// @MX:NOTE [AUTO] REQ-010/011 ISO 14971 residual cyber risk linkage + change-control trigger.
// @MX:SPEC SPEC-REGULA-CYBERDEVICE-001 (REQ-010, REQ-011, AC-04)
//
// REQ-010: residual cybersecurity risk (a CVE affecting a product component)
// MUST link to an ISO 14971 risk_item (SPEC-REGULA-RISK-001, Issue #46) so the
// cyber risk is counted in the product's overall residual risk profile.
//
// REQ-011: when a vulnerability changes (new CVE, severity escalation, KEV
// addition), the system MUST trigger a #54 Change Control assessment + #46 Risk
// re-evaluation. The trigger is a best-effort enqueue — the heavy change-control
// engine lives in lib/change-control and is not duplicated here. We expose a
// `shouldTriggerReassessment` predicate so the caller can decide whether to
// fire the change-control hook (deterministic, testable) without coupling this
// module to the change-control persistence layer.

import { db } from '@/lib/db/client';
import { cveImpact, riskItems, workflowRuns } from '@/lib/db/schema';
import { and, eq, inArray } from 'drizzle-orm';

export interface RiskLinkageResult {
  /** IDs of risk_items that were resolved to the caller's org and linked. */
  linkedRiskItemIds: string[];
  /** riskItemIds supplied by the caller that did not belong to the org (dropped). */
  rejectedRiskItemIds: string[];
}

/**
 * Resolve which of the caller-supplied riskItemIds actually belong to `orgId`.
 * risk_items inherits tenancy through workflow_runs.organization_id (no direct
 * org_id column). Cross-org IDs are dropped — defense-in-depth on top of RLS.
 */
export async function filterRiskItemsByOrg(
  riskItemIds: ReadonlyArray<string>,
  orgId: string,
): Promise<{ ok: string[]; rejected: string[] }> {
  if (riskItemIds.length === 0) return { ok: [], rejected: [] };
  try {
    const rows = await db
      .select({ id: riskItems.id })
      .from(riskItems)
      .innerJoin(workflowRuns, eq(riskItems.workflowRunId, workflowRuns.id))
      .where(and(inArray(riskItems.id, [...riskItemIds]), eq(workflowRuns.organizationId, orgId)));
    const okSet = new Set(rows.map((r) => r.id));
    const ok = [...okSet];
    const rejected = riskItemIds.filter((id) => !okSet.has(id));
    return { ok, rejected };
  } catch {
    return { ok: [], rejected: [...riskItemIds] };
  }
}

/**
 * REQ-010: link a CVE impact record to an ISO 14971 risk_item. Sets
 * cve_impact.risk_item_id. The audit row (cyber.risk_linked) is written by the
 * caller inside the same transaction (Part 11 atomicity).
 */
export async function linkCveImpactToRiskItem(params: {
  cveImpactId: string;
  riskItemIds: string[];
  orgId: string;
}): Promise<RiskLinkageResult> {
  const { ok, rejected } = await filterRiskItemsByOrg(params.riskItemIds, params.orgId);
  // REQ-010 linkage is single-risk-item per CVE (cve_impact.risk_item_id is a
  // single nullable FK). If the caller passes multiple, we link the first
  // org-validated one and surface the rest in `linkedRiskItemIds` for the
  // caller's audit meta. This mirrors how riskControls links to risk_items.
  const primaryRiskItemId = ok[0];
  if (primaryRiskItemId) {
    await db
      .update(cveImpact)
      .set({ riskItemId: primaryRiskItemId })
      .where(eq(cveImpact.id, params.cveImpactId));
  }
  return {
    linkedRiskItemIds: ok,
    rejectedRiskItemIds: rejected,
  };
}

/**
 * REQ-011: re-exported from reassess-policy.ts so importing this predicate
 * does NOT require the db client. Callers that only need the predicate should
 * import { shouldTriggerReassessment } from '@/lib/cyberdevice/reassess-policy'.
 */
export { shouldTriggerReassessment } from './reassess-policy';
