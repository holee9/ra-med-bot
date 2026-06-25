// @MX:ANCHOR [AUTO] linkInvestigationResults — REQ-CLININV-009 / AC-04 forward-link hook.
// @MX:REASON Called by POST /api/clinical-investigation/[id]/links route + integration
//           tests. fan_in >= 3. Mirrors lib/pms/cer-linkage.ts project-scoped linkage
//           pattern: writes a ci_links row that traces investigation results to a
//           downstream CER / PMS / DHF deliverable. The reverse lookup (CI → linked
//           deliverables) is what the dashboard (AC-05) and traceability matrix
//           consume.
// @MX:SPEC SPEC-REGULA-CLINICAL-INVESTIGATION-001 (Issue #69, REQ-CLININV-009, AC-04)

import { type db, withTenantScope } from '@/lib/db/client';
import { ciLinks, designHistoryFiles, pmsInputs, workflowRuns } from '@/lib/db/schema';
import { and, eq } from 'drizzle-orm';
import type { CiLinkTarget } from './types';

// Structural handle accepting both the db singleton and a PgTransaction. Includes
// both the insert-chain and select-chain used by this helper.
type LinkDbHandle = {
  insert: (typeof db)['insert'];
  select: (typeof db)['select'];
};

export interface LinkResult {
  id: string;
  investigationId: string;
  targetType: CiLinkTarget;
  targetId: string;
}

/**
 * REQ-009 — link investigation results to a CER / PMS / DHF deliverable.
 *
 * The (investigationId, targetType, targetId) tuple is UNIQUE in the DB, so a
 * repeated call is idempotent — the route catches the conflict and returns the
 * existing link rather than failing (see integration test AC-04).
 *
 * IDOR defense: scoped by orgId. The route asserts the investigation belongs to
 * the caller's org before invoking this function; this helper additionally
 * carries the orgId into the insert row so RLS is consistent.
 *
 * @param tx - Optional Drizzle transaction handle (H2 atomicity — caller wraps
 *             the link insert with its audit row in one db.transaction).
 */
export async function linkInvestigationResults(
  params: {
    investigationId: string;
    orgId: string;
    targetType: CiLinkTarget;
    targetId: string;
  },
  tx?: LinkDbHandle,
): Promise<LinkResult> {
  // When the caller supplies a scoped tx handle (already inside withTenantScope),
  // run directly on it. Otherwise, open a tenant scope so the GUC is set.
  if (tx) {
    return runLink(tx, params);
  }
  return withTenantScope(params.orgId, (dbs) => runLink(dbs as unknown as LinkDbHandle, params));
}

async function runLink(
  client: LinkDbHandle,
  params: { investigationId: string; orgId: string; targetType: CiLinkTarget; targetId: string },
): Promise<LinkResult> {
  const [row] = await client
    .insert(ciLinks)
    .values({
      investigationId: params.investigationId,
      orgId: params.orgId,
      targetType: params.targetType,
      targetId: params.targetId,
    })
    .onConflictDoNothing()
    .returning({ id: ciLinks.id });

  // If the row already existed (onConflictDoNothing), fetch it so callers always
  // receive a stable LinkResult without a second round-trip in the common case.
  if (row) {
    return {
      id: row.id,
      investigationId: params.investigationId,
      targetType: params.targetType,
      targetId: params.targetId,
    };
  }

  // H-2 fix: use `client` (tx-aware) — NOT the `db` singleton. The previous
  // `db.select(...)` bypassed the caller's transaction handle, breaking
  // isolation and creating a future IDOR risk if invoked outside the request
  // lifecycle. Mirrors the insert-chain which already uses `client`.
  const [existing] = await client
    .select({ id: ciLinks.id })
    .from(ciLinks)
    .where(
      and(
        eq(ciLinks.investigationId, params.investigationId),
        eq(ciLinks.orgId, params.orgId),
        eq(ciLinks.targetType, params.targetType),
        eq(ciLinks.targetId, params.targetId),
      ),
    )
    .limit(1);

  if (!existing) {
    throw new Error('ci_links insert returned no rows and no existing row found');
  }

  return {
    id: existing.id,
    investigationId: params.investigationId,
    targetType: params.targetType,
    targetId: params.targetId,
  };
}

/**
 * H-4 fix — verify a ci_links target row exists AND belongs to `orgId` before
 * the link is persisted. Mirrors lib/capa/linkage.ts verifyTargetExists.
 *
 * Without this check, a caller could persist a ci_links row pointing at any
 * UUID — nonexistent, or another org's CER/PMS/DHF deliverable — because the
 * ci_links UNIQUE + RLS scope only the ci_links row, not the referent.
 *
 * Per-target org scoping:
 *   - pms:  pms_inputs carries org_id directly → filter by org_id.
 *   - dhf:  design_history_files carries org_id directly → filter by org_id.
 *   - cer:  CER deliverables persist as workflow_runs rows (Issue #243) with
 *           workflow_type='cer' → filter by organization_id on workflow_runs.
 *
 * Returns true when the referent exists in the caller's org, false otherwise
 * (the route surfaces 404 — never 403 — so UUID probing is not possible).
 */
export async function verifyLinkTargetExists(
  orgId: string,
  targetType: CiLinkTarget,
  targetId: string,
): Promise<boolean> {
  return withTenantScope(orgId, async (dbs) => {
    switch (targetType) {
      case 'cer': {
        const rows = await dbs
          .select({ id: workflowRuns.id })
          .from(workflowRuns)
          .where(
            and(
              eq(workflowRuns.id, targetId),
              eq(workflowRuns.organizationId, orgId),
              eq(workflowRuns.workflowType, 'cer'),
            ),
          )
          .limit(1);
        return rows.length > 0;
      }
      case 'pms': {
        const rows = await dbs
          .select({ id: pmsInputs.id })
          .from(pmsInputs)
          .where(and(eq(pmsInputs.id, targetId), eq(pmsInputs.orgId, orgId)))
          .limit(1);
        return rows.length > 0;
      }
      case 'dhf': {
        const rows = await dbs
          .select({ id: designHistoryFiles.id })
          .from(designHistoryFiles)
          .where(and(eq(designHistoryFiles.id, targetId), eq(designHistoryFiles.orgId, orgId)))
          .limit(1);
        return rows.length > 0;
      }
      default: {
        return false;
      }
    }
  });
}
