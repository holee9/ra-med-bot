// @MX:ANCHOR [AUTO] canCloseInvestigation — REQ-CLININV-012 server-side close gate.
// @MX:REASON Called by POST /api/clinical-investigation/[id]/close route + integration
//           tests. fan_in >= 3 expected. SAFETY GATE — blocks close unless the
//           caller supplies a resolved expert review as signoff (21 CFR Part 11
//           approval authority). Mirrors the lib/capa/close-gate.ts pattern:
//           IDOR defense returns a generic missing/cross-org reason for the
//           investigation record so UUID probing is not possible.
// @MX:SPEC SPEC-REGULA-CLINICAL-INVESTIGATION-001 (Issue #69, REQ-CLININV-012, AC-07)

import { db } from '@/lib/db/client';
import { clinicalInvestigations, expertReviews } from '@/lib/db/schema';
import { and, eq } from 'drizzle-orm';
import type { CloseGateResult } from './types';

/**
 * REQ-012 — determine whether a clinical investigation may be closed.
 *
 * Blocking conditions:
 *   - Investigation is missing or belongs to another org.
 *   - Investigation is already closed.
 *   - No expertSignoffId is supplied.
 *   - expertSignoffId does not resolve to expert_reviews.status='resolved'.
 *
 * The existing expert_reviews table is not org-scoped, so this function keeps
 * org isolation on the investigation itself and treats the review row only as
 * approval evidence. A future migration may add resource-scoped expert reviews;
 * until then, the minimum safe gate is "real resolved review ID", not just a UUID.
 */
export async function canCloseInvestigation(
  investigationId: string,
  orgId: string,
  expertSignoffId?: string,
): Promise<CloseGateResult> {
  const [investigation] = await db
    .select({
      id: clinicalInvestigations.id,
      approvalStatus: clinicalInvestigations.approvalStatus,
    })
    .from(clinicalInvestigations)
    .where(
      and(eq(clinicalInvestigations.id, investigationId), eq(clinicalInvestigations.orgId, orgId)),
    )
    .limit(1);

  if (!investigation) {
    return { allowed: false, reason: 'investigation_not_found_or_org_mismatch' };
  }

  if (investigation.approvalStatus === 'closed') {
    return { allowed: false, reason: 'already_closed' };
  }

  if (!expertSignoffId) {
    return { allowed: false, reason: 'expert_signoff_missing' };
  }

  const [review] = await db
    .select({ id: expertReviews.id, status: expertReviews.status })
    .from(expertReviews)
    .where(and(eq(expertReviews.id, expertSignoffId), eq(expertReviews.status, 'resolved')))
    .limit(1);

  if (!review) {
    return { allowed: false, reason: 'expert_signoff_not_resolved' };
  }

  return { allowed: true, reason: 'ok' };
}
