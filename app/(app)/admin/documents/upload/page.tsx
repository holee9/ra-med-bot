import { RedactionBlockerWarning } from '@/components/admin/RedactionBlockerWarning';
import type { DocClass } from '@/lib/ingest/doc-class';
import { docClassLabels } from '@/lib/ingest/doc-class-labels';
import { auth } from '@/lib/kernel/auth';
// @MX:NOTE [AUTO] Admin document upload page — R2 presigned URL flow with DocClass selection.
// @MX:SPEC SPEC-REGULA-DOCINGEST-001 (REQ-DOC-073)
// @MX:SPEC Issue #158 (Group B4 - Admin Documents #151 redaction blocker warning on upload)
import { redirect } from 'next/navigation';

export default async function AdminDocumentUploadPage() {
  const session = await auth();

  if (
    !session?.user ||
    !['admin', 'ra-lead'].includes((session.user as { role?: string }).role ?? '')
  ) {
    redirect('/403');
  }

  const docClassOptions = Object.entries(docClassLabels) as [
    DocClass,
    { ko: string; en: string },
  ][];

  return (
    <div className="mx-auto max-w-2xl px-6 py-8">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold">문서 업로드</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          규제 문서를 업로드하면 자동으로 분류 및 처리됩니다.
        </p>
      </header>

      <RedactionBlockerWarning />

      <form className="space-y-6">
        {/* DocClass selection */}
        <div>
          <label className="block text-sm font-medium" htmlFor="docClass">
            문서 분류 *
          </label>
          <select
            id="docClass"
            name="docClass"
            className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            required
          >
            <option value="">문서 유형을 선택하세요</option>
            {docClassOptions.map(([cls, label]) => (
              <option key={cls} value={cls}>
                {label.ko} ({label.en})
              </option>
            ))}
          </select>
        </div>

        {/* File upload */}
        <div>
          <label className="block text-sm font-medium" htmlFor="file">
            파일 *
          </label>
          <div className="mt-1 flex justify-center rounded-md border-2 border-dashed border-border px-6 pt-5 pb-6">
            <div className="space-y-1 text-center">
              <div className="flex text-sm text-muted-foreground">
                <label
                  htmlFor="file"
                  className="relative cursor-pointer rounded-md font-medium text-primary hover:text-primary/80"
                >
                  <span>파일 선택</span>
                  <input
                    id="file"
                    name="file"
                    type="file"
                    className="sr-only"
                    accept=".pdf,.docx,.xlsx"
                  />
                </label>
                <p className="pl-1">또는 드래그 앤 드롭</p>
              </div>
              <p className="text-xs text-muted-foreground">PDF, DOCX, XLSX (최대 100MB)</p>
            </div>
          </div>
        </div>

        {/* Submit */}
        <div className="flex justify-end gap-3">
          <a
            href="/admin/documents"
            className="rounded-md border border-border px-4 py-2 text-sm hover:bg-muted"
          >
            취소
          </a>
          <button
            type="submit"
            className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90"
          >
            업로드
          </button>
        </div>
      </form>
    </div>
  );
}
