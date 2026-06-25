// @MX:NOTE [AUTO] retrieval-hook.ts — REQ-RLHF-010 retrieval pipeline integration.
// @MX:SPEC SPEC-REGULA-RLHF-001 (REQ-RLHF-010, REQ-RLHF-013, REQ-RLHF-014, AC-05, AC-07)
// @MX:REASON This module is the SINGLE integration point between the RLHF
//           feedback_score and the retrieval pipeline (lib/ai/merge.ts).
//           Tier-1 dead-code defense: the integration test in Phase G asserts
//           that retrieval output CHANGES when feedback_score changes, AND that
//           verifyPostRerankInvariants fires on EVERY retrieval path.
//
// Contract:
//   - applyRlhfReranking(results, opts): takes post-Cohere results, fetches the
//     feedback_score for each result's source_section, blends via applyReranking,
//     records the re-ranking via recordReranking, returns re-ranked results.
//   - The caller (merge.ts) MUST call this on EVERY retrieval path (happy /
//     cached / streaming / fallback). The integration test enumerates the paths.

import { db } from '@/lib/db/client';
import { sourceSections } from '@/lib/db/schema';
import {
  type PostRerankInvariantResult,
  verifyPostRerankInvariants,
} from '@/lib/rlhf/post-rerank-gate';
import { type FeedbackScoreMap, type RerankableResult, applyReranking } from '@/lib/rlhf/reranker';
import { recordReranking } from '@/lib/rlhf/version-tracker';
import { inArray } from 'drizzle-orm';

/** A retrieval result in the shape needed for RLHF re-ranking. */
export interface RlhfRerankableResult extends RerankableResult {
  /** The chunk id (maps to source_sections.id). */
  id: string;
}

/**
 * Fetch the feedback_score for a set of source_section ids.
 * Returns a map of { sectionId -> feedbackScore }. Sections not found or with
 * null/0 scores are omitted (treated as neutral 0 by applyReranking).
 *
 * Exposed for testing so the integration test can assert non-empty scores are
 * actually loaded (Tier-1 dead-code defense against "called with empty {}").
 */
export async function fetchFeedbackScores(
  sectionIds: readonly string[],
): Promise<FeedbackScoreMap> {
  if (sectionIds.length === 0) return {};
  const rows = await db
    .select({ id: sourceSections.id, score: sourceSections.feedbackScore })
    .from(sourceSections)
    .where(inArray(sourceSections.id, [...sectionIds]));
  const map: FeedbackScoreMap = {};
  for (const r of rows) {
    const num = Number(r.score);
    if (num !== 0) map[r.id] = num;
  }
  return map;
}

/**
 * REQ-RLHF-010 / AC-05: apply feedback-driven re-ranking to a retrieval batch.
 *
 * Steps:
 *   1. Fetch feedback_scores for the returned section ids.
 *   2. Blend via applyReranking (lambda-blended base + tanh(feedback)).
 *   3. Record the re-ranking via recordReranking (version metadata + audit).
 *   4. Verify post-rerank invariants (REQ-RLHF-014) — confidence/citation/expert.
 *
 * The `postRerankContext` is supplied by the caller so the invariant check can
 * run on every path (the caller knows the confidence/citation/expert state).
 *
 * @MX:ANCHOR [AUTO] applyRlhfReranking — the single retrieval RLHF integration point.
 * @MX:REASON fan_in >= 3 (happy path, cached path, streaming path, fallback). The
 *           integration test MUST assert this fires on each entrypoint.
 */
export async function applyRlhfReranking<T extends RlhfRerankableResult>(
  results: readonly T[],
  opts: {
    orgId: string;
    actorId: string | null;
    lambda?: number;
    /** Post-rerank invariant context (REQ-RLHF-014). */
    postRerank: {
      confidenceScore: number;
      citationCount: number;
      expertReviewRequired: boolean;
    };
  },
): Promise<{ results: T[]; invariantCheck: PostRerankInvariantResult }> {
  // 1. Fetch feedback scores (Tier-1 defense: assert non-empty when results exist).
  const sectionIds = results.map((r) => r.id).filter(Boolean);
  const scores = await fetchFeedbackScores(sectionIds);

  // 2. Apply feedback-blended re-ranking.
  const reranked = applyReranking(results, scores, { lambda: opts.lambda });

  // 3. Record the re-ranking (version metadata + 21 CFR Part 11 audit).
  // H-2 fix: recordReranking errors PROPAGATE. A failure here is a real health
  // signal — the previous silent warn-and-continue masked 21 CFR Part 11
  // audit-trail degradation (regulators would see feedback-driven re-ranks
  // with no change_request + no audit row). The caller (merge.ts) wraps this
  // whole path in its own try/catch that falls back to Cohere ordering, so
  // retrieval still completes; but the error is NOT swallowed at this layer.
  await recordReranking({
    orgId: opts.orgId,
    submittedBy: opts.actorId,
    lambda: opts.lambda ?? 0.2,
    sectionCount: sectionIds.length,
    appliedAt: new Date(),
  });

  // 4. REQ-RLHF-014: verify post-rerank invariants.
  const invariantCheck = verifyPostRerankInvariants(opts.postRerank);

  return { results: reranked, invariantCheck };
}
