// @MX:NOTE [AUTO] Unit tests for corpus-license audit wrappers (9 exports).
// @MX:SPEC SPEC-REGULA-CORPUS-LICENSE-001 (REQ-CORPUSL-010/012/014, Issue #402)
// @MX:REASON Each export is a thin writeAudit wrapper with distinct action
//   strings + meta_json shapes. Tests verify the exact payload passed to
//   writeAudit for each of the 9 functions, plus the optional tx pass-through.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const writeAuditMock = vi.fn().mockResolvedValue(undefined);

vi.mock('@/lib/audit', () => ({
  writeAudit: writeAuditMock,
  // AuditDbHandle is a type-only export; no runtime value needed.
}));

beforeEach(() => {
  writeAuditMock.mockClear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('corpus-license/audit — auditLicenseSet (REQ-001/010)', () => {
  it('writes corpus.license_set audit with licenseType + sourceId', async () => {
    const { auditLicenseSet } = await import('@/lib/corpus-license/audit');
    await auditLicenseSet({
      userId: 'u-1',
      sourceLicenseId: 'lic-1',
      sourceId: 'src-1',
      licenseType: 'subscription',
    });
    expect(writeAuditMock).toHaveBeenCalledTimes(1);
    expect(writeAuditMock).toHaveBeenCalledWith(
      {
        actor_id: 'u-1',
        action: 'corpus.license_set',
        resource_type: 'sourceLicense',
        resource_id: 'lic-1',
        meta_json: { sourceId: 'src-1', licenseType: 'subscription', expiryDate: null },
      },
      undefined,
    );
  });

  it('includes expiryDate in meta when provided', async () => {
    const { auditLicenseSet } = await import('@/lib/corpus-license/audit');
    await auditLicenseSet({
      userId: 'u-1',
      sourceLicenseId: 'lic-1',
      sourceId: 'src-1',
      licenseType: 'perpetual',
      expiryDate: '2027-01-01',
    });
    const arg = writeAuditMock.mock.calls[0]?.[0];
    expect(arg?.meta_json).toEqual({
      sourceId: 'src-1',
      licenseType: 'perpetual',
      expiryDate: '2027-01-01',
    });
  });

  it('passes tx handle as second arg when provided', async () => {
    const { auditLicenseSet } = await import('@/lib/corpus-license/audit');
    const tx = { __isTx: true } as unknown as Parameters<typeof auditLicenseSet>[1];
    await auditLicenseSet(
      {
        userId: 'u-1',
        sourceLicenseId: 'lic-1',
        sourceId: 'src-1',
        licenseType: 'subscription',
      },
      tx,
    );
    expect(writeAuditMock).toHaveBeenCalledWith(expect.anything(), tx);
  });

  it('handles null expiryDate explicitly', async () => {
    const { auditLicenseSet } = await import('@/lib/corpus-license/audit');
    await auditLicenseSet({
      userId: 'u-1',
      sourceLicenseId: 'lic-1',
      sourceId: 'src-1',
      licenseType: 'subscription',
      expiryDate: null,
    });
    const arg = writeAuditMock.mock.calls[0]?.[0];
    expect(arg?.meta_json?.expiryDate).toBeNull();
  });
});

describe('corpus-license/audit — auditIngestionBlocked (REQ-002/003)', () => {
  it('writes corpus.ingestion_blocked with reason', async () => {
    const { auditIngestionBlocked } = await import('@/lib/corpus-license/audit');
    await auditIngestionBlocked({
      userId: 'u-2',
      sourceId: 'src-2',
      reason: 'no active license',
    });
    expect(writeAuditMock).toHaveBeenCalledWith(
      {
        actor_id: 'u-2',
        action: 'corpus.ingestion_blocked',
        resource_type: 'source',
        resource_id: 'src-2',
        meta_json: { reason: 'no active license' },
      },
      undefined,
    );
  });
});

describe('corpus-license/audit — auditFullTextBlocked (REQ-004)', () => {
  it('writes corpus.full_text_blocked with licenseType', async () => {
    const { auditFullTextBlocked } = await import('@/lib/corpus-license/audit');
    await auditFullTextBlocked({
      userId: 'u-3',
      sourceId: 'src-3',
      licenseType: 'abstract_only',
    });
    expect(writeAuditMock).toHaveBeenCalledWith(
      {
        actor_id: 'u-3',
        action: 'corpus.full_text_blocked',
        resource_type: 'source',
        resource_id: 'src-3',
        meta_json: { licenseType: 'abstract_only' },
      },
      undefined,
    );
  });
});

describe('corpus-license/audit — auditEntitlementGranted (REQ-008)', () => {
  it('writes corpus.entitlement_granted with sourceLicenseId', async () => {
    const { auditEntitlementGranted } = await import('@/lib/corpus-license/audit');
    await auditEntitlementGranted({
      userId: 'u-4',
      entitlementId: 'ent-1',
      sourceLicenseId: 'lic-2',
    });
    expect(writeAuditMock).toHaveBeenCalledWith(
      {
        actor_id: 'u-4',
        action: 'corpus.entitlement_granted',
        resource_type: 'entitlement',
        resource_id: 'ent-1',
        meta_json: { sourceLicenseId: 'lic-2' },
      },
      undefined,
    );
  });
});

describe('corpus-license/audit — auditEntitlementRevoked (REQ-008)', () => {
  it('writes corpus.entitlement_revoked', async () => {
    const { auditEntitlementRevoked } = await import('@/lib/corpus-license/audit');
    await auditEntitlementRevoked({
      userId: 'u-5',
      entitlementId: 'ent-2',
      sourceLicenseId: 'lic-3',
    });
    expect(writeAuditMock).toHaveBeenCalledWith(
      {
        actor_id: 'u-5',
        action: 'corpus.entitlement_revoked',
        resource_type: 'entitlement',
        resource_id: 'ent-2',
        meta_json: { sourceLicenseId: 'lic-3' },
      },
      undefined,
    );
  });
});

describe('corpus-license/audit — auditExportBlocked (REQ-011)', () => {
  it('writes corpus.export_blocked with reason', async () => {
    const { auditExportBlocked } = await import('@/lib/corpus-license/audit');
    await auditExportBlocked({ userId: 'u-6', sourceId: 'src-4', reason: 'no entitlement' });
    expect(writeAuditMock).toHaveBeenCalledWith(
      {
        actor_id: 'u-6',
        action: 'corpus.export_blocked',
        resource_type: 'source',
        resource_id: 'src-4',
        meta_json: { reason: 'no entitlement' },
      },
      undefined,
    );
  });
});

describe('corpus-license/audit — auditCorpusAccessDenied (REQ-012)', () => {
  it('writes corpus.access_denied with reason', async () => {
    const { auditCorpusAccessDenied } = await import('@/lib/corpus-license/audit');
    await auditCorpusAccessDenied({ userId: 'u-7', sourceId: 'src-5', reason: 'cross-org' });
    expect(writeAuditMock).toHaveBeenCalledWith(
      {
        actor_id: 'u-7',
        action: 'corpus.access_denied',
        resource_type: 'source',
        resource_id: 'src-5',
        meta_json: { reason: 'cross-org' },
      },
      undefined,
    );
  });
});

describe('corpus-license/audit — auditExpiryWarned (REQ-014)', () => {
  it('writes corpus.expiry_warned with sourceId + expiryDate', async () => {
    const { auditExpiryWarned } = await import('@/lib/corpus-license/audit');
    await auditExpiryWarned({
      userId: 'u-8',
      sourceLicenseId: 'lic-4',
      sourceId: 'src-6',
      expiryDate: '2027-06-30',
    });
    expect(writeAuditMock).toHaveBeenCalledWith(
      {
        actor_id: 'u-8',
        action: 'corpus.expiry_warned',
        resource_type: 'sourceLicense',
        resource_id: 'lic-4',
        meta_json: { sourceId: 'src-6', expiryDate: '2027-06-30' },
      },
      undefined,
    );
  });
});

describe('corpus-license/audit — auditAbstractOnlyEnforced (REQ-013)', () => {
  it('writes corpus.abstract_only_enforced with empty meta', async () => {
    const { auditAbstractOnlyEnforced } = await import('@/lib/corpus-license/audit');
    await auditAbstractOnlyEnforced({ userId: 'u-9', sourceId: 'src-7' });
    expect(writeAuditMock).toHaveBeenCalledWith(
      {
        actor_id: 'u-9',
        action: 'corpus.abstract_only_enforced',
        resource_type: 'source',
        resource_id: 'src-7',
        meta_json: {},
      },
      undefined,
    );
  });
});

describe('corpus-license/audit — tx pass-through (all 9 exports)', () => {
  it('passes tx to writeAudit for every export when provided', async () => {
    const mod = await import('@/lib/corpus-license/audit');
    const tx = { __isTx: true } as never;
    const base = { userId: 'u-tx' } as const;

    await mod.auditLicenseSet(
      { ...base, sourceLicenseId: 'l', sourceId: 's', licenseType: 't' },
      tx,
    );
    await mod.auditIngestionBlocked({ ...base, sourceId: 's', reason: 'r' }, tx);
    await mod.auditFullTextBlocked({ ...base, sourceId: 's', licenseType: 't' }, tx);
    await mod.auditEntitlementGranted({ ...base, entitlementId: 'e', sourceLicenseId: 'l' }, tx);
    await mod.auditEntitlementRevoked({ ...base, entitlementId: 'e', sourceLicenseId: 'l' }, tx);
    await mod.auditExportBlocked({ ...base, sourceId: 's', reason: 'r' }, tx);
    await mod.auditCorpusAccessDenied({ ...base, sourceId: 's', reason: 'r' }, tx);
    await mod.auditExpiryWarned(
      { ...base, sourceLicenseId: 'l', sourceId: 's', expiryDate: '2027-01-01' },
      tx,
    );
    await mod.auditAbstractOnlyEnforced({ ...base, sourceId: 's' }, tx);

    // All 9 calls should pass `tx` as the second argument.
    for (const call of writeAuditMock.mock.calls) {
      expect(call[1]).toBe(tx);
    }
    expect(writeAuditMock).toHaveBeenCalledTimes(9);
  });
});
