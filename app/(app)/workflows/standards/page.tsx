// @MX:NOTE [AUTO] Harmonized Standards Tracker page — SPEC-REGULA-STANDARDS-001 (Issue #62).
// Server Component shell: resolves role server-side via auth() + hasRole and
// passes capability booleans to the StandardsClient island. standards.read
// (viewer+) gate on the page; standards.manage (ra-lead) gates any future edit
// affordance. The backend re-checks every call via withPermission('standards.read')
// — the client gate is UX-only (mirrors promote-button #50, project-memory #51).
// @MX:SPEC SPEC-REGULA-STANDARDS-001 (REQ-001/015/016/019/021/022, AC-03/05/06)
// @MX:REASON Charter [지양-4]: mapping is decision-SUPPORT. The page frames
//   results as "RA Lead review required" — no auto-submission affordance.
//   Charter [지양-2]: every standard displayed carries catalog citation.

import { auth } from '@/lib/auth';
import { type Role, hasRole } from '@/lib/auth/rbac';
import type { Metadata } from 'next';
import { StandardsClient } from './_components/StandardsClient';

export const metadata: Metadata = {
  title: '조화 표준 추적기 — Regula',
  description:
    'ISO/IEC/EN/ASTM 적용 표준 자동 매핑, FDA 인정 실시간 확인, 전환 알림 (SPEC-REGULA-STANDARDS-001)',
  robots: { index: false, follow: false },
};

export default async function StandardsTrackerPage() {
  // Resolve role server-side; defaults to least-privileged when auth is
  // unavailable (build / test environments) — mirrors the classify page.
  let role: Role | undefined;
  try {
    const session = await auth();
    const user = session?.user as { role?: string } | undefined;
    role = user?.role as Role | undefined;
  } catch {
    // auth() throws in test/build environments — fall through with no perms.
  }

  // standards.read (viewer+): can open the page and run/check mappings.
  const canView = role ? hasRole(role, 'viewer') : false;

  return (
    <section className="mx-auto flex max-w-content flex-col gap-6 px-6 py-8">
      <header>
        <h1 className="font-serif text-3xl text-brand-800">조화 표준 추적기</h1>
        <p className="mt-2 text-sm text-ink-600">
          기기 프로필 → 적용 가능한 ISO/IEC/EN/ASTM 표준 매핑, FDA 인정 실시간 확인, 전환·철회 알림.
        </p>
      </header>

      {!canView ? (
        <p
          className="rounded-lg border border-ink-150 bg-surface p-4 text-sm text-ink-500"
          data-testid="standards-unauthorized"
        >
          이 페이지를 볼 권한이 없습니다.
        </p>
      ) : (
        <StandardsClient />
      )}
    </section>
  );
}
