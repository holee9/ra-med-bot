// @MX:NOTE [AUTO] reranker.ts — feedback-driven retrieval re-ranking (REQ-RLHF-010).
// @MX:SPEC SPEC-REGULA-RLHF-001 (REQ-RLHF-009, REQ-RLHF-010, AC-05)
// @MX:REASON Blends the base vector/semantic score with the source_section
//           feedback_score so retrieval surfaces sections that RA experts have
//           endorsed and suppresses sections they have rejected. The actual
//           wiring into the retrieval pipeline is in Phase G (lib/ai/merge.ts).

/**
 * A retrieval result carrying the fields needed for feedback re-ranking.
 * `sourceSectionId` is optional because not every result originates from a
 * `source_sections` row (e.g. whole-source retrievers). Results without a
 * section id receive a neutral feedback weight of 0.
 */
export interface RerankableResult {
  /** Unique id of the source_sections row, or null/undefined if whole-source. */
  sourceSectionId?: string | null;
  /** Base semantic relevance score in [0, 1]. */
  score: number;
}

/**
 * A lookup from source_section id -> feedback_score (numeric, stored in the
 * `source_sections.feedback_score` column).
 */
export type FeedbackScoreMap = Record<string, number>;

/** Default blending weight for the feedback term (lambda in [0, 1]). */
export const DEFAULT_FEEDBACK_LAMBDA = 0.2;

/**
 * REQ-RLHF-010: blend a base score with a feedback score.
 *
 *   blended = (1 - lambda) * base + lambda * tanh(feedbackScore)
 *
 * `tanh` normalizes the raw feedback_score (unbounded numeric) into [-1, +1]
 * so a single very-large feedback value cannot dominate the ranking. The
 * `lambda` knob controls how aggressively feedback influences order.
 *
 * @MX:ANCHOR [AUTO] computeFeedbackWeight — per-result blended score.
 * @MX:REASON Called per result in a retrieval batch (fan_in >= 3 expected:
 *           applyReranking, unit tests, integration tests).
 */
export function computeFeedbackWeight(
  baseScore: number,
  feedbackScore: number | null | undefined,
  lambda: number = DEFAULT_FEEDBACK_LAMBDA,
): number {
  const fb = feedbackScore ?? 0;
  const fbTerm = Math.tanh(fb);
  return (1 - lambda) * baseScore + lambda * fbTerm;
}

/**
 * REQ-RLHF-010 / AC-05: re-rank a list of retrieval results by feedback score.
 *
 * - Stable when all feedback scores are equal or absent (preserves base order).
 * - Boosts high-feedback sections, suppresses negative-feedback sections.
 * - Does NOT mutate the input array.
 *
 * Returns a new array sorted by blended score descending.
 */
export function applyReranking<T extends RerankableResult>(
  results: readonly T[],
  feedbackScores: FeedbackScoreMap,
  opts: { lambda?: number } = {},
): T[] {
  const lambda = opts.lambda ?? DEFAULT_FEEDBACK_LAMBDA;
  const annotated = results.map((r, idx) => {
    const fbScore = r.sourceSectionId ? (feedbackScores[r.sourceSectionId] ?? 0) : 0;
    return {
      result: r,
      idx,
      blended: computeFeedbackWeight(r.score, fbScore, lambda),
    };
  });
  // Stable sort: compare blended score descending, fall back to original index
  // so ties preserve insertion order (avoids nondeterministic ordering).
  annotated.sort((a, b) => {
    if (b.blended !== a.blended) return b.blended - a.blended;
    return a.idx - b.idx;
  });
  return annotated.map((a) => a.result);
}
