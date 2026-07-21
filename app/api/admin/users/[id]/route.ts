import { writeAudit } from '@/lib/kernel/audit';
import { withPermission } from '@/lib/kernel/auth/with-permission';
import { db } from '@/lib/kernel/db/client';
import { users } from '@/lib/kernel/db/schema';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

const PatchSchema = z.object({
  status: z.enum(['active', 'pending', 'disabled']),
});

async function resolveId(ctx: unknown): Promise<string> {
  const raw = (ctx as { params?: unknown }).params;
  const p = raw instanceof Promise ? await raw : raw;
  return (p as { id?: string })?.id ?? '';
}

export const PATCH = withPermission('rbac.manage', async (req, ctx, session) => {
  const id = await resolveId(ctx);
  if (!id) return Response.json({ error: '잘못된 요청' }, { status: 400 });

  const body = await req.json().catch(() => null);
  const parsed = PatchSchema.safeParse(body);
  if (!parsed.success) return Response.json({ error: '잘못된 요청' }, { status: 400 });

  // 21 CFR Part 11 §11.10(e) — status update + audit ride one db.transaction so
  // a crash between them cannot leave a changed status with no audit trail.
  // Issue #378 PR-D-1.
  await db.transaction(async (tx) => {
    await tx.update(users).set({ status: parsed.data.status }).where(eq(users.id, id));
    await writeAudit(
      {
        actor_id: session.user.id,
        action: 'profile.update',
        resource_type: 'user',
        resource_id: id,
        meta_json: { status: parsed.data.status, admin: true },
      },
      tx,
    );
  });

  return Response.json({ ok: true });
});
