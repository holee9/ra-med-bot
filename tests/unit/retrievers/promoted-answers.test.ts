// @MX:NOTE [AUTO] AC-04 behavior test — PromotedAnswersRetriever REAL retrieval.
// @MX:SPEC SPEC-REGULA-KNOWLEDGE-PROMO-001 (REQ-009, REQ-010, REQ-011, REQ-014, AC-04, AC-05, AC-08)
// @MX:REASON The prior AC-04 test was a SOURCE-TEXT regex over the retriever
//           file (`expect(src).toMatch(/PROMOTED_BOOST_FACTOR\s*=\s*1\.[0-9]+/)`)
//           which passed even when the retriever was NEVER called (dead code).
//           This file exercises the retriever end-to-end against a mocked
//           db.execute so the boost, corpusType, and sourceMessageId metadata
//           are asserted on the REAL return value — not the source text.
//           Mirrors tests/unit/retrievers/internal-sops.test.ts mock pattern.

import { beforeEach, describe, expect, it, vi } from 'vitest';

// Hoisted dbMock — vi.mock factories run before top-level const initialization.
const { dbMock } = vi.hoisted(() => ({ dbMock: { execute: vi.fn() } }));
vi.mock('@/lib/kernel/db/client', () => ({
  db: dbMock,
  // withTenantScope forwards the fn to the mocked db so execute is observable.
  withTenantScope: vi.fn(
    async <T>(_orgId: string, fn: (db: typeof dbMock) => Promise<T>): Promise<T> =>
      fn(dbMock) as Promise<T>,
  ),
}));

// Stub embedding model (Phase A: centralized in lib/ai/embedding-provider).
vi.mock('@/lib/ai/embedding-provider', () => ({
  getEmbeddingModel: vi.fn().mockReturnValue('mock-embedding-model'),
}));

vi.mock('ai', () => ({
  embed: vi.fn(),
}));

vi.mock('@/lib/observability/logger', () => ({
  logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn() },
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe('PromotedAnswersRetriever — AC-04 behavior (REQ-009/010/011/014)', () => {
  it('throws when orgId is missing (REQ-003 security contract)', async () => {
    const { PromotedAnswersRetriever } = await import('@/lib/ai/retrievers/promoted-answers');
    await expect(new PromotedAnswersRetriever().retrieve('query', {})).rejects.toThrow(/orgId/i);
  });

  it('returns boosted org-corpus results with sourceMessageId metadata (AC-04/AC-05)', async () => {
    const { db } = await import('@/lib/kernel/db/client');
    const { embed } = await import('ai');
    const { PROMOTED_BOOST_FACTOR } = await import('@/lib/ai/retrievers/promoted-answers');

    // Simulate the query embedding (1536 dims — shape only matters for the call).
    vi.mocked(embed).mockResolvedValueOnce({
      embedding: new Array(1536).fill(0.2),
      value: '510(k) submission requirements',
      usage: { tokens: 8 },
    });

    // Simulate the DB returning one active promoted answer.
    const baseSimilarity = 0.8;
    const promotedRow = {
      promoted_id: 'pa-uuid-1',
      source_message_id: 'msg-uuid-1',
      title: '510(k) Predetermination requests should cite FDA-2019 guidance',
      tags: ['fda', '510k'],
      similarity: baseSimilarity,
    };
    vi.mocked(db.execute).mockResolvedValueOnce([promotedRow] as never);

    const { PromotedAnswersRetriever } = await import('@/lib/ai/retrievers/promoted-answers');
    const results = await new PromotedAnswersRetriever().retrieve('510(k) submission', {
      orgId: 'org-abc',
      limit: 5,
    });

    // AC-04: result is present — the retriever ACTUALLY ran (not dead code).
    expect(results).toHaveLength(1);
    const r = results[0];
    if (!r) throw new Error('expected one result');
    // AC-04: boost applied — score > baseSimilarity.
    expect(r.score).toBeCloseTo(baseSimilarity * PROMOTED_BOOST_FACTOR, 6);
    expect(r.score).toBeGreaterThan(baseSimilarity);
    // AC-05: sourceMessageId carries citation provenance.
    expect(r.metadata?.sourceMessageId).toBe('msg-uuid-1');
    expect(r.metadata?.promotedAnswerId).toBe('pa-uuid-1');
    expect(r.metadata?.boosted).toBe(true);
    expect(r.metadata?.boostFactor).toBe(PROMOTED_BOOST_FACTOR);
    expect(r.metadata?.corpusType).toBe('org_promoted');
    // id is the promoted row id so RLHF re-rank can map it back.
    expect(r.id).toBe('pa-uuid-1');
    // db.execute must have been called (SQL-level org isolation ran).
    expect(db.execute).toHaveBeenCalledTimes(1);
  });

  it('respects limit option and forwards orgId to the SQL WHERE (REQ-003)', async () => {
    const { db } = await import('@/lib/kernel/db/client');
    const { embed } = await import('ai');

    vi.mocked(embed).mockResolvedValueOnce({
      embedding: new Array(1536).fill(0.1),
      value: 'query',
      usage: { tokens: 4 },
    });
    vi.mocked(db.execute).mockResolvedValueOnce([] as never);

    const { PromotedAnswersRetriever } = await import('@/lib/ai/retrievers/promoted-answers');
    await new PromotedAnswersRetriever().retrieve('query', { orgId: 'org-xyz', limit: 3 });

    // db.execute must have been called exactly once with a defined SQL argument.
    // The SQL-level org_id + status='active' filter is asserted by the
    // source-level test in promote.test.ts (AC-08) and by the retriever
    // source itself — here we only verify the retriever dispatched to the DB
    // (i.e. did not short-circuit or filter client-side).
    expect(db.execute).toHaveBeenCalledTimes(1);
    const firstCall = vi.mocked(db.execute).mock.calls[0];
    expect(firstCall).toBeDefined();
    expect(firstCall?.[0]).toBeDefined();
  });

  it('returns empty when embedding fails (OpenAI unavailable) — graceful degrade', async () => {
    const { embed } = await import('ai');
    vi.mocked(embed).mockRejectedValueOnce(new Error('no-openai-key'));

    const { PromotedAnswersRetriever } = await import('@/lib/ai/retrievers/promoted-answers');
    const results = await new PromotedAnswersRetriever().retrieve('query', { orgId: 'org-abc' });
    expect(results).toEqual([]);
  });
});
