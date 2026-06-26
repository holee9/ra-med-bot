// @MX:NOTE [AUTO] POST /api/knowledge-promo/promote — promote a message answer.
// @MX:SPEC SPEC-REGULA-KNOWLEDGE-PROMO-001 (REQ-006, REQ-007, REQ-013, AC-02, AC-03, AC-07)
// @MX:REASON Charter [지양-4] no auto-finalize — withPermission('knowledgepromo.promote')
//           restricts to ra-lead/admin. 21 CFR Part 11 atomicity via promoteAnswer
//           (db.transaction wrapping insert + writeAudit). IDOR guard
//           (assertMessageInOrg) before any write.

import { withPermission } from '@/lib/auth/with-permission';
import { assertMessageInOrg } from '@/lib/knowledge-promo/access';
import { promoteAnswer } from '@/lib/knowledge-promo/promote';
import { z } from 'zod';

const PromoteRequestSchema = z.object({
  messageId: z.string().uuid(),
  title: z.string().min(1).max(500),
  tags: z.array(z.string().min(1).max(50)).max(20).default([]),
});

export const POST = withPermission('knowledgepromo.promote', async (req, _ctx, session) => {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'invalid_json' }, { status: 400 });
  }

  const parsed = PromoteRequestSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: 'validation_failed', issues: parsed.error.issues },
      { status: 400 },
    );
  }
  const input = parsed.data;

  const orgId = session.user.organizationId ?? '';
  if (!orgId) {
    return Response.json({ error: 'no_org_context' }, { status: 403 });
  }

  // IDOR guard: verify the message belongs to the caller's org BEFORE promote.
  // AC-03: assertMessageInOrg writes a `rbac.permission_deny` audit row on denial.
  const accessDenied = await assertMessageInOrg(input.messageId, {
    actorId: session.user.id,
    organizationId: orgId,
    action: 'knowledgepromo.promote',
  });
  if (accessDenied) {
    return accessDenied;
  }

  try {
    const result = await promoteAnswer({
      messageId: input.messageId,
      title: input.title,
      tags: input.tags,
      userId: session.user.id,
      orgId,
    });
    return Response.json(result, { status: 201 });
  } catch {
    // Atomicity preserved — tx rolled back, no partial write / no partial audit.
    return Response.json({ error: 'promote_failed' }, { status: 500 });
  }
});
