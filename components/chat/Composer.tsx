'use client';

// @MX:NOTE Composer — textarea with autosize, source filter chips, submit button.
// Handles abort mid-stream and keyboard submit (Shift+Enter = newline, Enter = submit).
// REQ-BREADTH-003: reads pendingQuestion from UIStore on mount and clears it.
// @MX:SPEC SPEC-REGULA-CHAT-001 (REQ-CHAT-031..036)
// @MX:SPEC SPEC-REGULA-BREADTH-001 (REQ-BREADTH-003)

import { useUIStore } from '@/stores/ui';
import { Send, Square } from 'lucide-react';
import { useCallback, useEffect, useRef } from 'react';
import type { ChangeEvent, KeyboardEvent } from 'react';

type SourceFilter = 'all' | 'regs' | 'internal';

const SOURCE_FILTER_LABELS: Record<SourceFilter, string> = {
  all: '전체',
  regs: '규정',
  internal: '내부',
};

interface ComposerProps {
  value: string;
  onChange: (value: string) => void;
  sourceFilter: SourceFilter;
  onSourceFilterChange: (filter: SourceFilter) => void;
  onSubmit: () => void;
  onAbort?: () => void;
  isStreaming: boolean;
  disabled?: boolean;
  placeholder?: string;
}

export function Composer({
  value,
  onChange,
  sourceFilter,
  onSourceFilterChange,
  onSubmit,
  onAbort,
  isStreaming,
  disabled = false,
  placeholder = '규제 관련 질문을 입력하세요...',
}: ComposerProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // REQ-BREADTH-003: on mount, read and consume pendingQuestion from UIStore.
  // One-time effect (dep: []) — must not re-trigger on re-renders.
  // biome-ignore lint/correctness/useExhaustiveDependencies: one-time pending question consumption on mount
  useEffect(() => {
    const pending = useUIStore.getState().pendingQuestion;
    if (pending) {
      onChange(pending);
      useUIStore.getState().setPendingQuestion(null);
    }
  }, []);

  // Autosize textarea: reset height then set to scrollHeight.
  const resizeTextarea = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }, []);

  // biome-ignore lint/correctness/useExhaustiveDependencies: value triggers resize but is not used in body
  useEffect(() => {
    resizeTextarea();
  }, [value, resizeTextarea]);

  const handleChange = useCallback(
    (e: ChangeEvent<HTMLTextAreaElement>) => {
      onChange(e.target.value);
    },
    [onChange],
  );

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      // Shift+Enter inserts newline; plain Enter submits.
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        if (!isStreaming && value.trim().length > 0 && !disabled) {
          onSubmit();
        }
      }
    },
    [isStreaming, value, disabled, onSubmit],
  );

  const handleSubmitOrAbort = useCallback(() => {
    if (isStreaming) {
      onAbort?.();
    } else if (value.trim().length > 0 && !disabled) {
      onSubmit();
    }
  }, [isStreaming, value, disabled, onSubmit, onAbort]);

  const canSubmit = !disabled && (isStreaming || value.trim().length > 0);

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-border-strong bg-white p-3 shadow-sm focus-within:border-brand-400 focus-within:ring-1 focus-within:ring-brand-300 transition-all">
      {/* Source filter chips */}
      <fieldset className="flex gap-1.5 border-0 p-0 m-0">
        <legend className="sr-only">Source filter</legend>
        {(Object.keys(SOURCE_FILTER_LABELS) as SourceFilter[]).map((filter) => (
          <button
            key={filter}
            type="button"
            className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium transition-colors ${
              sourceFilter === filter
                ? 'bg-brand-600 text-white'
                : 'bg-surface-soft text-ink-500 hover:bg-brand-50 hover:text-brand-700'
            }`}
            aria-pressed={sourceFilter === filter}
            onClick={() => onSourceFilterChange(filter)}
            disabled={isStreaming || disabled}
          >
            {SOURCE_FILTER_LABELS[filter]}
          </button>
        ))}
      </fieldset>

      {/* Input row */}
      <div className="flex items-end gap-2">
        <textarea
          ref={textareaRef}
          className="flex-1 resize-none bg-transparent text-sm leading-relaxed text-ink-800 placeholder:text-ink-400 focus:outline-none"
          rows={1}
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled || isStreaming}
          aria-label="질문 입력"
          maxLength={4000}
        />

        {/* Submit / Abort button */}
        <button
          type="button"
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors ${
            canSubmit
              ? isStreaming
                ? 'bg-red-500 text-white hover:bg-red-600'
                : 'bg-brand-600 text-white hover:bg-brand-700'
              : 'cursor-not-allowed bg-surface-soft text-ink-300'
          }`}
          aria-label={isStreaming ? 'Stop generation' : 'Send message'}
          disabled={!canSubmit}
          onClick={handleSubmitOrAbort}
        >
          {isStreaming ? <Square size={14} /> : <Send size={14} />}
        </button>
      </div>

      {/* Character counter — shows when approaching limit */}
      {value.length > 3600 && (
        <p className="text-right font-mono text-[10px] text-ink-400">{value.length} / 4000</p>
      )}
    </div>
  );
}
