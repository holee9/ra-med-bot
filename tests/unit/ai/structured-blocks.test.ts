// @MX:NOTE [AUTO] Unit tests for structured-blocks generator (SPEC-REGULA-STRUCTURED-001, REQ-STRUCT-001~010).
// @MX:SPEC SPEC-REGULA-STRUCTURED-001 (REQ-STRUCT-001..010, Issue #402)
// @MX:REASON REQ-STRUCT-001..010 gate: generateStructuredBlocks async generator
//   yields checklist/comparison/timeline/related events in fixed order.
//   Classifiers decide emit/skip; generators produce JSON parsed via Zod.
//   ai.generateText + getLlmFastModel mocked — no real LLM calls.

import type { BlockEvent } from '@/lib/ai/structured-blocks';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mock ai.generateText — each test sets the return sequence.
// ---------------------------------------------------------------------------
const generateTextMock = vi.fn();

vi.mock('ai', () => ({
  generateText: (...args: unknown[]) => generateTextMock(...args),
}));

vi.mock('@/lib/ai/llm-provider', () => ({
  getLlmFastModel: () => ({ id: 'mock-model' }),
}));

vi.mock('@/lib/observability/logger', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

beforeEach(() => {
  vi.resetModules();
  generateTextMock.mockReset();
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const baseInput = {
  question: 'MDR 문서화 요구사항은?',
  prose: 'MDR Annex II 문서화 요구사항은 기술문서에 포함되어야 합니다.',
  topSources: [
    { title: 'MDR Annex II', orgLabel: 'EU', year: 2017 },
    { title: 'FDA Guidance', orgLabel: 'FDA', year: 2023 },
  ],
  messageId: 'msg-1',
  locale: 'ko' as const,
};

/** Configure generateTextMock to return the given text values in sequence. */
function setResponses(texts: string[]) {
  for (const t of texts) {
    generateTextMock.mockResolvedValueOnce({ text: t });
  }
}

async function collectEvents(gen: AsyncGenerator<BlockEvent>): Promise<BlockEvent[]> {
  const events: BlockEvent[] = [];
  for await (const ev of gen) events.push(ev);
  return events;
}

function findByType(events: BlockEvent[], type: string): BlockEvent | undefined {
  return events.find((e) => e.type === type);
}

// ---------------------------------------------------------------------------
// OrderViolationError (REQ-STRUCT-003)
// ---------------------------------------------------------------------------
describe('OrderViolationError (REQ-STRUCT-003)', () => {
  it('is constructible with event type in message', async () => {
    const { OrderViolationError } = await import('@/lib/ai/structured-blocks');
    const err = new OrderViolationError('checklist');
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe('OrderViolationError');
    expect(err.message).toBe('structured event emitted before prose_done: checklist');
  });
});

// ---------------------------------------------------------------------------
// generateStructuredBlocks — checklist branch
// ---------------------------------------------------------------------------
describe('generateStructuredBlocks — checklist (REQ-STRUCT-001)', () => {
  it('yields checklist event when classifier says yes and generator returns valid JSON', async () => {
    const checklistJson = JSON.stringify({
      type: 'checklist',
      items: [{ id: 'c1', title: '기술문서 준비', completed: false }],
    });
    setResponses(['yes', checklistJson]);
    const { generateStructuredBlocks } = await import('@/lib/ai/structured-blocks');
    const events = await collectEvents(generateStructuredBlocks(baseInput));
    const checklist = findByType(events, 'checklist');
    expect(checklist).toBeDefined();
    expect(checklist?.type === 'checklist' && checklist.items).toHaveLength(1);
    expect(checklist?.type === 'checklist' && checklist.items[0]?.title).toBe('기술문서 준비');
  });

  it('skips checklist when classifier says no', async () => {
    setResponses(['no', 'no', 'no', '{}', '{}']);
    const { generateStructuredBlocks } = await import('@/lib/ai/structured-blocks');
    const events = await collectEvents(generateStructuredBlocks(baseInput));
    expect(findByType(events, 'checklist')).toBeUndefined();
  });

  it('skips checklist when generator returns invalid JSON (REQ-STRUCT-006)', async () => {
    setResponses(['yes', 'not valid json', 'no', 'no', '{}', '{}']);
    const { generateStructuredBlocks } = await import('@/lib/ai/structured-blocks');
    const events = await collectEvents(generateStructuredBlocks(baseInput));
    expect(findByType(events, 'checklist')).toBeUndefined();
    const { logger } = await import('@/lib/observability/logger');
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining('[structured-blocks] JSON parse error'),
    );
  });

  it('skips checklist when generator returns valid JSON that fails Zod (REQ-STRUCT-006)', async () => {
    setResponses(['yes', JSON.stringify({ type: 'checklist' }), 'no', 'no', '{}', '{}']);
    const { generateStructuredBlocks } = await import('@/lib/ai/structured-blocks');
    const events = await collectEvents(generateStructuredBlocks(baseInput));
    expect(findByType(events, 'checklist')).toBeUndefined();
  });

  it('strips markdown code fences from generator response', async () => {
    const fenced =
      '```json\n{"type":"checklist","items":[{"id":"c1","title":"x","completed":true}]}\n```';
    setResponses(['yes', fenced, 'no', 'no', '{}', '{}']);
    const { generateStructuredBlocks } = await import('@/lib/ai/structured-blocks');
    const events = await collectEvents(generateStructuredBlocks(baseInput));
    expect(findByType(events, 'checklist')).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// generateStructuredBlocks — comparison branch
// ---------------------------------------------------------------------------
describe('generateStructuredBlocks — comparison (REQ-STRUCT-002)', () => {
  it('yields comparison event when classifier says yes and generator returns valid JSON', async () => {
    const cmpJson = JSON.stringify({
      type: 'comparison',
      title: 'EU vs FDA',
      cols: ['기준', 'EU', 'FDA'],
      rows: [['문서화', 'Annex II', '21 CFR 820']],
    });
    setResponses(['no', 'yes', cmpJson, 'no', '{}', '{}']);
    const { generateStructuredBlocks } = await import('@/lib/ai/structured-blocks');
    const events = await collectEvents(generateStructuredBlocks(baseInput));
    const cmp = findByType(events, 'comparison');
    expect(cmp).toBeDefined();
    expect(cmp?.type === 'comparison' && cmp.title).toBe('EU vs FDA');
    expect(cmp?.type === 'comparison' && cmp.cols).toHaveLength(3);
  });

  it('skips comparison when classifier says no', async () => {
    setResponses(['no', 'no', 'no', '{}', '{}']);
    const { generateStructuredBlocks } = await import('@/lib/ai/structured-blocks');
    const events = await collectEvents(generateStructuredBlocks(baseInput));
    expect(findByType(events, 'comparison')).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// generateStructuredBlocks — timeline branch
// ---------------------------------------------------------------------------
describe('generateStructuredBlocks — timeline (REQ-STRUCT-004)', () => {
  it('yields timeline event when classifier says yes and generator returns valid JSON', async () => {
    const tlJson = JSON.stringify({
      type: 'timeline',
      items: [{ date: '2027-05-26', title: 'MDR 적용', description: 'MDR 전면 적용' }],
    });
    setResponses(['no', 'no', 'yes', tlJson, '{}', '{}']);
    const { generateStructuredBlocks } = await import('@/lib/ai/structured-blocks');
    const events = await collectEvents(generateStructuredBlocks(baseInput));
    const tl = findByType(events, 'timeline');
    expect(tl).toBeDefined();
    expect(tl?.type === 'timeline' && tl.items[0]?.date).toBe('2027-05-26');
  });

  it('skips timeline when generator returns items with bad date format', async () => {
    const badDateJson = JSON.stringify({
      type: 'timeline',
      items: [{ date: 'not-a-date', title: 'x', description: 'y' }],
    });
    setResponses(['no', 'no', 'yes', badDateJson, '{}', '{}']);
    const { generateStructuredBlocks } = await import('@/lib/ai/structured-blocks');
    const events = await collectEvents(generateStructuredBlocks(baseInput));
    expect(findByType(events, 'timeline')).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// generateStructuredBlocks — related branch (always generated, REQ-STRUCT-005)
// ---------------------------------------------------------------------------
describe('generateStructuredBlocks — related (REQ-STRUCT-005, REQ-STRUCT-008)', () => {
  it('yields related event on first try when generator returns valid 3+ items', async () => {
    const relJson = JSON.stringify({
      type: 'related',
      items: ['질문1', '질문2', '질문3'],
    });
    setResponses(['no', 'no', 'no', relJson]);
    const { generateStructuredBlocks } = await import('@/lib/ai/structured-blocks');
    const events = await collectEvents(generateStructuredBlocks(baseInput));
    const rel = findByType(events, 'related');
    expect(rel).toBeDefined();
    expect(rel?.type === 'related' && rel.items).toHaveLength(3);
  });

  it('retries once when first related generation returns null (REQ-STRUCT-008)', async () => {
    setResponses([
      'no',
      'no',
      'no',
      'invalid',
      JSON.stringify({ type: 'related', items: ['q1', 'q2', 'q3'] }),
    ]);
    const { generateStructuredBlocks } = await import('@/lib/ai/structured-blocks');
    const events = await collectEvents(generateStructuredBlocks(baseInput));
    const rel = findByType(events, 'related');
    expect(rel).toBeDefined();
    expect(rel?.type === 'related' && rel.items).toHaveLength(3);
  });

  it('does not yield related when both first and retry fail', async () => {
    setResponses(['no', 'no', 'no', 'invalid', 'also-invalid']);
    const { generateStructuredBlocks } = await import('@/lib/ai/structured-blocks');
    const events = await collectEvents(generateStructuredBlocks(baseInput));
    expect(findByType(events, 'related')).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// generateStructuredBlocks — event ordering (REQ-STRUCT-001)
// ---------------------------------------------------------------------------
describe('generateStructuredBlocks — event ordering', () => {
  it('emits events in fixed order: checklist → comparison → timeline → related', async () => {
    const checklistJson = JSON.stringify({
      type: 'checklist',
      items: [{ id: 'c1', title: 'x', completed: false }],
    });
    const cmpJson = JSON.stringify({
      type: 'comparison',
      title: 'T',
      cols: ['a', 'b'],
      rows: [['1', '2']],
    });
    const tlJson = JSON.stringify({
      type: 'timeline',
      items: [{ date: '2027-01-01', title: 'x', description: 'y' }],
    });
    const relJson = JSON.stringify({ type: 'related', items: ['q1', 'q2', 'q3'] });
    setResponses(['yes', checklistJson, 'yes', cmpJson, 'yes', tlJson, relJson]);
    const { generateStructuredBlocks } = await import('@/lib/ai/structured-blocks');
    const events = await collectEvents(generateStructuredBlocks(baseInput));
    const types = events.map((e) => e.type);
    expect(types).toEqual(['checklist', 'comparison', 'timeline', 'related']);
  });
});

// ---------------------------------------------------------------------------
// generateStructuredBlocks — abort signal handling
// ---------------------------------------------------------------------------
describe('generateStructuredBlocks — abort signal', () => {
  it('yields nothing when signal is already aborted', async () => {
    const controller = new AbortController();
    controller.abort();
    const { generateStructuredBlocks } = await import('@/lib/ai/structured-blocks');
    const events = await collectEvents(generateStructuredBlocks(baseInput, controller.signal));
    expect(events).toHaveLength(0);
    expect(generateTextMock).not.toHaveBeenCalled();
  });

  it('stops emitting after signal aborts mid-stream', async () => {
    const checklistJson = JSON.stringify({
      type: 'checklist',
      items: [{ id: 'c1', title: 'x', completed: false }],
    });
    const controller = new AbortController();
    setResponses(['yes', checklistJson]);
    // comparison classifier call aborts the signal.
    generateTextMock.mockImplementationOnce(async () => {
      controller.abort();
      return { text: 'yes' };
    });
    const { generateStructuredBlocks } = await import('@/lib/ai/structured-blocks');
    const events = await collectEvents(generateStructuredBlocks(baseInput, controller.signal));
    const types = events.map((e) => e.type);
    expect(types).toContain('checklist');
    expect(types).not.toContain('comparison');
    expect(types).not.toContain('related');
  });
});

// ---------------------------------------------------------------------------
// generateStructuredBlocks — error handling (fire-and-forget per block)
// ---------------------------------------------------------------------------
describe('generateStructuredBlocks — error handling', () => {
  it('logs error and continues when checklist classifier throws', async () => {
    generateTextMock.mockRejectedValueOnce(new Error('LLM down'));
    setResponses(['no', 'no', '{}', '{}']);
    const { generateStructuredBlocks } = await import('@/lib/ai/structured-blocks');
    const events = await collectEvents(generateStructuredBlocks(baseInput));
    expect(findByType(events, 'checklist')).toBeUndefined();
    const { logger } = await import('@/lib/observability/logger');
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining('[structured-blocks] checklist error:'),
      expect.any(Error),
    );
  });

  it('logs error and continues when comparison generator throws', async () => {
    setResponses(['no']);
    generateTextMock.mockRejectedValueOnce(new Error('comparison LLM error'));
    setResponses(['no', '{}', '{}']);
    const { generateStructuredBlocks } = await import('@/lib/ai/structured-blocks');
    const events = await collectEvents(generateStructuredBlocks(baseInput));
    expect(findByType(events, 'comparison')).toBeUndefined();
    const { logger } = await import('@/lib/observability/logger');
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining('[structured-blocks] comparison error:'),
      expect.any(Error),
    );
  });
});

// ---------------------------------------------------------------------------
// generateStructuredBlocks — input handling
// ---------------------------------------------------------------------------
describe('generateStructuredBlocks — input handling', () => {
  it('truncates topSources to 3 for prompt input', async () => {
    // Checklist classifier says yes → generator is called with formatSources.
    // The generator prompt (2nd call) includes the topSources formatted as
    // "[1] orgLabel — title (year)" — only the first 3 should appear.
    const checklistJson = JSON.stringify({
      type: 'checklist',
      items: [{ id: 'c1', title: 'x', completed: false }],
    });
    setResponses(['yes', checklistJson, 'no', 'no', '{}', '{}']);
    const { generateStructuredBlocks } = await import('@/lib/ai/structured-blocks');
    await collectEvents(
      generateStructuredBlocks({
        ...baseInput,
        topSources: [
          { title: 'A', orgLabel: 'X', year: 2020 },
          { title: 'B', orgLabel: 'Y', year: 2021 },
          { title: 'C', orgLabel: 'Z', year: 2022 },
          { title: 'D', orgLabel: 'W', year: 2023 },
          { title: 'E', orgLabel: 'V', year: 2024 },
        ],
      }),
    );
    // 2nd call is the checklist generator prompt (includes formatSources).
    const generatorArgs = generateTextMock.mock.calls[1]?.[0] as
      | { messages?: Array<{ content?: string }> }
      | undefined;
    const promptText = generatorArgs?.messages?.[0]?.content ?? '';
    // First 3 sources appear as "[N] orgLabel — title (year)".
    expect(promptText).toContain('[1] X — A (2020)');
    expect(promptText).toContain('[2] Y — B (2021)');
    expect(promptText).toContain('[3] Z — C (2022)');
    // 4th and 5th sources are truncated.
    expect(promptText).not.toContain('[4]');
    expect(promptText).not.toContain('W — D');
    expect(promptText).not.toContain('V — E');
  });
});

// ---------------------------------------------------------------------------
// module exports
// ---------------------------------------------------------------------------
describe('structured-blocks module exports', () => {
  it('exports generateStructuredBlocks and OrderViolationError', async () => {
    const mod = await import('@/lib/ai/structured-blocks');
    expect(typeof mod.generateStructuredBlocks).toBe('function');
    expect(mod.OrderViolationError).toBeDefined();
  });
});
