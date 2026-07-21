// @MX:NOTE [AUTO] /api/consult/sessions — RA Power Chat session list + create.
// @MX:SPEC SPEC-V3-CONSULT-001 (REQ-CONS-001, REQ-CONS-002, AC-CONS-01, AC-CONS-02, Issue 341)
// @MX:REASON REQ-CONS-001: POST creates a consult_sessions row + `consult.session.create`
//            audit (REQ-CONS-013, 21 CFR Part 11 §11.10(e)) in one transaction.
//            REQ-CONS-002: GET lists sessions — ra-member sees own, ra-lead/admin see all org.

import { randomUUID } from 'node:crypto';
import { writeAudit } from '@/lib/kernel/audit';
import { withPermission } from '@/lib/kernel/auth/with-permission';
import { db } from '@/lib/kernel/db/client';
import { consultSessions } from '@/lib/kernel/db/schema';
import { and, desc, eq, isNull } from 'drizzle-orm';
import { z } from 'zod';

// REQ-CONS-001: title 1-200 chars, projectId/locale optional.
const createSessionSchema = z.object({
  title: z.string().min(1).max(200),
  projectId: z.string().uuid().optional(),
  locale: z.string().min(2).max(10).optional(),
});

// POST /api/consult/sessions — create a Power Chat session (AC-CONS-01).
export const POST = withPermission('consult.session.create', async (req, _ctx, session) => {
  const organizationId = session.user.organizationId;
  if (!organizationId) {
    return Response.json({ error: 'Organization context required' }, { status: 403 });
  }

  const body = (await req.json().catch(() => null)) as unknown;
  const parsed = createSessionSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: 'Invalid input', issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { title, projectId, locale } = parsed.data;
  const sessionId = randomUUID();
  const effectiveLocale = locale ?? 'ko';

  // 21 CFR Part 11 atomicity: session row + audit in one tx (TRIAGE/INBOX 교훈).
  const created = await db.transaction(async (tx) => {
    const [row] = await tx
      .insert(consultSessions)
      .values({
        id: sessionId,
        orgId: organizationId,
        userId: session.user.id,
        projectId: projectId ?? null,
        title,
        locale: effectiveLocale,
      })
      .returning();

    // REQ-CONS-013: consult.session.create audit (C-1 fix — Policy Anchor 자기모순 해소).
    await writeAudit(
      {
        actor_id: session.user.id,
        action: 'consult.session.create',
        resource_type: 'consult_session',
        resource_id: sessionId,
        meta_json: {
          sessionId,
          raMemberId: session.user.id,
          projectId: projectId ?? null,
          locale: effectiveLocale,
        },
      },
      tx,
    );

    return row;
  });

  return Response.json({ session: created }, { status: 201 });
});

// GET /api/consult/sessions — list sessions (AC-CONS-02).
// ra-member: own sessions only. ra-lead/admin: all org sessions.
const listSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional().default(50),
  offset: z.coerce.number().int().min(0).max(10000).optional().default(0),
});

export const GET = withPermission('consult.session.view', async (req, _ctx, session) => {
  const organizationId = session.user.organizationId;
  if (!organizationId) {
    return Response.json({ error: 'Organization context required' }, { status: 403 });
  }

  const url = new URL(req.url);
  const parsed = listSchema.safeParse(Object.fromEntries(url.searchParams));
  if (!parsed.success) {
    return Response.json(
      { error: 'Invalid query', issues: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const { limit, offset } = parsed.data;

  // ra-member sees only own sessions (app-level userId filter, defense-in-depth
  // on top of consult.session.view minRole). ra-lead/admin see all org sessions.
  const conditions = [eq(consultSessions.orgId, organizationId), isNull(consultSessions.deletedAt)];
  if (session.user.role === 'ra-member') {
    conditions.push(eq(consultSessions.userId, session.user.id));
  }

  const sessions = await db
    .select()
    .from(consultSessions)
    .where(and(...conditions))
    .orderBy(desc(consultSessions.createdAt))
    .limit(limit)
    .offset(offset);

  return Response.json({ sessions, pagination: { limit, offset, count: sessions.length } });
});
