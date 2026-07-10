// SPEC-REGULA-WORKFLOWS-LLM-002 — submission-drafter pipeline integration tests.
// M1-M3 rewrote executors from synthetic mock → real gx10 via _shared/streaming-chain
// (judgeStructured/streamSection). This test mocks streaming-chain at the executor
// boundary so the full pipeline (executeStep × 6 steps + buildWorkflowSummary) runs
// with controlled LLM output, asserting the NEW behavior: 6 steps run in sequence,
// summary has overallConfidence 0-1, requiresReview is boolean, _mock absent.
//
// Pattern: lib/workflows/submission-drafter/__tests__/executor.test.ts (vi.mock + vi.mocked).

import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../lib/workflows/_shared/streaming-chain', () => ({
  streamSection: vi.fn(),
  judgeStructured: vi.fn(),
  DEFAULT_STREAM_TIMEOUT_MS: 30_000,
  WorkflowLlmError: class WorkflowLlmError extends Error {
    readonly kind: 'timeout' | 'runtime' | 'schema';
    readonly stepName: string;
    constructor(kind: 'timeout' | 'runtime' | 'schema', stepName: string, message: string) {
      super(message);
      this.name = 'WorkflowLlmError';
      this.kind = kind;
      this.stepName = stepName;
    }
  },
}));

import { judgeStructured, streamSection } from '../../../lib/workflows/_shared/streaming-chain';
import {
  type StepResult,
  buildWorkflowSummary,
  executeStep,
} from '../../../lib/workflows/submission-drafter/executor';
import {
  SUBMISSION_DRAFTER_STEPS,
  getNextStep,
} from '../../../lib/workflows/submission-drafter/steps';
import { SubmissionDrafterInputSchema } from '../../../lib/workflows/types';

/** Citation-rich prose fixture (every sentence cited → coverage 1.0). */
const CITED_PROSE =
  'The predicate device K123456 has the same intended use.<sup class="cite" data-source="1">1</sup> ' +
  'Technological characteristics are substantially equivalent.<sup class="cite" data-source="2">2</sup> ' +
  'Performance data confirms equivalence.<sup class="cite" data-source="3">3</sup>';

/**
 * Dispatch mock responses by stepName. Structured-judgment steps (3) return
 * Zod-schema-shaped objects with `confidence`; prose-draft steps (3) return
 * `{ text, status }`. This lets the full 6-step pipeline run with controlled
 * output without a real gx10 call.
 */
function mockStreamingChain(): void {
  vi.mocked(judgeStructured).mockImplementation(async (params) => {
    switch (params.stepName) {
      case 'device_classification':
        return {
          classification: 'II',
          regulatoryPath: '510(k)',
          rationale: 'Non-invasive monitor under 21 CFR 870.2900.',
          confidence: 0.88,
        } as never;
      case 'substantial_equivalence':
        return {
          equivalent: true,
          rationale: 'Same intended use and technological characteristics.',
          predicateReferences: ['K123456'],
          confidence: 0.82,
        } as never;
      case 'labeling_review':
        return {
          compliant: true,
          issues: [],
          confidence: 0.9,
        } as never;
      default:
        throw new Error(`unexpected judgeStructured step: ${params.stepName}`);
    }
  });

  vi.mocked(streamSection).mockResolvedValue({ text: CITED_PROSE, status: 'ok' });
}

const BASE_CTX = {
  workflowRunId: 'run-001',
  input: {
    product_name: 'Cardiac Monitor X100',
    device_class: 'II',
    indications_for_use:
      'For continuous monitoring of cardiac rhythm in adult patients in clinical settings.',
    target_jurisdiction: 'US_FDA',
    predicate_k_numbers: ['K123456'],
    // predicateResults is required by the executor (dependency #22 stub path).
    // The input-wiring layer defaults this to { isStub: true } when absent;
    // integration tests call executeStep directly, so we provide it explicitly.
    predicateResults: { isStub: true },
  },
  previousResults: [] as StepResult[],
};

describe('Submission Drafter — full pipeline integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStreamingChain();
  });

  it('executes all 6 steps in sequence', async () => {
    const results: StepResult[] = [];

    for (const step of SUBMISSION_DRAFTER_STEPS) {
      const result = await executeStep(step, {
        ...BASE_CTX,
        previousResults: results,
      });
      results.push(result);
    }

    expect(results).toHaveLength(6);
    expect(results.map((r) => r.stepName)).toEqual([...SUBMISSION_DRAFTER_STEPS]);
  });

  it('workflow summary has overallConfidence between 0 and 1', async () => {
    const results: StepResult[] = [];
    for (const step of SUBMISSION_DRAFTER_STEPS) {
      results.push(await executeStep(step, { ...BASE_CTX, previousResults: results }));
    }

    const summary = buildWorkflowSummary(results);
    expect(summary.overallConfidence).toBeGreaterThanOrEqual(0);
    expect(summary.overallConfidence).toBeLessThanOrEqual(1);
    // AC-01 D4: _mock flag must be absent from the new summary.
    expect(summary).not.toHaveProperty('_mock');
  });

  it('workflow summary requiresReview is boolean', async () => {
    const results: StepResult[] = [];
    for (const step of SUBMISSION_DRAFTER_STEPS) {
      results.push(await executeStep(step, { ...BASE_CTX, previousResults: results }));
    }

    const summary = buildWorkflowSummary(results);
    expect(typeof summary.requiresReview).toBe('boolean');
    // Expert Review Gate: requiresReview stays true after a full pipeline run.
    expect(summary.requiresReview).toBe(true);
  });

  it('step sequence is correct via getNextStep', () => {
    const visited: string[] = [];
    let current: (typeof SUBMISSION_DRAFTER_STEPS)[number] | null = SUBMISSION_DRAFTER_STEPS[0];

    while (current !== null) {
      visited.push(current);
      current = getNextStep(current);
    }

    expect(visited).toEqual([...SUBMISSION_DRAFTER_STEPS]);
  });

  it('SubmissionDrafterInputSchema validates minimum valid input', () => {
    const result = SubmissionDrafterInputSchema.safeParse({
      product_name: 'My Device',
      device_class: 'II',
      indications_for_use: 'For use in patients requiring glucose monitoring.',
      target_jurisdiction: 'US_FDA',
      project_id: '00000000-0000-0000-0000-000000000001',
    });
    expect(result.success).toBe(true);
  });

  it('SubmissionDrafterInputSchema rejects predicate number with wrong format', () => {
    const result = SubmissionDrafterInputSchema.safeParse({
      product_name: 'My Device',
      device_class: 'II',
      indications_for_use: 'For use in patients requiring glucose monitoring.',
      target_jurisdiction: 'US_FDA',
      project_id: '00000000-0000-0000-0000-000000000001',
      predicate_k_numbers: ['K12345'], // 5 digits — should be 6
    });
    expect(result.success).toBe(false);
  });
});
