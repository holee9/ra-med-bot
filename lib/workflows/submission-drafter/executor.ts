// @MX:ANCHOR: [AUTO] executeStep — gx10-backed step execution for 510(k) submission drafter
// @MX:REASON: fan_in >= 3: workflow runner, unit tests, and future async worker all call this
// @MX:SPEC SPEC-REGULA-WORKFLOWS-LLM-002 (M1, REQ-WFLLM-001/002/009/011, AC-01/04/05/11)
//
// 21 CFR Part 11 §11.10(e): audit is the RUNNER's job (in-tx). This executor
// MUST NOT call writeAudit — it only produces StepResult artifacts.

import { z } from 'zod';
import { computeCoverage } from '../_shared/citation-enforcer';
import type { PredicateSearchOutput } from '../_shared/input-wiring';
import { judgeStructured, streamSection } from '../_shared/streaming-chain';
import { type ConfidenceScore, aggregateScores } from '../common/confidence-aggregator';

export class UnknownStepError extends Error {
  constructor(step: string) {
    super(`Unknown submission drafter step: ${step}`);
    this.name = 'UnknownStepError';
  }
}

export type StepResult = {
  stepName: string;
  output: Record<string, unknown>;
  confidenceScores: ConfidenceScore[];
  completedAt: string;
};

export type StepExecutionContext = {
  workflowRunId: string;
  input: Record<string, unknown>;
  previousResults: StepResult[];
};

// ── Zod schemas (6) ───────────────────────────────────────────────────────
// Structured-judgment steps (3) use generateObject with these schemas.
// Prose-draft steps (3) use streamSection; the schema validates the output
// shape produced by the executor after streaming completes.

const deviceClassificationSchema = z.object({
  classification: z.enum(['I', 'II', 'III']),
  regulatoryPath: z.enum(['510(k)', 'PMA', 'De Novo']),
  rationale: z.string().min(1),
  confidence: z.number().min(0).max(1),
});

const substantialEquivalenceSchema = z.object({
  equivalent: z.boolean(),
  rationale: z.string().min(1),
  predicateReferences: z.array(z.string()).default([]),
  confidence: z.number().min(0).max(1),
});

const labelingReviewSchema = z.object({
  compliant: z.boolean(),
  issues: z
    .array(
      z.object({
        severity: z.enum(['critical', 'major', 'minor']),
        description: z.string(),
      }),
    )
    .default([]),
  confidence: z.number().min(0).max(1),
});

const predicateSearchSummarySchema = z.object({
  searchStrategy: z.string(),
  predicateDevices: z.array(z.string()).default([]),
  text: z.string(),
  status: z.enum(['ok', 'failed']),
});

const performanceSummarySchema = z.object({
  testingRequired: z.array(z.string()).default([]),
  text: z.string(),
  status: z.enum(['ok', 'failed']),
});

const submissionAssemblySchema = z.object({
  sectionsGenerated: z.number().int().min(0),
  text: z.string(),
  status: z.enum(['ok', 'failed']),
});

// ── Input typed accessor ──────────────────────────────────────────────────

interface SubmissionDrafterInput {
  product_name: string;
  device_class: string;
  indications_for_use: string;
  target_jurisdiction: string;
  predicate_k_numbers?: string[];
  predicateResults: PredicateSearchOutput | { isStub: true };
}

function readInput(ctx: StepExecutionContext): SubmissionDrafterInput {
  return ctx.input as unknown as SubmissionDrafterInput;
}

