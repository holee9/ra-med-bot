import { writeAudit } from '@/lib/audit';
import { db } from '@/lib/db/client';
import { users } from '@/lib/db/schema';
import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';

const SignupSchema = z.object({
  name: z.string().min(2, '이름은 2자 이상이어야 합니다'),
  email: z.string().email('올바른 이메일 주소를 입력하세요'),
  password: z.string().min(8, '비밀번호는 8자 이상이어야 합니다'),
});

// @MX:ANCHOR: [AUTO] Public signup endpoint — no role assignment, defers to admin approval
// @MX:REASON: OWASP A01:2021 — prevents privilege escalation via self-signup
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = SignupSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.errors[0]?.message ?? '입력값이 올바르지 않습니다' },
      { status: 400 },
    );
  }

  const { name, email, password } = parsed.data;

  const [existing] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (existing) {
    return NextResponse.json({ error: '이미 사용 중인 이메일입니다' }, { status: 409 });
  }

  const password_hash = await bcrypt.hash(password, 12);
  // @MX:ANCHOR Deferred role assignment — users created without role until admin approval
  // @MX:REASON OWASP A01:2021 — prevents privilege escalation via self-signup
  const [created] = await db
    .insert(users)
    .values({ name, email, password_hash, status: 'pending' })
    .returning({ id: users.id });

  if (!created) {
    return NextResponse.json({ error: '회원가입 처리에 실패했습니다' }, { status: 500 });
  }

  await writeAudit({
    actor_id: null,
    action: 'profile.update',
    resource_type: 'user',
    resource_id: created.id,
    meta_json: { status: 'pending', source: 'signup' },
  });

  return NextResponse.json({ ok: true }, { status: 201 });
}
