import { withPermission } from '@/lib/auth/with-permission';
import { db } from '@/lib/db/client';
import { users } from '@/lib/db/schema';
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

export const PATCH = withPermission('rbac.manage', async (req, ctx) => {
  const id = await resolveId(ctx);
  if (!id) return Response.json({ error: '잘못된 요청' }, { status: 400 });

  const body = await req.json().catch(() => null);
  const parsed = PatchSchema.safeParse(body);
  if (!parsed.success) return Response.json({ error: '잘못된 요청' }, { status: 400 });

  await db.update(users).set({ status: parsed.data.status }).where(eq(users.id, id));
  return Response.json({ ok: true });
});
