// @MX:NOTE [AUTO] GET|DELETE /api/ra/conversations/:id — single conversation fetch and delete.
// @MX:SPEC SPEC-REGULA-ENTERPRISE-001 (REQ-ENTERPRISE-019)

import { and, eq } from 'drizzle-orm';
import { writeAudit } from '../../../../../lib/audit';
import { withPermission } from '../../../../../lib/auth/with-permission';
import { db } from '../../../../../lib/db/client';
import { conversations } from '../../../../../lib/db/schema';

// Resolves Next.js 15 async params safely.
async function resolveId(ctx: unknown): Promise<string> {
  const raw = (ctx as { params?: unknown }).params;
  const p = raw instanceof Promise ? await raw : raw;
  return (p as { id?: string })?.id ?? '';
}

export const GET = withPermission('conversation.view', async (_req, ctx) => {
  const id = await resolveId(ctx);
  if (!id) return new Response('Missing id', { status: 400 });

  const [row] = await db.select().from(conversations).where(eq(conversations.id, id)).limit(1);

  if (!row) return new Response('Not Found', { status: 404 });

  return Response.json({ conversation: row });
});

export const DELETE = withPermission('conversation.delete', async (_req, ctx, session) => {
  const id = await resolveId(ctx);
  if (!id) return new Response('Missing id', { status: 400 });

  // Ownership check before delete.
  const [row] = await db
    .select({ userId: conversations.userId })
    .from(conversations)
    .where(and(eq(conversations.id, id), eq(conversations.userId, session.user.id)))
    .limit(1);

  if (!row) return new Response('Not Found', { status: 404 });

  await db.delete(conversations).where(eq(conversations.id, id));
  await writeAudit({
    action: 'conversation.delete',
    actor_id: session.user.id,
    resource_type: 'conversation',
    resource_id: id,
    conversation_id: id,
    meta_json: {},
  });

  return new Response(null, { status: 204 });
});
