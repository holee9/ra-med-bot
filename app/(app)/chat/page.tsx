'use client';

// @MX:NOTE Chat page — Composer + useStreamingAnswer + AnswerBlock integration.
// Empty state: hero prompt. After first submission: streaming answer display.
// @MX:SPEC SPEC-REGULA-CHAT-001 (REQ-CHAT-031..039, REQ-CHAT-051..052)

import { useCallback, useState } from 'react';
import { AnswerBlock } from '../../../components/chat/AnswerBlock';
import { Composer } from '../../../components/chat/Composer';
import { Thinking } from '../../../components/chat/Thinking';
import { useStreamingAnswer } from '../../../hooks/useStreamingAnswer';

type SourceFilter = 'all' | 'regs' | 'internal';

export default function ChatPage() {
  const [inputValue, setInputValue] = useState('');
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>('all');
  const [hasSubmitted, setHasSubmitted] = useState(false);

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
    setHasSubmitted(true);
    start({
      question: inputValue.trim(),
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
    <div className="mx-auto flex min-h-screen max-w-content flex-col px-4 pb-4 pt-6">
      {/* Empty state */}
      {showEmptyState && (
        <section className="flex flex-1 flex-col items-center justify-center text-center py-16">
          <h1 className="font-serif text-3xl text-brand-800">새로운 상담을 시작하세요</h1>
          <p className="mt-4 text-ink-600">규제 질문을 입력하면 출처와 함께 답변해 드립니다.</p>
        </section>
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
          {error}
        </div>
      )}

      {/* Answer block */}
      {showAnswer && (
        <div className="mb-6">
          <AnswerBlock
            confidence={structured.confidence}
            sources={structured.sources}
            prose={prose}
            durationMs={durationMs}
            expertReviewRequired={structured.expertReviewRequired}
          />
        </div>
      )}

      {/* Spacer to push composer to bottom */}
      {!showEmptyState && <div className="flex-1" />}

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
    </div>
  );
}
