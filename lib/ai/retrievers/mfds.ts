// @MX:NOTE [AUTO] MFDS (Korea) corpus retriever — wraps hybridSearch with corpus='mfds'.
// @MX:SPEC SPEC-REGULA-BREADTH-001 (REQ-BREADTH-035)

import { hybridSearch } from './hybrid-search';
import { toRetrievalResult } from './retriever-utils';
import type { IRetriever, RetrievalResult, RetrieverOptions } from './types';

/**
 * Retriever for the MFDS (Korea Ministry of Food and Drug Safety) corpus.
 * Uses text-embedding-3-small (1536 dim) via hybridSearch.
 */
export class MfdsRetriever implements IRetriever {
  readonly corpus = 'mfds';

  async retrieve(query: string, opts: RetrieverOptions = {}): Promise<RetrievalResult[]> {
    const limit = opts.limit ?? 10;
    const chunks = await hybridSearch(query, 'mfds' as never, limit, 'all');
    return chunks.map(toRetrievalResult);
  }
}
