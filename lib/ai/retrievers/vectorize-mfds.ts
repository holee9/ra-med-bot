// @MX:NOTE [AUTO] Vectorize-backed MFDS corpus retriever (Phase 7).
// @MX:SPEC SPEC-REGULA-CLOUDFLARE-001 (REQ-CF-018)

import type { IRetriever, RetrievalResult, RetrieverOptions } from './types';

/**
 * Vectorize-backed retriever for the MFDS (Korea MFDS) public regulatory corpus.
 *
 * Usage in Workers runtime:
 *   const retriever = new VectorizeMfdsRetriever(env.MFDS_PUBLIC);
 */
export class VectorizeMfdsRetriever implements IRetriever {
  readonly corpus = 'mfds';

  constructor(private readonly index: VectorizeIndex) {}

  async retrieve(query: string, opts: RetrieverOptions = {}): Promise<RetrievalResult[]> {
    const limit = opts.limit ?? 10;

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
