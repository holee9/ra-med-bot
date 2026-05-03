// @MX:ANCHOR [AUTO] Expert review auto-flag logic — single gating function for Phase C.
// @MX:REASON shouldAutoFlag is called from consult.ts Phase C and tested via
// expert-review-gating.test.ts. fan_in >= 3 expected when reporting pipelines added.
// @MX:SPEC SPEC-REGULA-ENTERPRISE-001 (REQ-ENTERPRISE-008)

import { detectPolicyKeyword } from './policy-keywords';

/**
 * Result of the auto-flag gating check.
 */
export interface FlagResult {
  flag: boolean;
  reason: string | null;
}

/**
 * Determines whether the consult response should be automatically flagged
 * for expert review.
 *
 * Priority:
 *  1. Low confidence score (< 0.7)
 *  2. Policy keyword detection
 *
 * @param confidenceScore - Numeric confidence score from the RAG pipeline.
 * @param question - The user's original question string.
 * @param prose - The generated prose answer to scan for policy keywords.
 * @returns FlagResult with flag and reason.
 */
export function shouldAutoFlag(
  confidenceScore: number,
  question: string,
  prose: string,
): FlagResult {
  // Priority 1: low confidence
  if (confidenceScore < 0.7) {
    return {
      flag: true,
      reason: `confidence score ${confidenceScore.toFixed(2)} < 0.7`,
    };
  }

  // Priority 2: policy keyword detection
  const keyword = detectPolicyKeyword(question, prose);
  if (keyword !== null) {
    return {
      flag: true,
      reason: `policy keyword: ${keyword}`,
    };
  }

  return { flag: false, reason: null };
}
