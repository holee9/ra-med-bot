// @MX:NOTE [AUTO] calibration-detector.ts — pure functions for confidence
// calibration detection (REQ-RLHF-005 aggregate, REQ-RLHF-006 trend).
// @MX:SPEC SPEC-REGULA-RLHF-001 (Issue #264 sub-PR 2/3, REQ-RLHF-005/006/014/015)
// @MX:REASON Pure, deterministic functions with no I/O deps so they are
//           trivially testable and reusable from the API route and (future)
//           daily-digest cron. Mirrors feedback-aggregator.ts discipline.
//
// Calibration semantics:
//   The system emits a confidenceScore per answer (messages.confidence_score).
//   Users submit answer_feedback (rating up/down). A confidence bucket that is
//   consistently downvoted is "overconfident"; consistently upvoted is
//   "underconfident". This module measures that gap and surfaces candidates.
//
// Charter [지양-2] / [지양-4]: detection ONLY. No Platt scaling, no isotonic
// regression, no learned mapping applied to scores — that math is pointless
// here because auto-application is forbidden. The output is a candidate row
// for human review, nothing more.

/**
 * Minimal shape of a (confidence, rating) sample needed for aggregation.
 * Callers project from messages + answer_feedback rows to this shape.
 */
export interface ConfidenceFeedbackSample {
  /** Emitted confidence for the answer, in [0, 1]. May be null if unrecorded. */
  confidence: number | null;
  rating: 'up' | 'down';
}

/**
 * Canonical confidence buckets (half-open intervals). The label is stored
 * verbatim in calibration_candidates.confidence_bucket so candidate rows are
 * human-readable in audit + dashboards. Buckets are aligned with
 * DEFAULT_CONFIDENCE_FLOOR (0.7) from post-rerank-gate.ts — the floor sits at
 * the boundary between the '0.6-0.7' and '0.7-0.8' buckets, so calibration
 * drift across the safety threshold is directly visible.
 */
export const CONFIDENCE_BUCKETS = [
  { label: '0.0-0.2', lo: 0.0, hi: 0.2 },
  { label: '0.2-0.4', lo: 0.2, hi: 0.4 },
  { label: '0.4-0.6', lo: 0.4, hi: 0.6 },
  { label: '0.6-0.8', lo: 0.6, hi: 0.8 },
  { label: '0.8-1.0', lo: 0.8, hi: 1.0001 }, // closed on top to include 1.0
] as const;

/**
 * Resolve a confidence score to its bucket label. Returns null for scores
 * outside [0, 1] (treated as missing — unbucketed).
 */
export function bucketForConfidence(confidence: number): string | null {
  if (confidence < 0 || confidence > 1) return null;
  for (const b of CONFIDENCE_BUCKETS) {
    if (confidence >= b.lo && confidence < b.hi) return b.label;
  }
  return null;
}

/**
 * Per-bucket aggregate result. One per bucket that has at least one sample.
 */
export interface ConfidenceBucketAggregate {
  confidenceBucket: string;
  /** Midpoint of the bucket interval — the "expected" up-ratio if calibrated. */
  bucketMidpoint: number;
  /** Observed up-vote ratio in [0, 1]. */
  observedUpRatio: number;
  sampleSize: number;
  upCount: number;
  downCount: number;
}

/**
 * REQ-RLHF-005: aggregate (confidence, rating) samples into per-bucket
 * up-ratio statistics. Samples with null confidence are dropped (no bucket).
 *
 * @MX:NOTE [AUTO] aggregateConfidenceFeedback — pure aggregation, no DB.
 */
export function aggregateConfidenceFeedback(
  samples: readonly ConfidenceFeedbackSample[],
): ConfidenceBucketAggregate[] {
  // Bucket the samples.
  const buckets = new Map<string, { up: number; down: number; midpoint: number }>();
  for (const b of CONFIDENCE_BUCKETS) {
    buckets.set(b.label, { up: 0, down: 0, midpoint: (b.lo + Math.min(b.hi, 1)) / 2 });
  }

  for (const s of samples) {
    if (s.confidence === null) continue;
    const label = bucketForConfidence(s.confidence);
    if (label === null) continue;
    const entry = buckets.get(label);
    if (!entry) continue;
    if (s.rating === 'up') entry.up += 1;
    else entry.down += 1;
  }

  const out: ConfidenceBucketAggregate[] = [];
  for (const [label, entry] of buckets) {
    const total = entry.up + entry.down;
    if (total === 0) continue; // omit empty buckets
    out.push({
      confidenceBucket: label,
      bucketMidpoint: round3(entry.midpoint),
      observedUpRatio: round3(entry.up / total),
      sampleSize: total,
      upCount: entry.up,
      downCount: entry.down,
    });
  }
  return out;
}

