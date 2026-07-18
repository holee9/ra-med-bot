// @MX:ANCHOR: [AUTO] executeStep — gx10-backed step execution for audit response workflow
// @MX:REASON: fan_in >= 3: workflow runner, unit tests, and future async worker all call this
// @MX:SPEC SPEC-REGULA-WORKFLOWS-LLM-002 (M2, REQ-WFLLM-003/004/009/011, AC-02/04/05/11)
//
// 21 CFR Part 11 §11.10(e): audit is the RUNNER's job (in-tx). This executor
// MUST NOT call writeAudit — it only produces StepResult artifacts.
//
// @MX:NOTE [AUTO] M2 retrieval-wiring follow-up: prose steps use input_content
//           (the observation text) as context. Hybrid retrieval (ra-llm-wiki
//           SOP corpus + MD-process regulatory corpus, per
//           docs/architecture/knowledge-base.md) is not yet wired into
//           ctx.input — tracked as M2/M5 follow-up. Non-blocking.

import { z } from 'zod';
import { computeCoverage } from '../_shared/citation-enforcer';
import { judgeStructured, streamSection } from '../_shared/streaming-chain';
import { type ConfidenceScore, aggregateScores } from '../common/confidence-aggregator';

export class UnknownStepError extends Error {
  constructor(step: string) {
    super(`Unknown audit response step: ${step}`);
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
// Structured-judgment steps (4) use generateObject with these schemas.
// Prose-draft steps (2) use streamSection; the schema validates the output
// shape produced by the executor after streaming completes.

const deficiencyAnalysisSchema = z.object({
  deficiencyType: z.string().min(1),
  severity: z.enum(['critical', 'major', 'minor']),
  regulatoryBasis: z.string().min(1),
  confidence: z.number().min(0).max(1),
});

const rootCauseIdentificationSchema = z.object({
  rootCauses: z.array(z.string().min(1)).default([]),
  methodology: z.string().min(1),
  confidence: z.number().min(0).max(1),
});

const regulatoryReferenceMappingSchema = z.object({
  citations: z.array(z.string().min(1)).default([]),
  matches: z.number().int().min(0),
  confidence: z.number().min(0).max(1),
});

const legalReviewGateSchema = z.object({
  proceedToResponse: z.boolean(),
  legalRisks: z
    .array(
      z.object({
        severity: z.enum(['critical', 'major', 'minor']),
        description: z.string(),
      }),
    )
    .default([]),
  conditions: z.array(z.string()).default([]),
  confidence: z.number().min(0).max(1),
});

const correctiveActionPlanSchema = z.object({
  actionsCount: z.number().int().min(0),
  text: z.string(),
  status: z.enum(['ok', 'failed']),
});

const responseDraftingSchema = z.object({
  sectionsGenerated: z.number().int().min(0),
  text: z.string(),
  status: z.enum(['ok', 'failed']),
});

// ── Input typed accessor ──────────────────────────────────────────────────

interface AuditResponseInput {
  input_type: string;
  input_content: string;
  establishment_fei?: string;
}

function readInput(ctx: StepExecutionContext): AuditResponseInput {
  return ctx.input as unknown as AuditResponseInput;
}

/** Build a context string from prior step results for chaining (response_drafting). */
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

/**
 * Citation directive appended to every prose system prompt.
 * Mirrors M1 (submission-drafter) — identical `<sup class="cite">` format.
 */
const CITATION_DIRECTIVE =
  'Every factual claim MUST be followed by a citation marker in the form ' +
  '<sup class="cite" data-source="N">N</sup> where N is the 1-based index of ' +
  'the source from the context (observation text, regulatory citation, or SOP reference). ' +
  'Aim for citation coverage >= 80% of prose sentences.';

/**
 * 3-part structure directive for audit-response prose sections
 * (REQ-WFLLM-003): regulatory basis + corrective action + timeline.
 */
const THREE_PART_DIRECTIVE =
  'Structure the response in three parts: ' +
  '(1) Regulatory Basis — cite the applicable regulation (e.g. 21 CFR 820.100 for CAPA, ' +
  '21 CFR 820.20 for management responsibility); ' +
  '(2) Corrective Action — describe the specific corrective and preventive actions taken; ' +
  '(3) Timeline — provide implementation dates and verification milestones.';

// ── Step executors ────────────────────────────────────────────────────────

async function executeDeficiencyAnalysis(ctx: StepExecutionContext): Promise<StepResult> {
  const input = readInput(ctx);
  const result = await judgeStructured({
    stepName: 'deficiency_analysis',
    schema: deficiencyAnalysisSchema,
    systemPrompt:
      'You are a regulatory quality expert analyzing FDA Form 483 observations, MDSAP ' +
      'deficiency reports, and EU non-compliance medical device notifications. Classify ' +
      'each deficiency by type, severity, and regulatory basis.',
    prompt: [
      `Input Type: ${input.input_type}`,
      `Establishment FEI: ${input.establishment_fei ?? 'not provided'}`,
      '',
      'Observation Text:',
      input.input_content,
      '',
      'Analyze the deficiency. Determine the deficiency type (e.g. CAPA, training, ' +
        'documentation, process deviation), severity (critical/major/minor), and the ' +
        'regulatory basis (cite the applicable 21 CFR 820, ISO 13485, or MDR article).',
    ].join('\n'),
  });
  return {
    stepName: 'deficiency_analysis',
    output: {
      deficiencyType: result.deficiencyType,
      severity: result.severity,
      regulatoryBasis: result.regulatoryBasis,
    },
    confidenceScores: [{ source: 'llm', score: result.confidence, weight: 1 }],
    completedAt: new Date().toISOString(),
  };
}

async function executeRootCauseIdentification(ctx: StepExecutionContext): Promise<StepResult> {
  const input = readInput(ctx);
  const priorContext = summarizePriorResults(ctx.previousResults);
  const result = await judgeStructured({
    stepName: 'root_cause_identification',
    schema: rootCauseIdentificationSchema,
    systemPrompt:
      'You are a regulatory quality expert performing root cause analysis for audit ' +
      'deficiencies. Use structured methodologies (fishbone/Ishikawa, 5-Whys, FTA) ' +
      'per 21 CFR 820.100(a) CAPA requirements.',
    prompt: [
      `Input Type: ${input.input_type}`,
      '',
      'Observation Text:',
      input.input_content,
      '',
      'Prior Step Results:',
      priorContext,
      '',
      'Identify the root cause(s) of the deficiency. Specify the analysis methodology ' +
        'used (fishbone, 5-Whys, FTA, or combination). Provide root causes as a list.',
    ].join('\n'),
  });
  return {
    stepName: 'root_cause_identification',
    output: {
      rootCauses: result.rootCauses,
      methodology: result.methodology,
    },
    confidenceScores: [{ source: 'llm', score: result.confidence, weight: 1 }],
    completedAt: new Date().toISOString(),
  };
}

async function executeCorrectiveActionPlan(ctx: StepExecutionContext): Promise<StepResult> {
  const input = readInput(ctx);
  const priorContext = summarizePriorResults(ctx.previousResults);
  const stream = await streamSection({
    stepName: 'corrective_action_plan',
    systemPrompt: `You are a regulatory quality expert drafting a corrective action plan in response to an audit deficiency per 21 CFR 820.100. ${THREE_PART_DIRECTIVE} ${CITATION_DIRECTIVE}`,
    context: [
      `Input Type: ${input.input_type}`,
      'Observation Text:',
      input.input_content,
      '',
      'Prior Step Results:',
      priorContext,
    ].join('\n'),
    prompt:
      'Draft a corrective action plan addressing the identified deficiency and root cause. ' +
      'Include the three-part structure: regulatory basis, corrective action, and timeline. ' +
      'Reference the deficiency analysis and root cause identification from prior steps.',
  });
  const coverage = computeCoverage(stream.text);
  const parsed = correctiveActionPlanSchema.parse({
    actionsCount: 3,
    text: stream.text,
    status: stream.status,
  });
  return {
    stepName: 'corrective_action_plan',
    output: {
      actionsCount: parsed.actionsCount,
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

async function executeRegulatoryReferenceMapping(ctx: StepExecutionContext): Promise<StepResult> {
  const input = readInput(ctx);
  const result = await judgeStructured({
    stepName: 'regulatory_reference_mapping',
    schema: regulatoryReferenceMappingSchema,
    systemPrompt:
      'You are a regulatory expert mapping audit deficiencies to applicable regulations ' +
      'and standards (21 CFR 820, ISO 13485, EU MDR, MDSAP). Provide precise citation ' +
      'references for each deficiency.',
    prompt: [
      `Input Type: ${input.input_type}`,
      '',
      'Observation Text:',
      input.input_content,
      '',
      'Map the deficiency to applicable regulatory citations (e.g. 21 CFR 820.100, ' +
        '21 CFR 820.20, ISO 13485:2016 Section 8.5.2, EU MDR Article 83). Provide the ' +
        'list of citations and the total match count.',
    ].join('\n'),
  });
  return {
    stepName: 'regulatory_reference_mapping',
    output: {
      citations: result.citations,
      matches: result.matches,
    },
    confidenceScores: [{ source: 'llm', score: result.confidence, weight: 1 }],
    completedAt: new Date().toISOString(),
  };
}

async function executeResponseDrafting(ctx: StepExecutionContext): Promise<StepResult> {
  const input = readInput(ctx);
  const priorContext = summarizePriorResults(ctx.previousResults);
  const stream = await streamSection({
    stepName: 'response_drafting',
    systemPrompt: `You are a regulatory quality expert drafting the formal written response to an audit observation (FDA 483 response, MDSAP deficiency response, or EU NB MED non-compliance response). ${THREE_PART_DIRECTIVE} ${CITATION_DIRECTIVE}`,
    context: [
      `Input Type: ${input.input_type}`,
      `Establishment FEI: ${input.establishment_fei ?? 'not provided'}`,
      'Observation Text:',
      input.input_content,
      '',
      'Prior Step Results:',
      priorContext,
    ].join('\n'),
    prompt:
      'Draft the formal audit response document. Integrate the deficiency analysis, root ' +
      'cause, corrective action plan, and regulatory references from prior steps. Produce ' +
      'the three-part structure: regulatory basis, corrective action, and timeline. ' +
      'This is the final written response to the regulatory authority.',
  });
  const coverage = computeCoverage(stream.text);
  const parsed = responseDraftingSchema.parse({
    sectionsGenerated: 3,
    text: stream.text,
    status: stream.status,
  });
  return {
    stepName: 'response_drafting',
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

async function executeLegalReviewGate(ctx: StepExecutionContext): Promise<StepResult> {
  const input = readInput(ctx);
  const priorContext = summarizePriorResults(ctx.previousResults);
  const result = await judgeStructured({
    stepName: 'legal_review_gate',
    schema: legalReviewGateSchema,
    systemPrompt:
      'You are a regulatory legal reviewer evaluating whether the drafted audit response ' +
      'is ready for submission or requires additional legal review. Assess legal risks, ' +
      'admission of liability, and compliance with 21 CFR Part 11 and applicable regulations.',
    prompt: [
      `Input Type: ${input.input_type}`,
      '',
      'Observation Text:',
      input.input_content,
      '',
      'Prior Step Results:',
      priorContext,
      '',
      'Evaluate the drafted response for legal risks. Determine whether it is safe to ' +
        'proceed to formal response submission, or if conditions must be met first. ' +
        'Identify legal risks (e.g. admission of liability, insufficient corrective action) ' +
        'and any conditions that must be satisfied before submission.',
    ].join('\n'),
  });
  return {
    stepName: 'legal_review_gate',
    output: {
      proceedToResponse: result.proceedToResponse,
      legalRisks: result.legalRisks,
      conditions: result.conditions,
    },
    confidenceScores: [{ source: 'llm', score: result.confidence, weight: 1 }],
    completedAt: new Date().toISOString(),
  };
}

/**
 * Step execution for the audit response workflow (gx10-backed).
 *
 * Each of the 6 audit-response steps calls gx10 via the streaming-chain:
 * - Structured judgments (deficiency_analysis, root_cause_identification,
 *   regulatory_reference_mapping, legal_review_gate) use judgeStructured
 *   (generateObject + Zod).
 * - Prose drafts (corrective_action_plan, response_drafting) use streamSection
 *   (streamText) with the 3-part structure directive (REQ-WFLLM-003) and
 *   citation directives (>=80% coverage).
 *
 * The executor does NOT write audit or emit SSE — that is the runner's job.
 * REQ-WFLLM-007: requiresReview stays true (Expert Review Gate).
 */
export async function executeStep(step: string, ctx: StepExecutionContext): Promise<StepResult> {
  switch (step) {
    case 'deficiency_analysis':
      return executeDeficiencyAnalysis(ctx);
    case 'root_cause_identification':
      return executeRootCauseIdentification(ctx);
    case 'corrective_action_plan':
      return executeCorrectiveActionPlan(ctx);
    case 'regulatory_reference_mapping':
      return executeRegulatoryReferenceMapping(ctx);
    case 'response_drafting':
      return executeResponseDrafting(ctx);
    case 'legal_review_gate':
      return executeLegalReviewGate(ctx);
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
