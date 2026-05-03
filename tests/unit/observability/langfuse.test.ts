/**
 * langfuse.test.ts — REQ-ENTERPRISE-051
 *
 * Unit tests for lib/observability/langfuse.ts
 * Verifies null-safe behavior when env vars are not set.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock the langfuse module to prevent real network connections
vi.mock('langfuse', () => ({
  Langfuse: vi.fn().mockImplementation(() => ({
    trace: vi.fn().mockReturnValue({ generation: vi.fn() }),
    flushAsync: vi.fn().mockResolvedValue(undefined),
  })),
}));

beforeEach(() => {
  // Avoid assigning undefined, which process.env may coerce to a string.
  Reflect.deleteProperty(process.env, 'LANGFUSE_SECRET_KEY');
  Reflect.deleteProperty(process.env, 'LANGFUSE_PUBLIC_KEY');
  vi.resetModules();
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

describe('module exports (REQ-ENTERPRISE-051)', () => {
  it('should export getLangfuseClient and traceLlmCall', async () => {
    const mod = await import('@/lib/observability/langfuse');
    expect(typeof mod.getLangfuseClient).toBe('function');
    expect(typeof mod.traceLlmCall).toBe('function');
  });
});
