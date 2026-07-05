// @MX:NOTE [AUTO] NewSessionDialog — consult session creation dialog.
// @MX:SPEC SPEC-V3-UI-001 (REQ-V3-UI-052/053, AC-CONS-UI-002)

import { useCreateConsultSession } from '@/lib/queries/useConsult';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

interface NewSessionDialogProps {
  onSuccess?: () => void;
}

export function NewSessionDialog({ onSuccess }: NewSessionDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [projectId, setProjectId] = useState('');
  const [locale, setLocale] = useState('ko');

  const router = useRouter();
  const createMutation = useCreateConsultSession();
  const error = createMutation.error as { status?: number; message?: string } | null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // REQ-V3-UI-052: title 1-200자 validation
    if (title.length < 1 || title.length > 200) {
      return;
    }

    createMutation.mutate(
      { title, projectId: projectId || undefined, locale: locale || undefined },
      {
        onSuccess: (data) => {
          // REQ-V3-UI-053: 201 → navigate to new session
          router.push(`/consult/${data.session.id}`);
          onSuccess?.();
          setIsOpen(false);
          setTitle('');
          setProjectId('');
          setLocale('ko');
        },
      },
    );
  };

  if (!isOpen) {
    return (
      <button
        type="button"
        data-testid="new-session-button"
        onClick={() => setIsOpen(true)}
        className="rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
      >
        새 세션
      </button>
    );
  }

  const hasError = error?.status === 400;

  return (
    <div data-testid="new-session-dialog" className="space-y-4 rounded border p-4">
      <h3 className="text-lg font-semibold">새 세션 만들기</h3>

      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label htmlFor="session-title" className="block text-sm font-medium">
            제목 (1-200자)
          </label>
          <input
            id="session-title"
            data-testid="session-title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            disabled={createMutation.isPending}
            maxLength={200}
            required
            className="w-full rounded border px-3 py-2 disabled:opacity-50"
            placeholder="세션 제목을 입력하세요"
          />
          <div className="mt-1 text-xs text-gray-500">{title.length}/200</div>
        </div>

        <div>
          <label htmlFor="session-project" className="block text-sm font-medium">
            프로젝트 (선택)
          </label>
          <input
            id="session-project"
            data-testid="session-project"
            type="text"
            value={projectId}
            onChange={(e) => setProjectId(e.target.value)}
            disabled={createMutation.isPending}
            className="w-full rounded border px-3 py-2 disabled:opacity-50"
            placeholder="프로젝트 ID (선택사항)"
          />
        </div>

        <div>
          <label htmlFor="session-locale" className="block text-sm font-medium">
            언어 (선택)
          </label>
          <select
            id="session-locale"
            data-testid="session-locale"
            value={locale}
            onChange={(e) => setLocale(e.target.value)}
            disabled={createMutation.isPending}
            className="w-full rounded border px-3 py-2 disabled:opacity-50"
          >
            <option value="ko">한국어</option>
            <option value="en">English</option>
          </select>
        </div>

        {/* Validation error */}
        {hasError && (
          <div data-testid="session-error" className="rounded bg-red-50 p-3 text-sm text-red-700">
            {error?.message || '입력이 올바르지 않습니다'}
          </div>
        )}

        <div className="flex gap-2">
          <button
            type="submit"
            data-testid="session-submit"
            disabled={createMutation.isPending || title.length < 1 || title.length > 200}
            className="rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {createMutation.isPending ? '...' : '생성'}
          </button>
          <button
            type="button"
            data-testid="session-cancel"
            onClick={() => setIsOpen(false)}
            disabled={createMutation.isPending}
            className="rounded border px-4 py-2 hover:bg-gray-50 disabled:opacity-50"
          >
            취소
          </button>
        </div>
      </form>
    </div>
  );
}
