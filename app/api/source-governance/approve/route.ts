// @MX:NOTE [AUTO] POST /api/source-governance/approve — approve/reject a pending_review source.
// @MX:SPEC SPEC-REGULA-SOURCE-GOVERNANCE-001 (Issue #48, REQ-SOURCE-GOV-015, AC-05)
//
// RBAC: sourcegov.manage (ra-lead). IDOR: approveSource returns null on cross-org
// access → 404 (no existence leak). Audit: source.approved / source.rejected,
// written inside the same transaction as the state update (21 CFR Part 11 atomicity).

import { withPermission } from '@/lib/kernel/auth/with-permission';
import { approveSource } from '@/lib/source-governance/review-workflow';
import { approveRequestSchema } from '@/lib/source-governance/types';

/* audit-check-ignore: audit (source.approved/rejected) is written inside approveSource()
   within the same tx (21 CFR Part 11 atomicity) — route-level writeAudit would duplicate */
export const POST = withPermission('sourcegov.manage', async (req, _ctx, session) => {
  const organizationId = session.user.organizationId;
  if (!organizationId) {
    return Response.json({ error: 'Organization context required' }, { status: 403 });
  }

  const parsed = approveRequestSchema.safeParse(await req.json());
  if (!parsed.success) {
    return Response.json(
      { error: 'validation_failed', issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const result = await approveSource({
    sourceId: parsed.data.sourceId,
    orgId: organizationId,
    decision: parsed.data.decision,
    userId: session.user.id,
    notes: parsed.data.notes,
  });

  // IDOR: null → 404 (never reveal cross-org existence).
  if (!result) {
    return Response.json({ error: 'source_not_found' }, { status: 404 });
  }

  return Response.json(result, { status: 200 });
});
