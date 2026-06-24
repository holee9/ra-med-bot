// @MX:NOTE [AUTO] Labeling document detail page — workbench shell (REQ-001~012).
// @MX:SPEC SPEC-REGULA-LABELING-001 (REQ-001, REQ-002, REQ-006, REQ-012, AC-01/03/08)
//
// Server Component shell: resolves role + fetches the document (org-scoped)
// via the internal API. Passes the full detail to LabelingWorkbench (client
// island) which renders the section tabs + checklist + claim input + translation
// diff + approval/export gates. Mirrors the CC assessment detail RSC pattern.

import { auth } from '@/lib/auth';
import { type Role, hasRole } from '@/lib/auth/rbac';
import type { LabelingDocumentDetailResponse } from '@/lib/labeling/api-client';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { LabelingWorkbench } from './_components/LabelingWorkbench';

export const metadata: Metadata = {
  title: '라벨링 문서 — Regula',
  description: '라벨링·IFU·claim 검토 워크벤치 (SPEC-REGULA-LABELING-001)',
  robots: { index: false, follow: false },
};

type LabelingDocumentPageProps = {
  params: Promise<{ documentId: string }>;
};

export default async function LabelingDocumentPage({ params }: LabelingDocumentPageProps) {
  const { documentId } = await params;

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

  // label.view = ra-member+; label.approve/export = ra-lead (REQ-012).
  const canView = role ? hasRole(role, 'ra-member') : false;
  const canApprove = role ? hasRole(role, 'ra-lead') : false;
  const canExport = canApprove; // label.export mirrors label.approve (ra-lead).

  if (!canView || !orgId) {
    return (
      <section
        className="mx-auto flex max-w-content flex-col gap-6 px-6 py-8"
        data-testid="labeling-detail-forbidden"
      >
        <div
          className="rounded-md border border-ink-200 bg-ink-50 px-4 py-6 text-sm text-ink-600"
          role="alert"
        >
          라벨링 문서 조회는 RA Member 권한 이상 필요합니다 (label.view).
        </div>
      </section>
    );
  }

  // Fetch server-side via the API route (RLS-scoped, withPermission-gated).
  // Forward session cookies so auth() works inside the route handler.
  let detail: LabelingDocumentDetailResponse | null = null;
  let fetchFailed = false;
  try {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
    const res = await fetch(`${baseUrl}/api/labeling/documents/${documentId}`, {
      headers: sessionHeaders ?? {},
      cache: 'no-store',
    });
    if (res.status === 404) {
      notFound();
    }
    if (!res.ok) {
      fetchFailed = true;
    } else {
      detail = (await res.json()) as LabelingDocumentDetailResponse;
    }
  } catch {
    fetchFailed = true;
  }

  if (fetchFailed || !detail) {
    return (
      <section
        className="mx-auto flex max-w-content flex-col gap-6 px-6 py-8"
        data-testid="labeling-detail-error"
      >
        <div
          className="rounded-md border border-danger/30 bg-danger-bg px-4 py-6 text-sm text-danger"
          role="alert"
        >
          라벨링 문서를 불러오지 못했습니다. 잠시 후 다시 시도하세요.
        </div>
      </section>
    );
  }

  return (
    <section
      className="mx-auto flex max-w-content flex-col gap-6 px-6 py-8"
      data-testid="labeling-detail-page"
    >
      <LabelingWorkbench
        documentId={documentId}
        initial={detail}
        canEdit={canView}
        canApprove={canApprove}
        canExport={canExport}
      />
    </section>
  );
}
