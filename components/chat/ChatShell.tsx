'use client';

// @MX:NOTE: Client-side interactive shell extracted from ChatPage (REQ-CHAT-058).
// @MX:SPEC: SPEC-REGULA-CHAT-001 (REQ-CHAT-031..039, REQ-CHAT-051..052, REQ-CHAT-058)

import { useUIStore } from '@/stores/ui';
import { useCallback, useEffect, useState } from 'react';
import { useStreamingAnswer } from '../../hooks/useStreamingAnswer';
import { AnswerBlock } from './AnswerBlock';
import { Composer } from './Composer';
import { Thinking } from './Thinking';

type SourceFilter = 'all' | 'regs' | 'internal';

const suggestedQuestions = [
  'Class II SaMD의 FDA 제출 경로를 근거와 함께 비교해줘',
  'EU MDR 임상평가 보고서에서 전문가 검토가 필요한 항목을 찾아줘',
  '내부 SOP와 공식 규정이 충돌할 때 이슈로 남길 내용을 정리해줘',
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

  const showEmptyState = !hasSubmitted && isIdle;
  const showAnswer = hasSubmitted && prose.length > 0;
  const showThinking = traceSteps.length > 0 && (isStreaming || (!showAnswer && hasSubmitted));

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
      {error && (
        <div
          className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
          role="alert"
        >
          <div className="flex items-start gap-2">
            <svg className="mt-0.5 h-4 w-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
            <div className="flex-1">
              <p className="font-medium">답변 생성 중 오류가 발생했습니다</p>
              <p className="mt-1 text-xs text-red-600">잠시 후 다시 시도해 주세요. 문제가 지속되면 관리자에게 문의해 주세요.</p>
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
      )}

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
          />
        </div>
      )}

      {/* Spacer to push composer to bottom */}
      {!showEmptyState && <div className="flex-1" />}

      {showEmptyState && (
        <section className="mx-auto mb-4 grid w-full max-w-2xl gap-2" aria-label="추천 질문">
          <div className="rounded-lg border border-ink-150 bg-ink-50 p-3 text-left">
            <p className="text-xs font-medium uppercase text-ink-500">Source scope</p>
            <p className="mt-1 text-sm text-ink-700">
              공용 규제 지식과 현재 조직에 허용된 내부 source만 답변 근거로 사용합니다.
            </p>
          </div>
          {suggestedQuestions.map((question) => (
            <button
              key={question}
              type="button"
              className="rounded-lg border border-ink-150 bg-surface px-4 py-3 text-left text-sm text-ink-700 transition-colors hover:border-brand-200 hover:bg-brand-50"
              onClick={() => setInputValue(question)}
            >
              {question}
            </button>
          ))}
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
