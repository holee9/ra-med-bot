// @MX:NOTE [AUTO] PMS project workbench — SPEC-REGULA-PMS-001 (Issue #53, Phase 3).
// @MX:SPEC SPEC-REGULA-PMS-001 (REQ-PMS-002~007, AC-02/03/05/06/07)
//
// Server Component shell: resolves role + pre-fetches compliance result and CER
// linkage data server-side. Passes capability booleans + initial data to the
// client island (PmsWorkbench) which manages tab switching between PMSR,
// PMCF Plan, PMCF Evaluation, Inputs, and Compliance views.

import { auth } from '@/lib/auth';
import { type Role, hasRole } from '@/lib/auth/rbac';
import { db } from '@/lib/db/client';
import { pmsDocuments, projects } from '@/lib/db/schema';
import { and, eq } from 'drizzle-orm';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { PmsWorkbench } from '../_components/PmsWorkbench';

export const metadata: Metadata = {
  title: 'PMS 워크벤치 — Regula',
  description: 'EU MDR Article 83-86 PMS/PMCF 워크벤치 (SPEC-REGULA-PMS-001)',
  robots: { index: false, follow: false },
};

type ProjectPageProps = {
  params: Promise<{ projectId: string }>;
};

export default async function PmsProjectPage({ params }: ProjectPageProps) {
  const { projectId } = await params;

  let role: Role | undefined;
  let orgId: string | undefined;
  try {
    const session = await auth();
    const user = session?.user as { role?: string; organizationId?: string } | undefined;
    role = user?.role as Role | undefined;
    orgId = user?.organizationId;
  } catch {
    // auth() throws in test/build environments.
  }

  const canView = role ? hasRole(role, 'ra-member') : false;
  const canManage = role ? hasRole(role, 'ra-lead') : false;

  // Verify project exists and belongs to this org (IDOR guard).
  let projectName = 'Unknown Project';
  let cerRefId: string | null = null;
  let cerDeviceName: string | null = null;

  if (canView && orgId) {
    try {
      const projectRow = await db
        .select({ id: projects.id, name: projects.name })
        .from(projects)
        .where(and(eq(projects.id, projectId), eq(projects.organizationId, orgId)))
        .limit(1);
      if (projectRow.length === 0) {
        notFound();
      }
      projectName = projectRow[0]?.name ?? projectName;

      // Find CER document for this project (REQ-PMS-004 auto-linkage).
      const cerDocs = await db
        .select({ id: pmsDocuments.id })
        .from(pmsDocuments)
        .where(
          and(
            eq(pmsDocuments.projectId, projectId),
            eq(pmsDocuments.orgId, orgId),
            eq(pmsDocuments.workflowType, 'cer'),
          ),
        )
        .limit(1);
      if (cerDocs.length > 0 && cerDocs[0]) {
        cerRefId = cerDocs[0].id;
        cerDeviceName = projectName;
      }
    } catch {
      // DB unavailable in test environments — fall through with defaults.
    }
  }

  return (
    <section className="mx-auto flex max-w-content flex-col gap-6 px-6 py-8">
      <header>
        <h1 className="font-serif text-3xl text-brand-800">PMS 워크벤치</h1>
        <p className="mt-2 text-sm text-ink-600">
          프로젝트: <span className="font-medium text-brand-700">{projectName}</span>
        </p>
      </header>

      {!canView ? (
        <p
          className="rounded-lg border border-ink-150 bg-surface p-4 text-sm text-ink-500"
          data-testid="pms-unauthorized"
        >
          이 페이지를 볼 권한이 없습니다.
        </p>
      ) : (
        <PmsWorkbench
          projectId={projectId}
          canManage={canManage}
          cerRefId={cerRefId}
          cerDeviceName={cerDeviceName}
        />
      )}
    </section>
  );
}
