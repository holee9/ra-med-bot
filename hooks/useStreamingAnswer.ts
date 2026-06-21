'use client';

// @MX:ANCHOR useStreamingAnswer — manages SSE connection lifecycle and state.
// @MX:REASON Core hook used by all chat UI components. Handles AbortController,
// SSE parsing, and applyEvent state reducer.
// @MX:SPEC SPEC-REGULA-CHAT-001 (REQ-CHAT-046..052)
// @MX:SPEC SPEC-REGULA-BREADTH-001 (REQ-BREADTH-047)
// @MX:NOTE REQ-BREADTH-047: projectId snapshot captured at submit time via
// useUIStore.getState() so mid-stream project switching does not affect the
// in-flight request.

import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useUIStore } from '../stores/ui';
import type { ConsultRequest } from '../types/consult';
import {
  type ConfidenceEvent,
  type MetaEvent,
  type RagRouteEvent,
  type SourceItem,
  type StreamEvent,
  type TraceEvent,
  isStreamEvent,
} from '../types/streaming';

export interface StreamingState {
  status: 'idle' | 'streaming' | 'done' | 'error';
  traceSteps: TraceEvent[];
  prose: string;
  structured: {
    meta?: MetaEvent;
    confidence?: ConfidenceEvent;
    sources?: SourceItem[];
    /** Phase 3 reserve — accepted but not rendered in Phase 2. */
    checklist?: unknown[];
    comparison?: unknown;
    timeline?: unknown[];
    related?: string[];
    expertReviewRequired?: boolean;
    expertReviewReason?: string;
    ragRoute?: RagRouteEvent;
  };
  error: string | null;
  duration_ms: number | null;
}

const INITIAL_STATE: StreamingState = {
  status: 'idle',
  traceSteps: [],
  prose: '',
  structured: {},
  error: null,
  duration_ms: null,
};

/**
 * Parse an SSE buffer into complete events and a remainder for the next chunk.
 * Exported so it can be unit-tested independently.
 */
export function parseSSEBuffer(buffer: string): { parsed: StreamEvent[]; remainder: string } {
  const parsed: StreamEvent[] = [];
  const lines = buffer.split('\n\n');
  // Last element may be incomplete — keep as remainder.
  const remainder = lines.pop() ?? '';

  for (const chunk of lines) {
    // Each chunk may have multiple lines; find "data: ..." line.
    for (const line of chunk.split('\n')) {
      if (line.startsWith('data: ')) {
        const json = line.slice(6);
        try {
          const obj = JSON.parse(json) as unknown;
          if (isStreamEvent(obj)) {
            parsed.push(obj);
          }
        } catch {
          // Malformed JSON — skip.
        }
      }
      // Ignore comment lines (": keep-alive") and other non-data lines.
    }
  }

  return { parsed, remainder };
}

/**
 * Apply a single StreamEvent to the current state (reducer pattern).
 */
function applyEvent(state: StreamingState, ev: StreamEvent): StreamingState {
  switch (ev.type) {
    case 'meta':
      return { ...state, structured: { ...state.structured, meta: ev } };

    case 'trace': {
      const existing = state.traceSteps.findIndex((t) => t.step === ev.step);
      if (existing >= 0) {
        const updated = [...state.traceSteps];
        updated[existing] = ev;
        return { ...state, traceSteps: updated };
      }
      return { ...state, traceSteps: [...state.traceSteps, ev] };
    }

    case 'prose_delta':
      return { ...state, prose: state.prose + ev.delta };

    case 'confidence':
      return { ...state, structured: { ...state.structured, confidence: ev } };

    case 'sources':
      return { ...state, structured: { ...state.structured, sources: ev.items } };

    case 'expert_review_required':
      return {
        ...state,
        structured: {
          ...state.structured,
          expertReviewRequired: true,
          expertReviewReason: ev.reason,
        },
      };

    case 'done':
      return { ...state, status: 'done', duration_ms: ev.duration_ms };

    case 'error':
      return { ...state, status: 'error', error: ev.message };

    // Phase 3 reserve — store but do not render.
    case 'checklist':
      return { ...state, structured: { ...state.structured, checklist: ev.items } };

    case 'comparison':
      return { ...state, structured: { ...state.structured, comparison: ev } };

    case 'timeline':
      return { ...state, structured: { ...state.structured, timeline: ev.items } };

    case 'related':
      return { ...state, structured: { ...state.structured, related: ev.items } };

    // Issue #200 — RAG routing path badge.
    case 'rag_route':
      return { ...state, structured: { ...state.structured, ragRoute: ev } };

    default:
      return state;
  }
}

export interface UseStreamingAnswerReturn {
  status: StreamingState['status'];
  traceSteps: StreamingState['traceSteps'];
  prose: StreamingState['prose'];
  structured: StreamingState['structured'];
  meta: MetaEvent | undefined;
  error: StreamingState['error'];
  duration_ms: StreamingState['duration_ms'];
  ragRoute: RagRouteEvent | undefined;
  start: (input: ConsultRequest) => void;
  abort: () => void;
}

export function useStreamingAnswer(): UseStreamingAnswerReturn {
  const [state, setState] = useState<StreamingState>(INITIAL_STATE);
  const abortRef = useRef<AbortController | null>(null);
  const queryClient = useQueryClient();

  // REQ-CHAT-049 — abort on unmount.
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  const abort = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
  }, []);

  const start = useCallback(
    (input: ConsultRequest) => {
      // REQ-BREADTH-047: snapshot projectId at submit time so that switching
      // projects mid-stream does not affect this in-flight request.
      const projectId = useUIStore.getState().currentProjectId;

      // Abort any in-flight request.
      abortRef.current?.abort();
      const ac = new AbortController();
      abortRef.current = ac;

      // Reset state.
      setState({
        ...INITIAL_STATE,
        status: 'streaming',
      });

      void (async () => {
        try {
          // REQ-CHAT-052 — check response.ok.
          const response = await fetch('/api/ra/consult', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              ...input,
              projectId: input.projectId ?? projectId ?? undefined,
            }),
            signal: ac.signal,
          });

          if (!response.ok || !response.body) {
            setState((s) => ({ ...s, status: 'error', error: 'connection_failed' }));
            return;
          }

          const reader = response.body.getReader();
          const decoder = new TextDecoder();
          let buffer = '';

          // REQ-CHAT-047 — read SSE stream.
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const { parsed, remainder } = parseSSEBuffer(buffer);
            buffer = remainder;

            setState((prev) => {
              let next = prev;
              for (const ev of parsed) {
                next = applyEvent(next, ev);
              }
              return next;
            });
          }

          // REQ-CHAT-051 — invalidate conversation list on done.
          setState((s) => {
            if (s.status === 'done') {
              queryClient.invalidateQueries({ queryKey: ['conversations'] });
            }
            return s;
          });
        } catch (err) {
          if ((err as Error).name === 'AbortError') return;
          setState((s) => ({ ...s, status: 'error', error: 'connection_failed' }));
        }
      })();
    },
    [queryClient],
  );

  return {
    status: state.status,
    traceSteps: state.traceSteps,
    prose: state.prose,
    structured: state.structured,
    meta: state.structured.meta,
    error: state.error,
    duration_ms: state.duration_ms,
    ragRoute: state.structured.ragRoute,
    start,
    abort,
  };
}
