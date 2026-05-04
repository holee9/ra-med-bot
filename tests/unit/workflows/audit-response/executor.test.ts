import { describe, it, expect } from 'vitest';
import {
  executeStep,
  buildWorkflowSummary,
  UnknownStepError,
  type StepResult,
} from '@/lib/workflows/audit-response/executor';

describe('audit-response/executor', () => {
  describe('executeStep', () => {
    it('returns StepResult for deficiency_analysis', async () => {
      const ctx = {
        workflowRunId: 'test-run-id',
        input: {},
        previousResults: [],
      };

      const result = await executeStep('deficiency_analysis', ctx);

      expect(result.stepName).toBe('deficiency_analysis');
      expect(result.output).toMatchObject({
        deficiencyCount: 3,
        severity: 'major',
        categories: expect.arrayContaining(['CAPA', 'training', 'documentation']),
      });
      expect(result.confidenceScores).toHaveLength(1);
      expect(result.confidenceScores[0]?.score).toBe(0.89);
      expect(result.completedAt).toBeDefined();
    });

    it('returns StepResult for legal_review_gate with handoffId in output', async () => {
      const ctx = {
        workflowRunId: 'test-run-id',
        input: {},
        previousResults: [],
      };

      const result = await executeStep('legal_review_gate', ctx);

      expect(result.stepName).toBe('legal_review_gate');
      expect(result.output).toMatchObject({
        status: 'pending_human_review',
      });
      expect(typeof result.output.handoffId).toBe('string');
      expect(result.output.handoffId).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
      );
      expect(result.confidenceScores[0]?.score).toBe(1.0);
    });

    it('throws UnknownStepError for unknown step', async () => {
      const ctx = {
        workflowRunId: 'test-run-id',
        input: {},
        previousResults: [],
      };

      await expect(executeStep('nonexistent_step', ctx)).rejects.toThrow(UnknownStepError);
      await expect(executeStep('nonexistent_step', ctx)).rejects.toThrow(
        'Unknown audit response step: nonexistent_step',
      );
    });
  });

  describe('buildWorkflowSummary', () => {
    it('calculates overallConfidence from step results', () => {
      const results: StepResult[] = [
        {
          stepName: 'deficiency_analysis',
          output: {},
          confidenceScores: [{ source: 'llm', score: 0.89, weight: 1 }],
          completedAt: new Date().toISOString(),
        },
        {
          stepName: 'root_cause_identification',
          output: {},
          confidenceScores: [{ source: 'llm', score: 0.82, weight: 1 }],
          completedAt: new Date().toISOString(),
        },
      ];

      const summary = buildWorkflowSummary(results);

      expect(summary.totalSteps).toBe(2);
      expect(summary.completedSteps).toBe(2);
      expect(summary.overallConfidence).toBeGreaterThan(0);
      expect(summary.overallConfidence).toBeLessThanOrEqual(1);
      expect(summary.requiresReview).toBe(true);
    });

    it('returns zero confidence for empty results', () => {
      const summary = buildWorkflowSummary([]);

      expect(summary.totalSteps).toBe(0);
      expect(summary.completedSteps).toBe(0);
      expect(summary.overallConfidence).toBe(0);
      expect(summary.requiresReview).toBe(false);
    });
  });
});
