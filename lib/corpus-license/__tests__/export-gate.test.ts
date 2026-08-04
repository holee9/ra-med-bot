// @vitest-environment node
// @MX:NOTE [AUTO] Unit tests for lib/corpus-license/export-gate (SPEC-REGULA-CORPUS-LICENSE-001).
// @MX:SPEC SPEC-REGULA-CORPUS-LICENSE-001 (REQ-CORPUSLIC-007/011)

import { beforeEach, describe, expect, it, vi } from 'vitest';

const fetchPermittedUse = vi.fn();
const auditExportBlocked = vi.fn(async () => {});

vi.mock('@/lib/corpus-license/permitted-use', () => ({ fetchPermittedUse }));
vi.mock('@/lib/corpus-license/audit', () => ({ auditExportBlocked }));

const { auditExportBlockedBatch, verifyExportRights } = await import('../export-gate');

const exportAllowedPolicy = {
  sourceId: 's1',
  licenseType: 'open',
  permittedUse: { ingest: true, export: true },
  fullTextAllowed: true,
  abstractOnly: false,
  hasActiveEntitlement: false,
};

beforeEach(() => {
  vi.clearAllMocks();
  fetchPermittedUse.mockResolvedValue(exportAllowedPolicy);
});

describe('verifyExportRights (REQ-011)', () => {
  it('returns allowed:true for empty sourceIds', async () => {
    expect(await verifyExportRights({ sourceIds: [], orgId: 'org-1' })).toEqual({
      allowed: true,
      blockedSources: [],
    });
  });

  it('returns allowed:true when all sources permit export', async () => {
    const result = await verifyExportRights({ sourceIds: ['s1', 's2'], orgId: 'org-1' });
    expect(result.allowed).toBe(true);
  });

  it('blocks sources with no license metadata', async () => {
    fetchPermittedUse.mockResolvedValueOnce(null);
    const result = await verifyExportRights({ sourceIds: ['s1'], orgId: 'org-1' });
    expect(result.allowed).toBe(false);
    expect(result.blockedSources[0]?.reason).toBe('no_license_metadata');
  });

  it('blocks sources whose policy denies export', async () => {
    fetchPermittedUse.mockResolvedValueOnce({
      ...exportAllowedPolicy,
      permittedUse: { export: false },
    });
    const result = await verifyExportRights({ sourceIds: ['s1'], orgId: 'org-1' });
    expect(result.allowed).toBe(false);
    expect(result.blockedSources[0]?.reason).toBe('export_not_permitted');
  });
});

describe('auditExportBlockedBatch', () => {
  it('writes audit for each blocked source', async () => {
    await auditExportBlockedBatch({
      userId: 'u-1',
      blockedSources: [
        { sourceId: 's1', reason: 'no_license_metadata' },
        { sourceId: 's2', reason: 'export_not_permitted' },
      ],
    });
    expect(auditExportBlocked).toHaveBeenCalledTimes(2);
  });

  it('writes nothing when blockedSources is empty', async () => {
    await auditExportBlockedBatch({ userId: 'u-1', blockedSources: [] });
    expect(auditExportBlocked).not.toHaveBeenCalled();
  });
});