/**
 * Detection verdict for a single bucket.
 *   overconfident    — emitted confidence exceeds observed accuracy
 *                      (observed up-ratio materially below bucket midpoint)
 *   underconfident   — emitted confidence is materially below observed accuracy
 *                      (observed up-ratio above bucket midpoint)
 *   well_calibrated  — within the tolerance band
 */
export type CalibrationVerdict = 'overconfident' | 'underconfident' | 'well_calibrated';

/**
 * A candidate proposed by the detector. Overconfident / underconfident
 * buckets with enough samples become candidates; well-calibrated buckets do
 * not (the caller may still surface them in an aggregate view).
 */
export interface CalibrationCandidateInput {
  confidenceBucket: string;
  bucketMidpoint: number;
  observedUpRatio: number;
  sampleSize: number;
  verdict: CalibrationVerdict;
}

/** Detection thresholds (defaults; overridable by the caller for tuning). */
export interface DetectionThresholds {
  /** Minimum samples in a bucket before a candidate is proposed (avoids noise). */
  minSampleSize: number;
  /**
   * Maximum tolerated |observedUpRatio - bucketMidpoint| before the bucket is
   * flagged. 0.15 means a bucket whose observed up-ratio deviates by more than
   * 15 percentage points from its midpoint is a candidate.
   */
  maxTolerance: number;
}

export const DEFAULT_DETECTION_THRESHOLDS: DetectionThresholds = {
  minSampleSize: 5,
  maxTolerance: 0.15,
};

/**
 * Classify a single bucket aggregate into a verdict.
 *
 * @MX:NOTE [AUTO] classifyBucket — pure verdict function.
 */
export function classifyBucket(
  agg: ConfidenceBucketAggregate,
  thresholds: DetectionThresholds = DEFAULT_DETECTION_THRESHOLDS,
): CalibrationVerdict {
  const delta = agg.observedUpRatio - agg.bucketMidpoint;
  if (delta < -thresholds.maxTolerance) return 'overconfident';
  if (delta > thresholds.maxTolerance) return 'underconfident';
  return 'well_calibrated';
}

/**
 * REQ-RLHF-006: detect calibration candidates from aggregated samples. Returns
 * the buckets whose verdict is overconfident or underconfident AND whose
 * sample size meets the minimum. Well-calibrated buckets are omitted from the
 * candidate list (but the caller can call aggregateConfidenceFeedback +
 * classifyBucket separately to surface them in a dashboard view).
 *
 * Pure: no DB. The caller persists candidates via calibration-proposal.ts.
 *
 * @MX:ANCHOR [AUTO] detectCalibrationCandidates — detector entry point.
 * @MX:REASON Consumed by the calibration API route and (future) digest cron.
 *           fan_in expected to reach 3+.
 */
export function detectCalibrationCandidates(
  samples: readonly ConfidenceFeedbackSample[],
  opts: Partial<DetectionThresholds> = {},
): CalibrationCandidateInput[] {
  const thresholds = { ...DEFAULT_DETECTION_THRESHOLDS, ...opts };
  const aggregates = aggregateConfidenceFeedback(samples);

  const candidates: CalibrationCandidateInput[] = [];
  for (const agg of aggregates) {
    if (agg.sampleSize < thresholds.minSampleSize) continue;
    const verdict = classifyBucket(agg, thresholds);
    if (verdict === 'well_calibrated') continue;
    candidates.push({
      confidenceBucket: agg.confidenceBucket,
      bucketMidpoint: agg.bucketMidpoint,
      observedUpRatio: agg.observedUpRatio,
      sampleSize: agg.sampleSize,
      verdict,
    });
  }
  return candidates;
}

/** Round to 3 decimal places (matches numeric(4,3) column precision). */
function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}
