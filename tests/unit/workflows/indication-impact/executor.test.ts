import { describe, it, expect } from 'vitest';
import {
  executeStep,
  buildWorkflowSummary,
  UnknownStepError,
  type StepResult,
} from '@/lib/workflows/indication-impact/executor';

describe('indication-impact/executor', () => {
  describe('executeStep', () => {
    it('returns StepResult for indication_comparison', async () => {
      const ctx = {
        workflowRunId: 'run-001',
        input: { current_indication: 'Test indication', proposed_indication: 'New indication' },
        previousResults: [],
      };
      const result = await executeStep('indication_comparison', ctx);

      expect(result.stepName).toBe('indication_comparison');
      expect(result.output).toMatchObject({
        changeType: 'expansion',
        riskLevel: 'moderate',
        similarityScore: 0.65,
      });
      expect(result.confidenceScores).toHaveLength(1);
      expect(result.confidenceScores[0]).toMatchObject({
        source: 'llm',
        score: 0.88,
        weight: 1,
      });
      expect(result.completedAt).toBeDefined();
      expect(new Date(result.completedAt).toISOString()).toBe(result.completedAt);
    });

    it('returns StepResult for impact_report_generation', async () => {
      const ctx = { workflowRunId: 'run-001', input: {}, previousResults: [] };
      const result = await executeStep('impact_report_generation', ctx);

      expect(result.stepName).toBe('impact_report_generation');
      expect(result.output).toMatchObject({
        reportSections: 5,
        executiveSummaryWordCount: 800,
      });
      expect(result.confidenceScores).toContainEqual(
        expect.objectContaining({ source: 'llm', score: 0.93, weight: 1 }),
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
        makeResult('indication_comparison', 0.88),
        makeResult('regulatory_pathway_assessment', 0.84),
        makeResult('predicate_impact_analysis', 0.79),
        makeResult('clinical_data_gap_analysis', 0.83),
        makeResult('market_specific_requirements', 0.90),
        makeResult('impact_report_generation', 0.93),
      ];

      const summary = buildWorkflowSummary(results);

      expect(summary.totalSteps).toBe(6);
      expect(summary.completedSteps).toBe(6);
      const expected = (0.88 + 0.84 + 0.79 + 0.83 + 0.90 + 0.93) / 6;
      expect(summary.overallConfidence).toBeCloseTo(expected, 5);
    });

    it('returns requiresReview=false when overallConfidence >= 0.7', () => {
      const results: StepResult[] = [
        makeResult('indication_comparison', 0.9),
        makeResult('regulatory_pathway_assessment', 0.9),
      ];

      const summary = buildWorkflowSummary(results);
      expect(summary.requiresReview).toBe(false);
    });

    it('returns requiresReview=true when overallConfidence < 0.7', () => {
      const results: StepResult[] = [
        makeResult('indication_comparison', 0.5),
        makeResult('regulatory_pathway_assessment', 0.5),
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
