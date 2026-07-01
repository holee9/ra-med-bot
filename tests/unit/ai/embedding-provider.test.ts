// @MX:NOTE [AUTO] Phase A-revised unit tests for the centralized embedding provider.
// @MX:SPEC SPEC-LLM-MIGRATION-A (Phase A-revised: gx10 Ollama qwen3-embedding)
// Verifies the provider reads gx10 env vars and returns the correct default model
// id + base URL + keyless sentinel. The lazy singleton is reset between tests so
// env mutations are observable. MRL truncation (dimensions:1536 via fetch hook)
// is verified by the live gx10 call probe, not here (accessors only).

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// We import the module fresh per env scenario by isolating the module registry.
// The defaults are asserted without mocking createOpenAI/OpenAI — we only call
// the pure string-returning accessors, never instantiate a client here.

describe('lib/ai/embedding-provider (Phase A-revised — gx10 Ollama)', () => {
  // Snapshot the env so each test starts clean. We reassign process.env wholesale
  // (biome noDelete forbids `delete process.env.X`) and restore in afterEach.
  const ORIGINAL_ENV = { ...process.env };
  const CLEAN_ENV_KEYS = ['EMBEDDING_API_KEY', 'EMBEDDING_BASE_URL', 'EMBEDDING_MODEL'];

  beforeEach(() => {
    vi.resetModules();
    // Strip the three embedding keys so defaults apply. Rebuild process.env from
    // the snapshot without them.
    const restored = { NODE_ENV: ORIGINAL_ENV.NODE_ENV } as NodeJS.ProcessEnv;
    for (const [k, v] of Object.entries(ORIGINAL_ENV)) {
      if (!CLEAN_ENV_KEYS.includes(k)) restored[k] = v;
    }
    process.env = restored;
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  describe('getEmbeddingModelId', () => {
    it('defaults to qwen3-embedding:latest (gx10) when EMBEDDING_MODEL is unset', async () => {
      const { getEmbeddingModelId } = await import('@/lib/ai/embedding-provider');
      expect(getEmbeddingModelId()).toBe('qwen3-embedding:latest');
    });

    it('honors EMBEDDING_MODEL when set', async () => {
      process.env.EMBEDDING_MODEL = 'text-embedding-3-large';
      const { getEmbeddingModelId } = await import('@/lib/ai/embedding-provider');
      expect(getEmbeddingModelId()).toBe('text-embedding-3-large');
    });
  });

  describe('getEmbeddingBaseUrl', () => {
    it('defaults to the gx10 Ollama OpenAI-compatible endpoint', async () => {
      const { getEmbeddingBaseUrl } = await import('@/lib/ai/embedding-provider');
      expect(getEmbeddingBaseUrl()).toBe('http://192.168.100.1:11434/v1');
    });

    it('honors EMBEDDING_BASE_URL when set (e.g. alternative host)', async () => {
      process.env.EMBEDDING_BASE_URL = 'https://example.com/v1';
      const { getEmbeddingBaseUrl } = await import('@/lib/ai/embedding-provider');
      expect(getEmbeddingBaseUrl()).toBe('https://example.com/v1');
    });
  });

  describe('getEmbeddingApiKey', () => {
    it('returns EMBEDDING_API_KEY when set', async () => {
      process.env.EMBEDDING_API_KEY = 'sk-test-key';
      const { getEmbeddingApiKey } = await import('@/lib/ai/embedding-provider');
      expect(getEmbeddingApiKey()).toBe('sk-test-key');
    });

    it('falls back to the keyless ollama sentinel when unset (gx10 local-network trust)', async () => {
      const { getEmbeddingApiKey } = await import('@/lib/ai/embedding-provider');
      expect(getEmbeddingApiKey()).toBe('ollama');
    });
  });
});
