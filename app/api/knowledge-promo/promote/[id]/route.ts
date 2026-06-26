// @MX:NOTE [AUTO] DELETE /api/knowledge-promo/promote/:id — unpromote a promoted answer.
// @MX:SPEC SPEC-REGULA-KNOWLEDGE-PROMO-001 (REQ-014, AC-07, AC-08)
// @MX:REASON Sets status='unpromoted' (soft delete). RAG retriever excludes
//           non-active rows (AC-08). withPermission('knowledgepromo.promote')
//           restricts to ra-lead/admin. 21 CFR Part 11 atomicity via
//           unpromoteAnswer. IDOR guard (assertPromotedAnswerInOrg).

import { withPermission } from '@/lib/auth/with-permission';
import { assertPromotedAnswerInOrg } from '@/lib/knowledge-promo/access';
import { unpromoteAnswer } from '@/lib/knowledge-promo/promote';

export const DELETE = withPermission('knowledgepromo.promote', async (_req, ctx, session) => {
  const params =
    typeof ctx?.params === 'object' && ctx.params !== null
      ? await ctx.params
      : ({} as Record<string, string>);
  const id = params.id;
  if (!id) {
    return Response.json({ error: 'missing_id' }, { status: 400 });
  }

  const orgId = session.user.organizationId ?? '';
  if (!orgId) {
    return Response.json({ error: 'no_org_context' }, { status: 403 });
  }

  // IDOR guard: verify the promoted answer belongs to the caller's org.
  // AC-03: assertPromotedAnswerInOrg writes a `rbac.permission_deny` audit row on denial.
  const accessDenied = await assertPromotedAnswerInOrg(id, {
    actorId: session.user.id,
    organizationId: orgId,
    action: 'knowledgepromo.promote',
  });
  if (accessDenied) {
    return accessDenied;
  }

  try {
    await unpromoteAnswer({ promotedId: id, userId: session.user.id, orgId });
    return Response.json({ ok: true, promotedId: id }, { status: 200 });
  } catch {
    return Response.json({ error: 'unpromote_failed' }, { status: 500 });
  }
});
