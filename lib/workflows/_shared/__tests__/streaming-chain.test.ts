// SPEC-REGULA-WORKFLOWS-LLM-002 M0-1 — streaming-chain unit tests (gx10 mocked).
// REQ-WFLLM-002/010 / AC-04/10: gx10 streaming + timeout/partial-draft handling.

import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock the AI SDK + LLM provider BEFORE importing the module under test.
// Pattern: lib/domains/impact/__tests__/layer2-llm-classifier.test.ts.
vi.mock('ai', () => ({
  streamText: vi.fn(),
  generateObject: vi.fn(),
}));

vi.mock('@/lib/ai/llm-provider', () => ({
  getLlmModel: vi.fn(() => ({ model: 'gpt-oss:120b' })),
}));

import { generateObject, streamText } from 'ai';
import { z } from 'zod';
import {
  DEFAULT_STREAM_TIMEOUT_MS,
  WorkflowLlmError,
  judgeStructured,
  streamSection,
} from '../streaming-chain';

/** Build an async-iterable fullStream that yields text-deltas then finishes. */
function mockFullStream(deltas: string[]) {
  const parts = deltas.map((textDelta) => ({ type: 'text-delta' as const, textDelta }));
  return {
    async *[Symbol.asyncIterator]() {
      for (const part of parts) yield part;
    },
  };
}

describe('streaming-chain: streamSection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('accumulates text deltas and emits via onDelta callback', async () => {
    vi.mocked(streamText).mockResolvedValue({
      fullStream: mockFullStream(['Hello ', 'world', '!']),
    } as never);

    const deltas: string[] = [];
    const result = await streamSection({
      stepName: 'device_classification',
      systemPrompt: 'You are a classifier.',
      prompt: 'Classify this device.',
      onDelta: (d) => deltas.push(d),
    });

    expect(result.text).toBe('Hello world!');
    expect(result.status).toBe('ok');
    expect(deltas).toEqual(['Hello ', 'world', '!']);
  });

  it('prepends context to system prompt when provided', async () => {
    vi.mocked(streamText).mockResolvedValue({
      fullStream: mockFullStream(['ok']),
    } as never);

    await streamSection({
      stepName: 's1',
      systemPrompt: 'BASE',
      context: 'EVIDENCE',
      prompt: 'p',
    });

    const call = vi.mocked(streamText).mock.calls[0]?.[0];
    expect(call?.system).toBe('BASE\n\nEVIDENCE');
  });

  it('returns failed status with partial text on timeout (real timer)', async () => {
    // streamText that never resolves — the timeout fires first.
    vi.mocked(streamText).mockImplementation(() => new Promise(() => {}) as never);

    const result = await streamSection({
      stepName: 's2',
      systemPrompt: 'sys',
      prompt: 'p',
      timeoutMs: 10, // real timer — keep tiny so the test stays fast
    });

    expect(result.status).toBe('failed');
    expect(result.error).toBeInstanceOf(WorkflowLlmError);
    expect(result.error?.kind).toBe('timeout');
  });

  it('returns failed status on runtime error', async () => {
    vi.mocked(streamText).mockRejectedValue(new Error('gx10 down'));

    const result = await streamSection({
      stepName: 's3',
      systemPrompt: 'sys',
      prompt: 'p',
    });

    expect(result.status).toBe('failed');
    expect(result.error?.kind).toBe('runtime');
    expect(result.error?.message).toContain('gx10 down');
  });

  it('DEFAULT_STREAM_TIMEOUT_MS is 30000', () => {
    expect(DEFAULT_STREAM_TIMEOUT_MS).toBe(30_000);
  });
});

describe('streaming-chain: judgeStructured', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns the parsed object from generateObject', async () => {
    const Schema = z.object({ verdict: z.string(), confidence: z.number() });
    vi.mocked(generateObject).mockResolvedValue({
      object: { verdict: 'equivalent', confidence: 0.9 },
    } as never);

    const result = await judgeStructured({
      stepName: 'substantial_equivalence',
      schema: Schema,
      prompt: 'Evaluate SE.',
    });

    expect(result).toEqual({ verdict: 'equivalent', confidence: 0.9 });
  });

  it('throws WorkflowLlmError(kind=schema) on generateObject failure', async () => {
    vi.mocked(generateObject).mockRejectedValue(new Error('schema parse fail'));

    await expect(
      judgeStructured({
        stepName: 's',
        schema: z.object({ x: z.string() }),
        prompt: 'p',
      }),
    ).rejects.toMatchObject({ name: 'WorkflowLlmError', kind: 'schema' });
  });

  it('throws WorkflowLlmError(kind=timeout) on timeout (real timer)', async () => {
    vi.mocked(generateObject).mockImplementation(() => new Promise(() => {}) as never);

    await expect(
      judgeStructured({
        stepName: 's',
        schema: z.object({ x: z.string() }),
        prompt: 'p',
        timeoutMs: 10, // real timer
      }),
    ).rejects.toMatchObject({ name: 'WorkflowLlmError', kind: 'timeout' });
  });
});
