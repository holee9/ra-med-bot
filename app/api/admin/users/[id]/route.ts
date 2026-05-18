import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db/client';
import { users } from '@/lib/db/schema';

const PatchSchema = z.object({
  status: z.enum(['active', 'pending', 'disabled']),
});

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const [actor] = await db.select().from(users).where(eq(users.id, session.user.id)).limit(1);
  if (actor?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id } = await params;
  const body = await req.json().catch(() => null);
  const parsed = PatchSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: '잘못된 요청' }, { status: 400 });

  await db.update(users).set({ status: parsed.data.status }).where(eq(users.id, id));
  return NextResponse.json({ ok: true });
}
