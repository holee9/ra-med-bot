// @MX:NOTE [AUTO] CAPA complaint detail page — workbench shell (REQ-001~012).
// @MX:SPEC SPEC-REGULA-CAPA-001 (REQ-001~012, AC-01/04/07/08)
//
// Server Component shell: resolves role + fetches the complaint (org-scoped)
// and its CAPA records + close-gate state server-side. Passes everything to
// CapaWorkbench (client island) which renders the intake/reportability/RCA/
// corrective/preventive/close tabs. Mirrors the labeling detail RSC pattern.

import { CloseGateBadge, type CloseGateState } from '@/components/capa/close-gate-badge';
import { auth } from '@/lib/auth';
import { type Role, hasRole } from '@/lib/auth/rbac';
import { canCloseCapa } from '@/lib/capa/close-gate';
import { getComplaint } from '@/lib/capa/intake';
import { db } from '@/lib/db/client';
import { capaRecords, complaints, projects } from '@/lib/db/schema';
import { and, eq } from 'drizzle-orm';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { CapaWorkbench } from './_components/CapaWorkbench';

export const metadata: Metadata = {
  title: 'CAPA 워크벤치 — Regula',
  description: '불만·CAPA 폐루프 워크벤치 (SPEC-REGULA-CAPA-001)',
  robots: { index: false, follow: false },
};

type CapaDetailPageProps = {
  params: Promise<{ id: string }>;
};

type CapaRow = {
  id: string;
  type: string;
  description: string;
  status: string;
  effectivenessStatus: string;
  ownerId: string;
};

export default async function CapaDetailPage({ params }: CapaDetailPageProps) {
  const { id: complaintId } = await params;

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
  const canClose = role ? hasRole(role, 'ra-lead') : false;

  if (!canView || !orgId) {
    return (
      <section
        className="mx-auto flex max-w-content flex-col gap-6 px-6 py-8"
        data-testid="capa-detail-forbidden"
      >
        <div
          className="rounded-md border border-ink-200 bg-ink-50 px-4 py-6 text-sm text-ink-600"
          role="alert"
        >
          CAPA 워크벤치 조회는 RA Member 권한 이상 필요합니다 (complaint.view).
        </div>
      </section>
    );
  }

  // Fetch complaint (IDOR-safe: null for absent or cross-org).
  const complaint = await getComplaint(complaintId, orgId);
  if (!complaint) {
    notFound();
  }

  // Fetch the project name + id for context. complaint.projectId is a uuid FK.
  let projectName = 'Unknown Project';
  let complaintProjectId: string | null = null;
  try {
    const [complaintRow] = await db
      .select({ projectId: complaints.projectId })
      .from(complaints)
      .where(and(eq(complaints.id, complaintId), eq(complaints.orgId, orgId)))
      .limit(1);
    complaintProjectId = complaintRow?.projectId ?? null;
    if (complaintProjectId) {
      const [projectRow] = await db
        .select({ id: projects.id, name: projects.name })
        .from(projects)
        .where(and(eq(projects.id, complaintProjectId), eq(projects.organizationId, orgId)))
        .limit(1);
      if (projectRow) projectName = projectRow.name;
    }
  } catch {
    // DB unavailable in test environments.
  }

  // Fetch CAPA records linked to this complaint (corrective + preventive).
  let capaRecordsList: CapaRow[] = [];
  try {
    const rows = await db
      .select({
        id: capaRecords.id,
        type: capaRecords.type,
        description: capaRecords.description,
        status: capaRecords.status,
        effectivenessStatus: capaRecords.effectivenessStatus,
        ownerId: capaRecords.ownerId,
      })
      .from(capaRecords)
      .where(and(eq(capaRecords.complaintId, complaintId), eq(capaRecords.orgId, orgId)));
    capaRecordsList = rows;
  } catch {
    // DB unavailable in test environments.
  }

  // REQ-011: compute the close gate state for the badge. Use the first CAPA
  // record (if any) since the gate is complaint-level (reportable + vigilance).
  let closeGateState: CloseGateState = 'blocked_vigilance';
  let closeGateReason: string | undefined;
  const firstCapaId = capaRecordsList[0]?.id;
  if (firstCapaId) {
    const gate = await canCloseCapa(firstCapaId, orgId);
    if (gate.allowed) {
      closeGateState = canClose ? 'allowed' : 'insufficient_role';
    } else if (gate.reason === 'vigilance_link_missing') {
      closeGateState = 'blocked_vigilance';
      closeGateReason =
        'reportable 불만이 Vigilance에 연결되지 않았습니다. 먼저 reportability 평가를 수행하세요.';
    } else {
      closeGateState = 'blocked_vigilance';
      closeGateReason = gate.reason;
    }
  } else {
    // No CAPA record yet — show the vigilance gate based on complaint status.
    if (complaint.reportabilityStatus === 'reportable' && !complaint.vigilanceRef) {
      closeGateState = 'blocked_vigilance';
      closeGateReason = 'reportable 불만이 Vigilance에 연결되지 않았습니다.';
    } else {
      closeGateState = canClose ? 'allowed' : 'insufficient_role';
    }
  }

  return (
    <section
      className="mx-auto flex max-w-content flex-col gap-6 px-6 py-8"
      data-testid="capa-detail-page"
    >
      <header>
        <h1 className="font-serif text-3xl text-brand-800">CAPA 워크벤치</h1>
        <p className="mt-2 text-sm text-ink-600">
          기기:{' '}
          <span className="font-medium text-brand-700">{complaint.intakeData.deviceName}</span>
          {complaint.intakeData.deviceModel && (
            <span className="text-ink-500"> ({complaint.intakeData.deviceModel})</span>
          )}
        </p>
        <p className="mt-1 text-xs text-ink-400">
          프로젝트: {projectName} · Complaint ID: <code className="font-mono">{complaintId}</code>
        </p>
      </header>

      {/* Reportability status banner (REQ-002 result). */}
      <output
        className={[
          'rounded-md border px-4 py-3 text-sm',
          complaint.reportabilityStatus === 'reportable'
            ? 'border-danger/30 bg-danger-bg text-danger'
            : complaint.reportabilityStatus === 'not_reportable'
              ? 'border-success/30 bg-success-bg text-success'
              : 'border-amber-200 bg-amber-50 text-amber-700',
        ].join(' ')}
        aria-live="polite"
        data-testid="reportability-banner"
      >
        <p className="font-medium">
          보고 의무 상태:{' '}
          {complaint.reportabilityStatus === 'reportable'
            ? '보고 대상 (reportable)'
            : complaint.reportabilityStatus === 'not_reportable'
              ? '보고 불필요 (not_reportable)'
              : '평가 대기 (pending)'}
        </p>
        {complaint.vigilanceRef && (
          <p className="mt-1 text-xs">
            Vigilance 연결: <code className="font-mono">{complaint.vigilanceRef}</code>
          </p>
        )}
      </output>

      {/* REQ-011 close gate badge (server-computed, advisory). */}
      {capaRecordsList.length > 0 && (
        <CloseGateBadge state={closeGateState} reason={closeGateReason} />
      )}

      <CapaWorkbench
        complaintId={complaintId}
        orgId={orgId}
        projectId={complaintProjectId ?? ''}
        projectName={projectName}
        intake={complaint.intakeData}
        reportabilityStatus={complaint.reportabilityStatus}
        vigilanceRef={complaint.vigilanceRef}
        capaRecords={capaRecordsList}
        canClose={canClose}
        closeGateState={closeGateState}
      />
    </section>
  );
}
