// @MX:NOTE Unit tests for StreamOrderValidator — REQ-CHAT-006.
// @vitest-environment node

import { describe, expect, it } from 'vitest';
import { StreamOrderValidator, encodeSSE } from '../../lib/ai/streaming';

describe('StreamOrderValidator', () => {
  it('accepts meta as first event', () => {
    const v = new StreamOrderValidator();
    expect(() => v.validate({ type: 'meta', conversationId: 'c', messageId: 'm' })).not.toThrow();
  });

  it('accepts trace after meta', () => {
    const v = new StreamOrderValidator();
    v.validate({ type: 'meta', conversationId: 'c', messageId: 'm' });
    expect(() => v.validate({ type: 'trace', step: 's', status: 'active' })).not.toThrow();
  });

  it('accepts prose_delta after trace', () => {
    const v = new StreamOrderValidator();
    v.validate({ type: 'meta', conversationId: 'c', messageId: 'm' });
    v.validate({ type: 'trace', step: 's', status: 'done' });
    expect(() => v.validate({ type: 'prose_delta', delta: 'hello' })).not.toThrow();
  });

  it('throws when confidence emitted before any prose_delta', () => {
    const v = new StreamOrderValidator();
    v.validate({ type: 'meta', conversationId: 'c', messageId: 'm' });
    v.validate({ type: 'trace', step: 's', status: 'done' });
    // Emit confidence before any prose_delta — must throw
    expect(() => v.validate({ type: 'confidence', level: 'high', score: 0.9 })).toThrow();
  });

  it('throws when sources emitted before any prose_delta', () => {
    const v = new StreamOrderValidator();
    v.validate({ type: 'meta', conversationId: 'c', messageId: 'm' });
    v.validate({ type: 'trace', step: 's', status: 'done' });
    expect(() => v.validate({ type: 'sources', items: [] })).toThrow();
  });

  it('accepts confidence after prose_delta', () => {
    const v = new StreamOrderValidator();
    v.validate({ type: 'meta', conversationId: 'c', messageId: 'm' });
    v.validate({ type: 'trace', step: 's', status: 'done' });
    v.validate({ type: 'prose_delta', delta: 'hello' });
    v.validate({ type: 'prose_delta', delta: ' world' });
    expect(() => v.validate({ type: 'confidence', level: 'high', score: 0.9 })).not.toThrow();
  });

  it('accepts sources after confidence', () => {
    const v = new StreamOrderValidator();
    v.validate({ type: 'meta', conversationId: 'c', messageId: 'm' });
    v.validate({ type: 'trace', step: 's', status: 'done' });
    v.validate({ type: 'prose_delta', delta: 'hello' });
    v.validate({ type: 'confidence', level: 'high', score: 0.9 });
    expect(() => v.validate({ type: 'sources', items: [] })).not.toThrow();
  });

  it('throws when structured event is emitted before any prose_delta', () => {
    const v = new StreamOrderValidator();
    v.validate({ type: 'meta', conversationId: 'c', messageId: 'm' });
    expect(() => v.validate({ type: 'checklist', items: [] })).toThrow();
  });

  it('throws when Phase C events move backward', () => {
    const v = new StreamOrderValidator();
    v.validate({ type: 'meta', conversationId: 'c', messageId: 'm' });
    v.validate({ type: 'prose_delta', delta: 'hello' });
    v.validate({ type: 'sources', items: [] });
    expect(() => v.validate({ type: 'confidence', level: 'high', score: 0.9 })).toThrow();
  });

  it('accepts done as final event', () => {
    const v = new StreamOrderValidator();
    v.validate({ type: 'meta', conversationId: 'c', messageId: 'm' });
    v.validate({ type: 'prose_delta', delta: 'hello' });
    v.validate({ type: 'confidence', level: 'high', score: 0.9 });
    v.validate({ type: 'sources', items: [] });
    expect(() => v.validate({ type: 'done', duration_ms: 100 })).not.toThrow();
  });

  it('throws after a terminal done event', () => {
    const v = new StreamOrderValidator();
    v.validate({ type: 'meta', conversationId: 'c', messageId: 'm' });
    v.validate({ type: 'prose_delta', delta: 'hello' });
    v.validate({ type: 'done', duration_ms: 100 });
    expect(() => v.validate({ type: 'done', duration_ms: 101 })).toThrow();
  });

  it('accepts error event at any phase', () => {
    const v = new StreamOrderValidator();
    expect(() => v.validate({ type: 'error', code: 'e', message: 'm' })).not.toThrow();
  });
});

describe('encodeSSE', () => {
  it('produces correct SSE format', () => {
    const ev = { type: 'meta', conversationId: 'c', messageId: 'm' } as const;
    const encoded = encodeSSE(ev);
    expect(encoded).toMatch(/^data: /);
    expect(encoded).toMatch(/\n\n$/);
    const payload = JSON.parse(encoded.slice(6, -2));
    expect(payload.type).toBe('meta');
  });

  it('encodes complex event with nested objects', () => {
    const ev = {
      type: 'sources' as const,
      items: [
        {
          id: 's1',
          citeIndex: 1,
          orgLabel: 'FDA',
          title: 't',
          year: 2024,
          type: 'Regulation' as const,
          url: null,
          anchor: 'a',
          offset: 0,
        },
      ],
    };
    const encoded = encodeSSE(ev);
    const payload = JSON.parse(encoded.slice(6, -2));
    expect(payload.items[0].citeIndex).toBe(1);
  });
});
