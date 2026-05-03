// @MX:NOTE [AUTO] Vectorize-backed EU MDR corpus retriever (Phase 7).
// @MX:SPEC SPEC-REGULA-CLOUDFLARE-001 (REQ-CF-018)
//
// EU MDR data must stay in EU region. Binding: EU_MDR_PUBLIC (Vectorize EU region).
// Pending Item #2: Vectorize EU GA flag (VECTORIZE_EU_GA env var) controls activation.

import type { IRetriever, RetrievalResult, RetrieverOptions } from './types';

/**
 * Vectorize-backed retriever for the EU MDR public regulatory corpus.
 *
 * Usage in Workers runtime:
 *   const retriever = new VectorizeEuMdrRetriever(env.EU_MDR_PUBLIC);
 */
export class VectorizeEuMdrRetriever implements IRetriever {
  readonly corpus = 'eu-mdr';

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
