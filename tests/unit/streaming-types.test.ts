// @MX:NOTE Unit tests for SSE streaming types — REQ-CHAT-001 Group A type safety.
// @vitest-environment node

import { describe, expect, it } from 'vitest';
import type {
  ChecklistEvent,
  ComparisonEvent,
  ConfidenceEvent,
  DoneEvent,
  ErrorEvent,
  ExpertReviewRequiredEvent,
  MetaEvent,
  ProseDeltaEvent,
  RelatedEvent,
  SourcesEvent,
  StreamEvent,
  TimelineEvent,
  TraceEvent,
} from '../../types/streaming';
import { isStreamEvent } from '../../types/streaming';

describe('StreamEvent types', () => {
  it('MetaEvent has required fields', () => {
    const ev: MetaEvent = { type: 'meta', conversationId: 'c1', messageId: 'm1' };
    expect(ev.type).toBe('meta');
    expect(ev.conversationId).toBe('c1');
    expect(ev.messageId).toBe('m1');
  });

  it('TraceEvent has step and status fields', () => {
    const ev: TraceEvent = { type: 'trace', step: '검색 중', status: 'active' };
    expect(ev.type).toBe('trace');
    expect(ev.status).toBe('active');
  });

  it('ProseDeltaEvent has delta field', () => {
    const ev: ProseDeltaEvent = { type: 'prose_delta', delta: 'hello' };
    expect(ev.delta).toBe('hello');
  });

  it('ConfidenceEvent has level and score', () => {
    const ev: ConfidenceEvent = { type: 'confidence', level: 'high', score: 0.9 };
    expect(ev.level).toBe('high');
    expect(ev.score).toBe(0.9);
  });

  it('SourcesEvent has items array', () => {
    const ev: SourcesEvent = {
      type: 'sources',
      items: [
        {
          id: 's1',
          citeIndex: 1,
          orgLabel: 'FDA',
          title: 'Title',
          year: 2024,
          type: 'Regulation',
          url: null,
          anchor: 'sec-1',
          offset: 0,
        },
      ],
    };
    expect(ev.items).toHaveLength(1);
  });

  it('ExpertReviewRequiredEvent has reason field', () => {
    const ev: ExpertReviewRequiredEvent = {
      type: 'expert_review_required',
      reason: 'confidence < 0.7',
    };
    expect(ev.reason).toBeDefined();
  });

  it('DoneEvent has duration_ms', () => {
    const ev: DoneEvent = { type: 'done', duration_ms: 1234 };
    expect(ev.duration_ms).toBe(1234);
  });

  it('ErrorEvent has code and message', () => {
    const ev: ErrorEvent = { type: 'error', code: 'llm_failure', message: 'Internal error' };
    expect(ev.code).toBe('llm_failure');
  });

  it('Phase 3 reserve types are defined', () => {
    const checklist: ChecklistEvent = { type: 'checklist', items: [] };
    const comparison: ComparisonEvent = { type: 'comparison', title: '', cols: [], rows: [] };
    const timeline: TimelineEvent = { type: 'timeline', items: [] };
    const related: RelatedEvent = { type: 'related', items: [] };
    expect(checklist.type).toBe('checklist');
    expect(comparison.type).toBe('comparison');
    expect(timeline.type).toBe('timeline');
    expect(related.type).toBe('related');
  });

  it('StreamEvent union accepts all 12 types', () => {
    const events: StreamEvent[] = [
      { type: 'meta', conversationId: 'c', messageId: 'm' },
      { type: 'trace', step: 'step', status: 'active' },
      { type: 'prose_delta', delta: 'x' },
      { type: 'confidence', level: 'med', score: 0.6 },
      { type: 'sources', items: [] },
      { type: 'checklist', items: [] },
      { type: 'comparison', title: '', cols: [], rows: [] },
      { type: 'timeline', items: [] },
      { type: 'related', items: [] },
      { type: 'expert_review_required', reason: 'r' },
      { type: 'done', duration_ms: 100 },
      { type: 'error', code: 'e', message: 'm' },
    ];
    expect(events).toHaveLength(12);
  });

  it('isStreamEvent type guard works', () => {
    expect(isStreamEvent({ type: 'meta', conversationId: 'c', messageId: 'm' })).toBe(true);
    expect(isStreamEvent({ type: 'unknown' })).toBe(false);
    expect(isStreamEvent(null)).toBe(false);
    expect(isStreamEvent('string')).toBe(false);
  });
});
