// @MX:NOTE Confidence calculation — chunk score + citation coverage based 0.0~1.0.
// @MX:SPEC SPEC-REGULA-CHAT-001 (REQ-CHAT-055)

/**
 * Input parameters for confidence calculation.
 */
export interface ConfidenceInput {
  /** Combined scores (vec + fts hybrid) for top-K retrieved chunks. */
  chunkScores: number[];
  /** Number of sentences with at least one citation. */
  citedCount: number;
  /** Total number of sentences in prose. */
  totalSentences: number;
}

/**
 * Calculate a confidence score in [0, 1] from chunk similarity and citation coverage.
 *
 * Formula:
 *   chunkWeight = 0.6
 *   citationWeight = 0.4
 *   avgChunkScore = mean(chunkScores) or 0
 *   citationCoverage = citedCount / totalSentences or 0
 *   confidence = chunkWeight * avgChunkScore + citationWeight * citationCoverage
 */
export function calculateConfidence(input: ConfidenceInput): number {
  const { chunkScores, citedCount, totalSentences } = input;

  if (chunkScores.length === 0) return 0;

  const avgChunkScore = chunkScores.reduce((sum, s) => sum + s, 0) / chunkScores.length;

  const citationCoverage = totalSentences === 0 ? 0 : Math.min(citedCount / totalSentences, 1.0);

  const score = 0.6 * avgChunkScore + 0.4 * citationCoverage;
  return Math.min(Math.max(score, 0), 1);
}

/**
 * Map a numeric confidence score to a categorical level.
 * - high: score >= 0.8
 * - med: score >= 0.5
 * - low: score < 0.5
 */
export function getConfidenceLevel(score: number): 'high' | 'med' | 'low' {
  if (score >= 0.8) return 'high';
  if (score >= 0.5) return 'med';
  return 'low';
}
