// @MX:NOTE Unit tests for ConsultRequest Zod schema — REQ-CHAT-003.
// @vitest-environment node

import { describe, expect, it } from 'vitest';
import { ZodError } from 'zod';
import { ConsultRequestSchema } from '../../types/consult';

describe('ConsultRequestSchema', () => {
  const valid = {
    question: 'What is 510(k)?',
    sourceFilter: 'all' as const,
    locale: 'ko' as const,
  };

  it('accepts a minimal valid request', () => {
    const result = ConsultRequestSchema.parse(valid);
    expect(result.question).toBe('What is 510(k)?');
    expect(result.sourceFilter).toBe('all');
    expect(result.locale).toBe('ko');
  });

  it('defaults sourceFilter to "all" when omitted', () => {
    const result = ConsultRequestSchema.parse({ question: 'q', locale: 'ko' });
    expect(result.sourceFilter).toBe('all');
  });

  it('defaults locale to "ko" when omitted', () => {
    const result = ConsultRequestSchema.parse({ question: 'q' });
    expect(result.locale).toBe('ko');
  });

  it('rejects empty question', () => {
    expect(() => ConsultRequestSchema.parse({ ...valid, question: '' })).toThrow(ZodError);
  });

  it('rejects question longer than 4000 chars', () => {
    expect(() => ConsultRequestSchema.parse({ ...valid, question: 'x'.repeat(4001) })).toThrow(
      ZodError,
    );
  });

  it('accepts question of exactly 4000 chars', () => {
    const result = ConsultRequestSchema.parse({ ...valid, question: 'x'.repeat(4000) });
    expect(result.question).toHaveLength(4000);
  });

  it('rejects invalid locale', () => {
    expect(() => ConsultRequestSchema.parse({ ...valid, locale: 'ja' })).toThrow(ZodError);
  });

  it('rejects invalid sourceFilter', () => {
    expect(() => ConsultRequestSchema.parse({ ...valid, sourceFilter: 'invalid' })).toThrow(
      ZodError,
    );
  });

  it('accepts optional conversationId as uuid', () => {
    const result = ConsultRequestSchema.parse({
      ...valid,
      conversationId: '550e8400-e29b-41d4-a716-446655440000',
    });
    expect(result.conversationId).toBeDefined();
  });

  it('rejects non-uuid conversationId', () => {
    expect(() => ConsultRequestSchema.parse({ ...valid, conversationId: 'not-a-uuid' })).toThrow(
      ZodError,
    );
  });

  it('accepts optional projectId as uuid', () => {
    const result = ConsultRequestSchema.parse({
      ...valid,
      projectId: '550e8400-e29b-41d4-a716-446655440001',
    });
    expect(result.projectId).toBeDefined();
  });

  it('accepts "regs" and "internal" sourceFilter values', () => {
    expect(ConsultRequestSchema.parse({ ...valid, sourceFilter: 'regs' }).sourceFilter).toBe(
      'regs',
    );
    expect(ConsultRequestSchema.parse({ ...valid, sourceFilter: 'internal' }).sourceFilter).toBe(
      'internal',
    );
  });

  it('accepts "en" locale', () => {
    expect(ConsultRequestSchema.parse({ ...valid, locale: 'en' }).locale).toBe('en');
  });
});
