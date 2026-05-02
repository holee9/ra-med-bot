// @MX:NOTE FDA corpus retriever — thin wrapper over hybridSearch. Phase 4 will
// add per-corpus prefilters; for now this is intentionally trivial.
// @MX:SPEC SPEC-REGULA-CHAT-001 (REQ-CHAT-013)

import { type RetrievedChunk, hybridSearch } from './hybrid-search';

export async function searchFDACorpus(
  query: string,
  k: number,
  sourceFilter: 'all' | 'regs' | 'internal',
): Promise<RetrievedChunk[]> {
  return hybridSearch(query, 'fda', k, sourceFilter);
}
