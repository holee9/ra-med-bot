import { describe, it, expect } from 'vitest';
import { AUDIT_RESPONSE_STEPS } from '../../../lib/workflows/audit-response/steps';
import {
  executeStep,
  buildWorkflowSummary,
  type StepResult,
} from '../../../lib/workflows/audit-response/executor';
import { AuditResponseInputSchema } from '../../../lib/workflows/types';

const BASE_CTX = {
  workflowRunId: 'run-audit-001',
  input: {},
  previousResults: [] as StepResult[],
};

describe('Audit Response — full pipeline integration', () => {
  it('executes all 6 steps in sequence', async () => {
    const results: StepResult[] = [];

    for (const step of AUDIT_RESPONSE_STEPS) {
      const result = await executeStep(step, {
        ...BASE_CTX,
        previousResults: results,
      });
      results.push(result);
    }

    expect(results).toHaveLength(6);
    expect(results.map((r) => r.stepName)).toEqual([...AUDIT_RESPONSE_STEPS]);
  });

  it('legal_review_gate step returns handoffId in output', async () => {
    const result = await executeStep('legal_review_gate', BASE_CTX);

    expect(result.output).toHaveProperty('handoffId');
    expect(typeof result.output.handoffId).toBe('string');
    expect((result.output.handoffId as string).length).toBeGreaterThan(0);
  });

  it('workflow summary has overallConfidence between 0 and 1', async () => {
    const results: StepResult[] = [];
    for (const step of AUDIT_RESPONSE_STEPS) {
      results.push(await executeStep(step, { ...BASE_CTX, previousResults: results }));
    }

    const summary = buildWorkflowSummary(results);
    expect(summary.overallConfidence).toBeGreaterThanOrEqual(0);
    expect(summary.overallConfidence).toBeLessThanOrEqual(1);
  });

  it('AuditResponseInputSchema rejects input_content shorter than 100 chars', () => {
    const result = AuditResponseInputSchema.safeParse({
      input_type: 'fda_483',
      input_format: 'text',
      input_content: 'Too short.',
      project_id: '00000000-0000-0000-0000-000000000002',
    });
    expect(result.success).toBe(false);
  });

  it('AuditResponseInputSchema accepts valid input with all fields', () => {
    const result = AuditResponseInputSchema.safeParse({
      input_type: 'fda_483',
      input_format: 'text',
      input_content:
        'During the inspection conducted on 2026-01-15, the following observations were noted: ' +
        'The CAPA system failed to identify root causes for recurring non-conformances. ' +
        'Training records for personnel involved in critical manufacturing operations were incomplete.',
      project_id: '00000000-0000-0000-0000-000000000002',
      establishment_fei: '1234567',
    });
    expect(result.success).toBe(true);
  });
});
