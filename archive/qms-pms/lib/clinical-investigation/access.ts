// @MX:NOTE [AUTO] assertInvestigationAccess — IDOR guard for CI [id] routes.
// @MX:SPEC SPEC-REGULA-CLINICAL-INVESTIGATION-001 (Issue #69)

// @MX:LEGACY archived from lib
// @MX:REASON Every route under app/api/clinical-investigation/[id]/ MUST verify the
//           investigation belongs to the caller's org before any mutation. Mirrors
//           assertPmsProjectAccess. Returns the investigation row on success so the
//           caller avoids a second round-trip.

import { db } from '@/lib/db/client';
import { clinicalInvestigations } from '@/lib/db/schema';
import { and, eq } from 'drizzle-orm';

export interface InvestigationRow {
  id: string;
  orgId: string;
  projectId: string | null;
  pathway: 'fda_ide' | 'eu_mdr' | null;
  necessityStatus: string;
  necessityRationale: string | null;
  approvalStatus: string;
}

export async function resolveRouteId(ctx: {
  params?: Record<string, string> | Promise<Record<string, string>>;
}): Promise<string> {
  const rawParams = ctx.params;
  const params = rawParams && 'then' in rawParams ? await rawParams : rawParams;
  return params?.id ?? '';
}

/**
 * Verify `investigationId` belongs to `organizationId`. Returns the row on success
 * or null when the record is missing or cross-org (the route surfaces 404 — never
 * 403 — so UUID probing is not possible).
 */
export async function assertInvestigationAccess(
  investigationId: string,
  organizationId: string,
): Promise<InvestigationRow | null> {
  const [row] = await db
    .select({
      id: clinicalInvestigations.id,
      orgId: clinicalInvestigations.orgId,
      projectId: clinicalInvestigations.projectId,
      pathway: clinicalInvestigations.pathway,
      necessityStatus: clinicalInvestigations.necessityStatus,
      necessityRationale: clinicalInvestigations.necessityRationale,
      approvalStatus: clinicalInvestigations.approvalStatus,
    })
    .from(clinicalInvestigations)
    .where(
      and(
        eq(clinicalInvestigations.id, investigationId),
        eq(clinicalInvestigations.orgId, organizationId),
      ),
    )
    .limit(1);

  return row ?? null;
}
