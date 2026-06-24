// @MX:ANCHOR [AUTO] linkInvestigationResults — REQ-CLININV-009 / AC-04 forward-link hook.
// @MX:REASON Called by POST /api/clinical-investigation/[id]/links route + integration
//           tests. fan_in >= 3. Mirrors lib/pms/cer-linkage.ts project-scoped linkage
//           pattern: writes a ci_links row that traces investigation results to a
//           downstream CER / PMS / DHF deliverable. The reverse lookup (CI → linked
//           deliverables) is what the dashboard (AC-05) and traceability matrix
//           consume.
// @MX:SPEC SPEC-REGULA-CLINICAL-INVESTIGATION-001 (Issue #69, REQ-CLININV-009, AC-04)

import { db } from '@/lib/db/client';
import { ciLinks } from '@/lib/db/schema';
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
  const client = tx ?? db;
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

  const [existing] = await db
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
