// @MX:NOTE [AUTO] 운영 콘솔 — t3610 서비스 상황판 (2026-10-20).
// @MX:REASON SSH+CLI 루틴 확인을 브라우저 한 화면으로 대체. Admin-only:
//           app/admin/*/page.tsx와 동일한 세션 role 게이트. 데이터는
//           sidecar가 수집한 var/ops-status.json (웹 프로세스 무권한).

import OpsConsole from '@/components/ops/OpsConsole';
import { redirect } from 'next/navigation';

export default async function OpsPage() {
  let role: string | undefined;
  try {
    const { auth } = await import('@/lib/kernel/auth');
    const session = await auth();
    role = (session?.user as { role?: string } | undefined)?.role;
  } catch {
    // test/build environment — fall through to gate below
  }
  if (role !== 'admin') redirect('/');

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <h1 className="mb-4 text-lg font-semibold text-ink-900">운영 콘솔 — t3610</h1>
      <OpsConsole />
    </div>
  );
}
