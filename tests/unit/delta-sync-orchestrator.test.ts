// @MX:NOTE [AUTO] #300 runDeltaSync orchestrator tests. Verifies the pipeline
//   lifecycle (pending → synced/unchanged/failed), applyOutdateOperations live
//   call site (the #238 dead-code → live proof), M-2 audit per section,
//   M-1 org-scoped existingChunkIds, and IDOR on sourceId.

import { beforeEach, describe, expect, it, vi } from 'vitest';

// --- Mocks ---------------------------------------------------------------
// vi.mock factories are hoisted above const declarations, so every mock
// referenced inside a factory MUST be created via vi.hoisted (not a bare const).
const {
  insertChain,
  updateChain,
  mockDb,
  writeAuditMock,
  applyOutdateOperationsMock,
  getSourceInOrgMock,
  detectChangesMock,
  embedChunksMock,
} = vi.hoisted(() => {
  const insertChain = {
    values: vi.fn().mockReturnThis(),
    returning: vi.fn().mockResolvedValue([{ id: 'run-1' }]),
  };
  const updateChain = {
    set: vi.fn().mockReturnThis(),
    where: vi.fn().mockResolvedValue(undefined),
  };
  // biome-ignore lint/suspicious/noExplicitAny: transaction callback references the mock; `any` breaks the self-referential type cycle (cf. knowledge-sources.test.ts).
  const mockDb: any = {
    insert: vi.fn().mockReturnValue(insertChain),
    update: vi.fn().mockReturnValue(updateChain),
    // Issue #378 — runDeltaSync now wraps each mutation+audit pair in
    // db.transaction(async (tx) => ...). Thread the same mockDb as `tx` so the
    // existing insert/update chain mocks cover both the outer db and inner tx.
    transaction: vi.fn(async (cb: (tx: unknown) => Promise<unknown>) => cb(mockDb)),
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        innerJoin: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([]),
        }),
        where: vi.fn().mockReturnValue({
          orderBy: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
          limit: vi.fn().mockResolvedValue([]),
        }),
      }),
    }),
  };
  return {
    insertChain,
    updateChain,
    mockDb,
    writeAuditMock: vi.fn().mockResolvedValue(undefined),
    applyOutdateOperationsMock: vi.fn().mockResolvedValue({ applied: 0, results: [] }),
    getSourceInOrgMock: vi.fn(),
    detectChangesMock: vi.fn(),
    embedChunksMock: vi.fn().mockResolvedValue([[0.1, 0.2, 0.3]]),
  };
});

vi.mock('@/lib/db/client', () => ({
  db: mockDb,
  withTenantScope: vi.fn(async (_orgId: string, fn: (tx: unknown) => Promise<unknown>) => {
    const tx = {
      insert: vi.fn().mockReturnValue({
        values: vi.fn().mockReturnThis(),
        returning: vi.fn().mockResolvedValue([{ id: 'sec-new-1' }]),
      }),
    };
    return fn(tx);
  }),
}));

vi.mock('@/lib/audit', () => ({ writeAudit: writeAuditMock }));

vi.mock('@/lib/source-governance/access', () => ({ getSourceInOrg: getSourceInOrgMock }));

vi.mock('@/lib/radar/delta-sync/ingest', () => ({
  applyOutdateOperations: applyOutdateOperationsMock,
  assembleEmbeddedChunks: vi.fn((_chunks, embeddings, ctx) =>
    embeddings.map((e: number[], i: number) => ({
      text: `chunk-${i}`,
      embedding: e,
      metadata: { ...ctx, sectionPath: `sec-${i}` },
    })),
  ),
  chunkForDelta: vi.fn(() => [{ text: 'chunk-0', metadata: { sectionPath: 'sec-0' } }]),
}));

vi.mock('@/lib/ingest/embed', () => ({ embedChunks: embedChunksMock }));

vi.mock('@/lib/radar/delta-sync/detector', () => ({ detectChanges: detectChangesMock }));

vi.mock('@/lib/observability/logger', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));

import { detectChanges } from '@/lib/radar/delta-sync/detector';
// Import AFTER mocks.
import { getSourceInOrg } from '@/lib/source-governance/access';
import { resolveExistingChunkIds, runDeltaSync } from '../../lib/radar/delta-sync/orchestrator';

const baseInput = {
  orgId: 'org-1',
  sourceId: 'src-1',
  crawlerName: 'fda-crawler',
  sourceUrl: 'https://example.test/fda-doc',
  rawContent: 'Some regulatory text',
  actorId: 'user-1',
};

