// @vitest-environment node
// @MX:NOTE [AUTO] Unit tests for lib/corpus-license/license-gate (SPEC-REGULA-CORPUS-LICENSE-001).
// @MX:SPEC SPEC-REGULA-CORPUS-LICENSE-001 (REQ-CORPUSLIC-002/003/004)

import { beforeEach, describe, expect, it, vi } from 'vitest';

const fetchPermittedUse = vi.fn();
const isFullTextBlocked = vi.fn();
const auditIngestionBlocked = vi.fn(async () => {});
const auditFullTextBlocked = vi.fn(async () => {});

vi.mock('@/lib/corpus-license/permitted-use', () => ({ fetchPermittedUse, isFullTextBlocked }));
vi.mock('@/lib/corpus-license/audit', () => ({ auditIngestionBlocked, auditFullTextBlocked }));

const { assertIngestionLicensed } = await import('../license-gate');

const validPolicy = { permittedUse: { ingest: true }, licenseType: 'subscription' };

beforeEach(() => {
  vi.clearAllMocks();
  fetchPermittedUse.mockResolvedValue(validPolicy);
  isFullTextBlocked.mockReturnValue(false);
});

describe('assertIngestionLicensed (REQ-CORPUSLIC-002/003/004)', () => {
  it('blocks with no_license_metadata when no policy exists (REQ-003)', async () => {
    fetchPermittedUse.mockResolvedValueOnce(null);
    const result = await assertIngestionLicensed({ sourceId: 's1', orgId: 'org-1', userId: 'u-1' });
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('no_license_metadata');
    expect(auditIngestionBlocked).toHaveBeenCalled();
  });

  it('blocks with ingest_not_permitted when policy denies ingest (REQ-002)', async () => {
    fetchPermittedUse.mockResolvedValueOnce({
      permittedUse: { ingest: false },
      licenseType: 'restricted',
    });
    const result = await assertIngestionLicensed({ sourceId: 's1', orgId: 'org-1', userId: 'u-1' });
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('ingest_not_permitted');
  });

  it('blocks with full_text_requires_entitlement for paid full-text without entitlement (REQ-004)', async () => {
    isFullTextBlocked.mockReturnValueOnce(true);
    const result = await assertIngestionLicensed({
      sourceId: 's1',
      orgId: 'org-1',
      userId: 'u-1',
      wantsFullText: true,
    });
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('full_text_requires_entitlement');
    expect(auditFullTextBlocked).toHaveBeenCalled();
  });

  it('allows ingestion when the policy permits and full-text is not blocked', async () => {
    const result = await assertIngestionLicensed({ sourceId: 's1', orgId: 'org-1', userId: 'u-1' });
    expect(result.allowed).toBe(true);
    expect(result.licenseType).toBe('subscription');
  });

  it('skips the full-text check when wantsFullText is false', async () => {
    isFullTextBlocked.mockReturnValueOnce(true);
    const result = await assertIngestionLicensed({
      sourceId: 's1',
      orgId: 'org-1',
      userId: 'u-1',
      wantsFullText: false,
    });
    expect(result.allowed).toBe(true);
    expect(isFullTextBlocked).not.toHaveBeenCalled();
  });
});
