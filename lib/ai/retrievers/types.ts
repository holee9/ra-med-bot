// @MX:ANCHOR [AUTO] IRetriever — standard retriever interface for all corpus adapters.
// @MX:REASON REQ-BREADTH-038/039 require a shared interface so future retrievers
// (fda, internal, custom) can be swapped without call-site changes. fan_in will
// reach 3+ once the RAG handler, project retriever, and Phase 4 per-corpus
// prefilters all reference this type.
// @MX:SPEC SPEC-REGULA-BREADTH-001 (REQ-BREADTH-038, REQ-BREADTH-039)

/**
 * Options passed to every retriever call. All fields are optional so callers
 * that do not care about project or org scoping can omit them.
 */
export interface RetrieverOptions {
  /** Maximum number of results to return. */
  limit?: number;
  /** Filter results to a specific project. */
  projectId?: string;
  /** Filter results to a specific organisation. */
  orgId?: string;
}

/**
 * A single retrieved chunk returned by a corpus retriever.
 * `score` is a normalised relevance score in [0, 1].
 */
export interface RetrievalResult {
  id: string;
  content: string;
  score: number;
  sourceId: string;
  metadata: Record<string, unknown>;
}

/**
 * Standard interface for all corpus retrievers in the Regula RAG pipeline.
 * Implement this interface to add a new retriever without changing call sites.
 *
 * `corpus` identifies the retriever's data source (e.g. 'fda', 'internal').
 */
export interface IRetriever {
  retrieve(query: string, opts?: RetrieverOptions): Promise<RetrievalResult[]>;
  readonly corpus: string;
}
