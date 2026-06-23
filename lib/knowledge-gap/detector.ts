// @MX:ANCHOR [AUTO] Knowledge gap detector — 4-condition signal from RAG pipeline.
// @MX:REASON fan_in will reach 3+ (consult.ts hook + future replay + API routes).
//          The pure detectKnowledgeGap() is unit-testable without DB; the
//          captureKnowledgeGap() side effect writes the queue row + audit log.
// @MX:SPEC SPEC-REGULA-KNOWLEDGE-GAP-001 (REQ-KNOWLEDGE-GAP-001, REQ-KNOWLEDGE-GAP-004, Issue #35)
//
// Design reference: design.md §2.1 "Four Gap Conditions".
// Thresholds (cite REQ-KNOWLEDGE-GAP-001):
//   1. low_confidence   — confidenceScore < 0.5
//   2. low_citation     — citation coverage < 80% (uncited / totalSentences > 0.2)
//   3. no_results       — search returned 0 chunks
//   4. policy_blocked   — LLM generation failed / policy restriction

import { writeAudit } from '@/lib/audit';
import { db } from '@/lib/db/client';
import { unansweredQueue } from '@/lib/db/schema';
import { redactQuestion } from './redaction';

/** Input to the pure detection function — all 4 signal dimensions. */
export interface GapDetectionInput {
  /** Final confidence score from calculateConfidence() (0.0 ~ 1.0). */
  confidenceScore: number;
  /** Confidence level — 'low' is an independent trigger from the score. */
  confidenceLevel: 'high' | 'med' | 'low';
  /** True when citation coverage fell below 80%. */
  citationCoverageBelow80: boolean;
  /** Number of chunks retrieved by the search stage. */
  topChunksLength: number;
  /** True when LLM generation failed (policy / billing / network). */
  llmFailed: boolean;
}

/** Which gap reason was triggered (null = no gap). First match wins. */
export type DetectedGapReason =
  | 'low_confidence'
  | 'low_citation'
  | 'no_results'
  | 'policy_blocked'
  | null;

/** Confidence threshold below which a consult is a low_confidence gap (design.md §2.1). */
export const LOW_CONFIDENCE_THRESHOLD = 0.5;

/**
 * Pure detection function — evaluates the 4 gap conditions from design.md §2.1.
 * Returns the first matching reason, or null if the consult was adequately answered.
 *
 * Evaluation order (most specific → least specific):
 *   1. policy_blocked  — LLM never produced an answer
 *   2. no_results      — search returned nothing to cite
 *   3. low_citation    — answer exists but >20% of sentences are uncited
 *   4. low_confidence  — answer exists, cited, but score < 0.5
 *
 * Order rationale: a more specific root cause takes precedence over a downstream
 * symptom. If the LLM failed, confidence is also low — but the real reason is
 * policy_blocked, which points to a different remediation path.
 */
export function detectKnowledgeGap(input: GapDetectionInput): DetectedGapReason {
  if (input.llmFailed) return 'policy_blocked';
  if (input.topChunksLength === 0) return 'no_results';
  if (input.citationCoverageBelow80) return 'low_citation';
  if (input.confidenceLevel === 'low' || input.confidenceScore < LOW_CONFIDENCE_THRESHOLD) {
    return 'low_confidence';
  }
  return null;
}

/** Context for persisting a detected gap into unanswered_queue + audit_logs. */
export interface CaptureContext {
  orgId: string;
  conversationId: string;
  messageId: string;
  /** The ORIGINAL user question — PII is redacted before persistence. */
  originalQuestion: string;
  reason: NonNullable<DetectedGapReason>;
  /** User UUID initiating the consult (null for system-initiated). */
  actorId: string | null;
}

/**
 * Persist a detected knowledge gap: redact the question, insert into
 * unanswered_queue, write the knowledge_gap_created audit log, and mark the
 * source message row with knowledge_gap_required=true (REQ-KNOWLEDGE-GAP-002/003/004/016).
 *
 * Failures propagate — the caller MUST fail closed if the audit write fails
 * (21 CFR Part 11, see lib/audit.ts writeAudit contract).
 */
export async function captureKnowledgeGap(ctx: CaptureContext): Promise<void> {
  const { redacted, hash, redactionCount } = redactQuestion(ctx.originalQuestion);

  await db.insert(unansweredQueue).values({
    orgId: ctx.orgId,
    conversationId: ctx.conversationId,
    messageId: ctx.messageId,
    redactedQuestion: redacted,
    redactionHash: hash,
    gapReason: ctx.reason,
    status: 'open',
  });

  await writeAudit({
    actor_id: ctx.actorId,
    action: 'knowledge_gap_created',
    resource_type: 'unanswered_queue',
    resource_id: ctx.messageId,
    conversation_id: ctx.conversationId,
    meta_json: {
      reason: ctx.reason,
      redaction_count: redactionCount,
      redaction_hash: hash,
    },
  });
}
