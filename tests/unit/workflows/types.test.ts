import { describe, expect, it } from 'vitest';
import {
  AuditResponseInputSchema,
  IndicationImpactInputSchema,
  SubmissionDrafterInputSchema,
  WorkflowStatusSchema,
  WorkflowTypeSchema,
} from '../../../lib/workflows/types';

// RED: These tests should pass once implementation is in place
describe('WorkflowTypeSchema', () => {
  it('accepts valid workflow types', () => {
    expect(WorkflowTypeSchema.parse('submission_drafter')).toBe('submission_drafter');
    expect(WorkflowTypeSchema.parse('audit_response')).toBe('audit_response');
    expect(WorkflowTypeSchema.parse('indication_impact')).toBe('indication_impact');
  });
  it('rejects invalid workflow type', () => {
    expect(() => WorkflowTypeSchema.parse('invalid')).toThrow();
  });
});

describe('WorkflowStatusSchema', () => {
  it('accepts all 7 valid statuses', () => {
    const statuses = [
      'queued',
      'running',
      'paused',
      'pending_review',
      'approved',
      'rejected',
      'failed',
    ];
    for (const s of statuses) {
      expect(WorkflowStatusSchema.parse(s)).toBe(s);
    }
  });
});

describe('SubmissionDrafterInputSchema', () => {
  const valid = {
    product_name: 'GlucoMonitor Pro',
    device_class: 'II' as const,
    indications_for_use: 'For home blood glucose monitoring in adult patients',
    target_jurisdiction: 'US_FDA' as const,
    project_id: '123e4567-e89b-12d3-a456-426614174000',
  };
  it('accepts valid input', () => {
    expect(SubmissionDrafterInputSchema.parse(valid)).toBeDefined();
  });
  it('rejects short indications_for_use', () => {
    expect(() =>
      SubmissionDrafterInputSchema.parse({ ...valid, indications_for_use: 'short' }),
    ).toThrow();
  });
  it('validates K-number format in predicate_k_numbers', () => {
    expect(() =>
      SubmissionDrafterInputSchema.parse({ ...valid, predicate_k_numbers: ['INVALID'] }),
    ).toThrow();
    expect(
      SubmissionDrafterInputSchema.parse({ ...valid, predicate_k_numbers: ['K123456'] }),
    ).toBeDefined();
  });
  it('rejects more than 3 predicate K-numbers', () => {
    expect(() =>
      SubmissionDrafterInputSchema.parse({
        ...valid,
        predicate_k_numbers: ['K123456', 'K234567', 'K345678', 'K456789'],
      }),
    ).toThrow();
  });
});

describe('AuditResponseInputSchema', () => {
  const valid = {
    input_type: 'fda_483' as const,
    input_format: 'pdf' as const,
    input_content: 'A'.repeat(100),
    project_id: '123e4567-e89b-12d3-a456-426614174000',
  };
  it('accepts valid input', () => {
    expect(AuditResponseInputSchema.parse(valid)).toBeDefined();
  });
  it('rejects short input_content', () => {
    expect(() => AuditResponseInputSchema.parse({ ...valid, input_content: 'short' })).toThrow();
  });
});

describe('IndicationImpactInputSchema', () => {
  const valid = {
    project_id: '123e4567-e89b-12d3-a456-426614174000',
    current_indication: 'For adults with diabetes monitoring blood glucose',
    proposed_indication: 'For pediatric patients with type 1 diabetes',
    target_markets: ['US'] as const,
  };
  it('accepts valid input', () => {
    expect(IndicationImpactInputSchema.parse(valid)).toBeDefined();
  });
  it('rejects empty target_markets', () => {
    expect(() => IndicationImpactInputSchema.parse({ ...valid, target_markets: [] })).toThrow();
  });
  it('rejects more than 5 target_markets', () => {
    expect(() =>
      IndicationImpactInputSchema.parse({
        ...valid,
        target_markets: ['US', 'EU', 'KR', 'JP', 'CN', 'US'],
      }),
    ).toThrow();
  });
});
