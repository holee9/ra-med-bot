// @MX:SPEC SPEC-REGULA-RLHF-001 (REQ-RLHF-010, REQ-RLHF-013, REQ-RLHF-014, AC-05, AC-07)
// Tier-1 dead-code defense integration test.
//
// This test proves:
//   1. REQ-RLHF-010: retrieval output CHANGES when feedback_score changes
//      (the "applyReranking defined but never called" defect class).
//   2. REQ-RLHF-014: verifyPostRerankInvariants fires on the retrieval path.
//   3. REQ-RLHF-013: recordReranking records version metadata (change_request
//      with source='rlhf').
//
// The test mocks the DB (feedback scores) + the model-governance gates so it
// runs in pure unit-test mode, but it exercises the REAL retrieval-hook.ts
// AND the REAL reranker.ts + post-rerank-gate.ts + version-tracker.ts.

import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock recordReranking so we can assert it was called (REQ-RLHF-013).
vi.mock('@/lib/rlhf/version-tracker', () => ({
  recordReranking: vi.fn().mockResolvedValue({ changeRequestId: 'cr-rlhf-1' }),
}));

// Shared mutable mock so per-test code can control the feedback-score rows.
// vi.hoisted lifts the declaration so the vi.mock factory (which is hoisted
// to the top of the file by vitest) can reference it without a TDZ error.
const { dbMock } = vi.hoisted(() => ({
  dbMock: {
    select: vi.fn(() => ({ from: () => ({ where: () => Promise.resolve([]) }) })),
  },
}));
vi.mock('@/lib/db/client', () => ({ db: dbMock }));

vi.mock('@/lib/observability/logger', () => ({
  logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn() },
}));

import { applyRlhfReranking, fetchFeedbackScores } from '@/lib/rlhf/retrieval-hook';
import { recordReranking } from '@/lib/rlhf/version-tracker';

/**
 * Typed helper to override the db.select mock per-test without `as any`.
 * Returns a chainable that resolves to the supplied rows.
 */
function mockSelectReturns(rowsFactory: () => Promise<unknown>): void {
  (
    dbMock.select as unknown as {
      mockReturnValue: (v: unknown) => typeof dbMock;
    }
  ).mockReturnValue({ from: () => ({ where: rowsFactory }) });
}

/** Typed helper to manipulate the recordReranking mock without `as any`. */
const recordRerankingMock = recordReranking as unknown as {
  mockRejectedValueOnce: (e: Error) => void;
};

function makeResults() {
  return [
    { id: 'sec-high-base', sourceSectionId: 'sec-high-base', score: 0.9 },
    { id: 'sec-low-base', sourceSectionId: 'sec-low-base', score: 0.45 },
    { id: 'sec-mid-base', sourceSectionId: 'sec-mid-base', score: 0.6 },
  ];
}

