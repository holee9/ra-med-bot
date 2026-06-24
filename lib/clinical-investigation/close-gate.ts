// @MX:ANCHOR [AUTO] canCloseInvestigation — REQ-CLININV-012 server-side close gate.
// @MX:REASON Called by POST /api/clinical-investigation/[id]/close route + integration
//           tests. fan_in >= 3 expected. SAFETY GATE — blocks close unless the
//           caller supplies a resolved expert review as signoff (21 CFR Part 11
//           approval authority). Mirrors the lib/capa/close-gate.ts pattern:
//           IDOR defense returns a generic missing/cross-org reason for the
//           investigation record so UUID probing is not possible.
// @MX:SPEC SPEC-REGULA-CLINICAL-INVESTIGATION-001 (Issue #69, REQ-CLININV-012, AC-07)

import { db } from '@/lib/db/client';
import { clinicalInvestigations, conversations, expertReviews, projects } from '@/lib/db/schema';
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
 *   - expertSignoffId belongs to a conversation/project in ANOTHER org
 *     (C-1 fix: cross-org signoff UUID probing is now blocked).
 *
 * C-1 fix (org-binding): expert_reviews has no organization_id column, so the
 * signoff is org-bound via its conversation → project → organization chain.
 * A caller supplying another org's resolved review UUID is denied with
 * `expert_signoff_not_org_bound`. For projectless conversations (projectId is
 * null), the join yields no row → denied (a signoff must belong to a project
 * in the caller's org to count as approval evidence).
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

  // C-1 fix: bind the signoff to the caller's org via
  // expert_reviews → conversations → projects.organizationId. The join also
  // enforces status='resolved' in the same query so a non-resolved or
  // cross-org review collapses to a single deny decision.
  const [review] = await db
    .select({ id: expertReviews.id })
    .from(expertReviews)
    .innerJoin(conversations, eq(conversations.id, expertReviews.conversationId))
    .innerJoin(projects, eq(projects.id, conversations.projectId))
    .where(
      and(
        eq(expertReviews.id, expertSignoffId),
        eq(expertReviews.status, 'resolved'),
        eq(projects.organizationId, orgId),
      ),
    )
    .limit(1);

  if (!review) {
    return { allowed: false, reason: 'expert_signoff_not_org_bound' };
  }

  return { allowed: true, reason: 'ok' };
}
