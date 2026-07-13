// @vitest-environment node
// @MX:NOTE [AUTO] Unit tests for lib/corpus-license/audit (SPEC-REGULA-CORPUS-LICENSE-001).
// @MX:SPEC SPEC-REGULA-CORPUS-LICENSE-001 (REQ-CORPUSLIC-010..014)

import { beforeEach, describe, expect, it, vi } from 'vitest';

type AuditInput = {
  actor_id: string | null;
  action: string;
  resource_type: string;
  resource_id: string;
  meta_json?: Record<string, unknown>;
};

const writeAudit = vi.fn(async (_input: AuditInput) => {});

vi.mock('@/lib/audit', () => ({ writeAudit }));

const {
  auditAbstractOnlyEnforced,
  auditCorpusAccessDenied,
  auditEntitlementGranted,
  auditEntitlementRevoked,
  auditExportBlocked,
  auditExpiryWarned,
  auditFullTextBlocked,
  auditIngestionBlocked,
  auditLicenseSet,
} = await import('../audit');

function lastAudit(): AuditInput {
  const calls = writeAudit.mock.calls as unknown[][];
  return calls[calls.length - 1]?.[0] as AuditInput;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('lib/corpus-license/audit (REQ-CORPUSLIC)', () => {
  it('auditLicenseSet writes corpus.license_set', async () => {
    await auditLicenseSet({
      userId: 'u-1',
      sourceLicenseId: 'lic-1',
      sourceId: 'src-1',
      licenseType: 'subscription',
    });
    expect(lastAudit().action).toBe('corpus.license_set');
    expect(lastAudit().meta_json).toMatchObject({ licenseType: 'subscription' });
  });

  it('auditIngestionBlocked writes corpus.ingestion_blocked', async () => {
    await auditIngestionBlocked({ userId: 'u-1', sourceId: 'src-1', reason: 'no_license' });
    expect(lastAudit().action).toBe('corpus.ingestion_blocked');
  });

  it('auditFullTextBlocked writes corpus.full_text_blocked', async () => {
    await auditFullTextBlocked({ userId: 'u-1', sourceId: 'src-1', licenseType: 'paid' });
    expect(lastAudit().action).toBe('corpus.full_text_blocked');
  });

  it('auditEntitlementGranted writes corpus.entitlement_granted', async () => {
    await auditEntitlementGranted({
      userId: 'u-1',
      entitlementId: 'ent-1',
      sourceLicenseId: 'lic-1',
    });
    expect(lastAudit().action).toBe('corpus.entitlement_granted');
  });

  it('auditEntitlementRevoked writes corpus.entitlement_revoked', async () => {
    await auditEntitlementRevoked({
      userId: 'u-1',
      entitlementId: 'ent-1',
      sourceLicenseId: 'lic-1',
    });
    expect(lastAudit().action).toBe('corpus.entitlement_revoked');
  });

  it('auditExportBlocked writes corpus.export_blocked', async () => {
    await auditExportBlocked({ userId: 'u-1', sourceId: 'src-1', reason: 'not_entitled' });
    expect(lastAudit().action).toBe('corpus.export_blocked');
  });

  it('auditCorpusAccessDenied writes corpus.access_denied', async () => {
    await auditCorpusAccessDenied({ userId: 'u-1', sourceId: 'src-1', reason: 'cross_org' });
    expect(lastAudit().action).toBe('corpus.access_denied');
  });

  it('auditExpiryWarned writes corpus.expiry_warned', async () => {
    await auditExpiryWarned({
      userId: 'u-1',
      sourceLicenseId: 'lic-1',
      sourceId: 'src-1',
      expiryDate: '2026-12-31',
    });
    expect(lastAudit().action).toBe('corpus.expiry_warned');
  });

  it('auditAbstractOnlyEnforced writes corpus.abstract_only_enforced', async () => {
    await auditAbstractOnlyEnforced({ userId: 'u-1', sourceId: 'src-1' });
    expect(lastAudit().action).toBe('corpus.abstract_only_enforced');
  });
});