describe('runDeltaSync orchestrator — #300 live activation of applyOutdateOperations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    insertChain.returning.mockResolvedValue([{ id: 'run-1' }]);
    writeAuditMock.mockResolvedValue(undefined);
  });

  it('IDOR miss (source not in org) → status=failed + corpus.sync_failed audit, no run row', async () => {
    vi.mocked(getSourceInOrg).mockResolvedValueOnce(null);

    const result = await runDeltaSync(baseInput);

    expect(result.status).toBe('failed');
    expect(result.errorMessage).toBe('source_not_found_in_org');
    expect(result.runId).toBe('');
    expect(writeAuditMock).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'corpus.sync_failed' }),
    );
    // No run row was created (db.insert not called for corpus_sync_runs).
    expect(mockDb.insert).not.toHaveBeenCalled();
  });

  it('unchanged path → status=unchanged, no chunking, corpus.sync_completed audit', async () => {
    vi.mocked(getSourceInOrg).mockResolvedValueOnce({ id: 'src-1', approvalStatus: 'approved' });
    vi.mocked(detectChanges).mockReturnValueOnce({
      crawlerName: 'fda-crawler',
      sourceUrl: baseInput.sourceUrl,
      status: 'unchanged',
      contentHash: 'hash-abc',
    });

    const result = await runDeltaSync(baseInput);

    expect(result.status).toBe('unchanged');
    expect(result.change).toBe('unchanged');
    expect(writeAuditMock).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'corpus.sync_started' }),
      expect.anything(),
    );
    expect(writeAuditMock).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'corpus.sync_completed', resource_id: 'src-1' }),
      expect.anything(),
    );
    // applyOutdateOperations must NOT fire for unchanged.
    expect(applyOutdateOperationsMock).not.toHaveBeenCalled();
  });

  it('changed path → chunks embedded, applyOutdateOperations CALLED (#238 live proof), corpus.sync_completed', async () => {
    vi.mocked(getSourceInOrg).mockResolvedValueOnce({ id: 'src-1', approvalStatus: 'approved' });
    vi.mocked(detectChanges).mockReturnValueOnce({
      crawlerName: 'fda-crawler',
      sourceUrl: baseInput.sourceUrl,
      status: 'changed',
      contentHash: 'hash-new',
    });
    applyOutdateOperationsMock.mockResolvedValueOnce({ applied: 1, results: [] });

    const result = await runDeltaSync(baseInput);

    expect(result.status).toBe('synced');
    expect(result.change).toBe('changed');
    expect(result.chunksAdded).toBe(1);
    expect(result.chunksOutdated).toBe(1);
    // THE proof: applyOutdateOperations has a live caller now.
    expect(applyOutdateOperationsMock).toHaveBeenCalledTimes(1);
    expect(applyOutdateOperationsMock).toHaveBeenCalledWith({
      orgId: 'org-1',
      existingChunkIds: expect.any(Array),
      newIngestionRunId: 'run-1',
      actorId: 'user-1',
    });
    expect(writeAuditMock).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'corpus.sync_completed' }),
      expect.anything(),
    );
  });

  it('new path → same as changed (first sighting, no existing chunks to outdate)', async () => {
    vi.mocked(getSourceInOrg).mockResolvedValueOnce({ id: 'src-1', approvalStatus: 'approved' });
    vi.mocked(detectChanges).mockReturnValueOnce({
      crawlerName: 'fda-crawler',
      sourceUrl: baseInput.sourceUrl,
      status: 'new',
      contentHash: 'hash-first',
    });
    applyOutdateOperationsMock.mockResolvedValueOnce({ applied: 0, results: [] });

    const result = await runDeltaSync(baseInput);

    expect(result.status).toBe('synced');
    expect(result.change).toBe('new');
    expect(applyOutdateOperationsMock).toHaveBeenCalled();
  });

  it('error path → status=failed, run marked failed, corpus.sync_failed audit, never pending', async () => {
    vi.mocked(getSourceInOrg).mockResolvedValueOnce({ id: 'src-1', approvalStatus: 'approved' });
    vi.mocked(detectChanges).mockImplementation(() => {
      throw new Error('detector explosion');
    });

    const result = await runDeltaSync(baseInput);

    expect(result.status).toBe('failed');
    expect(result.errorMessage).toContain('detector explosion');
    // The run row MUST be marked failed (db.update with status='failed').
    const updateCalls = updateChain.set.mock.calls;
    const failedSetCall = updateCalls.find((c) => {
      const v = c[0] as { status?: string };
      return v?.status === 'failed';
    });
    expect(failedSetCall).toBeDefined();
    expect(writeAuditMock).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'corpus.sync_failed' }),
      expect.anything(),
    );
  });
});

describe('M-1: resolveExistingChunkIds — org-scoped via JOIN sources.organization_id', () => {
  it('returns section ids from the JOIN query (cross-org sections excluded by the sources filter)', async () => {
    // Override the select chain for this test to return controlled section ids.
    const where = vi.fn().mockResolvedValue([{ id: 'sec-a' }, { id: 'sec-b' }]);
    const innerJoin = vi.fn().mockReturnValue({ where });
    const from = vi.fn().mockReturnValue({ innerJoin });
    mockDb.select.mockReturnValueOnce({ from });

    const ids = await resolveExistingChunkIds('src-1', 'org-1');

    expect(ids).toEqual(['sec-a', 'sec-b']);
    // The JOIN was wired (sources table joined).
    expect(innerJoin).toHaveBeenCalled();
  });

  it('returns empty array when no non-superseded sections exist', async () => {
    const where = vi.fn().mockResolvedValue([]);
    const innerJoin = vi.fn().mockReturnValue({ where });
    const from = vi.fn().mockReturnValue({ innerJoin });
    mockDb.select.mockReturnValueOnce({ from });

    const ids = await resolveExistingChunkIds('src-1', 'org-1');
    expect(ids).toEqual([]);
  });
});
