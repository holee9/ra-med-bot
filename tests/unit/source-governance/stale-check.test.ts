// @MX:NOTE [AUTO] Unit tests for stale-check (SPEC-REGULA-SOURCE-GOVERNANCE-001, AC-03).
// @MX:SPEC SPEC-REGULA-SOURCE-GOVERNANCE-001 (REQ-SOURCE-GOV-007, AC-03, Issue #48)
// @MX:REASON AC-03 gate: superseded / sunset-past / not-yet-effective / pending_review
//   sources MUST NOT appear in a regulatory submission export. Each branch in
//   verifyGovernanceFreshness is exercised independently + the audit batch
//   helper is verified.

import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mock db — same thenable pattern as tests/integration/source-governance.test.ts.
// Each test sets `mockRows.select` then imports the real lib function.
// ---------------------------------------------------------------------------
let mockRows: Record<string, unknown[]> = {};

function makeThenable(rowsFor: () => unknown[]) {
  const p = Promise.resolve(rowsFor()) as Promise<unknown[]> & {
    limit: () => Promise<unknown[]>;
  };
  p.limit = () => Promise.resolve(rowsFor());
  return p;
}

function makeMockDb(rows: Record<string, unknown[]>) {
  const rowsFor = (key: string): unknown[] => rows[key] ?? [];
  const selectMock = () => ({
    from: () => ({
      where: () => makeThenable(() => rowsFor('select')),
    }),
  });
  return {
    select: vi.fn(selectMock),
  };
}

const writeAuditMock = vi.fn(async () => {});

beforeEach(() => {
  mockRows = {};
  vi.resetModules();
  vi.doMock('@/lib/audit', () => ({
    writeAudit: writeAuditMock,
  }));
  vi.doMock('@/lib/db/client', () => ({
    db: makeMockDb(mockRows),
  }));
});

// ---------------------------------------------------------------------------
// verifyGovernanceFreshness — empty input short-circuit
// ---------------------------------------------------------------------------
describe('verifyGovernanceFreshness — empty input (REQ-SOURCE-GOV-007)', () => {
  it('returns allowed=true with no blocked sources when sourceIds is empty', async () => {
    const { verifyGovernanceFreshness } = await import('@/lib/source-governance/stale-check');
    const result = await verifyGovernanceFreshness([], 'org-1');
    expect(result).toEqual({ allowed: true, blockedSources: [] });
  });
});

