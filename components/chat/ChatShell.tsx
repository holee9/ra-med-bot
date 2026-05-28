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

export function ChatShell() {
  const [inputValue, setInputValue] = useState('');
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>('all');
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const currentProjectId = useUIStore((s) => s.currentProjectId);

  // Reset draft when user switches project context.
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
          {error}
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
    </>
  );
}
