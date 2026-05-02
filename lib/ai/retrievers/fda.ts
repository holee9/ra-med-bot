// @MX:NOTE [AUTO] FDA corpus retriever — thin wrapper over hybridSearch. Phase 4 will
// add per-corpus prefilters; for now this is intentionally trivial.
// This module is a function-level retriever. The IRetriever interface in types.ts
// targets class-based adapters. Phase 4 will wrap this as an FDARetriever class
// implementing IRetriever when per-corpus prefilters are introduced.
// @MX:SPEC SPEC-REGULA-CHAT-001 (REQ-CHAT-013), SPEC-REGULA-BREADTH-001 (REQ-BREADTH-038)

import { type RetrievedChunk, hybridSearch } from './hybrid-search';

export async function searchFDACorpus(
  query: string,
  k: number,
  sourceFilter: 'all' | 'regs' | 'internal',
): Promise<RetrievedChunk[]> {
  return hybridSearch(query, 'fda', k, sourceFilter);
}
