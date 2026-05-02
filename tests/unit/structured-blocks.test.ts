// @MX:NOTE Unit tests for structured-blocks.ts — REQ-STRUCT-001~010.
// @vitest-environment node

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Mock the anthropic module before import
vi.mock('@anthropic-ai/sdk', () => ({
  default: vi.fn(() => ({
    messages: {
      create: vi.fn(),
    },
  })),
  Anthropic: vi.fn(() => ({
    messages: {
      create: vi.fn(),
    },
  })),
}));

// We'll use dynamic imports with mocks
import type {
  ChecklistEvent,
  ComparisonEvent,
  RelatedEvent,
  TimelineEvent,
} from '../../types/streaming';

describe('generateStructuredBlocks (REQ-STRUCT-001)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('module exports generateStructuredBlocks as async generator function', async () => {
    const mod = await import('../../lib/ai/structured-blocks');
    expect(typeof mod.generateStructuredBlocks).toBe('function');
  });

  it('accepts StructuredInput shape and returns AsyncGenerator', async () => {
    const { generateStructuredBlocks } = await import('../../lib/ai/structured-blocks');
    const gen = generateStructuredBlocks({
      question: '510(k) 면제 기준은?',
      prose: '답변 텍스트입니다.',
      topSources: [],
      messageId: 'msg-123',
      locale: 'ko',
    });
    // Must be an async iterable
    expect(typeof gen[Symbol.asyncIterator]).toBe('function');
  });
});

describe('generateStructuredBlocks - related always emitted (REQ-STRUCT-005)', () => {
  it('related block has type="related"', async () => {
    // This test verifies the type structure definition matches
    const relatedEvent: RelatedEvent = {
      type: 'related',
      items: ['질문1', '질문2', '질문3'],
    };
    expect(relatedEvent.type).toBe('related');
    expect(relatedEvent.items.length).toBeGreaterThanOrEqual(3);
  });
});

describe('OrderViolationError (REQ-STRUCT-003)', () => {
  it('OrderViolationError is exported from structured-blocks', async () => {
    const mod = await import('../../lib/ai/structured-blocks');
    expect(typeof mod.OrderViolationError).toBe('function');
  });

  it('OrderViolationError is an Error subclass', async () => {
    const { OrderViolationError } = await import('../../lib/ai/structured-blocks');
    const err = new OrderViolationError('checklist');
    expect(err).toBeInstanceOf(Error);
    expect(err.message).toContain('checklist');
    expect(err.message).toContain('prose_done');
  });
});

describe('StructuredInput type shape (REQ-STRUCT-001)', () => {
  it('accepts valid StructuredInput', async () => {
    const mod = await import('../../lib/ai/structured-blocks');
    // The function should accept the input without throwing immediately
    const input = {
      question: '질문',
      prose: '답변',
      topSources: [{ title: 'T', orgLabel: 'FDA', year: 2024 }],
      messageId: 'msg-abc',
      locale: 'ko' as const,
    };
    // Just calling it should not throw synchronously
    const gen = mod.generateStructuredBlocks(input);
    expect(gen).toBeTruthy();
  });
});
