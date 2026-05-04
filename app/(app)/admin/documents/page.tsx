// @MX:NOTE [AUTO] Admin document list page — server component with client filtering.
// @MX:SPEC SPEC-REGULA-DOCINGEST-001 (REQ-DOC-073)
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { docClassLabels } from '@/lib/ingest/doc-class-labels';
import type { DocClass } from '@/lib/ingest/doc-class';

export default async function AdminDocumentsPage() {
  const session = await auth();

  // Only admin and ra-lead can access this page
  if (!session?.user || !['admin', 'ra-lead'].includes((session.user as { role?: string }).role ?? '')) {
    redirect('/403');
  }

  return (
    <div className="mx-auto max-w-content px-6 py-8">
      <header className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">문서 관리</h1>
        <a
          href="/admin/documents/upload"
          className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90"
        >
          문서 업로드
        </a>
      </header>

      <section>
        <p className="text-sm text-muted-foreground">
          총 {Object.keys(docClassLabels).length}개 문서 클래스 지원
        </p>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {(Object.entries(docClassLabels) as [DocClass, { ko: string; en: string }][]).map(
            ([cls, label]) => (
              <div
                key={cls}
                className="rounded-lg border border-border bg-card p-4"
              >
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
