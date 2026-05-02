// @MX:NOTE Unit tests for SSE buffer parser — REQ-CHAT-048.
// @vitest-environment node

import { describe, expect, it } from 'vitest';
import { parseSSEBuffer } from '../../hooks/useStreamingAnswer';

describe('parseSSEBuffer', () => {
  it('parses a complete single event', () => {
    const buffer = 'data: {"type":"meta","conversationId":"c","messageId":"m"}\n\n';
    const { parsed, remainder } = parseSSEBuffer(buffer);
    expect(parsed).toHaveLength(1);
    expect(parsed[0]?.type).toBe('meta');
    expect(remainder).toBe('');
  });

  it('parses multiple complete events', () => {
    const buffer =
      'data: {"type":"meta","conversationId":"c","messageId":"m"}\n\n' +
      'data: {"type":"trace","step":"s","status":"active"}\n\n';
    const { parsed, remainder } = parseSSEBuffer(buffer);
    expect(parsed).toHaveLength(2);
    expect(parsed[0]?.type).toBe('meta');
    expect(parsed[1]?.type).toBe('trace');
    expect(remainder).toBe('');
  });

  it('retains incomplete event in remainder', () => {
    const buffer =
      'data: {"type":"meta","conversationId":"c","messageId":"m"}\n\n' +
      'data: {"type":"prose_delta","del';
    const { parsed, remainder } = parseSSEBuffer(buffer);
    expect(parsed).toHaveLength(1);
    expect(remainder).toBe('data: {"type":"prose_delta","del');
  });

  it('returns empty parsed for empty buffer', () => {
    const { parsed, remainder } = parseSSEBuffer('');
    expect(parsed).toHaveLength(0);
    expect(remainder).toBe('');
  });

  it('handles buffer with only incomplete event', () => {
    const buffer = 'data: {"type":"trace","step":"s"';
    const { parsed, remainder } = parseSSEBuffer(buffer);
    expect(parsed).toHaveLength(0);
    expect(remainder).toBe(buffer);
  });

  it('skips non-data lines (comments)', () => {
    const buffer =
      ': keep-alive\n\n' + 'data: {"type":"meta","conversationId":"c","messageId":"m"}\n\n';
    const { parsed } = parseSSEBuffer(buffer);
    expect(parsed.filter((e) => e.type === 'meta')).toHaveLength(1);
  });

  it('handles prose_delta with special characters', () => {
    const buffer = 'data: {"type":"prose_delta","delta":"<sup class=\\"cite\\">"}\n\n';
    const { parsed } = parseSSEBuffer(buffer);
    expect(parsed).toHaveLength(1);
    expect(parsed[0]?.type).toBe('prose_delta');
  });
});
