// @MX:NOTE [AUTO] Change Control entry page — structured change input form (REQ-002, AC-01).
// @MX:SPEC SPEC-REGULA-CHANGE-CONTROL-001 (REQ-002, REQ-003, AC-01)

// @MX:LEGACY archived from app
//
// Server Component shell: resolves role server-side via auth() + hasRole and
// pre-fetches the project list (RLS scoped via org_id). Passes capability
// booleans + project list to the client island (ChangeControlForm).
// Mirrors the PMS workbench RSC pattern.

import { auth } from '@/lib/auth';
import { type Role, hasRole } from '@/lib/auth/rbac';
import { db } from '@/lib/db/client';
import { projects } from '@/lib/db/schema';
import { desc, eq } from 'drizzle-orm';
import type { Metadata } from 'next';
import { ChangeControlForm } from './_components/ChangeControlForm';

export const metadata: Metadata = {
  title: '변경 관리 — Regula',
  description: '설계 변경의 관할권별 규제 영향 자동 평가 (SPEC-REGULA-CHANGE-CONTROL-001)',
  robots: { index: false, follow: false },
};

export default async function ChangeControlPage() {
  let role: Role | undefined;
  let orgId: string | undefined;
  try {
    const session = await auth();
    const user = session?.user as { role?: string; organizationId?: string } | undefined;
    role = user?.role as Role | undefined;
    orgId = user?.organizationId;
  } catch {
    // auth() throws in test/build environments — fall through with no perms.
  }

  const canView = role ? hasRole(role, 'ra-member') : false;
  const canAssess = role ? hasRole(role, 'ra-lead') : false;

  let projectList: Array<{ id: string; name: string }> = [];
  if (canView && orgId) {
    try {
      const rows = await db
        .select({ id: projects.id, name: projects.name })
        .from(projects)
        .where(eq(projects.organizationId, orgId))
        .orderBy(desc(projects.createdAt))
        .limit(50);
      projectList = rows;
    } catch {
      // DB unavailable in test environments — empty list.
    }
  }

  return (
    <section
      className="mx-auto flex max-w-content flex-col gap-6 px-6 py-8"
      data-testid="change-control-page"
    >
      <header>
        <h1 className="font-serif text-3xl text-brand-800">변경 관리</h1>
        <p className="mt-2 text-sm text-ink-600">
          설계 변경의 관할권별 규제 영향을 자동 평가합니다. FDA 21 CFR 807.81(a)(3), EU MDR Article
          120(3), MFDS 의료기기법 제12조 등 다중 관할권 기준으로 새 허가 필요 여부를 판단합니다.
        </p>
      </header>

      {!canView ? (
        <div
          className="rounded-md border border-ink-200 bg-ink-50 px-4 py-6 text-sm text-ink-600"
          role="alert"
        >
          변경 관리 페이지 접근은 RA Member 권한 이상 필요합니다 (change.view).
        </div>
      ) : projectList.length === 0 ? (
        <div
          className="rounded-md border border-ink-200 bg-ink-50 px-4 py-6 text-sm text-ink-600"
          role="alert"
        >
          평가를 실행하려면 먼저 프로젝트를 생성하세요.
        </div>
      ) : (
        <div className="rounded-lg border border-ink-200 bg-surface p-6">
          <h2 className="mb-4 font-serif text-xl text-brand-700">변경 입력</h2>
          <ChangeControlForm projects={projectList} canAssess={canAssess} />
        </div>
      )}
    </section>
  );
}
