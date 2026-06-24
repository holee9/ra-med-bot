// @MX:NOTE [AUTO] POST /api/model-governance/approve — expert approval gate.
// @MX:ANCHOR [AUTO] REQ-MODELGOV-005/012/014 — approval enforces eval_status='passed' + RBAC + audit.
// @MX:REASON Three-layer defense:
//             1) withPermission('modelgov.approve') — ra-lead only (REQ-014).
//             2) IDOR gate via assertChangeRequestAccess (404 cross-org).
//             3) approveChangeRequest enforces eval_status='passed' (REQ-005),
//                activates single-active combo (REQ-013), records approver/ts/eval
//                link in audit (REQ-012) — all in one db.transaction (H2 atomicity).
// @MX:SPEC SPEC-REGULA-MODEL-GOVERNANCE-001 (Issue 71, REQ-MODELGOV-005/012/013/014, AC-02/07)

import { withPermission } from '@/lib/auth/with-permission';
import { assertChangeRequestAccess } from '@/lib/model-governance/access';
import {
  ChangeRequestBlockedError,
  approveChangeRequest,
} from '@/lib/model-governance/change-workflow';
import { approveChangeRequestInputSchema } from '@/lib/model-governance/types';

export const POST = withPermission('modelgov.approve', async (req, _ctx, session) => {
  const organizationId = session.user.organizationId;
  if (!organizationId) {
    return Response.json({ error: 'Organization context required' }, { status: 403 });
  }

  const parsed = approveChangeRequestInputSchema.safeParse(await req.json());
  if (!parsed.success) {
    return Response.json(
      { error: 'Invalid input', issues: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const input = parsed.data;

  // IDOR defense — verify change_request belongs to this org (404 on miss).
  const existing = await assertChangeRequestAccess(input.changeRequestId, organizationId);
  if (!existing) {
    return Response.json({ error: 'Change request not found' }, { status: 404 });
  }

  try {
    const result = await approveChangeRequest({
      changeRequestId: input.changeRequestId,
      orgId: organizationId,
      approverId: session.user.id,
      evalResultRef: input.evalResultRef,
    });
    return Response.json({ approvedCombinationId: result.combinationId });
  } catch (err) {
    if (err instanceof ChangeRequestBlockedError) {
      // REQ-005 / REQ-014 denial — 403 + the audit row was already written in-tx.
      const status = err.reason.includes('not_found') ? 404 : 403;
      return Response.json({ error: err.reason }, { status });
    }
    return Response.json({ error: 'Failed to approve change request' }, { status: 500 });
  }
});
