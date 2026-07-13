// @vitest-environment node
// @MX:NOTE [AUTO] Unit tests for lib/source-governance/delta-sync-hook (SPEC-REGULA-SOURCE-GOVERNANCE-001).
// @MX:SPEC SPEC-REGULA-SOURCE-GOVERNANCE-001 (REQ-SOURCE-GOV-016, AC-07)

import { beforeEach, describe, expect, it, vi } from 'vitest';

let selectQueue: unknown[][] = [];
const txUpdateWhere = vi.fn(async () => {});
const auditSourceDeltaSyncUpdated = vi.fn(async () => {});

vi.mock('@/lib/observability/logger', () => ({
  logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn() },
}));
vi.mock('@/lib/source-governance/audit', () => ({ auditSourceDeltaSyncUpdated }));

vi.mock('@/lib/db/client', () => {
  const chain: Record<string, unknown> = {};
  chain.from = () => chain;
  chain.where = () => chain;
  // Intentional thenable: `await` on the chain pops the next queued select result.
  // biome-ignore lint/suspicious/noThenProperty: deliberate chainable thenable for the db mock
  chain.then = (resolve: (v: unknown) => void) => resolve(selectQueue.shift() ?? []);
  const handle = {
    select: () => chain,
    update: () => ({ set: () => ({ where: txUpdateWhere }) }),
  };
  return {
    withTenantScope: vi.fn(async (_orgId: string, fn: (h: unknown) => unknown) => fn(handle)),
  };
});

const { updateGovernanceFromSync } = await import('../delta-sync-hook');

beforeEach(() => {
  vi.clearAllMocks();
  selectQueue = [];
  txUpdateWhere.mockResolvedValue(undefined);
});

describe('updateGovernanceFromSync (REQ-SOURCE-GOV-016, AC-07)', () => {
  it('returns empty results for empty updates', async () => {
    expect(await updateGovernanceFromSync({ orgId: 'org-1', actorId: 'u-1', updates: [] })).toEqual(
      {
        refreshed: [],
        skipped: [],
      },
    );
  });

  it('refreshes owned sources and audits', async () => {
    selectQueue = [[{ id: 's1' }, { id: 's2' }]];
    const result = await updateGovernanceFromSync({
      orgId: 'org-1',
      actorId: 'u-1',
      updates: [
        { sourceId: 's1', effectiveDate: '2026-01-01' },
        { sourceId: 's2', sunsetDate: '2026-12-31' },
      ],
    });
    expect(result.refreshed).toEqual(['s1', 's2']);
    expect(auditSourceDeltaSyncUpdated).toHaveBeenCalledTimes(2);
  });

  it('skips sources not owned by the org', async () => {
    selectQueue = [[{ id: 's1' }]];
    const result = await updateGovernanceFromSync({
      orgId: 'org-1',
      actorId: 'u-1',
      updates: [{ sourceId: 's1' }, { sourceId: 'sX' }],
    });
    expect(result.refreshed).toEqual(['s1']);
    expect(result.skipped).toEqual(['sX']);
  });

  it('skips a source when the update throws', async () => {
    selectQueue = [[{ id: 's1' }]];
    txUpdateWhere.mockRejectedValueOnce(new Error('db conflict'));
    const result = await updateGovernanceFromSync({
      orgId: 'org-1',
      actorId: 'u-1',
      updates: [{ sourceId: 's1' }],
    });
    expect(result.skipped).toEqual(['s1']);
  });
});
