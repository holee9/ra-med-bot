// @MX:NOTE [AUTO] Shared utilities for corpus retrievers that wrap hybridSearch.
// @MX:SPEC SPEC-REGULA-BREADTH-001 (REQ-BREADTH-034, REQ-BREADTH-035, REQ-BREADTH-036)

import type { RetrievedChunk } from './hybrid-search';
import type { RetrievalResult } from './types';

/**
 * Maps a RetrievedChunk from hybridSearch to the canonical RetrievalResult shape.
 * All corpus retrievers backed by hybridSearch use this mapping.
 */
export function toRetrievalResult(chunk: RetrievedChunk): RetrievalResult {
  return {
    id: chunk.sectionId,
    content: chunk.text,
    score: chunk.combined_score,
    sourceId: chunk.sourceId,
    metadata: {
      anchor: chunk.anchor,
      orgLabel: chunk.orgLabel,
      title: chunk.title,
      year: chunk.year,
      type: chunk.type,
      url: chunk.url,
      offset: chunk.offset,
    },
  };
}
