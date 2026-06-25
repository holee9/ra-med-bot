// @MX:NOTE [AUTO] Corpus-license-specific audit helpers wrapping writeAudit().
// @MX:SPEC SPEC-REGULA-CORPUS-LICENSE-001 (REQ-CORPUSLIC-010/012/014)
//
// 21 CFR Part 11: every regulated license/entitlement action is recorded through
// the central append-only audit pipeline. meta_json is PII-free — only source IDs,
// license types, and status labels are stored.
//
// Atomicity (Part 11): every wrapper accepts an optional `tx` handle so the
// audit insert rides the same transaction boundary as the mutation.

import { type AuditDbHandle, writeAudit } from '../audit';

type AuditTx = AuditDbHandle | undefined;

/** REQ-001/010: license metadata created or updated. */
export async function auditLicenseSet(
  params: {
    userId: string;
    sourceLicenseId: string;
    sourceId: string;
    licenseType: string;
    expiryDate?: string | null;
  },
  tx?: AuditTx,
): Promise<void> {
  await writeAudit(
    {
      actor_id: params.userId,
      action: 'corpus.license_set',
      resource_type: 'sourceLicense',
      resource_id: params.sourceLicenseId,
      meta_json: {
        sourceId: params.sourceId,
        licenseType: params.licenseType,
        expiryDate: params.expiryDate ?? null,
      },
    },
    tx,
  );
}

/** REQ-002/003: ingestion gate blocked an unlicensed source. */
export async function auditIngestionBlocked(
  params: { userId: string; sourceId: string; reason: string },
  tx?: AuditTx,
): Promise<void> {
  await writeAudit(
    {
      actor_id: params.userId,
      action: 'corpus.ingestion_blocked',
      resource_type: 'source',
      resource_id: params.sourceId,
      meta_json: { reason: params.reason },
    },
    tx,
  );
}

/** REQ-004: paid full-text blocked without entitlement. */
export async function auditFullTextBlocked(
  params: { userId: string; sourceId: string; licenseType: string },
  tx?: AuditTx,
): Promise<void> {
  await writeAudit(
    {
      actor_id: params.userId,
      action: 'corpus.full_text_blocked',
      resource_type: 'source',
      resource_id: params.sourceId,
      meta_json: { licenseType: params.licenseType },
    },
    tx,
  );
}

/** REQ-008: entitlement granted for a source_license. */
export async function auditEntitlementGranted(
  params: { userId: string; entitlementId: string; sourceLicenseId: string },
  tx?: AuditTx,
): Promise<void> {
  await writeAudit(
    {
      actor_id: params.userId,
      action: 'corpus.entitlement_granted',
      resource_type: 'entitlement',
      resource_id: params.entitlementId,
      meta_json: { sourceLicenseId: params.sourceLicenseId },
    },
    tx,
  );
}

/** REQ-008: entitlement revoked — source search-excluded. */
export async function auditEntitlementRevoked(
  params: { userId: string; entitlementId: string; sourceLicenseId: string },
  tx?: AuditTx,
): Promise<void> {
  await writeAudit(
    {
      actor_id: params.userId,
      action: 'corpus.entitlement_revoked',
      resource_type: 'entitlement',
      resource_id: params.entitlementId,
      meta_json: { sourceLicenseId: params.sourceLicenseId },
    },
    tx,
  );
}

/** REQ-011: export blocked for an unentitled source. */
export async function auditExportBlocked(
  params: { userId: string; sourceId: string; reason: string },
  tx?: AuditTx,
): Promise<void> {
  await writeAudit(
    {
      actor_id: params.userId,
      action: 'corpus.export_blocked',
      resource_type: 'source',
      resource_id: params.sourceId,
      meta_json: { reason: params.reason },
    },
    tx,
  );
}

/** REQ-012: cross-org or unauthorized access blocked. */
export async function auditCorpusAccessDenied(
  params: { userId: string; sourceId: string; reason: string },
  tx?: AuditTx,
): Promise<void> {
  await writeAudit(
    {
      actor_id: params.userId,
      action: 'corpus.access_denied',
      resource_type: 'source',
      resource_id: params.sourceId,
      meta_json: { reason: params.reason },
    },
    tx,
  );
}

/** REQ-014: admin warned of upcoming license expiry. */
export async function auditExpiryWarned(
  params: { userId: string; sourceLicenseId: string; sourceId: string; expiryDate: string },
  tx?: AuditTx,
): Promise<void> {
  await writeAudit(
    {
      actor_id: params.userId,
      action: 'corpus.expiry_warned',
      resource_type: 'sourceLicense',
      resource_id: params.sourceLicenseId,
      meta_json: { sourceId: params.sourceId, expiryDate: params.expiryDate },
    },
    tx,
  );
}

/** REQ-013: abstract-only policy enforced, full-text blocked. */
export async function auditAbstractOnlyEnforced(
  params: { userId: string; sourceId: string },
  tx?: AuditTx,
): Promise<void> {
  await writeAudit(
    {
      actor_id: params.userId,
      action: 'corpus.abstract_only_enforced',
      resource_type: 'source',
      resource_id: params.sourceId,
      meta_json: {},
    },
    tx,
  );
}
