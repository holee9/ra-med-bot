// @MX:NOTE [AUTO] PMS Workbench entry page — SPEC-REGULA-PMS-001 (Issue #53, Phase 3).
// @MX:SPEC SPEC-REGULA-PMS-001 (REQ-PMS-002~007, AC-02/05/06)
//
// Server Component shell: resolves role server-side via auth() + hasRole and
// passes capability booleans down. Lists projects and links to the per-project
// workbench. The backend re-checks permissions via withPermission.

import { auth } from '@/lib/auth';
import { type Role, hasRole } from '@/lib/auth/rbac';
import { db } from '@/lib/db/client';
import { projects } from '@/lib/db/schema';
import { desc, eq } from 'drizzle-orm';
import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'PMS 워크벤치 — Regula',
  description: 'EU MDR Article 83-86 사후시장 감시 보고서 및 PMCF 계획 관리 (SPEC-REGULA-PMS-001)',
  robots: { index: false, follow: false },
};

export default async function PmsWorkbenchPage() {
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
  const canManage = role ? hasRole(role, 'ra-lead') : false;

  // Fetch projects server-side (RLS scoped via org_id).
  let projectList: { id: string; name: string }[] = [];
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
    <section className="mx-auto flex max-w-content flex-col gap-6 px-6 py-8">
      <header>
        <h1 className="font-serif text-3xl text-brand-800">PMS 워크벤치</h1>
        <p className="mt-2 text-sm text-ink-600">
          EU MDR Article 83-86 사후시장 감시 보고서(PMSR) 및 PMCF 계획 관리. MDCG 2022-21 섹션 구조,
          Annex XIV Part B 체크리스트, Article 83-86 컴플라이언스 체크를 지원합니다.
        </p>
      </header>

      {!canView ? (
        <p
          className="rounded-lg border border-ink-150 bg-surface p-4 text-sm text-ink-500"
          data-testid="pms-unauthorized"
        >
          이 페이지를 볼 권한이 없습니다.
        </p>
      ) : projectList.length === 0 ? (
        <p
          className="rounded-lg border border-ink-150 bg-surface p-4 text-sm text-ink-500"
          data-testid="pms-no-projects"
        >
          등록된 프로젝트가 없습니다. 프로젝트를 먼저 생성하세요.
        </p>
      ) : (
        <div className="flex flex-col gap-3" data-testid="pms-project-list">
          <p className="text-sm font-medium text-ink-700">
            프로젝트를 선택하여 PMS 워크벤치를 시작하세요:
          </p>
          <ul className="grid gap-2 sm:grid-cols-2">
            {projectList.map((project) => (
              <li key={project.id}>
                <Link
                  href={`/pms/${project.id}`}
                  data-testid={`pms-project-link-${project.id}`}
                  className="block rounded-lg border border-ink-200 bg-white p-4 text-sm hover:border-brand-400 hover:bg-brand-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2"
                >
                  <span className="font-medium text-brand-700">{project.name}</span>
                  <span className="mt-1 block text-xs text-ink-500">PMS 워크벤치 열기 →</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      {canView && !canManage && (
        <p className="text-xs text-ink-400" data-testid="pms-viewer-notice">
          RA Lead 이상의 권한이 있어야 문서를 생성할 수 있습니다.
        </p>
      )}
    </section>
  );
}
