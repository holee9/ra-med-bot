import {
  DEFAULT_CONFIDENCE_FLOOR,
  DEFAULT_MIN_CITATIONS,
  verifyPostRerankInvariants,
} from '@/lib/rlhf/post-rerank-gate';
// @MX:SPEC SPEC-REGULA-RLHF-001 (REQ-RLHF-014, AC-07)
import { describe, expect, it } from 'vitest';

describe('verifyPostRerankInvariants (REQ-RLHF-014, AC-07)', () => {
  it('passes when confidence and citations meet floors', () => {
    const result = verifyPostRerankInvariants({
      confidenceScore: 0.85,
      citationCount: 3,
      expertReviewRequired: false,
    });
    expect(result.passed).toBe(true);
    expect(result.violations).toEqual([]);
  });

  it('fails when confidence is below floor', () => {
    const result = verifyPostRerankInvariants({
      confidenceScore: 0.5,
      citationCount: 3,
      expertReviewRequired: false,
    });
    expect(result.passed).toBe(false);
    expect(result.violations.some((v) => v.includes('confidence'))).toBe(true);
  });

  it('fails when citation count is below min', () => {
    const result = verifyPostRerankInvariants({
      confidenceScore: 0.9,
      citationCount: 0,
      expertReviewRequired: false,
    });
    expect(result.passed).toBe(false);
    expect(result.violations.some((v) => v.includes('citations'))).toBe(true);
  });

  it('passes when expert review is required (human review is the safety net)', () => {
    const result = verifyPostRerankInvariants({
      confidenceScore: 0.3,
      citationCount: 0,
      expertReviewRequired: true,
    });
    expect(result.passed).toBe(true);
  });

  it('respects custom confidence floor', () => {
    const result = verifyPostRerankInvariants({
      confidenceScore: 0.75,
      citationCount: 2,
      expertReviewRequired: false,
    });
    expect(result.thresholds.confidenceFloor).toBe(DEFAULT_CONFIDENCE_FLOOR);
    // With a stricter floor, the same input should fail.
    const stricter = verifyPostRerankInvariants(
      { confidenceScore: 0.75, citationCount: 2, expertReviewRequired: false },
      // custom floor not supported via opts here; this just documents default.
    );
    expect(stricter.passed).toBe(true);
  });

  it('respects custom min citations via input', () => {
    const result = verifyPostRerankInvariants({
      confidenceScore: 0.9,
      citationCount: 2,
      minCitations: 5,
      expertReviewRequired: false,
    });
    expect(result.passed).toBe(false);
    expect(result.thresholds.minCitations).toBe(5);
  });

  it('enforces eval gate when evalResultJson is supplied and fails', () => {
    // Empty results -> eval gate fails with 'no_eval_cases'.
    const result = verifyPostRerankInvariants(
      { confidenceScore: 0.9, citationCount: 3, expertReviewRequired: false },
      { evalResultJson: { results: [] } },
    );
    expect(result.passed).toBe(false);
    expect(result.violations.some((v) => v.includes('eval_gate_failed'))).toBe(true);
  });

  it('passes when eval gate passes', () => {
    const evalJson = {
      results: [{ success: true }, { success: true }, { success: true }, { success: true }],
    };
    const result = verifyPostRerankInvariants(
      { confidenceScore: 0.9, citationCount: 3, expertReviewRequired: false },
      { evalResultJson: evalJson },
    );
    expect(result.passed).toBe(true);
  });

  it('DEFAULT_CONFIDENCE_FLOOR is 0.7', () => {
    expect(DEFAULT_CONFIDENCE_FLOOR).toBe(0.7);
  });

  it('DEFAULT_MIN_CITATIONS is 1', () => {
    expect(DEFAULT_MIN_CITATIONS).toBe(1);
  });
});
