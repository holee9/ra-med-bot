// SPEC-REGULA-WORKFLOWS-LLM-002 M0-3 — review-gate unit tests.
// REQ-WFLLM-007/008 / AC-06: block export unless review approved.

import { describe, expect, it } from 'vitest';
import { assertExportAllowed, shouldFlagForExpertReview } from '../review-gate';

describe('review-gate: assertExportAllowed', () => {
  it('allows export when status=approved', () => {
    const result = assertExportAllowed({
      runId: 'r1',
      status: 'approved',
      reviewRequired: true,
    });
    expect(result.allowed).toBe(true);
    expect(result.reason).toBeUndefined();
  });

  it('allows export when reviewRequired=false (gate not applicable)', () => {
    const result = assertExportAllowed({
      runId: 'r2',
      status: 'running',
      reviewRequired: false,
    });
    expect(result.allowed).toBe(true);
  });

  it('blocks export when status=pending_review and reviewRequired=true', () => {
    const result = assertExportAllowed({
      runId: 'r3',
      status: 'pending_review',
      reviewRequired: true,
    });
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('pending');
  });

  it('blocks export when status=rejected', () => {
    const result = assertExportAllowed({
      runId: 'r4',
      status: 'rejected',
      reviewRequired: true,
    });
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('rejected');
  });

  it('blocks export when status=running and reviewRequired=true (not yet reviewed)', () => {
    const result = assertExportAllowed({
      runId: 'r5',
      status: 'running',
      reviewRequired: true,
    });
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('not approved');
  });

  it('blocks export when status=queued', () => {
    const result = assertExportAllowed({
      runId: 'r6',
      status: 'queued',
      reviewRequired: true,
    });
    expect(result.allowed).toBe(false);
  });

  it('blocks export when status=failed', () => {
    const result = assertExportAllowed({
      runId: 'r7',
      status: 'failed',
      reviewRequired: true,
    });
    expect(result.allowed).toBe(false);
  });
});

describe('review-gate: shouldFlagForExpertReview', () => {
  it('flags when citation coverage fails', () => {
    expect(
      shouldFlagForExpertReview({ citationCoveragePasses: false, reviewRequired: false }),
    ).toBe(true);
  });

  it('flags when review is required (even if coverage passes)', () => {
    expect(shouldFlagForExpertReview({ citationCoveragePasses: true, reviewRequired: true })).toBe(
      true,
    );
  });

  it('does NOT flag when coverage passes and review not required', () => {
    expect(shouldFlagForExpertReview({ citationCoveragePasses: true, reviewRequired: false })).toBe(
      false,
    );
  });
});
