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

export interface ConfidenceEvent {
  type: 'confidence';
  level: 'high' | 'med' | 'low';
  score: number;
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
}

export interface SourcesEvent {
  type: 'sources';
  items: SourceItem[];
}

// Phase 3 reserve — types defined now, emitted in Phase 3.
export interface ChecklistItem {
  text: string;
  checked?: boolean;
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
  label: string;
  description?: string;
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

// StreamEvent union — 12 types total (8 Phase 2 + 4 Phase 3 reserve).
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
  | ErrorEvent;

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
