// @MX:NOTE [AUTO] Vectorize-backed FDA corpus retriever (Phase 7).
// @MX:SPEC SPEC-REGULA-CLOUDFLARE-001 (REQ-CF-018)
//
// Implements the Phase 4 IRetriever interface. Wraps Cloudflare VectorizeIndex
// binding (FDA_PUBLIC) to provide semantic search over the FDA regulatory corpus.

import type { IRetriever, RetrievalResult, RetrieverOptions } from './types';

/**
 * Vectorize-backed retriever for the FDA public regulatory corpus.
 *
 * Usage in Workers runtime:
 *   const retriever = new VectorizeFdaRetriever(env.FDA_PUBLIC);
 */
export class VectorizeFdaRetriever implements IRetriever {
  readonly corpus = 'fda';

  constructor(private readonly index: VectorizeIndex) {}

  async retrieve(query: string, opts: RetrieverOptions = {}): Promise<RetrievalResult[]> {
    const limit = opts.limit ?? 10;

    // Vectorize v2 query — returns pre-computed semantic matches.
    // Embedding is handled by the Vectorize pipeline (no client-side embed call needed).
    const response = await this.index.query(query as unknown as number[], {
      topK: limit,
      returnMetadata: 'all',
    });

    return response.matches.map((match) => ({
      id: match.id,
      content: String((match.metadata as Record<string, unknown>)?.content ?? ''),
      score: match.score,
      sourceId: String((match.metadata as Record<string, unknown>)?.sourceId ?? match.id),
      metadata: (match.metadata as Record<string, unknown>) ?? {},
    }));
  }
}
