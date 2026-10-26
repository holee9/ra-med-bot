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
 * Confidence threshold below which a consult is auto-flagged for expert review.
 *
 * Recalibrated 2026-10-19 (#538): the original 0.7 was authored against the
 * E2E-test-mode fixture (citation coverage 0.92) and never validated against
 * real gpt-oss answers. Measured live distribution under the recalibrated
 * score (0.35*vec + 0.65*citation-coverage): strongly-grounded answers land
 * at 0.62–0.69, irrelevant-question answers at ~0.12. A 0.6 threshold
 * separates the two populations with margin in BOTH directions, keeping the
 * gate conservative (borderline answers still go to review).
 */
export const EXPERT_REVIEW_CONFIDENCE_THRESHOLD = 0.6;

/**
 * Determines whether the consult response should be automatically flagged
 * for expert review.
 *
 * Priority:
 *  1. Low confidence score (< EXPERT_REVIEW_CONFIDENCE_THRESHOLD)
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
  if (confidenceScore < EXPERT_REVIEW_CONFIDENCE_THRESHOLD) {
    return {
      flag: true,
      reason: `confidence score ${confidenceScore.toFixed(2)} < ${EXPERT_REVIEW_CONFIDENCE_THRESHOLD}`,
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
