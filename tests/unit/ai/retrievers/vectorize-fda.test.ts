// Tests for Vectorize-backed retrievers (all 5 corpora)
// RED: verify IRetriever interface compliance and corpus identity

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { IRetriever, RetrievalResult } from '../../../../lib/ai/retrievers/types';

// Minimal VectorizeIndex stub
function makeVectorizeMock(
  results: Array<{ id: string; score: number; metadata?: Record<string, unknown> }>,
) {
  return {
    query: vi.fn().mockResolvedValue({
      matches: results.map((r) => ({
        id: r.id,
        score: r.score,
        metadata: r.metadata ?? {},
        values: [],
      })),
    }),
  } as unknown as VectorizeIndex;
}

const CORPORA = [
  {
    name: 'VectorizeFdaRetriever',
    corpus: 'fda',
    path: '../../../../lib/ai/retrievers/vectorize-fda',
  },
  {
    name: 'VectorizeEuMdrRetriever',
    corpus: 'eu-mdr',
    path: '../../../../lib/ai/retrievers/vectorize-eu-mdr',
  },
  {
    name: 'VectorizeMfdsRetriever',
    corpus: 'mfds',
    path: '../../../../lib/ai/retrievers/vectorize-mfds',
  },
  {
    name: 'VectorizeNmpaRetriever',
    corpus: 'nmpa',
    path: '../../../../lib/ai/retrievers/vectorize-nmpa',
  },
  {
    name: 'VectorizePmdaRetriever',
    corpus: 'pmda',
    path: '../../../../lib/ai/retrievers/vectorize-pmda',
  },
];

for (const { name, corpus, path } of CORPORA) {
  describe(`${name}`, () => {
    it('should export the retriever class', async () => {
      const mod = await import(path);
      expect(mod[name]).toBeDefined();
    });

    it(`should have corpus === '${corpus}'`, async () => {
      const mod = await import(path);
      const RetrieverClass = mod[name];
      const index = makeVectorizeMock([]);
      const retriever: IRetriever = new RetrieverClass(index);
      expect(retriever.corpus).toBe(corpus);
    });

    it('should implement IRetriever.retrieve method', async () => {
      const mod = await import(path);
      const RetrieverClass = mod[name];
      const index = makeVectorizeMock([]);
      const retriever: IRetriever = new RetrieverClass(index);
      expect(typeof retriever.retrieve).toBe('function');
    });

    it('should return RetrievalResult[] from retrieve()', async () => {
      const mod = await import(path);
      const RetrieverClass = mod[name];
      const mockMatches = [
        { id: 'doc-1', score: 0.9, metadata: { content: 'test content', sourceId: 'src-1' } },
        { id: 'doc-2', score: 0.7, metadata: { content: 'other content', sourceId: 'src-2' } },
      ];
      const index = makeVectorizeMock(mockMatches);
      const retriever: IRetriever = new RetrieverClass(index);

      const results = await retriever.retrieve('test query', { limit: 2 });
      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBe(2);
      expect(results[0]).toMatchObject({
        id: expect.any(String),
        content: expect.any(String),
        score: expect.any(Number),
        sourceId: expect.any(String),
        metadata: expect.any(Object),
      });
    });

    it('should call VectorizeIndex.query with the provided query', async () => {
      const mod = await import(path);
      const RetrieverClass = mod[name];
      const index = makeVectorizeMock([]);
      const retriever: IRetriever = new RetrieverClass(index);

      await retriever.retrieve('regulatory query', { limit: 5 });
      expect(index.query).toHaveBeenCalled();
    });
  });
}
