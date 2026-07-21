// @MX:NOTE [AUTO] POST /api/model-governance/change-request/[id]/eval — async eval result recording.
// @MX:ANCHOR [AUTO] REQ-MODELGOV-010/011 — wire recordEvalResult (CI eval → DB).
// @MX:REASON The SPEC intends "eval runs in CI, result recorded asynchronously." This
//           route is the async wire: a CI eval run completes, POSTs the result here,
//           and recordEvalResult flips eval_status pending→passed/failed + writes the
//           modelgov.eval_passed/eval_failed audit row in one transaction (H2 atomicity).
//           Three-layer defense mirrors the approve route:
//             1) withPermission('modelgov.manage') — authorized operator only.
//             2) IDOR gate via assertChangeRequestAccess (404 cross-org).
//             3) Zod input validation.
// @MX:SPEC SPEC-REGULA-MODEL-GOVERNANCE-001 (Issue 71, REQ-MODELGOV-010/011)

import { withPermission } from '@/lib/kernel/auth/with-permission';
import { assertChangeRequestAccess } from '@/lib/model-governance/access';
import { recordEvalResult } from '@/lib/model-governance/change-workflow';
import { z } from 'zod';

const evalInputSchema = z.object({
  evalResultJson: z.record(z.unknown()),
  evalRunId: z.string().max(256).optional(),
  evalResultRef: z.string().max(1024).optional(),
});

/* audit-check-ignore: audit is written inside recordEvalResult() (change-workflow)
   within the same tx (21 CFR Part 11 atomicity) — route-level writeAudit would duplicate */
export const POST = withPermission('modelgov.manage', async (req, ctx, session) => {
  const organizationId = session.user.organizationId;
  if (!organizationId) {
    return Response.json({ error: 'Organization context required' }, { status: 403 });
  }

  const params =
    typeof ctx.params === 'object' && ctx.params !== null ? await Promise.resolve(ctx.params) : {};
  const changeRequestId = params.id;
  if (!changeRequestId || typeof changeRequestId !== 'string') {
    return Response.json({ error: 'Missing change request id' }, { status: 400 });
  }

  const parsed = evalInputSchema.safeParse(await req.json());
  if (!parsed.success) {
    return Response.json(
      { error: 'Invalid input', issues: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const input = parsed.data;

  // IDOR defense — verify change_request belongs to this org (404 on miss).
  const existing = await assertChangeRequestAccess(changeRequestId, organizationId);
  if (!existing) {
    return Response.json({ error: 'Change request not found' }, { status: 404 });
  }

  const gate = await recordEvalResult({
    changeRequestId,
    orgId: organizationId,
    actorId: session.user.id,
    evalResultJson: input.evalResultJson,
    evalRunId: input.evalRunId,
    evalResultRef: input.evalResultRef,
  });

  return Response.json({
    evalStatus: gate.passed ? 'passed' : 'failed',
    score: gate.score,
    threshold: gate.threshold,
    reason: gate.reason,
  });
});
