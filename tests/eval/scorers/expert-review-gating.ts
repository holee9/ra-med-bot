/**
 * Expert Review Gating Scorer
 * SPEC-REGULA-LAUNCH-001 — REQ-LAUNCH-004
 *
 * Validates that when confidence is low, the output includes an indication
 * that expert review is recommended (e.g., "consult an expert",
 * "expert review recommended", "please verify with a regulatory specialist").
 *
 * This scorer checks the gating behavior: low-confidence outputs must
 * trigger a review recommendation.
 *
 * This is a heuristic scorer — not an LLM judge.
 */

interface ScorerResult {
  pass: boolean;
  score: number; // 0.0 to 1.0
  reason: string;
}

const LOW_CONFIDENCE_PATTERN =
  /\b(low confidence|not certain|uncertain|limited information|may not be accurate|cannot confirm)\b/i;

const EXPERT_REVIEW_PATTERN =
  /\b(consult|expert review|regulatory specialist|verify with|professional advice|seek guidance|recommend reviewing)\b/i;

// @MX:ANCHOR: [AUTO] promptfoo scorer entry point — called for each eval test case
// @MX:REASON: external integration boundary with promptfoo eval harness
export default async function score(
  output: string,
  _context: { vars: Record<string, string>; prompt: string },
): Promise<ScorerResult> {
  const isLowConfidence = LOW_CONFIDENCE_PATTERN.test(output);
  const hasExpertReview = EXPERT_REVIEW_PATTERN.test(output);

  if (isLowConfidence && !hasExpertReview) {
    return {
      pass: false,
      score: 0,
      reason:
        'Output signals low confidence but does not recommend expert review. Low-confidence outputs must include a review recommendation.',
    };
  }

  if (isLowConfidence && hasExpertReview) {
    return {
      pass: true,
      score: 1.0,
      reason: 'Low confidence detected and expert review recommendation is present.',
    };
  }

  if (!isLowConfidence && hasExpertReview) {
    return {
      pass: true,
      score: 1.0,
      reason: 'Output proactively recommends expert review (bonus).',
    };
  }

  // High/medium confidence without explicit expert review — acceptable
  return {
    pass: true,
    score: 0.8,
    reason: 'Output does not signal low confidence; expert review gating not required.',
  };
}