// ---------------------------------------------------------------------------
// verifyGovernanceFreshness — all staleness branches
// ---------------------------------------------------------------------------
describe('verifyGovernanceFreshness — staleness reason branches (AC-03)', () => {
  it('blocks superseded source (supersededBy != null)', async () => {
    mockRows.select = [
      {
        id: 'src-sup',
        title: 'Old FDA Guidance',
        supersededBy: 'src-new',
        sunsetDate: null,
        effectiveDate: null,
        approvalStatus: 'approved',
      },
    ];
    const { verifyGovernanceFreshness } = await import('@/lib/source-governance/stale-check');
    const result = await verifyGovernanceFreshness(['src-sup'], 'org-1');
    expect(result.allowed).toBe(false);
    expect(result.blockedSources).toHaveLength(1);
    expect(result.blockedSources[0]).toEqual({
      sourceId: 'src-sup',
      title: 'Old FDA Guidance',
      reason: 'superseded by src-new',
    });
  });

  it('blocks sunset-past source (sunsetDate < today)', async () => {
    mockRows.select = [
      {
        id: 'src-sunset',
        title: 'Expired EU MDR',
        supersededBy: null,
        sunsetDate: '2020-01-01',
        effectiveDate: null,
        approvalStatus: 'approved',
      },
    ];
    const { verifyGovernanceFreshness } = await import('@/lib/source-governance/stale-check');
    const result = await verifyGovernanceFreshness(['src-sunset'], 'org-1');
    expect(result.allowed).toBe(false);
    expect(result.blockedSources[0]?.reason).toContain('sunset date passed');
    expect(result.blockedSources[0]?.reason).toContain('2020-01-01');
  });

  it('does NOT block sunset-future source (sunsetDate >= today)', async () => {
    const future = '2099-12-31';
    mockRows.select = [
      {
        id: 'src-future-sunset',
        title: 'Active Regulation',
        supersededBy: null,
        sunsetDate: future,
        effectiveDate: null,
        approvalStatus: 'approved',
      },
    ];
    const { verifyGovernanceFreshness } = await import('@/lib/source-governance/stale-check');
    const result = await verifyGovernanceFreshness(['src-future-sunset'], 'org-1');
    expect(result.allowed).toBe(true);
    expect(result.blockedSources).toHaveLength(0);
  });

  it('blocks not-yet-effective source (effectiveDate > today)', async () => {
    const future = '2099-12-31';
    mockRows.select = [
      {
        id: 'src-future',
        title: 'Future FDA Rule',
        supersededBy: null,
        sunsetDate: null,
        effectiveDate: future,
        approvalStatus: 'approved',
      },
    ];
    const { verifyGovernanceFreshness } = await import('@/lib/source-governance/stale-check');
    const result = await verifyGovernanceFreshness(['src-future'], 'org-1');
    expect(result.allowed).toBe(false);
    expect(result.blockedSources[0]?.reason).toContain('not yet effective');
    expect(result.blockedSources[0]?.reason).toContain(future);
  });

  it('does NOT block already-effective source (effectiveDate <= today)', async () => {
    const past = '2020-01-01';
    mockRows.select = [
      {
        id: 'src-effective',
        title: 'Active Rule',
        supersededBy: null,
        sunsetDate: null,
        effectiveDate: past,
        approvalStatus: 'approved',
      },
    ];
    const { verifyGovernanceFreshness } = await import('@/lib/source-governance/stale-check');
    const result = await verifyGovernanceFreshness(['src-effective'], 'org-1');
    expect(result.allowed).toBe(true);
    expect(result.blockedSources).toHaveLength(0);
  });

  it('blocks pending_review approval status', async () => {
    mockRows.select = [
      {
        id: 'src-pending',
        title: 'Pending SOP',
        supersededBy: null,
        sunsetDate: null,
        effectiveDate: null,
        approvalStatus: 'pending_review',
      },
    ];
    const { verifyGovernanceFreshness } = await import('@/lib/source-governance/stale-check');
    const result = await verifyGovernanceFreshness(['src-pending'], 'org-1');
    expect(result.allowed).toBe(false);
    expect(result.blockedSources[0]?.reason).toBe('approval status: pending_review');
  });

  it('blocks rejected approval status', async () => {
    mockRows.select = [
      {
        id: 'src-rejected',
        title: 'Rejected Source',
        supersededBy: null,
        sunsetDate: null,
        effectiveDate: null,
        approvalStatus: 'rejected',
      },
    ];
    const { verifyGovernanceFreshness } = await import('@/lib/source-governance/stale-check');
    const result = await verifyGovernanceFreshness(['src-rejected'], 'org-1');
    expect(result.allowed).toBe(false);
    expect(result.blockedSources[0]?.reason).toBe('approval status: rejected');
  });

  it('blocks sunset approval status (orphan cleanup cron)', async () => {
    mockRows.select = [
      {
        id: 'src-sunset-status',
        title: 'Sunset Source',
        supersededBy: null,
        sunsetDate: null,
        effectiveDate: null,
        approvalStatus: 'sunset',
      },
    ];
    const { verifyGovernanceFreshness } = await import('@/lib/source-governance/stale-check');
    const result = await verifyGovernanceFreshness(['src-sunset-status'], 'org-1');
    expect(result.allowed).toBe(false);
    expect(result.blockedSources[0]?.reason).toBe('approval status: sunset');
  });

  it('allows fully-approved source with no stale markers', async () => {
    mockRows.select = [
      {
        id: 'src-ok',
        title: 'Current Approved Source',
        supersededBy: null,
        sunsetDate: null,
        effectiveDate: null,
        approvalStatus: 'approved',
      },
    ];
    const { verifyGovernanceFreshness } = await import('@/lib/source-governance/stale-check');
    const result = await verifyGovernanceFreshness(['src-ok'], 'org-1');
    expect(result.allowed).toBe(true);
    expect(result.blockedSources).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// verifyGovernanceFreshness — branch priority (first match wins)
// ---------------------------------------------------------------------------
describe('verifyGovernanceFreshness — branch priority', () => {
  it('superseded takes priority over sunset/effective/approval', async () => {
    // A source that is both superseded AND has a past sunset date — the
    // superseded reason should win (it's checked first in the if-chain).
    mockRows.select = [
      {
        id: 'src-multi',
        title: 'Multi-stale',
        supersededBy: 'src-new',
        sunsetDate: '2020-01-01',
        effectiveDate: null,
        approvalStatus: 'pending_review',
      },
    ];
    const { verifyGovernanceFreshness } = await import('@/lib/source-governance/stale-check');
    const result = await verifyGovernanceFreshness(['src-multi'], 'org-1');
    expect(result.blockedSources).toHaveLength(1);
    expect(result.blockedSources[0]?.reason).toBe('superseded by src-new');
  });

  it('sunset-past takes priority over effective/approval (when not superseded)', async () => {
    mockRows.select = [
      {
        id: 'src-multi2',
        title: 'Multi-stale 2',
        supersededBy: null,
        sunsetDate: '2020-01-01',
        effectiveDate: '2099-12-31',
        approvalStatus: 'rejected',
      },
    ];
    const { verifyGovernanceFreshness } = await import('@/lib/source-governance/stale-check');
    const result = await verifyGovernanceFreshness(['src-multi2'], 'org-1');
    expect(result.blockedSources[0]?.reason).toContain('sunset date passed');
  });

  it('not-yet-effective takes priority over approval status', async () => {
    mockRows.select = [
      {
        id: 'src-multi3',
        title: 'Future + pending',
        supersededBy: null,
        sunsetDate: null,
        effectiveDate: '2099-12-31',
        approvalStatus: 'pending_review',
      },
    ];
    const { verifyGovernanceFreshness } = await import('@/lib/source-governance/stale-check');
    const result = await verifyGovernanceFreshness(['src-multi3'], 'org-1');
    expect(result.blockedSources[0]?.reason).toContain('not yet effective');
  });
});

// ---------------------------------------------------------------------------
// verifyGovernanceFreshness — mixed batch (some blocked, some allowed)
// ---------------------------------------------------------------------------
describe('verifyGovernanceFreshness — mixed batch', () => {
  it('returns blocked sources for stale rows while allowing fresh ones', async () => {
    const future = '2099-12-31';
    const past = '2020-01-01';
    mockRows.select = [
      {
        id: 'src-ok',
        title: 'Current',
        supersededBy: null,
        sunsetDate: null,
        effectiveDate: null,
        approvalStatus: 'approved',
      },
      {
        id: 'src-sup',
        title: 'Superseded',
        supersededBy: 'src-new',
        sunsetDate: null,
        effectiveDate: null,
        approvalStatus: 'approved',
      },
      {
        id: 'src-sunset',
        title: 'Expired',
        supersededBy: null,
        sunsetDate: past,
        effectiveDate: null,
        approvalStatus: 'approved',
      },
      {
        id: 'src-future',
        title: 'Future',
        supersededBy: null,
        sunsetDate: null,
        effectiveDate: future,
        approvalStatus: 'approved',
      },
      {
        id: 'src-pending',
        title: 'Pending',
        supersededBy: null,
        sunsetDate: null,
        effectiveDate: null,
        approvalStatus: 'pending_review',
      },
    ];
    const { verifyGovernanceFreshness } = await import('@/lib/source-governance/stale-check');
    const result = await verifyGovernanceFreshness(
      ['src-ok', 'src-sup', 'src-sunset', 'src-future', 'src-pending'],
      'org-1',
    );
    expect(result.allowed).toBe(false);
    expect(result.blockedSources).toHaveLength(4);
    const blockedIds = result.blockedSources.map((b) => b.sourceId);
    expect(blockedIds).toEqual(
      expect.arrayContaining(['src-sup', 'src-sunset', 'src-future', 'src-pending']),
    );
    // The fresh source is NOT in blockedSources.
    expect(blockedIds).not.toContain('src-ok');
  });

  it('handles source with null title', async () => {
    mockRows.select = [
      {
        id: 'src-no-title',
        title: null,
        supersededBy: 'src-new',
        sunsetDate: null,
        effectiveDate: null,
        approvalStatus: 'approved',
      },
    ];
    const { verifyGovernanceFreshness } = await import('@/lib/source-governance/stale-check');
    const result = await verifyGovernanceFreshness(['src-no-title'], 'org-1');
    expect(result.blockedSources[0]?.title).toBeNull();
  });

  it('returns allowed=true when DB returns no rows (all ids not found)', async () => {
    mockRows.select = [];
    const { verifyGovernanceFreshness } = await import('@/lib/source-governance/stale-check');
    const result = await verifyGovernanceFreshness(['src-missing'], 'org-1');
    // No rows → no blocked sources → allowed. (The export route treats
    // missing sources as "not stale" — the retrieval gate handles exclusion.)
    expect(result.allowed).toBe(true);
    expect(result.blockedSources).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// auditStaleBlockedBatch — writes one audit row per blocked source
// ---------------------------------------------------------------------------
describe('auditStaleBlockedBatch (REQ-SOURCE-GOV-015)', () => {
  it('writes a source.stale_blocked audit row for each blocked source', async () => {
    writeAuditMock.mockClear();
    const { auditStaleBlockedBatch } = await import('@/lib/source-governance/stale-check');
    await auditStaleBlockedBatch({
      userId: 'user-1',
      conversationId: 'conv-1',
      blockedSources: [
        { sourceId: 'src-1', title: 'Old Doc', reason: 'superseded by src-new' },
        { sourceId: 'src-2', title: 'Expired', reason: 'sunset date passed (2020-01-01)' },
      ],
    });
    expect(writeAuditMock).toHaveBeenCalledTimes(2);
    expect(writeAuditMock).toHaveBeenNthCalledWith(1, {
      actor_id: 'user-1',
      action: 'source.stale_blocked',
      resource_type: 'source',
      resource_id: 'src-1',
      conversation_id: 'conv-1',
      meta_json: { reason: 'superseded by src-new', title: 'Old Doc' },
    });
    expect(writeAuditMock).toHaveBeenNthCalledWith(2, {
      actor_id: 'user-1',
      action: 'source.stale_blocked',
      resource_type: 'source',
      resource_id: 'src-2',
      conversation_id: 'conv-1',
      meta_json: { reason: 'sunset date passed (2020-01-01)', title: 'Expired' },
    });
  });

  it('does not write any audit when blockedSources is empty', async () => {
    writeAuditMock.mockClear();
    const { auditStaleBlockedBatch } = await import('@/lib/source-governance/stale-check');
    await auditStaleBlockedBatch({
      userId: 'user-1',
      blockedSources: [],
    });
    expect(writeAuditMock).not.toHaveBeenCalled();
  });

  it('passes undefined conversation_id when not provided', async () => {
    writeAuditMock.mockClear();
    const { auditStaleBlockedBatch } = await import('@/lib/source-governance/stale-check');
    await auditStaleBlockedBatch({
      userId: 'user-2',
      blockedSources: [{ sourceId: 'src-x', title: null, reason: 'approval status: rejected' }],
    });
    expect(writeAuditMock).toHaveBeenCalledTimes(1);
    expect(writeAuditMock).toHaveBeenCalledWith({
      actor_id: 'user-2',
      action: 'source.stale_blocked',
      resource_type: 'source',
      resource_id: 'src-x',
      conversation_id: undefined,
      meta_json: { reason: 'approval status: rejected', title: null },
    });
  });
});
