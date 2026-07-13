// @vitest-environment node
// @MX:NOTE [AUTO] Unit tests for lib/source-governance/stale-check (SPEC-REGULA-SOURCE-GOVERNANCE-001).
// @MX:SPEC SPEC-REGULA-SOURCE-GOVERNANCE-001 (REQ-SOURCE-GOV-007/015, AC-03)

import { beforeEach, describe, expect, it, vi } from 'vitest';

let rows: unknown[] = [];

type AuditInput = {
  actor_id: string | null;
  action: string;
  resource_type: string;
  resource_id: string;
  meta_json?: Record<string, unknown>;
};

const writeAudit = vi.fn(async (_input: AuditInput) => {});

vi.mock('@/lib/audit', () => ({ writeAudit }));

vi.mock('@/lib/db/client', () => {
  const chain: Record<string, unknown> = {};
  chain.from = () => chain;
  chain.where = () => chain;
  // Intentional thenable: `await` on the chain resolves to rows.
  // biome-ignore lint/suspicious/noThenProperty: deliberate chainable thenable for the db mock
  chain.then = (resolve: (v: unknown) => void) => resolve(rows);
  return { db: { select: () => chain } };
});

const { auditStaleBlockedBatch, verifyGovernanceFreshness } = await import('../stale-check');

beforeEach(() => {
  vi.clearAllMocks();
  rows = [];
});

describe('verifyGovernanceFreshness (REQ-SOURCE-GOV-007, AC-03)', () => {
  it('returns allowed:true for empty sourceIds', async () => {
    expect(await verifyGovernanceFreshness([], 'org-1')).toEqual({
      allowed: true,
      blockedSources: [],
    });
  });

  it('returns allowed:true when all sources are clean', async () => {
    rows = [
      {
        id: 's1',
        title: 'ISO 13485',
        supersededBy: null,
        sunsetDate: null,
        effectiveDate: null,
        approvalStatus: 'approved',
      },
    ];
    const result = await verifyGovernanceFreshness(['s1'], 'org-1');
    expect(result.allowed).toBe(true);
  });

  it('blocks superseded sources', async () => {
    rows = [
      {
        id: 's1',
        title: 'Old',
        supersededBy: 's2',
        sunsetDate: null,
        effectiveDate: null,
        approvalStatus: 'approved',
      },
    ];
    const result = await verifyGovernanceFreshness(['s1'], 'org-1');
    expect(result.allowed).toBe(false);
    expect(result.blockedSources[0]?.reason).toContain('superseded');
  });

  it('blocks sunset-past sources', async () => {
    rows = [
      {
        id: 's1',
        title: 'Expired',
        supersededBy: null,
        sunsetDate: '2025-01-01',
        effectiveDate: null,
        approvalStatus: 'approved',
      },
    ];
    const result = await verifyGovernanceFreshness(['s1'], 'org-1');
    expect(result.allowed).toBe(false);
    expect(result.blockedSources[0]?.reason).toContain('sunset');
  });

  it('blocks not-yet-effective sources', async () => {
    rows = [
      {
        id: 's1',
        title: 'Future',
        supersededBy: null,
        sunsetDate: null,
        effectiveDate: '2030-01-01',
        approvalStatus: 'approved',
      },
    ];
    const result = await verifyGovernanceFreshness(['s1'], 'org-1');
    expect(result.allowed).toBe(false);
    expect(result.blockedSources[0]?.reason).toContain('effective');
  });

  it('blocks pending-approval sources', async () => {
    rows = [
      {
        id: 's1',
        title: 'Pending',
        supersededBy: null,
        sunsetDate: null,
        effectiveDate: null,
        approvalStatus: 'pending_review',
      },
    ];
    const result = await verifyGovernanceFreshness(['s1'], 'org-1');
    expect(result.allowed).toBe(false);
    expect(result.blockedSources[0]?.reason).toContain('approval');
  });
});

describe('auditStaleBlockedBatch (REQ-SOURCE-GOV-015)', () => {
  it('writes a source.stale_blocked audit for each blocked source', async () => {
    await auditStaleBlockedBatch({
      userId: 'u-1',
      blockedSources: [
        { sourceId: 's1', title: 'Old', reason: 'superseded by s2' },
        { sourceId: 's2', title: 'Future', reason: 'not yet effective' },
      ],
    });
    expect(writeAudit).toHaveBeenCalledTimes(2);
    const first = writeAudit.mock.calls[0]?.[0] as AuditInput;
    expect(first.action).toBe('source.stale_blocked');
    expect(first.resource_id).toBe('s1');
  });

  it('writes nothing when blockedSources is empty', async () => {
    await auditStaleBlockedBatch({ userId: 'u-1', blockedSources: [] });
    expect(writeAudit).not.toHaveBeenCalled();
  });
});
