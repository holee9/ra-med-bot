// @MX:ANCHOR SSE streaming event type union — single source of truth for all 12 event types.
// @MX:REASON Every component, hook, and route handler references this union.
// fan_in is well above 3 (useStreamingAnswer, consult.ts, route.ts, applyEvent).
// @MX:SPEC SPEC-REGULA-CHAT-001 (REQ-CHAT-001..011, Group A)
//
// Phase 2 emitted types: meta, trace, prose_delta, confidence, sources,
//   expert_review_required, done, error (8 types)
// Phase 3 reserved (defined here, not emitted in Phase 2):
//   checklist, comparison, timeline, related (4 types)
//
// INVARIANT: Do NOT remove types from this union in Phase 3+.
// Add new types; never break downstream switch-case exhaustiveness.

export interface MetaEvent {
  type: 'meta';
  conversationId: string;
  messageId: string;
}

export interface TraceEvent {
  type: 'trace';
  step: string;
  status: 'active' | 'done';
}

export interface ProseDeltaEvent {
  type: 'prose_delta';
  delta: string;
}

// SPEC-REGULA-CONFIDENCE-EXPLAIN-001 (REQ-CONFIDENCE-001..004)
export interface ConfidenceBreakdown {
  citationCoverage: number; // 0-1: cited sentences / total sentences
  sourceAgreement: number; // 0-1: top-N source agreement score
  sourceRecency: number; // 0-1: normalized source recency
  retrievalScore: number; // 0-1: top-1 vector similarity
}

export interface ConfidenceEvent {
  type: 'confidence';
  level: 'high' | 'med' | 'low';
  score: number;
  breakdown?: ConfidenceBreakdown;
}

// Represents a cited source item in the sources event.
export interface SourceItem {
  id: string;
  citeIndex: number;
  orgLabel: string;
  title: string;
  year: number | null;
  type: 'Regulation' | 'Guidance' | 'Standard' | 'Industry' | 'Internal';
  url: string | null;
  anchor: string;
  offset: number;
  // REQ-CORPUSLIC-007/011 — per-source usage-restriction notice attached by
  // generateUsageNotice() at the answer/export path. Optional: present when a
  // source_license row exists for the source.
  usageNotice?: string;
  // REQ-INTEGRATION-001 — provenance for reproducible citations:
  // host > repo > ref/commit > path > anchor. Optional: present when the
  // source row carries provenance fields (migration 0059).
  sourceHost?: string | null;
  sourceOwner?: string | null;
  sourceRepo?: string | null;
  sourceRef?: string | null;
  sourcePath?: string | null;
}

export interface SourcesEvent {
  type: 'sources';
  items: SourceItem[];
}

// Phase 3 — structured block item types.
export interface ChecklistItem {
  id: string;
  title: string;
  completed: boolean;
  ref?: string;
  refSourceIndex?: number;
}

export interface ChecklistEvent {
  type: 'checklist';
  items: ChecklistItem[];
}

export interface ComparisonEvent {
  type: 'comparison';
  title: string;
  cols: string[];
  rows: string[][];
}

export interface TimelineItem {
  date: string;
  title: string;
  description: string;
  current?: boolean;
}

export interface TimelineEvent {
  type: 'timeline';
  items: TimelineItem[];
}

export interface RelatedEvent {
  type: 'related';
  items: string[];
}

export interface ExpertReviewRequiredEvent {
  type: 'expert_review_required';
  reason: string;
}

export interface DoneEvent {
  type: 'done';
  duration_ms: number;
}

export interface ErrorEvent {
  type: 'error';
  code: string;
  message: string;
}

// Issue #200 — RAG routing source event (emitted by hybrid-router; undefined when local-only).
export interface RagRouteEvent {
  type: 'rag_route';
  path: 'local' | 'hybrid' | 'regula';
  fallback?: boolean;
  fallback_reason?: 'timeout' | 'unavailable' | 'degraded';
}

// StreamEvent union — 13 types total (8 Phase 2 + 4 Phase 3 reserve + 1 Issue #200).
export type StreamEvent =
  | MetaEvent
  | TraceEvent
  | ProseDeltaEvent
  | ConfidenceEvent
  | SourcesEvent
  | ChecklistEvent
  | ComparisonEvent
  | TimelineEvent
  | RelatedEvent
  | ExpertReviewRequiredEvent
  | DoneEvent
  | ErrorEvent
  | RagRouteEvent;

// Known event type values for runtime guard.
const KNOWN_TYPES = new Set<string>([
  'meta',
  'trace',
  'prose_delta',
  'confidence',
  'sources',
  'checklist',
  'comparison',
  'timeline',
  'related',
  'expert_review_required',
  'done',
  'error',
  'rag_route',
]);

/**
 * Runtime type guard — verifies that an unknown value is a StreamEvent.
 * Used by parseSSEBuffer to safely cast parsed JSON.
 */
export function isStreamEvent(value: unknown): value is StreamEvent {
  if (value === null || typeof value !== 'object') return false;
  const obj = value as Record<string, unknown>;
  return typeof obj.type === 'string' && KNOWN_TYPES.has(obj.type);
}
