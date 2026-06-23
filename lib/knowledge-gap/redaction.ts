// @MX:NOTE [AUTO] PII redaction wrapper for knowledge-gap question capture.
// @MX:SPEC SPEC-REGULA-KNOWLEDGE-GAP-001 (REQ-KNOWLEDGE-GAP-002, Issue #35)
// @MX:REASON Reuses the existing HIPAA Safe Harbor regex layer (lib/ingest/pii/regex.ts)
//           per SPEC §1.4 Out-of-Scope: "redaction 알고리즘 자체의 신규 개발 금지".
//           The wrapper adds only: (1) SHA-256 hash of the ORIGINAL question for
//           de-dup / clustering, (2) the redacted text stored in unanswered_queue.
//           No PII ever enters the queue or the GitHub Issue body.

import { createHash } from 'node:crypto';
import { detectPii, redactText } from '@/lib/ingest/pii/regex';

/**
 * SHA-256 hex hash of the original (un-redacted) question.
 * Used for de-duplication / clustering of similar unanswered questions
 * without retaining the PII-bearing original (REQ-KNOWLEDGE-GAP-002).
 */
export function hashQuestion(originalQuestion: string): string {
  return createHash('sha256').update(originalQuestion).digest('hex');
}

export interface RedactedQuestion {
  /** PII-free text safe to persist in unanswered_queue + GitHub Issue body. */
  redacted: string;
  /** SHA-256 of the ORIGINAL question — for de-dup, not for display. */
  hash: string;
  /** Number of PII spans redacted (audit context, not PII itself). */
  redactionCount: number;
}

/**
 * Redact PII from a user question before persistence in unanswered_queue.
 *
 * Wraps the existing regex-based redaction utility (REQ-KNOWLEDGE-GAP-002).
 * Returns the redacted text plus a hash of the original for clustering.
 * The original question is NEVER persisted or returned beyond hashing it.
 */
export function redactQuestion(originalQuestion: string): RedactedQuestion {
  const matches = detectPii(originalQuestion);
  const redacted = redactText(originalQuestion, matches);
  return {
    redacted,
    hash: hashQuestion(originalQuestion),
    redactionCount: matches.length,
  };
}
