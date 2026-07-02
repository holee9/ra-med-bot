// @MX:NOTE [AUTO] Labeling entry page — document creation form (REQ-001, AC-01).
// @MX:SPEC SPEC-REGULA-LABELING-001 (REQ-001, REQ-002, REQ-012, AC-01)
//
// Server Component shell: resolves role server-side via auth() + hasRole and
// pre-fetches the project list (RLS scoped via org_id). Passes capability
// booleans + project list to the client island (LabelingCreateForm).
// Mirrors the change-control RSC pattern (app/(app)/change-control/page.tsx).

import { auth } from '@/lib/auth';
import { type Role, hasRole } from '@/lib/auth/rbac';
import { db } from '@/lib/db/client';
import { projects } from '@/lib/db/schema';
import { desc, eq } from 'drizzle-orm';
import type { Metadata } from 'next';
import { LabelingCreateForm } from './_components/LabelingCreateForm';

export const metadata: Metadata = {
  title: '라벨링·IFU 워크벤치 — Regula',
  description: '의료기기 라벨·IFU·claim의 관할권별 검토·승인 (SPEC-REGULA-LABELING-001)',
  robots: { index: false, follow: false },
};

export default async function LabelingPage() {
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

  // label.create = ra-member+ (REQ-001). label.view also ra-member+.
  const canView = role ? hasRole(role, 'ra-member') : false;
  const canCreate = canView;

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
      data-testid="labeling-page"
    >
      <header>
        <h1 className="font-serif text-3xl text-brand-800">라벨링·IFU 워크벤치</h1>
        <p className="mt-2 text-sm text-ink-600">
          의료기기 라벨, IFU, intended use, indication, 마케팅 claim을 FDA·EU MDR·MFDS·PMDA·NMPA
          관할권별 규제 기준에 맞춰 작성·검토·승인합니다. 모든 claim은 근거 citation 연결이
          강제되며, 비교·우월성 표현은 자동 경고됩니다 (21 CFR 801, MDR Annex I, 의료기기법 제12조).
        </p>
      </header>

      {!canView ? (
        <div
          className="rounded-md border border-ink-200 bg-ink-50 px-4 py-6 text-sm text-ink-600"
          role="alert"
        >
          라벨링 워크벤치 접근은 RA Member 권한 이상 필요합니다 (label.view).
        </div>
      ) : projectList.length === 0 ? (
        <div
          className="rounded-md border border-ink-200 bg-ink-50 px-4 py-6 text-sm text-ink-600"
          role="alert"
        >
          라벨링 문서를 생성하려면 먼저 프로젝트를 생성하세요.
        </div>
      ) : (
        <div className="rounded-lg border border-ink-200 bg-surface p-6">
          <h2 className="mb-4 font-serif text-xl text-brand-700">새 라벨링 문서</h2>
          <LabelingCreateForm projects={projectList} canCreate={canCreate} />
        </div>
      )}
    </section>
  );
}
