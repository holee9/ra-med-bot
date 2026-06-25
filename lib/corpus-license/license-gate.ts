// @MX:ANCHOR [AUTO] assertIngestionLicensed — ingestion pre-flight license gate.
// @MX:REASON fan_in >= 3: lib/ingest route, ingestion-gate API, integration tests
//   all call this. REQ-002/003/004 compliance gate — unlicensed sources MUST NOT
//   enter the corpus. A dead-code definition without a call site is a SPEC violation.
// @MX:SPEC SPEC-REGULA-CORPUS-LICENSE-001 (REQ-CORPUSLIC-002, REQ-CORPUSLIC-003, REQ-CORPUSLIC-004)
import { auditFullTextBlocked, auditIngestionBlocked } from './audit';
import { fetchPermittedUse, isFullTextBlocked } from './permitted-use';
import type { GateResult } from './types';

/**
 * REQ-002/003/004 — ingestion pre-flight gate.
 *
 * - REQ-003: NO license metadata ⇒ blocked (`no_license_metadata`).
 * - REQ-002: permitted_use.ingest false ⇒ blocked (`ingest_not_permitted`).
 * - REQ-004: paid-standard full-text without active entitlement ⇒ blocked
 *   (`full_text_requires_entitlement`).
 *
 * Wired at:
 *   - app/api/corpus-license/ingestion-gate/route.ts (POST handler)
 *   - app/api/ra/ingest/route.ts (primary ingest entry, pre-embedding)
 */
export async function assertIngestionLicensed(params: {
  sourceId: string;
  orgId: string;
  userId: string;
  wantsFullText?: boolean;
}): Promise<GateResult> {
  const wantsFullText = params.wantsFullText ?? true;
  const policy = await fetchPermittedUse(params.sourceId, params.orgId);

  // REQ-003: license metadata missing ⇒ ingestion forbidden.
  if (!policy) {
    await auditIngestionBlocked({
      userId: params.userId,
      sourceId: params.sourceId,
      reason: 'no_license_metadata',
    });
    return { allowed: false, reason: 'no_license_metadata' };
  }

  // REQ-002: explicit permitted_use.ingest=false override.
  if (!policy.permittedUse.ingest) {
    await auditIngestionBlocked({
      userId: params.userId,
      sourceId: params.sourceId,
      reason: 'ingest_not_permitted',
    });
    return { allowed: false, reason: 'ingest_not_permitted', licenseType: policy.licenseType };
  }

  // REQ-004: paid-standard full-text blocked without entitlement.
  if (wantsFullText && isFullTextBlocked(policy)) {
    await auditFullTextBlocked({
      userId: params.userId,
      sourceId: params.sourceId,
      licenseType: policy.licenseType,
    });
    return {
      allowed: false,
      reason: 'full_text_requires_entitlement',
      licenseType: policy.licenseType,
    };
  }

  return { allowed: true, licenseType: policy.licenseType };
}
