'use client';

// @MX:NOTE: Client-side interactive shell extracted from ChatPage (REQ-CHAT-058).
// @MX:SPEC: SPEC-REGULA-CHAT-001 (REQ-CHAT-031..039, REQ-CHAT-051..052, REQ-CHAT-058)

import { useUIStore } from '@/stores/ui';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { useStreamingAnswer } from '../../hooks/useStreamingAnswer';
import { fireImplicitRegenerateFeedback } from '../../lib/rlhf/regenerate';
import { AnswerBlock } from './AnswerBlock';
import { Callout } from './Callout';
import { Composer } from './Composer';
import { SuggestionPill } from './SuggestionPill';
import { Thinking } from './Thinking';

type SourceFilter = 'all' | 'regs' | 'internal';

const suggestedQuestions = [
  '510(k) predicate device 검색 방법',
  'EU MDR 분류 기준 확인',
  'SOP: 변경 관리 프로세스',
  '임상평가 보고서 필수 항목',
];

export function ChatShell() {
  const [inputValue, setInputValue] = useState('');
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>('all');
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [lastSubmittedQuestion, setLastSubmittedQuestion] = useState('');
  const currentProjectId = useUIStore((s) => s.currentProjectId);

  // Reset draft when user switches project context.
  // biome-ignore lint/correctness/useExhaustiveDependencies: currentProjectId is an intentional trigger, setInputValue is a stable useState setter
  useEffect(() => {
    setInputValue('');
  }, [currentProjectId]);

  const {
    status,
    traceSteps,
    prose,
    meta,
    structured,
    error,
    duration_ms: durationMs,
    ticketId,
    ragRoute,
    start,
    abort,
  } = useStreamingAnswer();

  const isStreaming = status === 'streaming';
  const isIdle = status === 'idle';

  const handleSubmit = useCallback(() => {
    if (!inputValue.trim() || isStreaming) return;
    const questionToSubmit = inputValue.trim();
    setLastSubmittedQuestion(questionToSubmit);
    setHasSubmitted(true);
    start({
      question: questionToSubmit,
      sourceFilter,
      locale: 'ko',
      conversationId: meta?.conversationId,
    });
    setInputValue('');
  }, [inputValue, isStreaming, sourceFilter, meta, start]);

  // #264 sub-PR 3/3 — alternate answers. "Regenerate answer" fires an implicit
  // downvote (best-effort telemetry, fire-and-forget) then re-asks the SAME
  // original question via the existing streaming send path. No new SSE/answer
  // pipeline is constructed here; we reuse start() so the new answer lands in
  // the same prose/structured state and AnswerBlock re-renders normally.
  // Charter [지양-2]: the implicit signal never alters what the user sees —
  // no badge manipulation, no "marked bad" UI.
  const handleRegenerate = useCallback(() => {
    const questionToResubmit = lastSubmittedQuestion;
    const answerMessageId = meta?.messageId;
    if (!questionToResubmit || isStreaming) return;
    if (answerMessageId) {
      // Fire-and-forget — never blocks the re-ask. Errors (403/404/network)
      // only surface in dev console. The new RAG run proceeds regardless.
      void fireImplicitRegenerateFeedback(answerMessageId);
    }
    start({
      question: questionToResubmit,
      sourceFilter,
      locale: 'ko',
      conversationId: meta?.conversationId,
    });
  }, [lastSubmittedQuestion, isStreaming, meta, sourceFilter, start]);

  const showEmptyState = !hasSubmitted && isIdle;
  const showAnswer = hasSubmitted && prose.length > 0;
  const showThinking = traceSteps.length > 0 && (isStreaming || (!showAnswer && hasSubmitted));
  const isConnectionError = error === 'connection_failed';

  return (
    <>
      {/* Streaming indicator — visible while response is being generated */}
      {isStreaming && (
        <div
          data-testid="streaming-indicator"
          className="mb-2 flex items-center gap-1.5 text-xs text-ink-400"
          aria-live="polite"
          aria-label="Generating response"
        >
          <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-brand-500" />
          <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-brand-500 [animation-delay:0.2s]" />
          <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-brand-500 [animation-delay:0.4s]" />
        </div>
      )}

      {/* Thinking trace */}
      {showThinking && (
        <div className="mb-4">
          <Thinking traceSteps={traceSteps} />
        </div>
      )}

      {/* Error state */}
      {error &&
        (isConnectionError ? (
          <Callout variant="warn" title="연결 실패">
            <div className="flex items-center justify-between">
              <p className="text-sm">
                서비스와 연결할 수 없습니다. 네트워크 연결을 확인하거나 잠시 후 다시 시도해 주세요.
              </p>
              <button
                type="button"
                onClick={() => {
                  setHasSubmitted(false);
                  setInputValue(lastSubmittedQuestion);
                  setLastSubmittedQuestion('');
                }}
                className="ml-4 flex items-center gap-1.5 rounded-md bg-warn-100 px-3 py-1.5 text-xs font-medium text-warn-800 transition-colors hover:bg-warn-200"
              >
                <RefreshCw size={12} />
                재시도
              </button>
            </div>
          </Callout>
        ) : (
          <div
            className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
            role="alert"
          >
            <div className="flex items-start gap-2">
              <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
              <div className="flex-1">
                <p className="font-medium">답변 생성 중 오류가 발생했습니다</p>
                <p className="mt-1 text-xs text-red-600">
                  잠시 후 다시 시도해 주세요. 문제가 지속되면 관리자에게 문의해 주세요.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setHasSubmitted(false);
                    setInputValue(lastSubmittedQuestion);
                    setLastSubmittedQuestion('');
                  }}
                  className="mt-2 rounded-md bg-red-100 px-3 py-1.5 text-xs font-medium text-red-800 transition-colors hover:bg-red-200"
                >
                  다시 시도
                </button>
              </div>
            </div>
          </div>
        ))}

      {/* Answer block */}
      {showAnswer && (
        <div className="mb-6" data-testid="chat-message-assistant">
          <AnswerBlock
            confidence={structured.confidence}
            sources={structured.sources}
            prose={prose}
            durationMs={durationMs}
            expertReviewRequired={structured.expertReviewRequired}
            expertReviewReason={structured.expertReviewReason}
            conversationId={meta?.conversationId}
            messageId={meta?.messageId}
            ragRoute={ragRoute}
            onRegenerate={handleRegenerate}
          />
        </div>
      )}

      {/* T-024 (Option B): viewer question → inbox ticket surfacing (REQ-V3-UI-033) */}
      {showAnswer && ticketId && (
        <div
          className="mb-4 rounded-lg border border-brand-200 bg-brand-50 px-4 py-2 text-sm"
          data-testid="chat-ticket-status"
        >
          <span className="text-ink-600">내 질문이 RA 인박스에 등록되었습니다.</span>{' '}
          <a
            href={`/inbox/${ticketId}`}
            data-testid="chat-ticket-link"
            className="font-medium text-brand-700 underline"
          >
            triage 상태 보기 →
          </a>
        </div>
      )}

      {/* Spacer to push composer to bottom */}
      {!showEmptyState && <div className="flex-1" />}

      {showEmptyState && (
        <section className="mx-auto mb-4 grid w-full max-w-2xl gap-3" aria-label="추천 질문">
          {/* Source scope copy */}
          <div className="rounded-lg border border-ink-150 bg-ink-50 px-4 py-3 text-left">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">
                검색 범위
              </p>
              <p className="text-sm text-ink-700">
                MD-process · ra-project · FDA · EU MDR · 내부 SOP
              </p>
            </div>
          </div>

          {/* Suggested questions */}
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-500">
              추천 질문
            </p>
            <div className="flex flex-wrap gap-2">
              {suggestedQuestions.map((question) => (
                <SuggestionPill
                  key={question}
                  text={question}
                  onClick={() => setInputValue(question)}
                />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Composer — pinned at bottom */}
      <div className={showEmptyState ? 'w-full max-w-2xl mx-auto' : 'sticky bottom-4 w-full'}>
        <Composer
          value={inputValue}
          onChange={setInputValue}
          sourceFilter={sourceFilter}
          onSourceFilterChange={setSourceFilter}
          onSubmit={handleSubmit}
          onAbort={abort}
          isStreaming={isStreaming}
        />
      </div>
    </>
  );
}
