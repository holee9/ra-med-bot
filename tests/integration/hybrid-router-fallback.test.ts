// @MX:NOTE [AUTO] REQ-QUAL-012/013 — pgvector fallback contract for hybrid router.
// @MX:SPEC SPEC-REGULA-QUALITY-001

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Mock the InternalSopsRetriever so we can observe whether the pgvector
// path was exercised without touching the real database.
const retrieveSpy = vi.fn();
vi.mock('@/lib/ai/retrievers/internal-sops', () => ({
  InternalSopsRetriever: vi.fn().mockImplementation(() => ({
    retrieve: retrieveSpy,
  })),
}));

const ORIGINAL_CACHES = (globalThis as { caches?: unknown }).caches;
const ORIGINAL_INDEX = process.env.CLOUDFLARE_VECTORIZE_INDEX_NAME;

beforeEach(() => {
  retrieveSpy.mockReset();
  retrieveSpy.mockResolvedValue([
    {
      id: 'mock-chunk-1',
      sourceId: 'mock-source-1',
      content: 'mock pgvector chunk',
      score: 0.91,
      metadata: { sourceType: 'guidance' },
    },
  ]);
});

afterEach(() => {
  // Restore globals so tests do not leak into siblings.
  if (ORIGINAL_CACHES === undefined) {
    (globalThis as { caches?: unknown }).caches = undefined;
  } else {
    (globalThis as { caches?: unknown }).caches = ORIGINAL_CACHES;
  }
  if (ORIGINAL_INDEX === undefined) {
    process.env.CLOUDFLARE_VECTORIZE_INDEX_NAME = '';
  } else {
    process.env.CLOUDFLARE_VECTORIZE_INDEX_NAME = ORIGINAL_INDEX;
  }
  vi.resetModules();
});

describe('hybridRetrieve — Vectorize / pgvector routing (REQ-QUAL-012, REQ-QUAL-013)', () => {
  it('falls back to pgvector when CLOUDFLARE_VECTORIZE_INDEX_NAME is unset', async () => {
    process.env.CLOUDFLARE_VECTORIZE_INDEX_NAME = '';
    (globalThis as { caches?: unknown }).caches = undefined;

    const { hybridRetrieve, isVectorizeAvailable } = await import('@/lib/ai/hybrid-router');

    expect(isVectorizeAvailable()).toBe(false);

    const results = await hybridRetrieve('510(k) submission', 'public_corpus', {}, 5);

    expect(retrieveSpy).toHaveBeenCalledTimes(1);
    expect(results).toHaveLength(1);
    expect(results[0]?.id).toBe('mock-chunk-1');
  });

  it('falls back to pgvector in Node test runtime even when env var is set', async () => {
    // REQ-QUAL-013: env var alone is insufficient — Workers runtime is also required.
    process.env.CLOUDFLARE_VECTORIZE_INDEX_NAME = 'regula-public';
    (globalThis as { caches?: unknown }).caches = undefined;

    const { hybridRetrieve, isVectorizeAvailable } = await import('@/lib/ai/hybrid-router');

    expect(isVectorizeAvailable()).toBe(false);

    const results = await hybridRetrieve('EU MDR Annex VIII', 'public_corpus', {}, 5);

    expect(retrieveSpy).toHaveBeenCalledTimes(1);
    expect(results).toHaveLength(1);
  });

  it('reports Vectorize as available when in Workers runtime with env var set', async () => {
    // Simulate Workers runtime: caches global present + env var configured.
    (globalThis as { caches?: unknown }).caches = { default: {} } as unknown;
    process.env.CLOUDFLARE_VECTORIZE_INDEX_NAME = 'regula-public';

    const { isVectorizeAvailable, hybridRetrieve } = await import('@/lib/ai/hybrid-router');

    expect(isVectorizeAvailable()).toBe(true);

    // The Vectorize binding stub returns []; the router does NOT auto-fallback
    // to pgvector once the binding path is taken (that path is reserved for
    // genuine timeouts, see retrievePublicWithFallback). So pgvector must
    // NOT be invoked in this branch.
    const results = await hybridRetrieve('FDA 510(k)', 'public_corpus', {}, 5);

    expect(retrieveSpy).not.toHaveBeenCalled();
    expect(results).toEqual([]);
  });
});
