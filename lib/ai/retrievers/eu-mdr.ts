// @MX:NOTE [AUTO] EU MDR corpus retriever — wraps hybridSearch with corpus='eu-mdr'.
// @MX:SPEC SPEC-REGULA-BREADTH-001 (REQ-BREADTH-034)

import { hybridSearch } from './hybrid-search';
import { toRetrievalResult } from './retriever-utils';
import type { IRetriever, RetrievalResult, RetrieverOptions } from './types';

/**
 * Retriever for the EU MDR 2017/745 corpus.
 * Uses text-embedding-3-small (1536 dim) via hybridSearch.
 */
export class EuMdrRetriever implements IRetriever {
  readonly corpus = 'eu-mdr';

  async retrieve(query: string, opts: RetrieverOptions = {}): Promise<RetrievalResult[]> {
    const limit = opts.limit ?? 10;
    // REQ-CORPUSLIC-008 — thread orgId so filterExpiredSources fires inside hybridSearch.
    const chunks = await hybridSearch(query, 'eu-mdr' as never, limit, 'all', opts.orgId);
    return chunks.map(toRetrievalResult);
  }
}