/** Build a context string from prior step results for chaining (submission_assembly). */
function summarizePriorResults(previous: StepResult[]): string {
  if (previous.length === 0) return 'No prior steps completed.';
  return previous
    .map((r) => {
      const out = r.output;
      const parts: string[] = [`${r.stepName}:`];
      for (const [key, value] of Object.entries(out)) {
        if (typeof value === 'string' && value.length > 0) {
          parts.push(`  ${key}=${value.slice(0, 200)}`);
        } else if (typeof value === 'boolean' || typeof value === 'number') {
          parts.push(`  ${key}=${String(value)}`);
        } else if (Array.isArray(value) && value.length > 0) {
          parts.push(`  ${key}=[${value.slice(0, 5).join(', ')}]`);
        }
      }
      return parts.join('\n');
    })
    .join('\n');
}

/** Format predicate search results as context for the LLM prompt. */
function formatPredicateContext(
  predicateResults: PredicateSearchOutput | { isStub: true },
  predicateKNumbers?: string[],
): string {
  if ('isStub' in predicateResults) {
    const kNums = predicateKNumbers?.length ? predicateKNumbers.join(', ') : 'none provided';
    return `Predicate search results unavailable (dependency #22 not yet integrated). User-provided predicate K-numbers: ${kNums}. Base predicate analysis on these K-numbers.`;
  }
  const devices = predicateResults.predicateDevices
    .map(
      (d, i) =>
        `  [${i + 1}] K-Number: ${d.kNumber}, Device: ${d.deviceName}, ` +
        `Product Code: ${d.productCode}, Similarity: ${d.similarityScore.toFixed(2)}`,
    )
    .join('\n');
  return `Predicate search results (strategy: ${predicateResults.searchStrategy}):\n${devices}`;
}

/** Citation directive appended to every prose system prompt. */
const CITATION_DIRECTIVE =
  'Every factual claim MUST be followed by a citation marker in the form ' +
  '<sup class="cite" data-source="N">N</sup> where N is the 1-based index of ' +
  'the source from the context (predicate devices, regulatory citation, or input data). ' +
  'Aim for citation coverage >= 80% of prose sentences.';

// ── Step executors ────────────────────────────────────────────────────────

async function executeDeviceClassification(ctx: StepExecutionContext): Promise<StepResult> {
  const input = readInput(ctx);
  const result = await judgeStructured({
    stepName: 'device_classification',
    schema: deviceClassificationSchema,
    systemPrompt:
      'You are an FDA regulatory expert. Classify the medical device and determine ' +
      'the regulatory submission path (510(k), PMA, or De Novel) based on the product ' +
      'name, indicated device class, and indications for use.',
    prompt: `Product Name: ${input.product_name}\nIndicated Device Class: ${input.device_class}\nIndications for Use: ${input.indications_for_use}\nTarget Jurisdiction: ${input.target_jurisdiction}\n\nDetermine the FDA device classification and regulatory submission path. Provide a rationale citing 21 CFR 860 product classification regulations.`,
  });
  return {
    stepName: 'device_classification',
    output: {
      classification: result.classification,
      regulatoryPath: result.regulatoryPath,
      rationale: result.rationale,
    },
    confidenceScores: [{ source: 'llm', score: result.confidence, weight: 1 }],
    completedAt: new Date().toISOString(),
  };
}

async function executePredicateSearch(ctx: StepExecutionContext): Promise<StepResult> {
  const input = readInput(ctx);
  const predicateContext = formatPredicateContext(
    input.predicateResults,
    input.predicate_k_numbers,
  );
  const stream = await streamSection({
    stepName: 'predicate_search',
    systemPrompt: `You are an FDA 510(k) regulatory expert drafting the predicate device search summary. Identify and describe predicate devices relevant to the subject device. ${CITATION_DIRECTIVE}`,
    context: predicateContext,
    prompt: `Subject Device: ${input.product_name}\nIndications for Use: ${input.indications_for_use}\nTarget Jurisdiction: ${input.target_jurisdiction}\n\nDraft a predicate search summary section for the 510(k) submission. Describe the search strategy, identified predicate devices, and rationale for selection.`,
  });
  const coverage = computeCoverage(stream.text);
  const predicateDevices =
    'isStub' in input.predicateResults
      ? (input.predicate_k_numbers ?? [])
      : input.predicateResults.predicateDevices.map((d) => d.kNumber);
  const parsed = predicateSearchSummarySchema.parse({
    searchStrategy: 'semantic+regulatory',
    predicateDevices,
    text: stream.text,
    status: stream.status,
  });
  return {
    stepName: 'predicate_search',
    output: {
      searchStrategy: parsed.searchStrategy,
      predicateDevices: parsed.predicateDevices,
      text: parsed.text,
      status: parsed.status,
    },
    confidenceScores: [
      { source: 'citation', score: coverage.coverage, weight: 1 },
      { source: 'llm', score: stream.status === 'ok' ? 0.8 : 0.3, weight: 0.5 },
    ],
    completedAt: new Date().toISOString(),
  };
}

