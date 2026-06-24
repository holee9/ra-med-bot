// @MX:NOTE [AUTO] CAPA entry page — complaint intake + complaint/CAPA list (REQ-001).
// @MX:SPEC SPEC-REGULA-CAPA-001 (REQ-001, REQ-012, AC-01)
//
// Server Component shell: resolves role server-side via auth() + hasRole and
// pre-fetches the project list + recent complaints (RLS scoped via org_id).
// Passes capability booleans + project list to the client island
// (ComplaintIntakeForm). Mirrors the labeling/change-control RSC pattern.

import { ComplaintIntakeForm } from '@/components/capa/complaint-intake-form';
import { auth } from '@/lib/auth';
import { type Role, hasRole } from '@/lib/auth/rbac';
import { db } from '@/lib/db/client';
import { complaints, projects } from '@/lib/db/schema';
import { desc, eq } from 'drizzle-orm';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '불만·CAPA 관리 — Regula',
  description: '불만 접수부터 시정·예방조치 폐루프까지 (SPEC-REGULA-CAPA-001)',
  robots: { index: false, follow: false },
};

type ComplaintRow = {
  id: string;
  deviceName: string;
  reportabilityStatus: string;
  createdAt: string | null;
};

export default async function CapaPage() {
  let role: Role | undefined;
  let orgId: string | undefined;
  let reporterName: string | undefined;
  try {
    const session = await auth();
    const user = session?.user as
      | { role?: string; organizationId?: string; name?: string | null }
      | undefined;
    role = user?.role as Role | undefined;
    orgId = user?.organizationId;
    reporterName = user?.name ?? undefined;
  } catch {
    // auth() throws in test/build environments — fall through with no perms.
  }

  // complaint.create = ra-member+ (REQ-001). capa.view also ra-member+.
  const canView = role ? hasRole(role, 'ra-member') : false;
  const canCreate = canView;

  let projectList: Array<{ id: string; name: string }> = [];
  let recentComplaints: ComplaintRow[] = [];
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

    try {
      const complaintRows = await db
        .select({
          id: complaints.id,
          reportabilityStatus: complaints.reportabilityStatus,
          createdAt: complaints.createdAt,
        })
        .from(complaints)
        .where(eq(complaints.orgId, orgId))
        .orderBy(desc(complaints.createdAt))
        .limit(20);
      // deviceName is inside intake_data jsonb; extract for display.
      recentComplaints = complaintRows.map((row) => {
        const intake = (row as { intakeData?: unknown }).intakeData as
          | { deviceName?: string }
          | undefined;
        return {
          id: row.id,
          deviceName: intake?.deviceName ?? '(알 수 없음)',
          reportabilityStatus: row.reportabilityStatus ?? 'pending',
          createdAt: row.createdAt
            ? new Date(row.createdAt as unknown as string).toISOString()
            : null,
        };
      });
    } catch {
      // DB unavailable in test environments — empty list.
    }
  }

  return (
    <section
      className="mx-auto flex max-w-content flex-col gap-6 px-6 py-8"
      data-testid="capa-page"
    >
      <header>
        <h1 className="font-serif text-3xl text-brand-800">불만·CAPA 관리</h1>
        <p className="mt-2 text-sm text-ink-600">
          의료기기 불만 접수부터 reportability 평가, 근본 원인 분석, 시정·예방조치, 실효성 검증까지
          폐루프를 관리합니다. 모든 단계는 21 CFR Part 11 감사 로그에 기록됩니다
          (SPEC-REGULA-CAPA-001, REQ-010).
        </p>
      </header>

      {!canView ? (
        <div
          className="rounded-md border border-ink-200 bg-ink-50 px-4 py-6 text-sm text-ink-600"
          role="alert"
        >
          불만·CAPA 페이지 접근은 RA Member 권한 이상 필요합니다 (complaint.view).
        </div>
      ) : projectList.length === 0 ? (
        <div
          className="rounded-md border border-ink-200 bg-ink-50 px-4 py-6 text-sm text-ink-600"
          role="alert"
        >
          불만을 접수하려면 먼저 프로젝트를 생성하세요.
        </div>
      ) : (
        <>
          {/* REQ-001: complaint intake */}
          <div className="rounded-lg border border-ink-200 bg-surface p-6">
            <h2 className="mb-4 font-serif text-xl text-brand-700">불만 접수 (REQ-001)</h2>
            {canCreate ? (
              <ComplaintIntakeForm
                projectId={projectList[0]?.id ?? ''}
                defaultReporterName={reporterName}
              />
            ) : (
              <p className="text-sm text-ink-500">
                불만 접수는 RA Member 권한 이상 필요합니다 (complaint.create).
              </p>
            )}
          </div>

          {/* Recent complaints list */}
          {recentComplaints.length > 0 && (
            <div className="rounded-lg border border-ink-200 bg-surface p-6">
              <h2 className="mb-4 font-serif text-xl text-brand-700">최근 불만</h2>
              <ul className="flex flex-col gap-2">
                {recentComplaints.map((c) => (
                  <li key={c.id}>
                    <a
                      href={`/capa/${c.id}`}
                      className="flex items-center justify-between rounded-md border border-ink-100 px-3 py-2 text-sm hover:bg-ink-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2"
                      data-testid={`complaint-row-${c.id}`}
                    >
                      <span className="flex items-center gap-2">
                        <span className="font-medium text-ink-800">{c.deviceName}</span>
                        <span
                          className={[
                            'rounded-xs px-2 py-0.5 text-xs',
                            c.reportabilityStatus === 'reportable'
                              ? 'bg-danger-bg text-danger'
                              : c.reportabilityStatus === 'not_reportable'
                                ? 'bg-success-bg text-success'
                                : 'bg-ink-100 text-ink-600',
                          ].join(' ')}
                        >
                          {c.reportabilityStatus === 'reportable'
                            ? '보고 대상'
                            : c.reportabilityStatus === 'not_reportable'
                              ? '보고 불필요'
                              : '평가 대기'}
                        </span>
                      </span>
                      <span className="text-xs text-ink-400">
                        {c.createdAt ? new Date(c.createdAt).toLocaleDateString('ko-KR') : '—'}
                      </span>
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </section>
  );
}
