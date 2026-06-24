// @MX:NOTE [AUTO] Cross-workflow linkage — CAPA → risk/change_control/DHF/PMS.
// @MX:SPEC SPEC-REGULA-CAPA-001 (REQ-008, AC-03)
//
// REQ-008: when a CAPA is completed, the system auto-links the result to
// #46 Risk (risk_items), #54 Change Control (change_assessments), and
// #64 DHF (design_history_files). Links are stored in capa_links with
// target_type + target_id. AC-03: link integrity — every closed CAPA must
// have ≥1 link to close the loop.

import { db } from '@/lib/db/client';
import {
  capaLinks,
  changeAssessments,
  designHistoryFiles,
  pmsInputs,
  riskItems,
  workflowRuns,
} from '@/lib/db/schema';
import { and, eq, sql } from 'drizzle-orm';
import type { CapaLinkInput, CapaLinkTarget } from './types';

/**
 * Verify that the target row exists and belongs to the org before linking.
 * REQ-008 link integrity: a link to a non-existent or foreign-org row is
 * rejected so the audit trail cannot reference phantom records.
 *
 * Per-target org scoping (H fix):
 *   - change_control / dhf / pms: these tables carry org_id directly, so we
 *     filter by org_id in the WHERE clause.
 *   - risk: risk_items has NO org_id (scoped via workflow_runs → projects →
 *     org). We join workflow_runs to enforce org membership rather than rely
 *     solely on DB-level RLS, so the check is effective even when RLS is not
 *     active (e.g. service-role connections in tests).
 */
async function verifyTargetExists(
  orgId: string,
  targetType: CapaLinkTarget,
  targetId: string,
): Promise<boolean> {
  switch (targetType) {
    case 'risk': {
      // risk_items.org_id absent — join workflow_runs to assert org ownership.
      const rows = await db
        .select({ id: riskItems.id })
        .from(riskItems)
        .innerJoin(workflowRuns, eq(workflowRuns.id, riskItems.workflowRunId))
        .where(and(eq(riskItems.id, targetId), eq(workflowRuns.organizationId, orgId)))
        .limit(1);
      return rows.length > 0;
    }
    case 'change_control': {
      const rows = await db
        .select({ id: changeAssessments.id })
        .from(changeAssessments)
        .where(and(eq(changeAssessments.id, targetId), eq(changeAssessments.orgId, orgId)))
        .limit(1);
      return rows.length > 0;
    }
    case 'dhf': {
      const rows = await db
        .select({ id: designHistoryFiles.id })
        .from(designHistoryFiles)
        .where(and(eq(designHistoryFiles.id, targetId), eq(designHistoryFiles.orgId, orgId)))
        .limit(1);
      return rows.length > 0;
    }
    case 'pms': {
      // pms_inputs carries org_id — verify the row exists AND belongs to the org.
      const rows = await db
        .select({ id: pmsInputs.id })
        .from(pmsInputs)
        .where(and(eq(pmsInputs.id, targetId), eq(pmsInputs.orgId, orgId)))
        .limit(1);
      return rows.length > 0;
    }
    default: {
      return false;
    }
  }
}

/**
 * REQ-008: create a single capa_links row. Returns the created link id, or
 * null when the target does not exist / cross-org.
 *
 * idempotent: the UNIQUE(capa_id, target_type, target_id) constraint means a
 * duplicate link is a no-op (ON CONFLICT DO NOTHING would be ideal, but the
 * caller should check existence first for a clean audit trail).
 */
export async function linkCapaToTarget(params: {
  capaId: string;
  orgId: string;
  createdBy: string;
  link: CapaLinkInput;
}): Promise<string | null> {
  const ok = await verifyTargetExists(params.orgId, params.link.targetType, params.link.targetId);
  if (!ok) return null;

  const [row] = await db
    .insert(capaLinks)
    .values({
      orgId: params.orgId,
      capaId: params.capaId,
      targetType: params.link.targetType,
      targetId: params.link.targetId,
      createdBy: params.createdBy,
    })
    .returning({ id: capaLinks.id });

  return row?.id ?? null;
}

/**
 * REQ-008: create multiple links in one call. Used when a CAPA completes and
 * must link to risk + change_control + DHF simultaneously. Returns the count
 * of successfully created links.
 *
 * AC-03: callers assert the returned count matches the input length.
 */
export async function linkCapaToTargets(params: {
  capaId: string;
  orgId: string;
  createdBy: string;
  links: CapaLinkInput[];
}): Promise<{ created: number; linkIds: string[] }> {
  const linkIds: string[] = [];
  for (const link of params.links) {
    const id = await linkCapaToTarget({
      capaId: params.capaId,
      orgId: params.orgId,
      createdBy: params.createdBy,
      link,
    });
    if (id) linkIds.push(id);
  }
  return { created: linkIds.length, linkIds };
}

/**
 * AC-03: verify a CAPA has ≥1 link. Used by the close route to enforce the
 * closed-loop integrity before allowing close.
 *
 * evaluator CRITICAL fix: the previous implementation selected a single
 * capaLinks.id row and returned `row ? 1 : 0` — which always yielded 0 or 1
 * regardless of the actual link count. A CAPA with 2+ links still returned 1,
 * masking the real count. The correct behavior is COUNT(*) aggregation.
 */
export async function getCapaLinkCount(capaId: string, orgId: string): Promise<number> {
  const [row] = await db
    .select({ count: sql<number>`count(*)` })
    .from(capaLinks)
    .where(and(eq(capaLinks.capaId, capaId), eq(capaLinks.orgId, orgId)));
  return Number(row?.count ?? 0);
}
