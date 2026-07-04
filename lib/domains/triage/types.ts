/**
 * @MX:NOTE [AUTO] T-001 — TRIAGE module types (GREEN phase)
 *
 * Minimal type definitions to satisfy tests.
 * Matches SPEC-V3-TRIAGE-001 §4.3 AutoAnswer JSONB structure.
 */

/**
 * Auto answer structure for TRIAGE RAG output.
 * Matches lib/domains/inbox/promote.ts:24-40 extractCitations() parser.
 *
 * @MX:SPEC SPEC-V3-TRIAGE-001
 */
export interface AutoAnswer {
  /** HTML prose with <sup class="cite"> markers */
  answer: string;

  /** Citation list - each citation references a source ID */
  citations: Array<{
    /** Source ID (sources.id UUID or identifier) */
    source: string;
    /** Optional quoted text from source */
    quote?: string;
  }>;
}

/**
 * TRIAGE pipeline result.
 * Union type: success (with autoAnswer + confidence) OR error case.
 *
 * @MX:SPEC SPEC-V3-TRIAGE-001
 */
export interface TriageResult {
  /** Auto answer JSONB (null if error or timeout) */
  autoAnswer: AutoAnswer | null;

  /** Confidence score 0.0-1.0 (null if error or timeout) */
  autoConfidence: number | null;

  /** Error type if TRIAGE failed */
  error?: 'no_citations' | 'timeout' | 'runtime_error';
}

/**
 * Input parameters for RAG pipeline.
 *
 * @MX:SPEC SPEC-V3-TRIAGE-001
 */
export interface RagPipelineInput {
  /** User question (1-5000 chars, Zod-validated upstream) */
  question: string;

  /** Organization ID for RAG context isolation */
  orgId: string;

  /** Optional AbortSignal for timeout cancellation */
  signal?: AbortSignal | undefined;
}
