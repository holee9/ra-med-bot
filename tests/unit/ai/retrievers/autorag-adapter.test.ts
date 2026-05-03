// Tests for lib/ai/retrievers/autorag-adapter.ts
// RED: HIPAA BAA guard, IRetriever compliance, normalization

import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { IRetriever, RetrievalResult } from '../../../../lib/ai/retrievers/types';

// Minimal AutoRAG env stub
function makeAutoRAGEnv(hipaaConfirmed: string = 'false') {
  const mockSearch = vi.fn().mockResolvedValue({
    results: [
      {
        id: 'autorag-1',
        score: 0.88,
        content: 'FDA guidance on 510k process',
        metadata: { sourceId: 'fda-src-1', title: 'FDA 510k Guidance' },
      },
    ],
  });

  return {
    AI: {
      autorag: vi.fn().mockReturnValue({
        aiSearch: mockSearch,
      }),
    },
    HIPAA_BAA_CONFIRMED: hipaaConfirmed,
    _mockSearch: mockSearch,
  };
}

describe('AutoRAGRetriever', () => {
  it('should be exported from autorag-adapter', async () => {
    const mod = await import('../../../../lib/ai/retrievers/autorag-adapter');
    expect(mod.AutoRAGRetriever).toBeDefined();
  });

  it('should implement IRetriever interface', async () => {
    const { AutoRAGRetriever } = await import('../../../../lib/ai/retrievers/autorag-adapter');
    const env = makeAutoRAGEnv('true');
    const retriever: IRetriever = new AutoRAGRetriever(env as unknown as CloudflareEnv, 'fda-instance');
    expect(typeof retriever.retrieve).toBe('function');
    expect(retriever.corpus).toBeDefined();
  });
});

describe('AutoRAGRetriever HIPAA BAA guard (REQ-CF-029)', () => {
  it('should throw HIPAABAAScopeError when HIPAA_BAA_CONFIRMED is not "true"', async () => {
    const { AutoRAGRetriever } = await import('../../../../lib/ai/retrievers/autorag-adapter');
    const { HIPAABAAScopeError } = await import('../../../../lib/ai/hybrid-router');

    const env = makeAutoRAGEnv('false');
    const retriever = new AutoRAGRetriever(env as unknown as CloudflareEnv, 'fda-instance');

    await expect(retriever.retrieve('test query')).rejects.toThrow(HIPAABAAScopeError);
  });

  it('should proceed when HIPAA_BAA_CONFIRMED === "true"', async () => {
    const { AutoRAGRetriever } = await import('../../../../lib/ai/retrievers/autorag-adapter');

    const env = makeAutoRAGEnv('true');
    const retriever = new AutoRAGRetriever(env as unknown as CloudflareEnv, 'fda-instance');

    const results = await retriever.retrieve('FDA 510k requirements', { limit: 5 });
    expect(Array.isArray(results)).toBe(true);
  });
});

describe('AutoRAGRetriever result normalization', () => {
  it('should return RetrievalResult[] with required fields', async () => {
    const { AutoRAGRetriever } = await import('../../../../lib/ai/retrievers/autorag-adapter');

    const env = makeAutoRAGEnv('true');
    const retriever = new AutoRAGRetriever(env as unknown as CloudflareEnv, 'fda-instance');

    const results = await retriever.retrieve('FDA guidance', { limit: 3 });
    expect(results.length).toBeGreaterThan(0);
    expect(results[0]).toMatchObject({
      id: expect.any(String),
      content: expect.any(String),
      score: expect.any(Number),
      sourceId: expect.any(String),
      metadata: expect.any(Object),
    });
  });
});
