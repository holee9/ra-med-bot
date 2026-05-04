// @MX:ANCHOR: [AUTO] aggregateScores — confidence aggregation for 21 CFR Part 11 audit trail
// @MX:REASON: fan_in >= 3: submission_drafter, audit_response, indication_impact workflows all call this

export class InvalidScoreError extends Error {
  constructor(score: number) {
    super(`Score must be in [0, 1] range, got: ${score}`);
    this.name = 'InvalidScoreError';
  }
}

export class InvalidWeightError extends Error {
  constructor(weight: number) {
    super(`Weight must be > 0, got: ${weight}`);
    this.name = 'InvalidWeightError';
  }
}

export interface ConfidenceScore {
  /** Identifier of the LLM or scoring source. */
  source: string;
  /** Score in range [0.0, 1.0]. */
  score: number;
  /** Relative weight for aggregation. Must be > 0. */
  weight: number;
}

/**
 * Computes the weighted average of confidence scores.
 * Returns 0 for an empty array.
 * Throws InvalidScoreError if any score is outside [0, 1].
 * Throws InvalidWeightError if any weight is <= 0.
 */
export function aggregateScores(scores: ConfidenceScore[]): number {
  if (scores.length === 0) return 0;

  for (const s of scores) {
    if (s.score < 0 || s.score > 1) throw new InvalidScoreError(s.score);
    if (s.weight <= 0) throw new InvalidWeightError(s.weight);
  }

  const totalWeight = scores.reduce((sum, s) => sum + s.weight, 0);
  const weightedSum = scores.reduce((sum, s) => sum + s.score * s.weight, 0);
  return weightedSum / totalWeight;
}

/**
 * Classifies a numeric confidence score into a tier.
 * high >= 0.8, medium >= 0.5, low < 0.5
 */
export function classifyConfidence(score: number): 'high' | 'medium' | 'low' {
  if (score >= 0.8) return 'high';
  if (score >= 0.5) return 'medium';
  return 'low';
}

/**
 * Returns true if the aggregated score falls below the threshold,
 * indicating that human review is required.
 * Default threshold is 0.7 (21 CFR Part 11 compliance gate).
 */
export function requiresHumanReview(scores: ConfidenceScore[], threshold = 0.7): boolean {
  return aggregateScores(scores) < threshold;
}
