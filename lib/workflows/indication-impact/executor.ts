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

// @MX:ANCHOR: [AUTO] executeStep — public API boundary for step execution in indication impact workflow
// @MX:REASON: fan_in >= 3: workflow runner, tests, and future async worker all call this

// @MX:TODO: [AUTO] Beta scaffold — step returns synthetic outputs. Replace with real LLM calls.
// @MX:SPEC SPEC-REGULA-QUALITY-001 (REQ-QUAL-011)
/** Step execution for the indication impact workflow (Beta scaffold). */
export async function executeStep(step: string, _ctx: StepExecutionContext): Promise<StepResult> {
  const completedAt = new Date().toISOString();

  switch (step) {
    case 'indication_comparison':
      return {
        stepName: step,
        output: { changeType: 'expansion', riskLevel: 'moderate', similarityScore: 0.65 },
        confidenceScores: [{ source: 'llm', score: 0.88, weight: 1 }],
        completedAt,
      };

    case 'regulatory_pathway_assessment':
      return {
        stepName: step,
        output: { pathway: '510(k)', newSubmissionRequired: true, estimatedTimeline: '6-9 months' },
        confidenceScores: [{ source: 'llm', score: 0.84, weight: 1 }],
        completedAt,
      };

    case 'predicate_impact_analysis':
      return {
        stepName: step,
        output: { predicateStillValid: false, newPredicateNeeded: true, suggestions: 1 },
        confidenceScores: [{ source: 'llm', score: 0.79, weight: 1 }],
        completedAt,
      };

    case 'clinical_data_gap_analysis':
      return {
        stepName: step,
        output: { gapCount: 2, criticalGaps: ['pediatric_data', 'long_term_followup'] },
        confidenceScores: [{ source: 'llm', score: 0.83, weight: 1 }],
        completedAt,
      };

    case 'market_specific_requirements':
      return {
        stepName: step,
        output: {
          marketsAnalyzed: 3,
          additionalRequirements: ['CE mark update', 'PMDA notification'],
        },
        confidenceScores: [{ source: 'llm', score: 0.9, weight: 1 }],
        completedAt,
      };

    case 'impact_report_generation':
      return {
        stepName: step,
        output: { reportSections: 5, executiveSummaryWordCount: 800 },
        confidenceScores: [{ source: 'llm', score: 0.93, weight: 1 }],
        completedAt,
      };

    default:
      throw new UnknownStepError(step);
  }
}

/** Aggregates all step results into a summary. */
// @MX:NOTE [AUTO] _mock flag — TASK-003: this summary is produced by mock
// executeStep implementations; consumers should disclose simulated output.
export function buildWorkflowSummary(results: StepResult[]): {
  totalSteps: number;
  completedSteps: number;
  overallConfidence: number;
  requiresReview: boolean;
  _mock: true;
} {
  if (results.length === 0) {
    return {
      totalSteps: 0,
      completedSteps: 0,
      overallConfidence: 0,
      requiresReview: false,
      _mock: true,
    };
  }

  const allScores = results.flatMap((r) => r.confidenceScores);
  const overallConfidence = aggregateScores(allScores);

  return {
    totalSteps: results.length,
    completedSteps: results.length,
    overallConfidence,
    requiresReview: true,
    _mock: true,
  };
}
