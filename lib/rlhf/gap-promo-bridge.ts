// @MX:NOTE [AUTO] gap-promo-bridge.ts — RLHF → Knowledge Gap / Knowledge Promo bridges.
// @MX:SPEC SPEC-REGULA-RLHF-001 (REQ-RLHF-007, REQ-RLHF-008, REQ-RLHF-015, AC-03, AC-04)
// @MX:REASON
//   - REQ-RLHF-007: wraps createGitHubIssue (lib/knowledge-gap/github-issue.ts) so
//     low-rated answers auto-create a Knowledge Gap issue with REAL qualityTags.
//   - REQ-RLHF-008: high-rated answers produce a CANDIDATE DESCRIPTOR ONLY.
//   - REQ-RLHF-015 [HARD]: the promo path MUST NOT insert into change_request
//     with approval_status != 'pending_review'. The actual submission to #50
//     is deferred (proposal-only interface + @MX:TODO marker).

import { createHash } from 'node:crypto';
import type { qualityTagEnum } from '@/lib/db/schema';
import {
  type GapIssueContext,
  type GitHubIssuesClient,
  createGitHubIssue,
} from '@/lib/knowledge-gap/github-issue';

/** Quality tags that mark an answer as low-rated (REQ-RLHF-007). */
export const LOW_RATED_TAGS = new Set([
  'citation_missing',
  'citation_wrong',
  'answer_incomplete',
  'answer_wrong',
  'outdated_info',
  'jurisdiction_mismatch',
  // #264 confidence-breakdown dimensions — all low-quality signals (REQ-RLHF-007):
  'citation_coverage_low',
  'source_recency_stale',
  'source_authority_weak',
  'source_agreement_conflict',
]);

/** Quality tags that mark an answer as high-rated (REQ-RLHF-008). */
export const HIGH_RATED_TAGS = new Set(['helpful', 'excellent']);

export type QualityTag = (typeof qualityTagEnum.enumValues)[number];

/** Input shape for both bridges — the feedback just submitted. */
export interface FeedbackBridgeInput {
  messageId: string;
  conversationId: string;
  userId: string;
  rating: 'up' | 'down';
  qualityTags: QualityTag[];
  comment: string | null;
  /**
   * PII-free snippet of the question that produced the answer. The caller MUST
   * redact before passing (the knowledge-gap pipeline is PII-free by contract).
   */
  redactedQuestion: string;
}

/**
 * Decide whether a feedback is "low-rated" (REQ-RLHF-007).
 * Low-rated = rating 'down' AND at least one low-rated quality tag.
 */
export function isLowRatedFeedback(input: FeedbackBridgeInput): boolean {
  if (input.rating !== 'down') return false;
  return input.qualityTags.some((t) => LOW_RATED_TAGS.has(t));
}

/**
 * Decide whether a feedback is "high-rated" (REQ-RLHF-008).
 * High-rated = rating 'up' AND (helpful OR excellent).
 */
export function isHighRatedFeedback(input: FeedbackBridgeInput): boolean {
  if (input.rating !== 'up') return false;
  return input.qualityTags.some((t) => HIGH_RATED_TAGS.has(t));
}

/**
 * REQ-RLHF-007 / AC-03: create a Knowledge Gap GitHub issue for a low-rated
 * answer. Wraps createGitHubIssue with a GapIssueContext derived from the
 * feedback + the redacted question.
 *
 * Tier-1 dead-code defense: the test MUST inject a realistic low-rated
 * feedback (with real qualityTags, not []) and assert the created issue body
 * contains the redacted question text AND at least one quality tag.
 *
 * Returns the created issue number, or null if GitHub is unconfigured.
 */
export async function createGapIssueForLowRatedAnswer(
  input: FeedbackBridgeInput,
  opts: { client?: GitHubIssuesClient; clusterId?: string } = {},
): Promise<{ number: number; htmlUrl: string } | null> {
  if (!isLowRatedFeedback(input)) return null;

  // Derive the machine reason from the dominant quality tag (first low-rated tag).
  const lowTag = input.qualityTags.find((t) => LOW_RATED_TAGS.has(t)) ?? 'answer_wrong';

  const ctx: GapIssueContext = {
    redactedQuestion: input.redactedQuestion,
    redactionHash: `sha256:${createHash('sha256').update(input.redactedQuestion, 'utf8').digest('hex')}`,
    // Map RLHF quality tags to the existing gap_reason enum vocabulary where
    // possible; fall back to 'low_citation' for citation-* tags, else 'low_confidence'.
    reason: lowTag.startsWith('citation_') ? 'low_citation' : 'low_confidence',
    clusterId: opts.clusterId ?? `rlhf-${input.messageId}`,
    conversationId: input.conversationId,
    messageId: input.messageId,
  };

  return createGitHubIssue(ctx, opts.client);
}

/**
 * REQ-RLHF-008 / REQ-RLHF-015 [HARD] / AC-04: propose a high-rated answer as a
 * knowledge-promotion candidate. Returns a DESCRIPTOR ONLY — does NOT call
 * submitRlhfProposal, does NOT insert into change_request, does NOT auto-confirm.
 *
 * The actual wiring to #50 KNOWLEDGE-PROMO is deferred (proposal-only interface).
 * The @MX:TODO marker below is the single coordination point for the follow-up.
 *
 * @MX:TODO [AUTO] When SPEC-REGULA-KNOWLEDGE-PROMO-001 (#50) lands, wire this
 *   descriptor into the promotion pipeline. Until then, this is a NO-OP stub
 *   that returns the descriptor so callers can log / surface it in dashboards.
 */
export interface PromotionCandidateDescriptor {
  messageId: string;
  userId: string;
  evidence: {
    rating: 'up';
    qualityTags: QualityTag[];
    comment: string | null;
  };
  /**
   * The deferred promotion flag. Always false in v1.0.0 (REQ-RLHF-015).
   * When #50 lands, this becomes the trigger for the promotion pipeline.
   */
  promotionDeferred: boolean;
  /** Follow-up issue tracking the wiring. */
  followUpIssue: '#50';
}

export function proposePromotionCandidateForHighRatedAnswer(
  input: FeedbackBridgeInput,
): PromotionCandidateDescriptor | null {
  if (!isHighRatedFeedback(input)) return null;

  // REQ-RLHF-015 [HARD]: intentionally a pure descriptor. No DB write, no
  // submitRlhfProposal call, no side effect. The assertion test in
  // gap-promo-bridge.test.ts guards this invariant.
  return {
    messageId: input.messageId,
    userId: input.userId,
    evidence: {
      rating: 'up',
      qualityTags: input.qualityTags.filter((t) => HIGH_RATED_TAGS.has(t)),
      comment: input.comment,
    },
    promotionDeferred: true,
    followUpIssue: '#50',
  };
}
