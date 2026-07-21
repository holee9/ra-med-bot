// @MX:NOTE [AUTO] /api/consult/sessions/:sessionId — detail + soft-delete.
// @MX:SPEC SPEC-V3-CONSULT-001 (REQ-CONS-003, REQ-CONS-006, AC-CONS-02b, AC-CONS-06, AC-CONS-07, Issue 341)
// @MX:REASON REQ-CONS-003: GET returns session + turns array (turnNumber asc, AC-CONS-02b).
//            REQ-CONS-006: DELETE soft-deletes (deletedAt) + `consult.session.delete` audit
//            (21 CFR Part 11). RBAC: ra-member sees own, ra-lead/admin see all org (AC-CONS-07).

import { writeAudit } from '@/lib/kernel/audit';
import { withPermission } from '@/lib/kernel/auth/with-permission';
import { db } from '@/lib/kernel/db/client';
import { consultSessions, consultTurns } from '@/lib/kernel/db/schema';
import { and, asc, eq, isNull } from 'drizzle-orm';

// GET /api/consult/sessions/:sessionId — session detail + turns (AC-CONS-02b, AC-CONS-07).
export const GET = withPermission('consult.session.view', async (_req, ctx, session) => {
  const organizationId = session.user.organizationId;
  if (!organizationId) {
    return Response.json({ error: 'Organization context required' }, { status: 403 });
  }

  const params = ctx.params ? await ctx.params : {};
  const sessionId = params.sessionId;
  if (!sessionId) {
    return Response.json({ error: 'Missing sessionId' }, { status: 400 });
  }

  // org-bound lookup (IDOR defense: orgId + not-deleted).
  const [sess] = await db
    .select()
    .from(consultSessions)
    .where(
      and(
        eq(consultSessions.id, sessionId),
        eq(consultSessions.orgId, organizationId),
        isNull(consultSessions.deletedAt),
      ),
    )
    .limit(1);

  // 404 for missing OR cross-user access by ra-member (no information leak).
  if (!sess || (session.user.role === 'ra-member' && sess.userId !== session.user.id)) {
    return Response.json({ error: 'Session not found' }, { status: 404 });
  }

  // turns 배열 — turnNumber 오름차순 (AC-CONS-02b, Edge-11).
  const turns = await db
    .select()
    .from(consultTurns)
    .where(eq(consultTurns.sessionId, sessionId))
    .orderBy(asc(consultTurns.turnNumber));

  return Response.json({ session: sess, turns });
});

// DELETE /api/consult/sessions/:sessionId — soft-delete (AC-CONS-06, AC-CONS-07).
export const DELETE = withPermission('consult.session.delete', async (_req, ctx, session) => {
  const organizationId = session.user.organizationId;
  if (!organizationId) {
    return Response.json({ error: 'Organization context required' }, { status: 403 });
  }

  const params = ctx.params ? await ctx.params : {};
  const sessionId = params.sessionId;
  if (!sessionId) {
    return Response.json({ error: 'Missing sessionId' }, { status: 400 });
  }

  const [sess] = await db
    .select()
    .from(consultSessions)
    .where(
      and(
        eq(consultSessions.id, sessionId),
        eq(consultSessions.orgId, organizationId),
        isNull(consultSessions.deletedAt),
      ),
    )
    .limit(1);
  if (!sess) {
    return Response.json({ error: 'Session not found' }, { status: 404 });
  }

  // 21 CFR Part 11 atomicity: soft-delete + audit in one tx.
  await db.transaction(async (tx) => {
    await tx
      .update(consultSessions)
      .set({ deletedAt: new Date() })
      .where(eq(consultSessions.id, sessionId));

    await writeAudit(
      {
        actor_id: session.user.id,
        action: 'consult.session.delete',
        resource_type: 'consult_session',
        resource_id: sessionId,
        meta_json: {
          sessionId,
          deletedBy: session.user.id,
          ownerUserId: sess.userId,
        },
      },
      tx,
    );
  });

  return Response.json({ ok: true });
});
