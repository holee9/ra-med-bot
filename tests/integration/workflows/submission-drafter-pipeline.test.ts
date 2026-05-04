import { describe, it, expect } from 'vitest';
import { SUBMISSION_DRAFTER_STEPS, getNextStep } from '../../../lib/workflows/submission-drafter/steps';
import {
  executeStep,
  buildWorkflowSummary,
  type StepResult,
} from '../../../lib/workflows/submission-drafter/executor';
import { aggregateScores, requiresHumanReview } from '../../../lib/workflows/common/confidence-aggregator';
import { SubmissionDrafterInputSchema } from '../../../lib/workflows/types';

const BASE_CTX = {
  workflowRunId: 'run-001',
  input: {},
  previousResults: [] as StepResult[],
};

describe('Submission Drafter — full pipeline integration', () => {
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
  });

  it('workflow summary requiresReview is boolean', async () => {
    const results: StepResult[] = [];
    for (const step of SUBMISSION_DRAFTER_STEPS) {
      results.push(await executeStep(step, { ...BASE_CTX, previousResults: results }));
    }

    const summary = buildWorkflowSummary(results);
    expect(typeof summary.requiresReview).toBe('boolean');
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
