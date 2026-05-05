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

// @MX:ANCHOR: [AUTO] executeStep — public API boundary for step execution in 510(k) workflow
// @MX:REASON: fan_in >= 3: workflow runner, tests, and future async worker all call this

// @MX:TODO: [AUTO] Beta scaffold — step returns synthetic outputs. Replace with real LLM calls.
// @MX:SPEC SPEC-REGULA-QUALITY-001 (REQ-QUAL-011)
/** Step execution for the submission drafter workflow (Beta scaffold). */
export async function executeStep(step: string, _ctx: StepExecutionContext): Promise<StepResult> {
  const completedAt = new Date().toISOString();

  switch (step) {
    case 'device_classification':
      return {
        stepName: step,
        output: { classification: 'Class II', regulatoryPath: '510(k)' },
        confidenceScores: [{ source: 'llm', score: 0.92, weight: 1 }],
        completedAt,
      };

    case 'predicate_search':
      return {
        stepName: step,
        output: { predicateDevices: [], searchStrategy: 'semantic' },
        confidenceScores: [{ source: 'llm', score: 0.85, weight: 1 }],
        completedAt,
      };

    case 'substantial_equivalence':
      return {
        stepName: step,
        output: { equivalent: true, rationale: 'Same intended use' },
        confidenceScores: [{ source: 'llm', score: 0.78, weight: 1 }],
        completedAt,
      };

    case 'performance_summary':
      return {
        stepName: step,
        output: { testingRequired: ['biocompatibility', 'electrical safety'] },
        confidenceScores: [{ source: 'llm', score: 0.88, weight: 1 }],
        completedAt,
      };

    case 'labeling_review':
      return {
        stepName: step,
        output: { compliant: true, issues: [] },
        confidenceScores: [{ source: 'llm', score: 0.95, weight: 1 }],
        completedAt,
      };

    case 'submission_assembly':
      return {
        stepName: step,
        output: { sectionsGenerated: 6, totalPages: 42 },
        confidenceScores: [{ source: 'llm', score: 0.91, weight: 1 }],
        completedAt,
      };

    default:
      throw new UnknownStepError(step);
  }
}

/** Aggregates all step results into a summary. */
// @MX:NOTE [AUTO] _mock flag — TASK-003: every workflow summary is currently
// produced by mock executeStep implementations. The flag makes downstream
// consumers (UI, audit log, API responses) able to mark/disclose simulated
// output until a real executor lands.
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
