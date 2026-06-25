// @MX:NOTE [AUTO] FDA corpus retriever — thin wrapper over hybridSearch. Phase 4 will
// add per-corpus prefilters; for now this is intentionally trivial.
// @MX:SPEC SPEC-REGULA-CHAT-001 (REQ-CHAT-013), SPEC-REGULA-BREADTH-001 (REQ-BREADTH-038)

import { type RetrievedChunk, hybridSearch } from './hybrid-search';
import { toRetrievalResult } from './retriever-utils';
import type { IRetriever, RetrievalResult, RetrieverOptions } from './types';

export async function searchFDACorpus(
  query: string,
  k: number,
  sourceFilter: 'all' | 'regs' | 'internal',
  orgId?: string,
): Promise<RetrievedChunk[]> {
  return hybridSearch(query, 'fda', k, sourceFilter, orgId);
}

/**
 * IRetriever-compatible class wrapper for the FDA corpus.
 * Used by the RAG merge layer (T-009) to retrieve FDA regulatory content.
 */
export class FdaRetriever implements IRetriever {
  readonly corpus = 'fda';

  async retrieve(query: string, opts: RetrieverOptions = {}): Promise<RetrievalResult[]> {
    const limit = opts.limit ?? 10;
    // REQ-CORPUSLIC-008 — thread orgId so filterExpiredSources fires inside hybridSearch.
    const chunks = await hybridSearch(query, 'fda', limit, 'all', opts.orgId);
    return chunks.map(toRetrievalResult);
  }
}
