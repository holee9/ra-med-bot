import {
  aggregateScores,
  type ConfidenceScore,
} from '../common/confidence-aggregator';

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

// @MX:ANCHOR: [AUTO] executeStep — public API boundary for step execution in audit response workflow
// @MX:REASON: fan_in >= 3: workflow runner, tests, and future async worker all call this

/** Mock implementation of step execution for the audit response workflow. */
export async function executeStep(
  step: string,
  _ctx: StepExecutionContext,
): Promise<StepResult> {
  const completedAt = new Date().toISOString();

  switch (step) {
    case 'deficiency_analysis':
      return {
        stepName: step,
        output: {
          deficiencyCount: 3,
          severity: 'major',
          categories: ['CAPA', 'training', 'documentation'],
        },
        confidenceScores: [{ source: 'llm', score: 0.89, weight: 1 }],
        completedAt,
      };

    case 'root_cause_identification':
      return {
        stepName: step,
        output: { rootCauses: ['inadequate_training', 'process_gap'], methodology: 'fishbone' },
        confidenceScores: [{ source: 'llm', score: 0.82, weight: 1 }],
        completedAt,
      };

    case 'corrective_action_plan':
      return {
        stepName: step,
        output: { actions: 3, targetDate: '2026-08-01', owner: 'QA' },
        confidenceScores: [{ source: 'llm', score: 0.86, weight: 1 }],
        completedAt,
      };

    case 'regulatory_reference_mapping':
      return {
        stepName: step,
        output: { citations: ['21 CFR 820.100', '21 CFR 820.20'], matches: 2 },
        confidenceScores: [{ source: 'llm', score: 0.91, weight: 1 }],
        completedAt,
      };

    case 'response_drafting':
      return {
        stepName: step,
        output: { sectionsGenerated: 4, wordCount: 2400 },
        confidenceScores: [{ source: 'llm', score: 0.87, weight: 1 }],
        completedAt,
      };

    case 'legal_review_gate':
      return {
        stepName: step,
        output: { status: 'pending_human_review', handoffId: crypto.randomUUID() },
        confidenceScores: [{ source: 'system', score: 1.0, weight: 1 }],
        completedAt,
      };

    default:
      throw new UnknownStepError(step);
  }
}

/** Aggregates all step results into a summary. */
export function buildWorkflowSummary(results: StepResult[]): {
  totalSteps: number;
  completedSteps: number;
  overallConfidence: number;
  requiresReview: boolean;
} {
  if (results.length === 0) {
    return { totalSteps: 0, completedSteps: 0, overallConfidence: 0, requiresReview: false };
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
