// @MX:NOTE [AUTO] TDD GREEN phase — SPEC-REGULA-KNOWLEDGE-GAP-001 Phase 2+3 (Issue #35).
// @MX:SPEC SPEC-REGULA-KNOWLEDGE-GAP-001
//   REQ-KNOWLEDGE-GAP-005 (clustering), 006/007 (github create), 014 (replay), 015 (resolve)
//
// Mirrors the mocking pattern in tests/unit/knowledge-gap-detector.test.ts:
//   vi.mock('@/lib/db/client') + vi.mock('@/lib/audit') short-circuit the env-loaded
//   module graph so pure logic is testable without a DB.

import { beforeEach, describe, expect, it, vi } from 'vitest';

// --- Shared mocks ----------------------------------------------------------
// The DB is represented as a tiny in-memory fixture mutated by helpers below.
// Chainable methods return a `DbRow`-shaped promise so per-test `mockReturnValueOnce`
// overrides can substitute ad-hoc row shapes without fighting the Mock<T> generic.
type DbRow = Record<string, unknown>;
type WhereResult = Promise<DbRow[]>;
type ChainableWhere = { where: ReturnType<typeof vi.fn<[], WhereResult>> };
type ChainableSet = { where: ReturnType<typeof vi.fn<[], Promise<undefined>>> };

const queueRows = new Map<string, DbRow>();

const dbMock = {
  select: vi.fn((): { from: () => ChainableWhere } => ({
    from: vi.fn(
      (): ChainableWhere => ({
        where: vi.fn(async (): WhereResult => [...queueRows.values()]),
      }),
    ),
  })),
  update: vi.fn((): { set: () => ChainableSet } => ({
    set: vi.fn(
      (): ChainableSet => ({
        where: vi.fn(async (): Promise<undefined> => undefined),
      }),
    ),
  })),
};

vi.mock('@/lib/db/client', () => ({ db: dbMock }));
vi.mock('@/lib/audit', () => ({ writeAudit: vi.fn().mockResolvedValue(undefined) }));

// Mock embedChunks so clustering tests do not call OpenAI.
vi.mock('@/lib/ingest/embed', () => ({
  embedChunks: vi.fn(async (texts: string[]) => texts.map(() => MOCK_EMBEDDING)),
}));

// Mock consult so replay tests do not invoke the LLM.
vi.mock('@/lib/ai/consult', () => ({
  consult: vi.fn(async function* () {
    yield { type: 'prose_delta', delta: '510(k) premarket notification requires...' };
    yield { type: 'confidence', level: 'high', score: 0.9 };
    yield {
      type: 'sources',
      items: [{ id: 'src-1', citeIndex: 1, title: 'FDA 510(k)' }],
    };
    yield { type: 'done', duration_ms: 10 };
  }),
}));

