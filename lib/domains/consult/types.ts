/**
 * @MX:NOTE [AUTO] CONSULT module types — RA Power Chat (v3 Phase C-5)
 *
 * Exchange model (H-1): one turn = one Q+A pair. consult_turns row stores
 * question (user input) + answer (RAG result) + citations + sources + confidence.
 *
 * @MX:SPEC SPEC-V3-CONSULT-001 (REQ-CONS-001..013, Issue 341)
 */

/**
 * Input for the CONSULT RAG pipeline (runConsult).
 * Mirrors TRIAGE RagPipelineInput; locale is fixed to 'ko' (TRIAGE pattern).
 *
 * @MX:SPEC SPEC-V3-CONSULT-001 (REQ-CONS-004)
 */
export interface ConsultInput {
  /** User question (1-5000 chars, Zod-validated upstream). */
  question: string;
  /** Organization ID for RAG context isolation (RLS / app-level eq(orgId)). */
  orgId: string;
  /** Session user id threaded to RLHF re-rank audit. */
  actorId?: string | null;
  /** Optional AbortSignal for caller-initiated cancellation. */
  signal?: AbortSignal;
}

/**
 * Citation entry — references a source ID. Matches TRIAGE AutoAnswer.citations
 * and inbox promote.ts extractCitations() parser shape.
 */
export interface ConsultCitation {
  /** Source ID (sources.id UUID or identifier). */
  source: string;
  /** Optional quoted text from source. */
  quote?: string;
}

/**
 * Source metadata persisted to consult_turns.sources (REQ-CONS-004).
 * Derived from citations for now; richer metadata is a follow-up.
 */
export interface ConsultSource {
  sourceId: string;
  sourceLabel?: string;
  quote?: string;
}

/**
 * CONSULT pipeline error cases.
 * Extends TRIAGE errors with `citation_coverage` (H-3: 80% coverage enforcement).
 */
export type ConsultError = 'no_citations' | 'citation_coverage' | 'timeout' | 'runtime_error';

/**
 * CONSULT pipeline result. On success: answer + citations + sources + confidence.
 * On failure: error set, all data fields null/empty.
 *
 * @MX:SPEC SPEC-V3-CONSULT-001 (REQ-CONS-005, AC-CONS-03..05)
 */
export interface ConsultResult {
  /** HTML prose with <sup class="cite"> markers, or null on error. */
  answer: string | null;
  /** Citation list (empty on error). */
  citations: ConsultCitation[];
  /** Source metadata for consult_turns.sources (empty on error). */
  sources: ConsultSource[];
  /** Confidence score 0.0-1.0 (null if not computed). */
  confidence: number | null;
  /** Error type, or null on success. */
  error: ConsultError | null;
}
