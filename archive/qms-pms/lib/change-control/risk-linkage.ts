// @MX:NOTE [AUTO] REQ-008 ISO 14971 (#46) risk re-evaluation linkage.
// @MX:SPEC SPEC-REGULA-CHANGE-CONTROL-001 (REQ-008, AC-06)

// @MX:LEGACY archived from lib
//
// Links a change assessment to the risk_items (SPEC-REGULA-RISK-001, Issue #46)
// that need re-evaluation because of the change. The linkage is a many-to-many
// join table (change_risk_links) so one assessment can flag multiple risk items,
// and one risk item can be flagged across multiple assessments.
//
// M-1: riskItemIds are caller-supplied and must be validated against the caller's
// org before insert. risk_items has no org_id column (it inherits tenancy through
// workflow_runs.organization_id), so ownership is resolved via that join. Any
// risk_item that does not belong to the caller's org is filtered out and never
// inserted into change_risk_links — defense-in-depth on top of RLS.

import { db } from '@/lib/db/client';
import { changeRiskLinks, riskItems, workflowRuns } from '@/lib/db/schema';
import { and, eq, inArray } from 'drizzle-orm';

export interface RiskLinkageResult {
  /** IDs of risk_items that were linked to the assessment. */
  linkedRiskItemIds: string[];
  /** Risk items that warrant re-evaluation given the change type/scope. */
  recommendedForReevaluation: Array<{
    id: string;
    hazard: string;
    harm: string;
    riskLevel: string;
  }>;
}

/**
 * Resolve which of the caller-supplied riskItemIds actually belong to `orgId`.
 * risk_items → workflow_runs.organization_id. Cross-org IDs are dropped silently
 * here; the caller never sees them in `linkedRiskItemIds`, and the subsequent
 * insert is scoped to this allow-list so an FK+RLS violation is impossible.
 */
async function filterRiskItemsByOrg(
  riskItemIds: ReadonlyArray<string>,
  orgId: string,
): Promise<string[]> {
  if (riskItemIds.length === 0) return [];
  try {
    const rows = await db
      .select({ id: riskItems.id })
      .from(riskItems)
      .innerJoin(workflowRuns, eq(riskItems.workflowRunId, workflowRuns.id))
      .where(and(inArray(riskItems.id, [...riskItemIds]), eq(workflowRuns.organizationId, orgId)));
    return rows.map((r) => r.id);
  } catch {
    return [];
  }
}

/**
 * Link an assessment to a set of risk_items. Idempotent: ON CONFLICT DO NOTHING
 * via the UNIQUE(assessment_id, risk_item_id) constraint in migration 0071.
 *
 * @param assessmentId  UUID of the newly-created change_assessments row.
 * @param riskItemIds   UUIDs of risk_items to link (may be empty — REQUIRES the
 *                      caller to first call recommendRiskItemsForReevaluation).
 * @param orgId         Used for RLS scoping on every inserted row.
 */
export async function linkAssessmentToRiskItems(
  assessmentId: string,
  riskItemIds: ReadonlyArray<string>,
  orgId: string,
): Promise<RiskLinkageResult> {
  // M-1: filter out cross-org riskItemIds BEFORE insert. Without this a caller
  // could link foreign-org risk_items to their assessment (FK is satisfied, RLS
  // on change_risk_links only checks the link row's org_id which the caller owns).
  const ownedIds = await filterRiskItemsByOrg(riskItemIds, orgId);
  const ownedSet = new Set(ownedIds);

  const linked: string[] = [];
  for (const riskItemId of riskItemIds) {
    if (!ownedSet.has(riskItemId)) continue;
    try {
      await db
        .insert(changeRiskLinks)
        .values({
          orgId,
          assessmentId,
          riskItemId,
        })
        .onConflictDoNothing();
      linked.push(riskItemId);
    } catch {
      // Swallow per-row insert failures (e.g. stale UUID) so a single bad link
      // doesn't abort the whole assessment transaction. The caller sees the
      // partial link list in the return value.
    }
  }

  const recommended = await fetchLinkedRiskItems(assessmentId, orgId);

  return {
    linkedRiskItemIds: linked,
    recommendedForReevaluation: recommended,
  };
}

/**
 * Fetch the risk_items linked to an assessment (used by the GET endpoint to
 * render the ISO 14971 re-evaluation panel, AC-06).
 */
export async function fetchLinkedRiskItems(
  assessmentId: string,
  orgId: string,
): Promise<Array<{ id: string; hazard: string; harm: string; riskLevel: string }>> {
  const rows = await db
    .select({
      id: riskItems.id,
      hazard: riskItems.hazard,
      harm: riskItems.harm,
      riskLevel: riskItems.riskLevel,
    })
    .from(changeRiskLinks)
    .innerJoin(riskItems, eq(changeRiskLinks.riskItemId, riskItems.id))
    .where(and(eq(changeRiskLinks.assessmentId, assessmentId), eq(changeRiskLinks.orgId, orgId)));

  return rows.map((r) => ({
    id: r.id,
    hazard: r.hazard,
    harm: r.harm,
    riskLevel: r.riskLevel,
  }));
}
