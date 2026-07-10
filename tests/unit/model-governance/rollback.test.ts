// @MX:NOTE [AUTO] Unit tests for rollbackCombination (REQ-MODELGOV-006, AC-03).
// @MX:SPEC SPEC-REGULA-MODEL-GOVERNANCE-001 / Issue #402 (coverage ratchet-up).
// Mocks withTenantScope (calls cb with a mock tx) + the audit fn. No real DB.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// biome-ignore lint/suspicious/noExplicitAny: mock tx is intentionally loose
let mockTx: any;
// biome-ignore lint/suspicious/noExplicitAny: queued select result rows
const selectResults: any[][] = [];
const auditMock = vi.fn().mockResolvedValue(undefined);

async function loadModule() {
  vi.doMock('@/lib/db/client', () => ({
    withTenantScope: async (_orgId: string, cb: (tx: unknown) => Promise<unknown>) => cb(mockTx),
  }));
  vi.doMock('@/lib/db/schema', () => ({
    approvedCombination: {
      id: 'id',
      orgId: 'orgId',
      active: 'active',
      supersededBy: 'supersededBy',
      approvedAt: 'approvedAt',
    },
  }));
  vi.doMock('@/lib/model-governance/audit', () => ({ auditRolledBack: auditMock }));
  vi.resetModules();
  return import('@/lib/model-governance/rollback');
}

beforeEach(() => {
  selectResults.length = 0;
  auditMock.mockClear();
  mockTx = {
    select: () => ({
      from: () => ({
        // `.where(...)` returns both `.limit()` and `.orderBy().limit()` paths;
        // each terminal `.limit()` shifts the next queued result.
        where: () => ({
          limit: () => Promise.resolve(selectResults.shift() ?? []),
          orderBy: () => ({ limit: () => Promise.resolve(selectResults.shift() ?? []) }),
        }),
      }),
    }),
    update: () => ({ set: () => ({ where: () => Promise.resolve() }) }),
  };
});

afterEach(() => {
  vi.doUnmock('@/lib/db/client');
  vi.doUnmock('@/lib/db/schema');
  vi.doUnmock('@/lib/model-governance/audit');
});

describe('rollbackCombination (REQ-MODELGOV-006)', () => {
  it('throws RollbackError when there is no active combination to rollback from', async () => {
    selectResults.push([]); // current active select → no row
    const { rollbackCombination, RollbackError } = await loadModule();
    await expect(rollbackCombination({ orgId: 'org-1', actorId: 'u-1' })).rejects.toThrow(
      RollbackError,
    );
    await expect(rollbackCombination({ orgId: 'org-1', actorId: 'u-1' })).rejects.toThrow(
      'no_active_combination_to_rollback_from',
    );
  });

  it('rolls back to an explicit toCombinationId (inactive, same org)', async () => {
    selectResults.push([{ id: 'current-id' }], [{ id: 'target-id' }]); // current, target
    const { rollbackCombination } = await loadModule();
    const result = await rollbackCombination({
      orgId: 'org-1',
      actorId: 'u-1',
      toCombinationId: 'target-id',
    });
    expect(result).toEqual({ fromId: 'current-id', toId: 'target-id' });
    expect(auditMock).toHaveBeenCalledTimes(1);
    expect(auditMock).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId: 'u-1',
        orgId: 'org-1',
        resourceId: 'target-id',
        fromCombinationId: 'current-id',
        toCombinationId: 'target-id',
      }),
    );
  });

  it('throws RollbackError when explicit target is not found or still active', async () => {
    selectResults.push([{ id: 'current-id' }], []); // current exists, target missing
    const { rollbackCombination, RollbackError } = await loadModule();
    await expect(
      rollbackCombination({ orgId: 'org-1', actorId: 'u-1', toCombinationId: 'ghost' }),
    ).rejects.toThrow(RollbackError);
  });

  it('rolls back to the most-recently-superseded combination when no target given (DESC)', async () => {
    selectResults.push([{ id: 'current-id' }], [{ id: 'prev-id' }]); // current, prev (DESC)
    const { rollbackCombination } = await loadModule();
    const result = await rollbackCombination({ orgId: 'org-1', actorId: 'u-1' });
    expect(result).toEqual({ fromId: 'current-id', toId: 'prev-id' });
    expect(auditMock).toHaveBeenCalledWith(expect.objectContaining({ toCombinationId: 'prev-id' }));
  });

  it('throws RollbackError when no previous combination exists to rollback to', async () => {
    selectResults.push([{ id: 'current-id' }], []); // current exists, no prev
    const { rollbackCombination, RollbackError } = await loadModule();
    await expect(rollbackCombination({ orgId: 'org-1', actorId: 'u-1' })).rejects.toThrow(
      RollbackError,
    );
  });
});
