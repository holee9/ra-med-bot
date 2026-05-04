// Tests for lib/ai/hybrid-router.ts
// RED: CRITICAL — internal scope must NEVER route to AutoRAG (REQ-CF-027)

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { RetrievalResult } from '../../../lib/ai/retrievers/types';

// Mock internal-sops retriever to prevent hanging dynamic import in test env
vi.mock('../../../lib/ai/retrievers/internal-sops', () => ({
  InternalSopsRetriever: class {
    async retrieve() {
      return [];
    }
  },
}));

// ── Error type tests ──────────────────────────────────────────────────────────

describe('BadScopeError', () => {
  it('should be exported from hybrid-router', async () => {
    const mod = await import('../../../lib/ai/hybrid-router');
    expect(mod.BadScopeError).toBeDefined();
  });

  it('should be an instance of Error', async () => {
    const { BadScopeError } = await import('../../../lib/ai/hybrid-router');
    const err = new BadScopeError('test');
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe('BadScopeError');
  });
});

describe('HIPAABAAScopeError', () => {
  it('should be exported from hybrid-router', async () => {
    const mod = await import('../../../lib/ai/hybrid-router');
    expect(mod.HIPAABAAScopeError).toBeDefined();
  });
});

// ── CRITICAL: internal scope isolation (REQ-CF-027) ───────────────────────────

describe('hybridRetrieve — internal scope isolation (REQ-CF-027)', () => {
  it('should throw BadScopeError when internal scope routes to AutoRAG', async () => {
    const { hybridRetrieve, BadScopeError } = await import('../../../lib/ai/hybrid-router');

    // Attempting to use AutoRAG explicitly on internal scope must throw
    await expect(
      hybridRetrieve('what is ISO 13485', 'internal', {}, 5, {
        forceAutoRAG: true,
      }),
    ).rejects.toThrow(BadScopeError);
  });

  it('should NOT throw BadScopeError for internal scope without forceAutoRAG', async () => {
    const { hybridRetrieve } = await import('../../../lib/ai/hybrid-router');

    // internal scope → pgvector path should succeed (may return empty array in test)
    await expect(hybridRetrieve('what is ISO 13485', 'internal', {}, 5)).resolves.toBeDefined();
  });
});

// ── Public corpus routing ─────────────────────────────────────────────────────

describe('hybridRetrieve — public scope', () => {
  it('should accept public_corpus scope without throwing', async () => {
    const { hybridRetrieve } = await import('../../../lib/ai/hybrid-router');

    await expect(
      hybridRetrieve('FDA 510k requirements', 'public_corpus', {}, 5),
    ).resolves.toBeDefined();
  });

  it('should return an array of RetrievalResults', async () => {
    const { hybridRetrieve } = await import('../../../lib/ai/hybrid-router');

    const results = await hybridRetrieve('FDA guidance', 'public_corpus', {}, 3);
    expect(Array.isArray(results)).toBe(true);
  });
});

// ── Fallback behaviour (REQ-CF-020) ──────────────────────────────────────────

describe('hybridRetrieve — fallback', () => {
  it('should export hybridRetrieve function', async () => {
    const mod = await import('../../../lib/ai/hybrid-router');
    expect(typeof mod.hybridRetrieve).toBe('function');
  });
});