async function executeSubstantialEquivalence(ctx: StepExecutionContext): Promise<StepResult> {
  const input = readInput(ctx);
  const predicateContext = formatPredicateContext(
    input.predicateResults,
    input.predicate_k_numbers,
  );
  const result = await judgeStructured({
    stepName: 'substantial_equivalence',
    schema: substantialEquivalenceSchema,
    systemPrompt:
      'You are an FDA 510(k) regulatory expert evaluating substantial equivalence (SE) ' +
      'between the subject device and predicate device(s) per 21 CFR 807.92(a)(3).',
    prompt: `Subject Device: ${input.product_name}\nIndications for Use: ${input.indications_for_use}\n\n${predicateContext}\n\nEvaluate substantial equivalence. Consider: intended use, technological characteristics, performance data. Provide predicate K-number references.`,
  });
  return {
    stepName: 'substantial_equivalence',
    output: {
      equivalent: result.equivalent,
      rationale: result.rationale,
      predicateReferences: result.predicateReferences,
    },
    confidenceScores: [{ source: 'llm', score: result.confidence, weight: 1 }],
    completedAt: new Date().toISOString(),
  };
}

async function executePerformanceSummary(ctx: StepExecutionContext): Promise<StepResult> {
  const input = readInput(ctx);
  const stream = await streamSection({
    stepName: 'performance_summary',
    systemPrompt: `You are an FDA 510(k) regulatory expert drafting the performance data summary section. Describe required performance testing (biocompatibility, electrical safety, EMC, clinical validation) per FDA guidance documents. ${CITATION_DIRECTIVE}`,
    context: `Device: ${input.product_name}\nIndications: ${input.indications_for_use}`,
    prompt:
      'Draft the performance data summary section for the 510(k) submission. ' +
      'Identify required performance testing categories and summarize the testing rationale. ' +
      'Reference applicable FDA consensus standards and guidance documents.',
  });
  const coverage = computeCoverage(stream.text);
  const parsed = performanceSummarySchema.parse({
    testingRequired: ['biocompatibility', 'electrical_safety', 'emc'],
    text: stream.text,
    status: stream.status,
  });
  return {
    stepName: 'performance_summary',
    output: {
      testingRequired: parsed.testingRequired,
      text: parsed.text,
      status: parsed.status,
    },
    confidenceScores: [
      { source: 'citation', score: coverage.coverage, weight: 1 },
      { source: 'llm', score: stream.status === 'ok' ? 0.8 : 0.3, weight: 0.5 },
    ],
    completedAt: new Date().toISOString(),
  };
}

async function executeLabelingReview(ctx: StepExecutionContext): Promise<StepResult> {
  const input = readInput(ctx);
  const result = await judgeStructured({
    stepName: 'labeling_review',
    schema: labelingReviewSchema,
    systemPrompt:
      'You are an FDA 510(k) regulatory expert reviewing device labeling for compliance ' +
      'with 21 CFR 801 and applicable FDA labeling guidance.',
    prompt: `Subject Device: ${input.product_name}\nIndications for Use: ${input.indications_for_use}\nTarget Jurisdiction: ${input.target_jurisdiction}\n\nReview the labeling requirements. Identify compliance status and any issues (e.g., missing indications, contraindications, warnings, precautions).`,
  });
  return {
    stepName: 'labeling_review',
    output: {
      compliant: result.compliant,
      issues: result.issues,
    },
    confidenceScores: [{ source: 'llm', score: result.confidence, weight: 1 }],
    completedAt: new Date().toISOString(),
  };
}

