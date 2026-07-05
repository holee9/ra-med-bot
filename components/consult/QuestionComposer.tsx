// @MX:NOTE [AUTO] QuestionComposer — question input with submit handling.
// @MX:SPEC SPEC-V3-UI-001 (REQ-V3-UI-055/056/057/058/059, AC-CONS-UI-004)

import { useCreateTurn } from '@/lib/queries/useConsult';
import type { ConsultTurn } from '@/lib/queries/useConsult';
import { useState } from 'react';

interface QuestionComposerProps {
  sessionId: string;
}

export function QuestionComposer({ sessionId }: QuestionComposerProps) {
  const [question, setQuestion] = useState('');
  const createTurnMutation = useCreateTurn(sessionId);
  const error = createTurnMutation.error as {
    status?: number;
    message?: string;
    turn?: ConsultTurn;
  } | null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // REQ-V3-UI-055: 1-5000자 validation
    if (question.length < 1 || question.length > 5000) {
      return;
    }

    createTurnMutation.mutate(
      { question },
      {
        onSuccess: () => {
          setQuestion(''); // Clear input on success
        },
      },
    );
  };

  const isPending = createTurnMutation.isPending;
  const hasError = error?.status === 400;

  return (
    <form data-testid="question-composer" onSubmit={handleSubmit} className="space-y-3">
      <div>
        <label htmlFor={`question-input-${sessionId}`} className="block text-sm font-medium">
          질문 입력 (1-5000자)
        </label>
        <textarea
          id={`question-input-${sessionId}`}
          data-testid="question-input"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          disabled={isPending}
          rows={4}
          required
          className="w-full rounded border px-3 py-2 disabled:opacity-50"
          placeholder="질문을 입력하세요..."
        />
        <div className="mt-1 text-xs text-gray-500">{question.length}/5000</div>
      </div>

      {/* Error display (REQ-V3-UI-059) */}
      {hasError && (
        <div
          data-testid="turn-error-message"
          className="rounded bg-red-50 p-3 text-sm text-red-700"
        >
          답변 생성 실패: {error?.message || '알 수 없는 오류'}
        </div>
      )}

      {/* Loading indicator (REQ-V3-UI-057) */}
      {isPending && (
        <div data-testid="turn-loading" className="text-sm text-gray-600">
          답변 생성 중...
        </div>
      )}

      <button
        type="submit"
        data-testid="question-submit"
        disabled={isPending || question.length < 1 || question.length > 5000}
        className="rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-50"
      >
        {isPending ? '...' : '전송'}
      </button>

      {/* Persisted turn on error (REQ-V3-UI-059) — shown via history refresh */}
      {hasError && error?.turn && (
        <div data-testid="turn-persisted-notice" className="text-xs text-gray-600">
          턴이 저장되었습니다. 다시 질문해 주세요.
        </div>
      )}
    </form>
  );
}
