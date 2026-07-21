import { writeAudit } from '@/lib/kernel/audit';
import { auth } from '@/lib/kernel/auth';
import { db } from '@/lib/kernel/db/client';
import { users } from '@/lib/kernel/db/schema';
import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';

const BodySchema = z.object({
  password: z.string().min(8),
});

export async function PATCH(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json();
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: '비밀번호는 8자 이상이어야 합니다.' }, { status: 400 });
  }

  const userId = session.user.id;
  const [user] = await db
    .select({ id: users.id, mustChangePassword: users.mustChangePassword })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!user) {
    return NextResponse.json({ error: '사용자를 찾을 수 없습니다.' }, { status: 404 });
  }

  const password_hash = await bcrypt.hash(parsed.data.password, 12);

  // 21 CFR Part 11 §11.10(e) — password update + audit ride one db.transaction
  // so a crash between them cannot leave a changed password with no audit trail.
  // Issue #378 PR-D-1.
  await db.transaction(async (tx) => {
    await tx
      .update(users)
      .set({ password_hash, mustChangePassword: false })
      .where(eq(users.id, userId));
    await writeAudit(
      {
        actor_id: userId,
        action: 'profile.update',
        resource_type: 'user',
        resource_id: userId,
        meta_json: { passwordChanged: true, mustChangePasswordCleared: true },
      },
      tx,
    );
  });

  return NextResponse.json({ ok: true });
}
