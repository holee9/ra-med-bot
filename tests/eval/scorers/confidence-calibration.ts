/**
 * Confidence Calibration Scorer
 * SPEC-REGULA-LAUNCH-001 — REQ-LAUNCH-004
 *
 * Validates that the model output contains appropriate confidence indicators
 * expected by the Regula RAG system (e.g., "high confidence", "medium confidence",
 * "low confidence", or "I am not certain").
 *
 * This is a heuristic scorer — not an LLM judge.
 */

interface ScorerResult {
  pass: boolean;
  score: number; // 0.0 to 1.0
  reason: string;
}

const HIGH_CONFIDENCE_PATTERN =
  /\b(high confidence|highly confident|with confidence|strong evidence)\b/i;
const MEDIUM_CONFIDENCE_PATTERN =
  /\b(medium confidence|moderate confidence|moderately confident|some uncertainty)\b/i;
const LOW_CONFIDENCE_PATTERN =
  /\b(low confidence|not certain|uncertain|limited information|may not be accurate)\b/i;
const ANY_CONFIDENCE_PATTERN = /\b(confidence|confident|certain|uncertain|certainty)\b/i;

// @MX:ANCHOR: [AUTO] promptfoo scorer entry point — called for each eval test case
// @MX:REASON: external integration boundary with promptfoo eval harness
export default async function score(
  output: string,
  _context: { vars: Record<string, string>; prompt: string },
): Promise<ScorerResult> {
  if (HIGH_CONFIDENCE_PATTERN.test(output)) {
    return {
      pass: true,
      score: 1.0,
      reason: 'Output contains high confidence indicator.',
    };
  }

  if (MEDIUM_CONFIDENCE_PATTERN.test(output)) {
    return {
      pass: true,
      score: 0.8,
      reason: 'Output contains medium confidence indicator.',
    };
  }

  if (LOW_CONFIDENCE_PATTERN.test(output)) {
    return {
      pass: true,
      score: 0.6,
      reason: 'Output contains low confidence indicator (acceptable).',
    };
  }

  if (ANY_CONFIDENCE_PATTERN.test(output)) {
    return {
      pass: true,
      score: 0.5,
      reason: 'Output contains a general confidence-related term.',
    };
  }

  // No confidence indicator — soft fail (score 0.3, not a hard failure)
  return {
    pass: false,
    score: 0.3,
    reason:
      'Output does not contain any confidence level indicator. Expected phrases like "high confidence" or "low confidence".',
  };
}
