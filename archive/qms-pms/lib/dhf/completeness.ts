// @MX:ANCHOR [AUTO] DHF completeness score algorithm — pure function, no DB/env deps.
// @MX:REASON fan_in >= 3: completeness route, tests, DHFDetail component all import this.

// @MX:LEGACY archived from lib
// @MX:SPEC SPEC-REGULA-DHF-001

/** Completeness score breakdown — each key is an achieved criterion with its point value. */
export interface CompletenessResult {
  score: number;
  breakdown: Record<string, number>;
}

/**
 * Compute DHF completeness score (0–100).
 *
 * Algorithm:
 *   +10  has device description (intended_use length >= 10)
 *   +15  has >= 3 design inputs
 *   +10  has user_need type inputs
 *   +10  has regulatory type inputs
 *   +15  has >= 1 verification
 *   +10  all verifications have a result
 *   +15  has a design review with approved_by
 *   +5   has preliminary review
 *   +5   has critical review
 *   +5   has final review
 * Max: 100
 */
export function computeCompleteness(
  dhf: { intendedUse: string },
  inputs: Array<{ inputType: string }>,
  verifications: Array<{ result: string | null }>,
  reviews: Array<{ reviewStage: string; approvedBy: string | null }>,
): CompletenessResult {
  const breakdown: Record<string, number> = {};
  let score = 0;

  if (dhf.intendedUse && dhf.intendedUse.length >= 10) {
    breakdown.has_device_description = 10;
    score += 10;
  }
  if (inputs.length >= 3) {
    breakdown.has_3_or_more_inputs = 15;
    score += 15;
  }
  if (inputs.some((i) => i.inputType === 'user_need')) {
    breakdown.has_user_need_inputs = 10;
    score += 10;
  }
  if (inputs.some((i) => i.inputType === 'regulatory')) {
    breakdown.has_regulatory_inputs = 10;
    score += 10;
  }
  if (verifications.length >= 1) {
    breakdown.has_verification = 15;
    score += 15;
  }
  if (verifications.length > 0 && verifications.every((v) => v.result !== null)) {
    breakdown.all_verifications_have_result = 10;
    score += 10;
  }
  if (reviews.some((r) => r.approvedBy)) {
    breakdown.has_approved_review = 15;
    score += 15;
  }
  if (reviews.some((r) => r.reviewStage === 'preliminary')) {
    breakdown.has_preliminary_review = 5;
    score += 5;
  }
  if (reviews.some((r) => r.reviewStage === 'critical')) {
    breakdown.has_critical_review = 5;
    score += 5;
  }
  if (reviews.some((r) => r.reviewStage === 'final')) {
    breakdown.has_final_review = 5;
    score += 5;
  }

  return { score, breakdown };
}
