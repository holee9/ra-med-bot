// @MX:NOTE [AUTO] Governance dashboard page — source authority/version/approval overview.
// @MX:SPEC SPEC-REGULA-SOURCE-GOVERNANCE-001 (Issue #48, REQ-SOURCE-GOV-012/013/014, AC-06)
//
// Architecture: Server Component (mirrors traceability/knowledge-gap page
// pattern — calls getGovernanceDashboard directly, no self-fetch). Role gating:
// visible to ra-member+ (sourcegov.view); the Sidebar nav link is conditionally
// rendered server-side, so direct URL access by an unauthorized role is handled
// by the /api/source-governance/* RBAC gate (403), not by hiding the page.

import { auth } from '@/lib/auth';
import { hasRole } from '@/lib/auth/rbac';
import { getGovernanceDashboard } from '@/lib/source-governance/dashboard';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '출처 거버넌스 | Regula',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

export default async function GovernancePage() {
  let counts = {
    approved: 0,
    pendingReview: 0,
    rejected: 0,
    stale: 0,
    superseded: 0,
  };
  let reviewDue: Array<{
    id: string;
    title: string;
    ownerDepartment: string | null;
    reviewCycleDays: number | null;
    lastReviewedAt: string | null;
    daysOverdue: number;
  }> = [];
  let staleCitationArtifacts: Array<{
    messageId: string;
    sourceId: string;
    sourceTitle: string | null;
    reason: string;
  }> = [];
  let canManage = false;
  let isMember = false;

  try {
    const session = await auth();
    const userRole = (session?.user as { role?: string } | undefined)?.role;
    const orgId = (session?.user as { organizationId?: string } | undefined)?.organizationId;
    isMember = !!userRole && hasRole(userRole as Parameters<typeof hasRole>[0], 'ra-member');
    canManage = !!userRole && hasRole(userRole as Parameters<typeof hasRole>[0], 'ra-lead');
    if (orgId && isMember) {
      const dashboard = await getGovernanceDashboard({ orgId });
      counts = dashboard.counts;
      reviewDue = dashboard.reviewDue;
      staleCitationArtifacts = dashboard.staleCitationArtifacts;
    }
  } catch {
    // Auth/DB unavailable in build — render with empty defaults.
  }

  if (!isMember) {
    return (
      <div className="p-6">
        <p className="text-sm text-ink-600">이 페이지에 접근할 권한이 없습니다.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-6 py-8" data-testid="governance-page">
      <header className="mb-6">
        <h1 className="text-xl font-semibold text-ink-800">출처 거버넌스 대시보드</h1>
        <p className="mt-1 text-sm text-ink-600">
          권위 등급, 유효일, 폐기 상태, 승인 대기 현황을 한눈에 확인합니다.
        </p>
      </header>

      <section className="mb-8" aria-label="승인 현황">
        <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-ink-500">승인 현황</h2>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
          <CountCard label="승인됨" value={counts.approved} testId="governance-count-approved" />
          <CountCard
            label="승인 대기"
            value={counts.pendingReview}
            testId="governance-count-pending"
          />
          <CountCard label="반려" value={counts.rejected} testId="governance-count-rejected" />
          <CountCard label="폐기 만료" value={counts.stale} testId="governance-count-stale" />
          <CountCard
            label="대체됨"
            value={counts.superseded}
            testId="governance-count-superseded"
          />
        </div>
      </section>

      <section className="mb-8" aria-label="리뷰 예정">
        <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-ink-500">
          30일 내 리뷰 예정
        </h2>
        {reviewDue.length === 0 ? (
          <p className="text-sm text-ink-500">예정된 리뷰가 없습니다.</p>
        ) : (
          <ul
            className="divide-y divide-ink-100 rounded-md border border-ink-200"
            data-testid="governance-review-due-list"
          >
            {reviewDue.slice(0, 20).map((s) => (
              <li key={s.id} className="px-3 py-2 text-sm">
                <span className="font-medium text-ink-800">{s.title}</span>
                {s.ownerDepartment && (
                  <span className="ml-2 text-xs text-ink-500">{s.ownerDepartment}</span>
                )}
                <span className="ml-2 text-xs text-amber-600">
                  {s.daysOverdue > 0 ? `${s.daysOverdue}일 지연` : '예정'}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-label="만료 인용">
        <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-ink-500">
          폐기/대체 출처 인용 산출물
        </h2>
        {staleCitationArtifacts.length === 0 ? (
          <p className="text-sm text-ink-500">만료 출처 인용 산출물이 없습니다.</p>
        ) : (
          <ul
            className="divide-y divide-ink-100 rounded-md border border-ink-200"
            data-testid="governance-stale-artifacts-list"
          >
            {staleCitationArtifacts.map((a) => (
              <li key={`${a.messageId}-${a.sourceId}`} className="px-3 py-2 text-sm">
                <span className="font-medium text-ink-800">
                  {a.sourceTitle ?? a.sourceId.slice(0, 8)}
                </span>
                <span className="ml-2 text-xs text-red-600">{a.reason}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {canManage && (
        <p className="mt-8 text-xs text-ink-400" data-testid="governance-manage-hint">
          승인/반려는 출처 상세 페이지 또는 /api/source-governance/approve 에서 처리할 수 있습니다.
        </p>
      )}
    </div>
  );
}

function CountCard({
  label,
  value,
  testId,
}: {
  label: string;
  value: number;
  testId: string;
}) {
  return (
    <div className="rounded-md border border-ink-200 bg-white px-3 py-2" data-testid={testId}>
      <p className="text-[10px] uppercase tracking-widest text-ink-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-ink-800">{value}</p>
    </div>
  );
}
