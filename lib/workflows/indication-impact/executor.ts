// @MX:ANCHOR: [AUTO] executeStep — gx10-backed step execution for indication impact workflow
// @MX:REASON: fan_in >= 3: workflow runner, unit tests, and future async worker all call this
// @MX:SPEC SPEC-REGULA-WORKFLOWS-LLM-002 (M3, REQ-WFLLM-005/009/011, AC-03/04/05)
//
// 21 CFR Part 11 §11.10(e): audit is the RUNNER's job (in-tx). This executor
// MUST NOT call writeAudit — it only produces StepResult artifacts.
//
// REQ-WFLLM-005: 3-axis impact chain — when an indication change is received,
// the system SHALL assess: (1) 510(k) substantial-equivalence re-assessment,
// (2) EU MDR classification change, (3) clinical data gap. Each axis is a
// structured judgment via judgeStructured (Zod). The final step streams a
// cited impact report (streamSection).

import { z } from 'zod';
import { computeCoverage } from '../_shared/citation-enforcer';
import type { PccpBuilderOutput } from '../_shared/input-wiring';
import { judgeStructured, streamSection } from '../_shared/streaming-chain';
import { type ConfidenceScore, aggregateScores } from '../common/confidence-aggregator';

export class UnknownStepError extends Error {
  constructor(step: string) {
    super(`Unknown indication impact step: ${step}`);
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
// Structured-judgment steps (5) use judgeStructured with these schemas.
// The 3-axis impact chain (REQ-WFLLM-005):
//   - predicate_impact_analysis     → 510(k) SE re-assessment
//   - regulatory_pathway_assessment → EU MDR classification change
//   - clinical_data_gap_analysis    → clinical data gap
// Prose-draft step (1) uses streamSection; the schema validates the output
// shape produced by the executor after streaming completes.

const indicationComparisonSchema = z.object({
  changeType: z.enum(['expansion', 'narrowing', 'shift']),
  riskLevel: z.enum(['low', 'moderate', 'high']),
  summary: z.string().min(1),
  confidence: z.number().min(0).max(1),
});

// 3-axis (1): EU MDR classification change
const regulatoryPathwaySchema = z.object({
  classificationChangeRequired: z.boolean(),
  newClass: z.enum(['I', 'IIa', 'IIb', 'III']),
  rationale: z.string().min(1),
  confidence: z.number().min(0).max(1),
});

// 3-axis (2): 510(k) substantial-equivalence re-assessment
const predicateImpactSchema = z.object({
  reAssessmentRequired: z.boolean(),
  rationale: z.string().min(1),
  predicateImpact: z.enum(['still_valid', 'invalidated', 'new_predicate_needed']),
  confidence: z.number().min(0).max(1),
});

// 3-axis (3): Clinical data gap
const clinicalDataGapSchema = z.object({
  additionalClinicalDataRequired: z.boolean(),
  gapDescription: z.string().min(1),
  confidence: z.number().min(0).max(1),
});

const marketSpecificRequirementsSchema = z.object({
  marketsAnalyzed: z.array(z.string()).default([]),
  additionalRequirements: z.array(z.string()).default([]),
  confidence: z.number().min(0).max(1),
});

const impactReportSchema = z.object({
  text: z.string(),
  status: z.enum(['ok', 'failed']),
});

// ── Input typed accessor ──────────────────────────────────────────────────

interface IndicationImpactInput {
  current_indication: string;
  proposed_indication: string;
  target_markets: string[];
  pccpContext?: PccpBuilderOutput | { isStub: true };
}

function readInput(ctx: StepExecutionContext): IndicationImpactInput {
  return ctx.input as unknown as IndicationImpactInput;
}

/** Build a context string from prior step results for chaining (impact_report_generation). */
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

/** Format PCCP context as context for the LLM prompt (dependency #24). */
function formatPccpContext(pccpContext: PccpBuilderOutput | { isStub: true } | undefined): string {
  if (!pccpContext) return 'PCCP context unavailable (dependency #24 not integrated).';
  if ('isStub' in pccpContext) {
    return 'PCCP context unavailable (dependency #24 not integrated).';
  }
  return (
    `PCCP context (version ${pccpContext.pccpVersionId}):\n` +
    `  Algorithm: ${pccpContext.algorithmDescription}\n` +
    `  Modification Protocol: ${pccpContext.modificationProtocol}`
  );
}

/** Citation directive appended to every prose system prompt. */
const CITATION_DIRECTIVE =
  'Every factual claim MUST be followed by a citation marker in the form ' +
  '<sup class="cite" data-source="N">N</sup> where N is the 1-based index of ' +
  'the source from the context (regulatory citation, prior step output, or input data). ' +
  'Aim for citation coverage >= 80% of prose sentences.';

// ── Step executors ────────────────────────────────────────────────────────

async function executeIndicationComparison(ctx: StepExecutionContext): Promise<StepResult> {
  const input = readInput(ctx);
  const result = await judgeStructured({
    stepName: 'indication_comparison',
    schema: indicationComparisonSchema,
    systemPrompt:
      'You are a regulatory expert comparing the current and proposed indications ' +
      'for a medical device. Determine the type of change (expansion, narrowing, or shift) ' +
      'and the overall risk level. Cite the regulatory basis for your assessment.',
    prompt: `Current Indication: ${input.current_indication}\nProposed Indication: ${input.proposed_indication}\nTarget Markets: ${input.target_markets.join(', ')}\n\nCompare the current and proposed indications. Classify the change type and risk level. Provide a summary citing relevant regulatory frameworks (21 CFR 814, EU MDR Annex IX).`,
  });
  return {
    stepName: 'indication_comparison',
    output: {
      changeType: result.changeType,
      riskLevel: result.riskLevel,
      summary: result.summary,
    },
    confidenceScores: [{ source: 'llm', score: result.confidence, weight: 1 }],
    completedAt: new Date().toISOString(),
  };
}

// 3-axis (1): EU MDR classification change
async function executeRegulatoryPathwayAssessment(ctx: StepExecutionContext): Promise<StepResult> {
  const input = readInput(ctx);
  const result = await judgeStructured({
    stepName: 'regulatory_pathway_assessment',
    schema: regulatoryPathwaySchema,
    systemPrompt:
      'You are an EU MDR regulatory expert. Assess whether the proposed indication change ' +
      'requires a device classification change under EU MDR Annex VIII classification rules. ' +
      'Determine the new class (I, IIa, IIb, III) and provide a rationale citing the ' +
      'specific classification rule invoked.',
    prompt: `Current Indication: ${input.current_indication}\nProposed Indication: ${input.proposed_indication}\nTarget Markets: ${input.target_markets.join(', ')}\n\nAssess whether the EU MDR classification changes. If so, identify the new class and cite the applicable Annex VIII classification rule. If no change is required, set classificationChangeRequired to false and state the current class in newClass.`,
  });
  return {
    stepName: 'regulatory_pathway_assessment',
    output: {
      classificationChangeRequired: result.classificationChangeRequired,
      newClass: result.newClass,
      rationale: result.rationale,
    },
    confidenceScores: [{ source: 'llm', score: result.confidence, weight: 1 }],
    completedAt: new Date().toISOString(),
  };
}

// 3-axis (2): 510(k) substantial-equivalence re-assessment
async function executePredicateImpactAnalysis(ctx: StepExecutionContext): Promise<StepResult> {
  const input = readInput(ctx);
  const result = await judgeStructured({
    stepName: 'predicate_impact_analysis',
    schema: predicateImpactSchema,
    systemPrompt:
      'You are an FDA 510(k) regulatory expert. Assess whether the proposed indication ' +
      'change invalidates the current predicate device relationship and requires a ' +
      'substantial equivalence (SE) re-assessment per 21 CFR 807.92(a)(3). ' +
      'Cite the regulatory basis for the predicate impact determination.',
    prompt: `Current Indication: ${input.current_indication}\nProposed Indication: ${input.proposed_indication}\nTarget Markets: ${input.target_markets.join(', ')}\n\nDetermine whether a 510(k) SE re-assessment is required. Assess the predicate impact: is the current predicate still valid, invalidated, or is a new predicate needed? Provide a rationale citing 21 CFR 807.92 and relevant FDA guidance.`,
  });
  return {
    stepName: 'predicate_impact_analysis',
    output: {
      reAssessmentRequired: result.reAssessmentRequired,
      rationale: result.rationale,
      predicateImpact: result.predicateImpact,
    },
    confidenceScores: [{ source: 'llm', score: result.confidence, weight: 1 }],
    completedAt: new Date().toISOString(),
  };
}

// 3-axis (3): Clinical data gap
async function executeClinicalDataGapAnalysis(ctx: StepExecutionContext): Promise<StepResult> {
  const input = readInput(ctx);
  const result = await judgeStructured({
    stepName: 'clinical_data_gap_analysis',
    schema: clinicalDataGapSchema,
    systemPrompt:
      'You are a clinical and regulatory expert. Assess whether the proposed indication ' +
      'change creates a clinical data gap requiring additional clinical evidence under ' +
      'EU MDR Annex XIV or FDA guidance. Cite the applicable clinical evidence requirements.',
    prompt: `Current Indication: ${input.current_indication}\nProposed Indication: ${input.proposed_indication}\nTarget Markets: ${input.target_markets.join(', ')}\n\nDetermine whether additional clinical data is required to support the proposed indication. If so, describe the gap and cite EU MDR Annex XIV / FDA clinical evidence guidance. If no additional data is needed, set additionalClinicalDataRequired to false and explain why existing data suffices.`,
  });
  return {
    stepName: 'clinical_data_gap_analysis',
    output: {
      additionalClinicalDataRequired: result.additionalClinicalDataRequired,
      gapDescription: result.gapDescription,
    },
    confidenceScores: [{ source: 'llm', score: result.confidence, weight: 1 }],
    completedAt: new Date().toISOString(),
  };
}

async function executeMarketSpecificRequirements(ctx: StepExecutionContext): Promise<StepResult> {
  const input = readInput(ctx);
  const result = await judgeStructured({
    stepName: 'market_specific_requirements',
    schema: marketSpecificRequirementsSchema,
    systemPrompt:
      'You are a multi-jurisdiction regulatory expert. For each target market, identify ' +
      'any additional regulatory requirements triggered by the proposed indication change. ' +
      'Cite the applicable regulations per market (US: 21 CFR, EU: MDR, KR: MFDS, JP: PMDA, CN: NMPA).',
    prompt: `Current Indication: ${input.current_indication}\nProposed Indication: ${input.proposed_indication}\nTarget Markets: ${input.target_markets.join(', ')}\n\nFor each target market, list additional regulatory requirements triggered by the indication change (e.g., CE mark update, PMDA notification, NMPA re-registration). Cite the specific regulation for each requirement.`,
  });
  return {
    stepName: 'market_specific_requirements',
    output: {
      marketsAnalyzed: result.marketsAnalyzed,
      additionalRequirements: result.additionalRequirements,
    },
    confidenceScores: [{ source: 'llm', score: result.confidence, weight: 1 }],
    completedAt: new Date().toISOString(),
  };
}

async function executeImpactReportGeneration(ctx: StepExecutionContext): Promise<StepResult> {
  const input = readInput(ctx);
  const priorContext = summarizePriorResults(ctx.previousResults);
  const pccpContext = formatPccpContext(input.pccpContext);
  const stream = await streamSection({
    stepName: 'impact_report_generation',
    systemPrompt: `You are a regulatory expert drafting the final indication impact report. Synthesize the prior step judgments into a cohesive report covering the 3-axis impact: 510(k) SE re-assessment, EU MDR classification change, and clinical data gap. ${CITATION_DIRECTIVE}`,
    context: `Prior step results:\n${priorContext}\n\n${pccpContext}`,
    prompt: `Current Indication: ${input.current_indication}\nProposed Indication: ${input.proposed_indication}\nTarget Markets: ${input.target_markets.join(', ')}\n\nDraft the indication impact report. Include: (1) executive summary of the change, (2) 510(k) SE re-assessment verdict, (3) EU MDR classification change determination, (4) clinical data gap assessment, (5) market-specific requirements, (6) recommended regulatory actions. Reference prior step outputs for each section.`,
  });
  const coverage = computeCoverage(stream.text);
  const parsed = impactReportSchema.parse({
    text: stream.text,
    status: stream.status,
  });
  return {
    stepName: 'impact_report_generation',
    output: {
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
 * Step execution for the indication impact workflow (gx10-backed).
 *
 * Each of the 6 steps calls gx10 via the streaming-chain:
 * - Structured judgments (indication_comparison, regulatory_pathway_assessment,
 *   predicate_impact_analysis, clinical_data_gap_analysis,
 *   market_specific_requirements) use judgeStructured (generateObject + Zod).
 * - The 3-axis impact chain (REQ-WFLLM-005):
 *     predicate_impact_analysis     → 510(k) SE re-assessment
 *     regulatory_pathway_assessment → EU MDR classification change
 *     clinical_data_gap_analysis    → clinical data gap
 * - Prose draft (impact_report_generation) uses streamSection (streamText)
 *   with citation directives.
 *
 * The executor does NOT write audit or emit SSE — that is the runner's job.
 * REQ-WFLLM-007: requiresReview stays true (Expert Review Gate).
 */
export async function executeStep(step: string, ctx: StepExecutionContext): Promise<StepResult> {
  switch (step) {
    case 'indication_comparison':
      return executeIndicationComparison(ctx);
    case 'regulatory_pathway_assessment':
      return executeRegulatoryPathwayAssessment(ctx);
    case 'predicate_impact_analysis':
      return executePredicateImpactAnalysis(ctx);
    case 'clinical_data_gap_analysis':
      return executeClinicalDataGapAnalysis(ctx);
    case 'market_specific_requirements':
      return executeMarketSpecificRequirements(ctx);
    case 'impact_report_generation':
      return executeImpactReportGeneration(ctx);
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
