// @vitest-environment node
// @MX:NOTE [AUTO] Unit tests for lib/corpus-license/entitlement (SPEC-REGULA-CORPUS-LICENSE-001).
// @MX:SPEC SPEC-REGULA-CORPUS-LICENSE-001 (REQ-CORPUSLIC-008)

import { beforeEach, describe, expect, it, vi } from 'vitest';

let selectQueue: unknown[][] = [];
const txInsertReturning = vi.fn().mockResolvedValue([{ id: 'ent-new' }]);
const txUpdateWhere = vi.fn().mockResolvedValue(undefined);
const auditEntitlementGranted = vi.fn(async () => {});
const auditEntitlementRevoked = vi.fn(async () => {});

vi.mock('@/lib/corpus-license/audit', () => ({ auditEntitlementGranted, auditEntitlementRevoked }));

vi.mock('@/lib/db/client', () => {
  const chain: Record<string, unknown> = {};
  chain.from = () => chain;
  chain.where = () => chain;
  chain.limit = () => chain;
  // Intentional thenable: `await` on the chain pops the next queued select result.
  // biome-ignore lint/suspicious/noThenProperty: deliberate chainable thenable for the db mock
  chain.then = (resolve: (v: unknown) => void) => resolve(selectQueue.shift() ?? []);
  const tx = {
    select: () => chain,
    insert: () => ({ values: () => ({ returning: txInsertReturning }) }),
    update: () => ({ set: () => ({ where: txUpdateWhere }) }),
  };
  return {
    withTenantScope: vi.fn(async (_orgId: string, fn: (tx: unknown) => unknown) => fn(tx)),
  };
});

const { grantEntitlement, revokeEntitlement } = await import('../entitlement');

beforeEach(() => {
  vi.clearAllMocks();
  selectQueue = [];
  txInsertReturning.mockResolvedValue([{ id: 'ent-new' }]);
});

describe('grantEntitlement (REQ-CORPUSLIC-008)', () => {
  it('creates a new entitlement + audit when none exists', async () => {
    selectQueue = [
      [{ id: 'lic-1', orgId: 'org-1' }], // license in-org
      [], // no existing active entitlement
    ];
    const result = await grantEntitlement({
      sourceLicenseId: 'lic-1',
      orgId: 'org-1',
      grantedBy: 'u-1',
    });
    expect(result).toEqual({ entitlementId: 'ent-new', created: true });
    expect(auditEntitlementGranted).toHaveBeenCalled();
  });

  it('returns the existing entitlement (idempotent) without creating a duplicate', async () => {
    selectQueue = [
      [{ id: 'lic-1', orgId: 'org-1' }], // license in-org
      [{ id: 'ent-1' }], // existing active entitlement
    ];
    const result = await grantEntitlement({
      sourceLicenseId: 'lic-1',
      orgId: 'org-1',
      grantedBy: 'u-1',
    });
    expect(result).toEqual({ entitlementId: 'ent-1', created: false });
    expect(txInsertReturning).not.toHaveBeenCalled();
  });

  it('returns empty + created false on an IDOR miss (cross-org license)', async () => {
    selectQueue = [[{ id: 'lic-1', orgId: 'org-B' }]]; // cross-org
    const result = await grantEntitlement({
      sourceLicenseId: 'lic-1',
      orgId: 'org-A',
      grantedBy: 'u-1',
    });
    expect(result).toEqual({ entitlementId: '', created: false });
  });

  it('returns empty + created false when the license does not exist', async () => {
    selectQueue = [[]]; // license not found
    const result = await grantEntitlement({
      sourceLicenseId: 'x',
      orgId: 'org-1',
      grantedBy: 'u-1',
    });
    expect(result).toEqual({ entitlementId: '', created: false });
  });
});

describe('revokeEntitlement (REQ-CORPUSLIC-008)', () => {
  it('revokes an active entitlement + audit', async () => {
    selectQueue = [[{ id: 'ent-1' }]]; // active entitlement found
    const result = await revokeEntitlement({
      sourceLicenseId: 'lic-1',
      orgId: 'org-1',
      revokedBy: 'u-1',
    });
    expect(result).toEqual({ entitlementId: 'ent-1', revoked: true });
    expect(txUpdateWhere).toHaveBeenCalled();
    expect(auditEntitlementRevoked).toHaveBeenCalled();
  });

  it('returns empty + revoked false when no active entitlement exists', async () => {
    selectQueue = [[]];
    const result = await revokeEntitlement({
      sourceLicenseId: 'lic-1',
      orgId: 'org-1',
      revokedBy: 'u-1',
    });
    expect(result).toEqual({ entitlementId: '', revoked: false });
  });
});
