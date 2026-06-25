// @MX:ANCHOR [AUTO] verifyExportRights — export-time license/entitlement gate.
// @MX:REASON fan_in >= 3: traceability export route, change-control export route,
//   and integration tests all call this. REQ-011 compliance gate — sources whose
//   permitted_use.export is false (or whose entitlement is inactive) MUST NOT
//   leave the system in an export package. A dead-code definition without a call
//   site is a SPEC violation.
// @MX:SPEC SPEC-REGULA-CORPUS-LICENSE-001 (REQ-CORPUSLIC-007, REQ-CORPUSLIC-011)
import { auditExportBlocked } from './audit';
import { fetchPermittedUse } from './permitted-use';

export interface ExportGateResult {
  /** True when every sourceId is export-entitled; false otherwise. */
  allowed: boolean;
  /** SourceIds blocked from export (empty when allowed). */
  blockedSources: Array<{ sourceId: string; reason: string }>;
}

/**
 * REQ-011 — verify that every sourceId in an export package is licensed for
 * export (`permitted_use.export === true`) AND has an active entitlement when
 * the license type requires one.
 *
 * On denial, callers SHOULD return 403 + call `auditExportBlocked` (the route
 * handles the audit write so it can attach the actor/session context). This
 * function returns the structured result; it does not audit itself to keep
 * the lib side-effect-free w.r.t. actor identity.
 *
 * Wired at:
 *   - app/api/traceability/[deliverableId]/export/route.ts
 *   - app/api/change-control/[assessmentId]/export/route.ts
 */
export async function verifyExportRights(params: {
  sourceIds: string[];
  orgId: string;
}): Promise<ExportGateResult> {
  const { sourceIds, orgId } = params;
  if (sourceIds.length === 0) {
    return { allowed: true, blockedSources: [] };
  }

  const blockedSources: ExportGateResult['blockedSources'] = [];
  for (const sourceId of sourceIds) {
    const policy = await fetchPermittedUse(sourceId, orgId);
    if (!policy) {
      blockedSources.push({ sourceId, reason: 'no_license_metadata' });
      continue;
    }
    if (!policy.permittedUse.export) {
      blockedSources.push({ sourceId, reason: 'export_not_permitted' });
    }
    // REQ-004: paid-standard without active entitlement collapses permittedUse
    // (including export=false) inside fetchPermittedUse, so the check above
    // already covers entitlement expiry. No separate entitlement query needed.
  }

  return { allowed: blockedSources.length === 0, blockedSources };
}

/**
 * Convenience: write audit for each blocked source. Routes call this after
 * verifyExportRights returns allowed=false so the audit carries the actor id.
 */
export async function auditExportBlockedBatch(params: {
  userId: string;
  blockedSources: ExportGateResult['blockedSources'];
}): Promise<void> {
  for (const b of params.blockedSources) {
    await auditExportBlocked({ userId: params.userId, sourceId: b.sourceId, reason: b.reason });
  }
}
