// @MX:NOTE [AUTO] Assessment detail page — REQ-004/006/008/011/010 verdict + risk + version view.
// @MX:SPEC SPEC-REGULA-CHANGE-CONTROL-001 (REQ-004, REQ-006, REQ-008, REQ-009, REQ-010, REQ-011, AC-03/06/07/08)
//
// Server Component shell: resolves role + fetches the assessment (org-scoped)
// via the internal API. Passes the full detail to AssessmentView (client island)
// which renders the verdict grid + expert review gate + export button.

import { auth } from '@/lib/auth';
import { type Role, hasRole } from '@/lib/auth/rbac';
import type { AssessmentDetailResponse } from '@/lib/change-control/api-client';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { AssessmentView } from './_components/AssessmentView';

export const metadata: Metadata = {
  title: '변경 평가 결과 — Regula',
  description: '관할권별 변경 영향 평가 결과 (SPEC-REGULA-CHANGE-CONTROL-001)',
  robots: { index: false, follow: false },
};

type AssessmentPageProps = {
  params: Promise<{ assessmentId: string }>;
};

export default async function AssessmentDetailPage({ params }: AssessmentPageProps) {
  const { assessmentId } = await params;

  let role: Role | undefined;
  let orgId: string | undefined;
  let sessionHeaders: Record<string, string> | undefined;
  try {
    const session = await auth();
    const user = session?.user as
      | { role?: string; organizationId?: string; accessToken?: string }
      | undefined;
    role = user?.role as Role | undefined;
    orgId = user?.organizationId;
    if (user?.accessToken) {
      sessionHeaders = { Cookie: `__Secure-authjs.session-token=${user.accessToken}` };
    }
  } catch {
    // auth() throws in test/build environments.
  }

  const canView = role ? hasRole(role, 'ra-member') : false;
  const canManage = role ? hasRole(role, 'ra-lead') : false;
  // canExport mirrors the backend withPermission('change.export') which is ra-lead.
  const canExport = canManage;

  if (!canView || !orgId) {
    return (
      <section
        className="mx-auto flex max-w-content flex-col gap-6 px-6 py-8"
        data-testid="cc-detail-forbidden"
      >
        <div
          className="rounded-md border border-ink-200 bg-ink-50 px-4 py-6 text-sm text-ink-600"
          role="alert"
        >
          평가 결과 조회는 RA Member 권한 이상 필요합니다 (change.view).
        </div>
      </section>
    );
  }

  // Fetch server-side via the API route (RLS-scoped, withPermission-gated).
  // Forward session cookies so auth() works inside the route handler.
  let detail: AssessmentDetailResponse | null = null;
  let fetchFailed = false;
  try {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
    const res = await fetch(`${baseUrl}/api/change-control/${assessmentId}`, {
      headers: sessionHeaders ?? {},
      cache: 'no-store',
    });
    if (res.status === 404) {
      notFound();
    }
    if (!res.ok) {
      fetchFailed = true;
    } else {
      detail = (await res.json()) as AssessmentDetailResponse;
    }
  } catch {
    fetchFailed = true;
  }

  if (fetchFailed || !detail) {
    return (
      <section
        className="mx-auto flex max-w-content flex-col gap-6 px-6 py-8"
        data-testid="cc-detail-error"
      >
        <div
          className="rounded-md border border-danger/30 bg-danger-bg px-4 py-6 text-sm text-danger"
          role="alert"
        >
          평가 데이터를 불러오지 못했습니다. 잠시 후 다시 시도하세요.
        </div>
      </section>
    );
  }

  return (
    <section
      className="mx-auto flex max-w-content flex-col gap-6 px-6 py-8"
      data-testid="cc-detail-page"
    >
      <AssessmentView
        assessmentId={assessmentId}
        initial={detail}
        canManage={canManage}
        canExport={canExport}
      />
    </section>
  );
}
