// @MX:NOTE [AUTO] Source governance RBAC + IDOR access helpers.
// @MX:SPEC SPEC-REGULA-SOURCE-GOVERNANCE-001 (Issue #48, REQ-SOURCE-GOV-015)
//
// sources is org-scoped via existing RLS (migrations 0067-0079 table-level
// policy). This module adds the application-level checks the route handlers
// need:
//   - assertCanManageGovernance: RBAC sourcegov.manage (ra-lead)
//   - assertSourceInOrg: IDOR gate — cross-org source access → 404 (not 403,
//     to avoid leaking existence). Mirrors the CAPA/PMS IDOR pattern.

import { db } from '@/lib/db/client';
import { sources } from '@/lib/db/schema';
import { and, eq } from 'drizzle-orm';

/**
 * IDOR gate: return the source row ONLY if it belongs to `orgId`.
 * Returns null when the source does not exist OR belongs to a different org.
 * Callers MUST treat null as 404 (never reveal cross-org existence).
 */
export async function getSourceInOrg(
  sourceId: string,
  orgId: string,
): Promise<{ id: string; approvalStatus: string } | null> {
  const rows = (await db
    .select({ id: sources.id, approvalStatus: sources.approvalStatus })
    .from(sources)
    .where(and(eq(sources.id, sourceId), eq(sources.organizationId, orgId)))
    .limit(1)) as Array<{ id: string; approvalStatus: string }>;

  return rows[0] ?? null;
}