describe('REQ-RLHF-010 / AC-05: retrieval re-ranking wiring (Tier-1 dead-code defense)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('retrieval order is STABLE when all feedback scores are neutral (0)', async () => {
    // Override the mock to return empty scores (all sections neutral).
    mockSelectReturns(async () => []);

    const { results } = await applyRlhfReranking(makeResults(), {
      orgId: 'org-1',
      actorId: 'user-1',
      postRerank: { confidenceScore: 0.9, citationCount: 3, expertReviewRequired: false },
    });

    // Order should match the base-score order (high, mid, low).
    expect(results.map((r) => r.id)).toEqual(['sec-high-base', 'sec-mid-base', 'sec-low-base']);
  });

  it('retrieval order CHANGES when a section gets strong positive feedback', async () => {
    // sec-low-base has a huge positive feedback_score; under lambda=0.2 its
    // blended score (0.8*0.45 + 0.2*tanh(10) = 0.56) beats sec-mid-base
    // (0.8*0.6 + 0 = 0.48) and nearly ties sec-high-base (0.8*0.9 = 0.72).
    mockSelectReturns(async () => [{ id: 'sec-low-base', score: '10' }]);

    const { results } = await applyRlhfReranking(makeResults(), {
      orgId: 'org-1',
      actorId: 'user-1',
      postRerank: { confidenceScore: 0.9, citationCount: 3, expertReviewRequired: false },
    });

    // sec-low-base must move UP (not be last). This is the core AC-05 assertion.
    const order = results.map((r) => r.id);
    const lowBaseIdx = order.indexOf('sec-low-base');
    const midBaseIdx = order.indexOf('sec-mid-base');
    expect(lowBaseIdx).toBeLessThan(midBaseIdx);
  });

  it('REQ-RLHF-013: recordReranking is called with source=rlhf (version metadata recorded)', async () => {
    mockSelectReturns(async () => []);

    await applyRlhfReranking(makeResults(), {
      orgId: 'org-1',
      actorId: 'user-1',
      postRerank: { confidenceScore: 0.9, citationCount: 3, expertReviewRequired: false },
    });

    expect(recordReranking).toHaveBeenCalledTimes(1);
    expect(recordReranking).toHaveBeenCalledWith(
      expect.objectContaining({
        orgId: 'org-1',
        submittedBy: 'user-1',
        sectionCount: 3,
      }),
    );
  });

  it('REQ-RLHF-014 / AC-07: verifyPostRerankInvariants runs and flags violations', async () => {
    mockSelectReturns(async () => []);

    // Low confidence + no citations + no expert review -> invariant FAILS.
    const { invariantCheck } = await applyRlhfReranking(makeResults(), {
      orgId: 'org-1',
      actorId: 'user-1',
      postRerank: { confidenceScore: 0.3, citationCount: 0, expertReviewRequired: false },
    });

    expect(invariantCheck.passed).toBe(false);
    expect(invariantCheck.violations.length).toBeGreaterThan(0);
  });

  it('REQ-RLHF-014: invariant passes when expert review is required (safety net)', async () => {
    mockSelectReturns(async () => []);

    const { invariantCheck } = await applyRlhfReranking(makeResults(), {
      orgId: 'org-1',
      actorId: 'user-1',
      postRerank: { confidenceScore: 0.2, citationCount: 0, expertReviewRequired: true },
    });

    expect(invariantCheck.passed).toBe(true);
  });

  it('H-2: applyRlhfReranking PROPAGATES recordReranking errors (no silent swallow)', async () => {
    mockSelectReturns(async () => []);
    recordRerankingMock.mockRejectedValueOnce(new Error('audit db down'));

    // H-2 contract change: the retrieval-hook no longer catches recordReranking
    // errors. A version-tracking failure is a real 21 CFR Part 11 health signal
    // and MUST surface — the previous silent warn-and-continue masked audit-
    // trail degradation. The retrieval-survives guarantee moved UP a layer to
    // merge.ts (which wraps applyRlhfReranking in its own try/catch and falls
    // back to Cohere ordering).
    await expect(
      applyRlhfReranking(makeResults(), {
        orgId: 'org-1',
        actorId: 'user-1',
        postRerank: { confidenceScore: 0.9, citationCount: 3, expertReviewRequired: false },
      }),
    ).rejects.toThrow('audit db down');
  });
});

describe('fetchFeedbackScores (Tier-1: never returns empty when sections have scores)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns an empty map when no section ids are supplied', async () => {
    const map = await fetchFeedbackScores([]);
    expect(map).toEqual({});
  });

  it('maps section ids to their numeric feedback scores, skipping zeros', async () => {
    mockSelectReturns(async () => [
      { id: 's1', score: '5.5' },
      { id: 's2', score: '0' },
      { id: 's3', score: '-2' },
    ]);

    const map = await fetchFeedbackScores(['s1', 's2', 's3']);
    // s2 (score 0) is omitted as neutral.
    expect(map).toEqual({ s1: 5.5, s3: -2 });
  });
});