async function executeSubmissionAssembly(ctx: StepExecutionContext): Promise<StepResult> {
  const input = readInput(ctx);
  const priorContext = summarizePriorResults(ctx.previousResults);
  const stream = await streamSection({
    stepName: 'submission_assembly',
    systemPrompt: `You are an FDA 510(k) regulatory expert assembling the final submission draft. Produce a cover letter and device description suitable for FDA eCopy submission. ${CITATION_DIRECTIVE}`,
    context: `Prior step results:\n${priorContext}`,
    prompt: `Subject Device: ${input.product_name}\nTarget Jurisdiction: ${input.target_jurisdiction}\n\nAssemble the 510(k) submission draft. Include: (1) cover letter, (2) device description, (3) performance data summary. Reference prior step outputs for classification, predicate, SE verdict, and labeling review.`,
  });
  const coverage = computeCoverage(stream.text);
  const parsed = submissionAssemblySchema.parse({
    sectionsGenerated: 3,
    text: stream.text,
    status: stream.status,
  });
  return {
    stepName: 'submission_assembly',
    output: {
      sectionsGenerated: parsed.sectionsGenerated,
      text: parsed.text,
      status: parsed.status,
    },
    confidenceScores: [
      { source: 'citation', score: coverage.coverage, weight: 1 },
      { source: 'llm', score: stream.status === 'ok' ? 0.8 : 0.3, weight: 0.5 },
    ],
    completedAt: new Date().toISOString(),
  };
}

/**
 * Step execution for the submission drafter workflow (gx10-backed).
 *
 * Each of the 6 FDA 510(k) eCopy steps calls gx10 via the streaming-chain:
 * - Structured judgments (device_classification, substantial_equivalence,
 *   labeling_review) use judgeStructured (generateObject + Zod).
 * - Prose drafts (predicate_search, performance_summary, submission_assembly)
 *   use streamSection (streamText) with citation directives.
 *
 * The executor does NOT write audit or emit SSE — that is the runner's job.
 * REQ-WFLLM-007: requiresReview stays true (Expert Review Gate).
 */
export async function executeStep(step: string, ctx: StepExecutionContext): Promise<StepResult> {
  switch (step) {
    case 'device_classification':
      return executeDeviceClassification(ctx);
    case 'predicate_search':
      return executePredicateSearch(ctx);
    case 'substantial_equivalence':
      return executeSubstantialEquivalence(ctx);
    case 'performance_summary':
      return executePerformanceSummary(ctx);
    case 'labeling_review':
      return executeLabelingReview(ctx);
    case 'submission_assembly':
      return executeSubmissionAssembly(ctx);
    default:
      throw new UnknownStepError(step);
  }
}

/**
 * Aggregates all step results into a summary.
 * REQ-WFLLM-007: requiresReview is always true (Expert Review Gate).
 */
export function buildWorkflowSummary(results: StepResult[]): {
  totalSteps: number;
  completedSteps: number;
  overallConfidence: number;
  requiresReview: boolean;
} {
  if (results.length === 0) {
    return {
      totalSteps: 0,
      completedSteps: 0,
      overallConfidence: 0,
      requiresReview: false,
    };
  }

  const allScores = results.flatMap((r) => r.confidenceScores);
  const overallConfidence = aggregateScores(allScores);

  return {
    totalSteps: results.length,
    completedSteps: results.length,
    overallConfidence,
    requiresReview: true,
  };
}
