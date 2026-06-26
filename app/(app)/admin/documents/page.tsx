import { RedactionBlockerWarning } from '@/components/admin/RedactionBlockerWarning';
import { SensitivityPolicyStatus } from '@/components/admin/SensitivityPolicyStatus';
import { auth } from '@/lib/auth';
import type { DocClass } from '@/lib/ingest/doc-class';
import { docClassLabels } from '@/lib/ingest/doc-class-labels';
import { ShieldCheck, Upload } from 'lucide-react';
// @MX:NOTE [AUTO] Admin document list page — server component with client filtering.
// @MX:SPEC SPEC-REGULA-DOCINGEST-001 (REQ-DOC-073)
// @MX:SPEC Issue #158 (Group B4 - Admin Documents #151 redaction blocker warning, sensitivity policy status)
import { redirect } from 'next/navigation';

export default async function AdminDocumentsPage() {
  const session = await auth();

  // Only admin and ra-lead can access this page
  if (
    !session?.user ||
    !['admin', 'ra-lead'].includes((session.user as { role?: string }).role ?? '')
  ) {
    redirect('/403');
  }

  return (
    <div className="mx-auto max-w-content px-6 py-8">
      <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">문서 관리</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            업로드 문서는 redaction, chunk, embedding, audit 경계를 통과한 뒤 조직 source로
            사용됩니다.
          </p>
        </div>
        <a
          href="/admin/documents/upload"
          className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90"
        >
          <Upload className="h-4 w-4" aria-hidden="true" />
          문서 업로드
        </a>
      </header>

      <RedactionBlockerWarning />

      <section className="mb-6">
        <SensitivityPolicyStatus policyConfigured={false} />
      </section>

      <section className="mb-6 rounded-lg border border-border bg-card p-4">
        <div className="flex items-center gap-2 text-sm font-medium">
          <ShieldCheck className="h-4 w-4" aria-hidden="true" />
          <span>운영 안전 경계</span>
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          {['PII redaction 적용', '조직별 source 접근 제한', 'document.* audit 기록'].map(
            (item) => (
              <div
                key={item}
                className="rounded-md border border-border bg-background px-3 py-2 text-sm"
              >
                {item}
              </div>
            ),
          )}
        </div>
      </section>

      <section>
        <p className="text-sm text-muted-foreground">
          총 {Object.keys(docClassLabels).length}개 문서 클래스 지원
        </p>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {(Object.entries(docClassLabels) as [DocClass, { ko: string; en: string }][]).map(
            ([cls, label]) => (
              <div key={cls} className="rounded-lg border border-border bg-card p-4">
                <p className="text-sm font-medium">{label.ko}</p>
                <p className="text-xs text-muted-foreground">{label.en}</p>
                <p className="mt-1 text-xs text-muted-foreground">{cls}</p>
              </div>
            ),
          )}
        </div>
      </section>
    </div>
  );
}
