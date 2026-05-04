import { describe, it, expect } from 'vitest';
import {
  executeStep,
  buildWorkflowSummary,
  UnknownStepError,
  type StepResult,
} from '@/lib/workflows/submission-drafter/executor';

describe('submission-drafter/executor', () => {
  describe('executeStep', () => {
    it('returns StepResult for device_classification', async () => {
      const ctx = {
        workflowRunId: 'run-001',
        input: { product_name: 'TestDevice' },
        previousResults: [],
      };
      const result = await executeStep('device_classification', ctx);

      expect(result.stepName).toBe('device_classification');
      expect(result.output).toMatchObject({
        classification: 'Class II',
        regulatoryPath: '510(k)',
      });
      expect(result.confidenceScores).toHaveLength(1);
      expect(result.confidenceScores[0]).toMatchObject({
        source: 'llm',
        score: 0.92,
        weight: 1,
      });
      expect(result.completedAt).toBeDefined();
      expect(new Date(result.completedAt).toISOString()).toBe(result.completedAt);
    });

    it('returns StepResult for predicate_search', async () => {
      const ctx = { workflowRunId: 'run-001', input: {}, previousResults: [] };
      const result = await executeStep('predicate_search', ctx);

      expect(result.stepName).toBe('predicate_search');
      expect(result.output).toMatchObject({
        predicateDevices: [],
        searchStrategy: 'semantic',
      });
      expect(result.confidenceScores).toContainEqual(
        expect.objectContaining({ source: 'llm', score: 0.85, weight: 1 }),
      );
    });

    it('returns StepResult for substantial_equivalence', async () => {
      const ctx = { workflowRunId: 'run-001', input: {}, previousResults: [] };
      const result = await executeStep('substantial_equivalence', ctx);

      expect(result.stepName).toBe('substantial_equivalence');
      expect(result.output).toMatchObject({
        equivalent: true,
        rationale: 'Same intended use',
      });
      expect(result.confidenceScores).toContainEqual(
        expect.objectContaining({ score: 0.78 }),
      );
    });

    it('returns StepResult for performance_summary', async () => {
      const ctx = { workflowRunId: 'run-001', input: {}, previousResults: [] };
      const result = await executeStep('performance_summary', ctx);

      expect(result.stepName).toBe('performance_summary');
      expect(result.output).toMatchObject({
        testingRequired: ['biocompatibility', 'electrical safety'],
      });
      expect(result.confidenceScores).toContainEqual(
        expect.objectContaining({ score: 0.88 }),
      );
    });

    it('returns StepResult for labeling_review', async () => {
      const ctx = { workflowRunId: 'run-001', input: {}, previousResults: [] };
      const result = await executeStep('labeling_review', ctx);

      expect(result.stepName).toBe('labeling_review');
      expect(result.output).toMatchObject({
        compliant: true,
        issues: [],
      });
      expect(result.confidenceScores).toContainEqual(
        expect.objectContaining({ score: 0.95 }),
      );
    });

    it('returns StepResult for submission_assembly', async () => {
      const ctx = { workflowRunId: 'run-001', input: {}, previousResults: [] };
      const result = await executeStep('submission_assembly', ctx);

      expect(result.stepName).toBe('submission_assembly');
      expect(result.output).toMatchObject({
        sectionsGenerated: 6,
        totalPages: 42,
      });
      expect(result.confidenceScores).toContainEqual(
        expect.objectContaining({ score: 0.91 }),
      );
    });

    it('throws UnknownStepError for an unknown step name', async () => {
      const ctx = { workflowRunId: 'run-001', input: {}, previousResults: [] };
      await expect(executeStep('nonexistent_step', ctx)).rejects.toThrow(UnknownStepError);
    });

    it('UnknownStepError is an instance of Error', async () => {
      const ctx = { workflowRunId: 'run-001', input: {}, previousResults: [] };
      await expect(executeStep('bad_step', ctx)).rejects.toBeInstanceOf(Error);
    });
  });

  describe('buildWorkflowSummary', () => {
    const makeResult = (stepName: string, score: number): StepResult => ({
      stepName,
      output: {},
      confidenceScores: [{ source: 'llm', score, weight: 1 }],
      completedAt: new Date().toISOString(),
    });

    it('calculates overallConfidence as weighted average of all step scores', () => {
      const results: StepResult[] = [
        makeResult('device_classification', 0.92),
        makeResult('predicate_search', 0.85),
        makeResult('substantial_equivalence', 0.78),
        makeResult('performance_summary', 0.88),
        makeResult('labeling_review', 0.95),
        makeResult('submission_assembly', 0.91),
      ];

      const summary = buildWorkflowSummary(results);

      expect(summary.totalSteps).toBe(6);
      expect(summary.completedSteps).toBe(6);
      // average of all 6 scores
      const expected = (0.92 + 0.85 + 0.78 + 0.88 + 0.95 + 0.91) / 6;
      expect(summary.overallConfidence).toBeCloseTo(expected, 5);
    });

    it('always requires human review even when overallConfidence >= 0.7', () => {
      const results: StepResult[] = [
        makeResult('device_classification', 0.9),
        makeResult('predicate_search', 0.9),
      ];

      const summary = buildWorkflowSummary(results);
      expect(summary.requiresReview).toBe(true);
    });

    it('returns requiresReview=true when overallConfidence < 0.7', () => {
      const results: StepResult[] = [
        makeResult('device_classification', 0.5),
        makeResult('predicate_search', 0.5),
      ];

      const summary = buildWorkflowSummary(results);
      expect(summary.requiresReview).toBe(true);
    });

    it('handles empty results array', () => {
      const summary = buildWorkflowSummary([]);
      expect(summary.totalSteps).toBe(0);
      expect(summary.completedSteps).toBe(0);
      expect(summary.overallConfidence).toBe(0);
    });
  });
});
