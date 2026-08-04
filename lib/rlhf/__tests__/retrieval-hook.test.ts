// @vitest-environment node
// @MX:NOTE [AUTO] Unit tests for lib/rlhf/retrieval-hook (SPEC-REGULA-RLHF-001).
// @MX:SPEC SPEC-REGULA-RLHF-001 (REQ-RLHF-010/013/014)

import { beforeEach, describe, expect, it, vi } from 'vitest';

let rows: unknown[] = [];
const applyReranking = vi.fn((results: readonly unknown[]) => [...results]);
const recordReranking = vi.fn(async () => {});
const verifyPostRerankInvariants = vi.fn(() => ({ passed: true, violations: [] }));

vi.mock('@/lib/db/client', () => {
  const chain: Record<string, unknown> = {};
  chain.from = () => chain;
  chain.where = () => chain;
  // Intentional thenable: `await` on the chain resolves to rows.
  // biome-ignore lint/suspicious/noThenProperty: deliberate chainable thenable for the db mock
  chain.then = (resolve: (v: unknown) => void) => resolve(rows);
  return { db: { select: () => chain } };
});
vi.mock('@/lib/rlhf/reranker', () => ({ applyReranking }));
vi.mock('@/lib/rlhf/version-tracker', () => ({ recordReranking }));
vi.mock('@/lib/rlhf/post-rerank-gate', () => ({ verifyPostRerankInvariants }));

const { applyRlhfReranking, fetchFeedbackScores } = await import('../retrieval-hook');

beforeEach(() => {
  vi.clearAllMocks();
  rows = [];
});

describe('fetchFeedbackScores', () => {
  it('returns {} for empty input', async () => {
    expect(await fetchFeedbackScores([])).toEqual({});
  });

  it('maps rows to {id→score}, omitting zero scores', async () => {
    rows = [
      { id: 's1', score: '0.8' },
      { id: 's2', score: '0' },
      { id: 's3', score: '-0.4' },
    ];
    const map = await fetchFeedbackScores(['s1', 's2', 's3']);
    expect(map).toEqual({ s1: 0.8, s3: -0.4 });
  });
});

describe('applyRlhfReranking (REQ-RLHF-010/014)', () => {
  it('fetches scores, reranks, records, and verifies invariants', async () => {
    rows = [{ id: 's1', score: '0.9' }];
    const results = [
      { id: 's1', score: 0.5 },
      { id: 's2', score: 0.3 },
    ];
    const { results: reranked, invariantCheck } = await applyRlhfReranking(results, {
      orgId: 'org-1',
      actorId: 'u-1',
      postRerank: { confidenceScore: 0.8, citationCount: 3, expertReviewRequired: false },
    });

    expect(applyReranking).toHaveBeenCalled();
    expect(recordReranking).toHaveBeenCalledWith(expect.objectContaining({ orgId: 'org-1' }));
    expect(verifyPostRerankInvariants).toHaveBeenCalled();
    expect(invariantCheck.passed).toBe(true);
  });
});
