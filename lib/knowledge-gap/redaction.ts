// @MX:NOTE [AUTO] Question capture helper for knowledge-gap question tracking.
// @MX:SPEC SPEC-REGULA-KNOWLEDGE-GAP-001 (REQ-KNOWLEDGE-GAP-002, Issue #35)
// @MX:REASON SPEC-REGULA-PHI-REMOVAL-001 removed the PII redaction layer —
//           Regula is an internal RA tool and does not handle patient
//           information. This helper now retains only the SHA-256 hash for
//           de-dup / clustering; the question text is passed through verbatim.

import { createHash } from 'node:crypto';

/**
 * SHA-256 hex hash of the question.
 * Used for de-duplication / clustering of similar unanswered questions.
 */
export function hashQuestion(originalQuestion: string): string {
  return createHash('sha256').update(originalQuestion).digest('hex');
}

export interface RedactedQuestion {
  /** Question text persisted in unanswered_queue (PII redaction removed). */
  redacted: string;
  /** SHA-256 of the question — for de-dup, not for display. */
  hash: string;
  /** Kept for backward-compat with audit meta — always 0 now. */
  redactionCount: number;
}

/**
 * Prepare a user question for persistence in unanswered_queue.
 *
 * SPEC-REGULA-PHI-REMOVAL-001: the PII redaction step was removed (Regula does
 * not handle patient information). Returns the question verbatim plus a hash
 * for clustering.
 */
export function redactQuestion(originalQuestion: string): RedactedQuestion {
  return {
    redacted: originalQuestion,
    hash: hashQuestion(originalQuestion),
    redactionCount: 0,
  };
}
