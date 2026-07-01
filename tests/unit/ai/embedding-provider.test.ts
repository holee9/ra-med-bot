// @MX:NOTE [AUTO] Phase A unit tests for the centralized embedding provider.
// @MX:SPEC SPEC-LLM-MIGRATION-A
// Verifies the provider reads GitHub Models env vars and returns the correct
// default model id + base URL. The lazy singleton is reset between tests so
// env mutations are observable.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// We import the module fresh per env scenario by isolating the module registry.
// The defaults are asserted without mocking createOpenAI/OpenAI — we only call
// the pure string-returning accessors, never instantiate a client here.

describe('lib/ai/embedding-provider (Phase A — GitHub Models)', () => {
  // Snapshot the env so each test starts clean. We reassign process.env wholesale
  // (biome noDelete forbids `delete process.env.X`) and restore in afterEach.
  const ORIGINAL_ENV = { ...process.env };
  const CLEAN_ENV_KEYS = ['GITHUB_MODELS_TOKEN', 'EMBEDDING_BASE_URL', 'EMBEDDING_MODEL'];

  beforeEach(() => {
    vi.resetModules();
    // Strip the three Phase-A keys so defaults apply. Rebuild process.env from
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
    it('defaults to text-embedding-3-small when EMBEDDING_MODEL is unset', async () => {
      const { getEmbeddingModelId } = await import('@/lib/ai/embedding-provider');
      expect(getEmbeddingModelId()).toBe('text-embedding-3-small');
    });

    it('honors EMBEDDING_MODEL when set', async () => {
      process.env.EMBEDDING_MODEL = 'text-embedding-3-large';
      const { getEmbeddingModelId } = await import('@/lib/ai/embedding-provider');
      expect(getEmbeddingModelId()).toBe('text-embedding-3-large');
    });
  });

  describe('getEmbeddingBaseUrl', () => {
    it('defaults to https://models.github.ai/inference', async () => {
      const { getEmbeddingBaseUrl } = await import('@/lib/ai/embedding-provider');
      expect(getEmbeddingBaseUrl()).toBe('https://models.github.ai/inference');
    });

    it('honors EMBEDDING_BASE_URL when set (e.g. Azure Foundry migration)', async () => {
      process.env.EMBEDDING_BASE_URL = 'https://example.com/v1';
      const { getEmbeddingBaseUrl } = await import('@/lib/ai/embedding-provider');
      expect(getEmbeddingBaseUrl()).toBe('https://example.com/v1');
    });
  });

  describe('getEmbeddingApiKey', () => {
    it('returns GITHUB_MODELS_TOKEN when set', async () => {
      process.env.GITHUB_MODELS_TOKEN = 'ghp_test-token-123';
      const { getEmbeddingApiKey } = await import('@/lib/ai/embedding-provider');
      expect(getEmbeddingApiKey()).toBe('ghp_test-token-123');
    });

    it('falls back to the no-key-in-test sentinel when unset', async () => {
      const { getEmbeddingApiKey } = await import('@/lib/ai/embedding-provider');
      expect(getEmbeddingApiKey()).toBe('no-key-in-test');
    });
  });
});
