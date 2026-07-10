/**
 * langfuse.test.ts — REQ-ENTERPRISE-051
 *
 * Unit tests for lib/observability/langfuse.ts
 * Verifies null-safe behavior when env vars are not set.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// Shared mocks so happy-path tests can assert generation/flush were called.
const generationMock = vi.fn();
const flushAsyncMock = vi.fn().mockResolvedValue(undefined);
const traceMock = vi.fn().mockReturnValue({ generation: generationMock });

// Mock the langfuse module to prevent real network connections.
vi.mock('langfuse', () => ({
  Langfuse: vi.fn().mockImplementation(() => ({
    trace: traceMock,
    flushAsync: flushAsyncMock,
  })),
}));

beforeEach(() => {
  // Avoid assigning undefined, which process.env may coerce to a string.
  Reflect.deleteProperty(process.env, 'LANGFUSE_SECRET_KEY');
  Reflect.deleteProperty(process.env, 'LANGFUSE_PUBLIC_KEY');
  Reflect.deleteProperty(process.env, 'LANGFUSE_BASEURL');
  vi.resetModules();
  vi.clearAllMocks();
});

describe('getLangfuseClient (REQ-ENTERPRISE-051)', () => {
  it('should return null when LANGFUSE_SECRET_KEY is not set', async () => {
    const { getLangfuseClient } = await import('@/lib/observability/langfuse');
    expect(getLangfuseClient()).toBeNull();
  });

  it('should return null when only LANGFUSE_PUBLIC_KEY is set', async () => {
    process.env.LANGFUSE_PUBLIC_KEY = 'pk-test';
    const { getLangfuseClient } = await import('@/lib/observability/langfuse');
    expect(getLangfuseClient()).toBeNull();
  });
});

describe('traceLlmCall (REQ-ENTERPRISE-051)', () => {
  it('should silently succeed when client is null (no env vars)', async () => {
    const { traceLlmCall } = await import('@/lib/observability/langfuse');
    await expect(
      traceLlmCall({
        name: 'test-trace',
        input: { prompt: 'hello' },
        output: { text: 'world' },
        model: 'claude-sonnet',
        tokensIn: 10,
        tokensOut: 20,
      }),
    ).resolves.toBeUndefined();
  });
});

describe('getLangfuseClient — happy path (env set)', () => {
  it('returns a non-null singleton client when both keys are set', async () => {
    process.env.LANGFUSE_SECRET_KEY = 'sk-test';
    process.env.LANGFUSE_PUBLIC_KEY = 'pk-test';
    const { getLangfuseClient } = await import('@/lib/observability/langfuse');
    const c1 = getLangfuseClient();
    const c2 = getLangfuseClient();
    expect(c1).not.toBeNull();
    expect(c1).toBe(c2); // singleton — constructed once, cached on the module
  });

  it('passes LANGFUSE_BASEURL override to the Langfuse constructor', async () => {
    process.env.LANGFUSE_SECRET_KEY = 'sk-test';
    process.env.LANGFUSE_PUBLIC_KEY = 'pk-test';
    process.env.LANGFUSE_BASEURL = 'https://selfhosted.langfuse.example';
    const { Langfuse } = await import('langfuse');
    const { getLangfuseClient } = await import('@/lib/observability/langfuse');
    getLangfuseClient();
    expect(Langfuse).toHaveBeenCalledWith(
      expect.objectContaining({ baseUrl: 'https://selfhosted.langfuse.example' }),
    );
  });

  it('defaults baseUrl to cloud.langfuse.com when LANGFUSE_BASEURL unset', async () => {
    process.env.LANGFUSE_SECRET_KEY = 'sk-test';
    process.env.LANGFUSE_PUBLIC_KEY = 'pk-test';
    const { Langfuse } = await import('langfuse');
    const { getLangfuseClient } = await import('@/lib/observability/langfuse');
    getLangfuseClient();
    expect(Langfuse).toHaveBeenCalledWith(
      expect.objectContaining({ baseUrl: 'https://cloud.langfuse.com' }),
    );
  });
});

describe('traceLlmCall — happy path (client exists)', () => {
  it('records a trace + generation + flush when the client is initialized', async () => {
    process.env.LANGFUSE_SECRET_KEY = 'sk-test';
    process.env.LANGFUSE_PUBLIC_KEY = 'pk-test';
    const { traceLlmCall } = await import('@/lib/observability/langfuse');
    await traceLlmCall({
      name: 'llm.call',
      input: 'prompt-text',
      output: 'completion-text',
      model: 'gpt-oss:120b',
      tokensIn: 42,
      tokensOut: 7,
    });
    expect(traceMock).toHaveBeenCalledWith({ name: 'llm.call' });
    expect(generationMock).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'llm.call',
        model: 'gpt-oss:120b',
        input: 'prompt-text',
        output: 'completion-text',
        usage: { promptTokens: 42, completionTokens: 7 },
      }),
    );
    expect(flushAsyncMock).toHaveBeenCalledTimes(1);
  });
});

describe('module exports (REQ-ENTERPRISE-051)', () => {
  it('should export getLangfuseClient and traceLlmCall', async () => {
    const mod = await import('@/lib/observability/langfuse');
    expect(typeof mod.getLangfuseClient).toBe('function');
    expect(typeof mod.traceLlmCall).toBe('function');
  });
});
