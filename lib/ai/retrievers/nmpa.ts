// @MX:NOTE [AUTO] NMPA (China) corpus retriever — wraps hybridSearch with corpus='nmpa'.
// @MX:SPEC SPEC-REGULA-BREADTH-001 (REQ-BREADTH-036)

import { hybridSearch } from './hybrid-search';
import { toRetrievalResult } from './retriever-utils';
import type { IRetriever, RetrievalResult, RetrieverOptions } from './types';

/**
 * Retriever for the NMPA (China National Medical Products Administration) corpus.
 * Uses text-embedding-3-small (1536 dim) via hybridSearch.
 */
export class NmpaRetriever implements IRetriever {
  readonly corpus = 'nmpa';

  async retrieve(query: string, opts: RetrieverOptions = {}): Promise<RetrievalResult[]> {
    const limit = opts.limit ?? 10;
    const chunks = await hybridSearch(query, 'nmpa' as never, limit, 'all');
    return chunks.map(toRetrievalResult);
  }
}