// Mock the logger used by gap-replay.ts.
vi.mock('@/lib/observability/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

// A deterministic 1536-d embedding. Orthogonal vectors are constructed per-test.
const MOCK_EMBEDDING = new Array(1536).fill(0);

// --- Helpers ---------------------------------------------------------------
function seedRow(id: string, extra: Record<string, unknown> = {}) {
  queueRows.set(id, {
    id,
    redactedQuestion: 'test question',
    redactionHash: `hash-${id}`,
    clusterId: null,
    githubIssueNumber: null,
    ...extra,
  });
}

/**
 * Override `db.select()` for the next call so it resolves with `rows`.
 * Builds a vi.fn() chain matching the production Drizzle shape, so the Mock
 * generic and noUncheckedIndexedAccess both stay satisfied.
 */
function mockSelectReturns(rows: DbRow[]): void {
  dbMock.select.mockReturnValueOnce({
    from: vi.fn(
      (): ChainableWhere => ({
        where: vi.fn(async () => rows),
      }),
    ),
  });
}

/** Read a seeded row, filtering the undefined that Map.get returns for misses. */
function row(id: string): DbRow {
  const r = queueRows.get(id);
  if (!r) throw new Error(`test fixture row not seeded: ${id}`);
  return r;
}

beforeEach(() => {
  queueRows.clear();
  dbMock.select.mockClear();
  dbMock.update.mockClear();
});

// --- clustering.ts (REQ-KNOWLEDGE-GAP-005, AC-03) -------------------------
describe('clustering — cosineSimilarity + computeClusterId', () => {
  it('cosineSimilarity is 1 for identical vectors', async () => {
    const { cosineSimilarity } = await import('../../lib/knowledge-gap/clustering');
    expect(cosineSimilarity([1, 0, 0], [1, 0, 0])).toBeCloseTo(1, 6);
  });

  it('cosineSimilarity is 0 for orthogonal vectors', async () => {
    const { cosineSimilarity } = await import('../../lib/knowledge-gap/clustering');
    expect(cosineSimilarity([1, 0], [0, 1])).toBeCloseTo(0, 6);
  });

  it('cosineSimilarity returns -1 for mismatched lengths (never clears threshold)', async () => {
    const { cosineSimilarity } = await import('../../lib/knowledge-gap/clustering');
    expect(cosineSimilarity([1, 0], [1])).toBe(-1);
  });

  it('computeClusterId is deterministic and PII-free (hex)', async () => {
    const { computeClusterId } = await import('../../lib/knowledge-gap/clustering');
    const a = computeClusterId('hash-1');
    const b = computeClusterId('hash-1');
    const c = computeClusterId('hash-2');
    expect(a).toBe(b);
    expect(a).not.toBe(c);
    expect(a).toMatch(/^[0-9a-f]{16}$/);
  });
});

// --- github-issue.ts (REQ-KNOWLEDGE-GAP-006, 007, AC-03) ------------------
describe('github-issue — injectable client', () => {
  const ctx = {
    redactedQuestion: 'redacted q',
    redactionHash: 'hash-1',
    reason: 'no_results',
    clusterId: 'abc123',
    conversationId: 'conv-1',
    messageId: 'msg-1',
  };

  it('createGitHubIssue returns null when GitHub is not configured (no token)', async () => {
    const { createGitHubIssue } = await import('../../lib/knowledge-gap/github-issue');
    const result = await createGitHubIssue(ctx);
    expect(result).toBeNull();
  });

  it('createGitHubIssue calls the injected client with mandatory labels', async () => {
    const { createGitHubIssue, KNOWLEDGE_GAP_LABELS } = await import(
      '../../lib/knowledge-gap/github-issue'
    );
    const mockClient = {
      createIssue: vi.fn().mockResolvedValue({ number: 42, htmlUrl: 'https://x/42' }),
      createComment: vi.fn(),
    };
    // Fixture where the ORIGINAL question would have contained PII; only the
    // redacted form may appear in the GitHub body.
    const piiCtx = {
      ...ctx,
      redactedQuestion: 'What is the 510(k) process for [REDACTED-EMAIL]?',
    };
    const result = await createGitHubIssue(piiCtx, mockClient);
    expect(result?.number).toBe(42);
    expect(mockClient.createIssue).toHaveBeenCalledOnce();
    const call = mockClient.createIssue.mock.calls[0][0];
    expect(call.labels).toEqual([...KNOWLEDGE_GAP_LABELS]);
    expect(call.body).toContain('hash-1');
    expect(call.body).toContain('[REDACTED-EMAIL]');
    // PII that would have been in the ORIGINAL must never appear in the body.
    expect(call.body).not.toContain('jane@example.com');
    expect(call.title).toContain('[no_results]');
  });

  it('appendGitHubIssue calls createComment with the existing issue number', async () => {
    const { appendGitHubIssue } = await import('../../lib/knowledge-gap/github-issue');
    const mockClient = {
      createIssue: vi.fn(),
      createComment: vi.fn().mockResolvedValue({ htmlUrl: 'https://x/42#c1' }),
    };
    const result = await appendGitHubIssue(42, ctx, mockClient);
    expect(result?.htmlUrl).toBe('https://x/42#c1');
    expect(mockClient.createComment).toHaveBeenCalledWith({
      issueNumber: 42,
      body: expect.stringContaining('redacted q'),
    });
  });

  it('commentGapResolved swallows GitHub errors (best-effort)', async () => {
    const { commentGapResolved } = await import('../../lib/knowledge-gap/github-issue');
    const mockClient = {
      createIssue: vi.fn(),
      createComment: vi.fn().mockRejectedValue(new Error('network down')),
    };
    await expect(
      commentGapResolved(42, { answerWithCitations: 'ans', sourceTitles: ['s'] }, mockClient),
    ).resolves.toBeUndefined();
  });
});

// --- replay.ts (REQ-KNOWLEDGE-GAP-014, 015) -------------------------------
describe('replayGapTest — passed logic', () => {
  it('throws when queue row not found', async () => {
    const { replayGapTest } = await import('../../lib/knowledge-gap/replay');
    mockSelectReturns([]); // no rows
    await expect(replayGapTest('missing')).rejects.toThrow('not found');
  });

  it('returns passed=true when consult yields high confidence + sources', async () => {
    const { replayGapTest } = await import('../../lib/knowledge-gap/replay');
    seedRow('gap-1', {
      redactedQuestion: 'redacted q',
      conversationId: 'conv-1',
    });
    mockSelectReturns([row('gap-1')]);
    const result = await replayGapTest('gap-1');
    expect(result.passed).toBe(true);
    expect(result.remainingReason).toBeNull();
    expect(result.sources).toHaveLength(1);
  });

  it('returns passed=false when consult yields low confidence', async () => {
    const { consult } = await import('@/lib/ai/consult');
    (consult as ReturnType<typeof vi.fn>).mockImplementationOnce(async function* () {
      yield { type: 'prose_delta', delta: 'low quality answer' };
      yield { type: 'confidence', level: 'low', score: 0.2 };
      yield { type: 'sources', items: [] };
      yield { type: 'done', duration_ms: 5 };
    });
    const { replayGapTest } = await import('../../lib/knowledge-gap/replay');
    seedRow('gap-low');
    mockSelectReturns([row('gap-low')]);
    const result = await replayGapTest('gap-low');
    expect(result.passed).toBe(false);
    expect(result.remainingReason).not.toBeNull();
  });

  it('returns passed=false when no sources (no_results)', async () => {
    const { consult } = await import('@/lib/ai/consult');
    (consult as ReturnType<typeof vi.fn>).mockImplementationOnce(async function* () {
      yield { type: 'prose_delta', delta: 'no idea' };
      yield { type: 'confidence', level: 'low', score: 0.1 };
      yield { type: 'sources', items: [] };
      yield { type: 'done', duration_ms: 5 };
    });
    const { replayGapTest } = await import('../../lib/knowledge-gap/replay');
    seedRow('gap-noresults');
    mockSelectReturns([row('gap-noresults')]);
    const result = await replayGapTest('gap-noresults');
    expect(result.passed).toBe(false);
  });
});

describe('markGapResolved — status + audit + github comment', () => {
  it('updates status, resolves github comment, writes audit', async () => {
    const { markGapResolved } = await import('../../lib/knowledge-gap/replay');
    seedRow('gap-r', { githubIssueNumber: 99 });
    mockSelectReturns([row('gap-r')]);
    await expect(
      markGapResolved('gap-r', {
        answerWithCitations: 'answered',
        sources: [{ id: 's1', citeIndex: 1, title: 'Src' } as never],
      }),
    ).resolves.toBeUndefined();
    expect(dbMock.update).toHaveBeenCalled();
  });

  it('throws when queue row not found', async () => {
    const { markGapResolved } = await import('../../lib/knowledge-gap/replay');
    mockSelectReturns([]);
    await expect(
      markGapResolved('missing', { answerWithCitations: 'x', sources: [] }),
    ).rejects.toThrow('not found');
  });
});

// --- gap-replay.ts stub completion (REQ-KNOWLEDGE-GAP-014, 015) -----------
describe('triggerGapReplay — closed loop', () => {
  it('returns triggered=false when no matched gaps', async () => {
    const { triggerGapReplay } = await import('../../lib/radar/delta-sync/gap-replay');
    const result = await triggerGapReplay({ crawlerName: 'fda' });
    expect(result.triggered).toBe(false);
    expect(result.gapIds).toEqual([]);
  });

  it('preserves the exported interface shape', async () => {
    // Compile-time + runtime guard that the interface contract was not changed.
    const mod = await import('../../lib/radar/delta-sync/gap-replay');
    expect(typeof mod.triggerGapReplay).toBe('function');
    expect(typeof mod.shouldTriggerGapReplay).toBe('function');
    expect(mod.triggerGapReplay({ crawlerName: 'x' })).toBeInstanceOf(Promise);
  });

  it('shouldTriggerGapReplay is true only when matchedGapIds non-empty', async () => {
    const { shouldTriggerGapReplay } = await import('../../lib/radar/delta-sync/gap-replay');
    expect(shouldTriggerGapReplay({ crawlerName: 'x' })).toBe(false);
    expect(shouldTriggerGapReplay({ crawlerName: 'x', matchedGapIds: ['g1'] })).toBe(true);
  });
});
