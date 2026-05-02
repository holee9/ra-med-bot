// @MX:NOTE [AUTO] PMDA (Japan) corpus retriever — wraps hybridSearch with corpus='pmda'.
// @MX:SPEC SPEC-REGULA-BREADTH-001 (REQ-BREADTH-036)

import { hybridSearch } from './hybrid-search';
import { toRetrievalResult } from './retriever-utils';
import type { IRetriever, RetrievalResult, RetrieverOptions } from './types';

/**
 * Retriever for the PMDA (Japan Pharmaceuticals and Medical Devices Agency) corpus.
 * Uses text-embedding-3-small (1536 dim) via hybridSearch.
 */
export class PmdaRetriever implements IRetriever {
  readonly corpus = 'pmda';

  async retrieve(query: string, opts: RetrieverOptions = {}): Promise<RetrievalResult[]> {
    const limit = opts.limit ?? 10;
    const chunks = await hybridSearch(query, 'pmda' as never, limit, 'all');
    return chunks.map(toRetrievalResult);
  }
}
