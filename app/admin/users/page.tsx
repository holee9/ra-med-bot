import { auth } from '@/lib/kernel/auth';
import { db } from '@/lib/kernel/db/client';
import { users } from '@/lib/kernel/db/schema';
import { eq, ne } from 'drizzle-orm';
import { redirect } from 'next/navigation';
import AdminUsersClient from './AdminUsersClient';

export default async function AdminUsersPage() {
  const session = await auth();
  if (!session?.user?.id) redirect('/login');

  const [actor] = await db.select().from(users).where(eq(users.id, session.user.id)).limit(1);
  if (actor?.role !== 'admin') redirect('/');

  const allUsers = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      role: users.role,
      status: users.status,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(ne(users.id, session.user.id))
    .orderBy(users.createdAt);

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <h1 className="font-serif text-2xl text-brand-800">사용자 관리</h1>
      <p className="mt-1 text-sm text-ink-500">신규 가입 승인 및 계정 상태를 관리합니다</p>
      <AdminUsersClient users={allUsers} />
    </main>
  );
}
