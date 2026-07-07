// @MX:NOTE [AUTO] Clinical Investigation entry page — Issue #69 full-cycle frontend.
// @MX:SPEC SPEC-REGULA-CLINICAL-INVESTIGATION-001 (REQ-CLININV-001~012, AC-01~08)

// @MX:LEGACY archived from app

import { auth } from '@/lib/auth';
import { type Role, hasRole } from '@/lib/auth/rbac';
import { db } from '@/lib/db/client';
import { clinicalInvestigations, projects } from '@/lib/db/schema';
import { desc, eq } from 'drizzle-orm';
import type { Metadata } from 'next';
import { ClinicalInvestigationWorkbench } from './_components/ClinicalInvestigationWorkbench';

export const metadata: Metadata = {
  title: '임상조사 계획기 — Regula',
  description: 'FDA IDE, EU MDR Clinical Investigation, IRB/EC 패키지 계획기',
  robots: { index: false, follow: false },
};

export default async function ClinicalInvestigationPage() {
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

  let projectList: Array<{ id: string; name: string }> = [];
  let recent: Array<{
    id: string;
    projectId: string | null;
    pathway: 'fda_ide' | 'eu_mdr' | null;
    necessityStatus: string;
    approvalStatus: string;
    updatedAt: string | null;
  }> = [];

  if (canView && orgId) {
    try {
      projectList = await db
        .select({ id: projects.id, name: projects.name })
        .from(projects)
        .where(eq(projects.organizationId, orgId))
        .orderBy(desc(projects.createdAt))
        .limit(50);
    } catch {
      // DB unavailable in test environments — empty list.
    }

    try {
      const rows = await db
        .select({
          id: clinicalInvestigations.id,
          projectId: clinicalInvestigations.projectId,
          pathway: clinicalInvestigations.pathway,
          necessityStatus: clinicalInvestigations.necessityStatus,
          approvalStatus: clinicalInvestigations.approvalStatus,
          updatedAt: clinicalInvestigations.updatedAt,
        })
        .from(clinicalInvestigations)
        .where(eq(clinicalInvestigations.orgId, orgId))
        .orderBy(desc(clinicalInvestigations.updatedAt))
        .limit(20);
      recent = rows.map((row) => ({
        ...row,
        updatedAt: row.updatedAt ? row.updatedAt.toISOString() : null,
      }));
    } catch {
      // DB unavailable in test environments — empty list.
    }
  }

  return (
    <section
      className="mx-auto flex max-w-content flex-col gap-6 px-6 py-8"
      data-testid="clinical-investigation-page"
    >
      <header>
        <h1 className="font-serif text-3xl text-brand-800">임상조사 계획기</h1>
        <p className="mt-2 text-sm text-ink-600">
          CER·문헌 갭에서 FDA IDE/EU MDR 임상조사 판단, protocol, IRB/EC 패키지, study event,
          CER/PMS/DHF 링크까지 하나의 감사 가능한 흐름으로 관리합니다.
        </p>
      </header>

      {!canView ? (
        <div
          className="rounded-md border border-ink-200 bg-ink-50 px-4 py-6 text-sm text-ink-600"
          role="alert"
        >
          임상조사 계획기는 RA Member 권한 이상 필요합니다 (clinical_investigation.view).
        </div>
      ) : projectList.length === 0 ? (
        <div
          className="rounded-md border border-ink-200 bg-ink-50 px-4 py-6 text-sm text-ink-600"
          role="alert"
        >
          임상조사 assessment를 생성하려면 먼저 프로젝트를 생성하세요.
        </div>
      ) : (
        <ClinicalInvestigationWorkbench
          projects={projectList}
          recent={recent}
          canManage={canManage}
        />
      )}

      {canView && !canManage && (
        <p className="text-xs text-ink-400" data-testid="ci-viewer-notice">
          RA Lead 이상의 권한이 있어야 assessment 생성과 lifecycle 변경을 수행할 수 있습니다.
        </p>
      )}
    </section>
  );
}
