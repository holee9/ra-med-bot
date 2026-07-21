import { auth } from '@/lib/kernel/auth';
// @MX:NOTE [AUTO] Admin document detail page — metadata, chunks, redaction preview, audit log.
// @MX:SPEC SPEC-REGULA-DOCINGEST-001 (REQ-DOC-074)
import { notFound, redirect } from 'next/navigation';

interface DocumentDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function DocumentDetailPage({ params }: DocumentDetailPageProps) {
  const session = await auth();

  if (
    !session?.user ||
    !['admin', 'ra-lead'].includes((session.user as { role?: string }).role ?? '')
  ) {
    redirect('/403');
  }

  const { id } = await params;

  if (!id || !/^[0-9a-f-]{36}$/.test(id)) {
    notFound();
  }

  return (
    <div className="mx-auto max-w-content px-6 py-8">
      <header className="mb-6">
        <nav className="text-sm text-muted-foreground">
          <a href="/admin/documents" className="hover:underline">
            문서 목록
          </a>
          <span className="mx-2">/</span>
          <span>문서 상세</span>
        </nav>
        <h1 className="mt-2 text-2xl font-semibold">문서 ID: {id}</h1>
      </header>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Metadata section */}
        <section className="rounded-lg border border-border bg-card p-5">
          <h2 className="mb-3 text-sm font-semibold">문서 정보</h2>
          <dl className="space-y-2 text-sm">
            <div className="flex gap-2">
              <dt className="text-muted-foreground">상태</dt>
              <dd className="font-medium">조회 중...</dd>
            </div>
            <div className="flex gap-2">
              <dt className="text-muted-foreground">클래스</dt>
              <dd className="font-medium">—</dd>
            </div>
            <div className="flex gap-2">
              <dt className="text-muted-foreground">업로드 일시</dt>
              <dd className="font-medium">—</dd>
            </div>
          </dl>
        </section>

        {/* Actions section */}
        <section className="rounded-lg border border-border bg-card p-5">
          <h2 className="mb-3 text-sm font-semibold">작업</h2>
          <div className="space-y-2">
            <button
              type="button"
              className="w-full rounded-md border border-border px-4 py-2 text-sm hover:bg-muted"
            >
              재처리 (Reprocess)
            </button>
          </div>
        </section>
      </div>

      {/* Chunks section */}
      <section className="mt-6 rounded-lg border border-border bg-card p-5">
        <h2 className="mb-3 text-sm font-semibold">청크 목록</h2>
        <p className="text-sm text-muted-foreground">청크 데이터를 로드 중...</p>
      </section>

      {/* Audit log section */}
      <section className="mt-6 rounded-lg border border-border bg-card p-5">
        <h2 className="mb-3 text-sm font-semibold">감사 로그</h2>
        <p className="text-sm text-muted-foreground">감사 로그를 로드 중...</p>
      </section>
    </div>
  );
}
