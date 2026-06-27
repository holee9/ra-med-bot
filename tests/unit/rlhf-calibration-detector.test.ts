// @MX:NOTE [AUTO] Pure-function tests for calibration-detector.ts.
// @MX:SPEC SPEC-REGULA-RLHF-001 (Issue #264 sub-PR 2/3, REQ-RLHF-005/006)
// @MX:REASON The detector is pure (no DB) — these tests cover the four key
//           cases: overconfident, underconfident, well-calibrated, and
//           insufficient-sample. Mirrors the discipline of feedback-aggregator
//           tests (pure deterministic inputs/outputs).

import {
  CONFIDENCE_BUCKETS,
  type ConfidenceFeedbackSample,
  DEFAULT_DETECTION_THRESHOLDS,
  aggregateConfidenceFeedback,
  bucketForConfidence,
  classifyBucket,
  detectCalibrationCandidates,
} from '@/lib/rlhf/calibration-detector';
import { describe, expect, it } from 'vitest';

describe('bucketForConfidence', () => {
  it('maps scores to the correct half-open bucket label', () => {
    expect(bucketForConfidence(0.0)).toBe('0.0-0.2');
    expect(bucketForConfidence(0.19)).toBe('0.0-0.2');
    expect(bucketForConfidence(0.2)).toBe('0.2-0.4');
    expect(bucketForConfidence(0.65)).toBe('0.6-0.8');
    expect(bucketForConfidence(0.79)).toBe('0.6-0.8');
    expect(bucketForConfidence(0.8)).toBe('0.8-1.0');
    expect(bucketForConfidence(1.0)).toBe('0.8-1.0'); // top bucket closed
  });

  it('returns null for scores outside [0, 1]', () => {
    expect(bucketForConfidence(-0.1)).toBeNull();
    expect(bucketForConfidence(1.5)).toBeNull();
  });

  it('exposes a canonical CONFIDENCE_BUCKETS list aligned with the 0.7 floor', () => {
    // The 0.7 floor (DEFAULT_CONFIDENCE_FLOOR) sits at the boundary between
    // 0.6-0.8 bucket midpoint region — drift across it is directly visible.
    expect(CONFIDENCE_BUCKETS).toHaveLength(5);
    const labels = CONFIDENCE_BUCKETS.map((b) => b.label);
    expect(labels).toContain('0.6-0.8');
    expect(labels).toContain('0.8-1.0');
  });
});

describe('aggregateConfidenceFeedback (REQ-RLHF-005)', () => {
  it('returns an empty array when there are no samples', () => {
    expect(aggregateConfidenceFeedback([])).toEqual([]);
  });

  it('drops samples with null confidence (no bucket)', () => {
    const samples: ConfidenceFeedbackSample[] = [
      { confidence: null, rating: 'up' },
      { confidence: 0.75, rating: 'up' },
    ];
    const out = aggregateConfidenceFeedback(samples);
    expect(out).toHaveLength(1);
    expect(out[0]?.confidenceBucket).toBe('0.6-0.8');
    expect(out[0]?.sampleSize).toBe(1);
    expect(out[0]?.observedUpRatio).toBe(1);
  });

  it('computes observed up-ratio, sample size, and midpoint per bucket', () => {
    // 0.6-0.8 bucket: 3 up, 1 down -> ratio 0.75, midpoint 0.7
    const samples: ConfidenceFeedbackSample[] = [
      { confidence: 0.7, rating: 'up' },
      { confidence: 0.72, rating: 'up' },
      { confidence: 0.78, rating: 'up' },
      { confidence: 0.75, rating: 'down' },
    ];
    const out = aggregateConfidenceFeedback(samples);
    const bucket = out.find((b) => b.confidenceBucket === '0.6-0.8');
    expect(bucket).toBeDefined();
    expect(bucket?.sampleSize).toBe(4);
    expect(bucket?.upCount).toBe(3);
    expect(bucket?.downCount).toBe(1);
    expect(bucket?.observedUpRatio).toBe(0.75);
    expect(bucket?.bucketMidpoint).toBe(0.7);
  });

  it('omits buckets with zero samples', () => {
    const samples: ConfidenceFeedbackSample[] = [{ confidence: 0.95, rating: 'up' }];
    const out = aggregateConfidenceFeedback(samples);
    expect(out).toHaveLength(1);
    expect(out[0]?.confidenceBucket).toBe('0.8-1.0');
  });
});

describe('classifyBucket (verdict logic)', () => {
  const thresholds = DEFAULT_DETECTION_THRESHOLDS;

  it('returns overconfident when observed up-ratio is materially below midpoint', () => {
    const agg = {
      confidenceBucket: '0.8-1.0',
      bucketMidpoint: 0.9,
      observedUpRatio: 0.5, // 0.4 below midpoint -> overconfident
      sampleSize: 10,
      upCount: 5,
      downCount: 5,
    };
    expect(classifyBucket(agg, thresholds)).toBe('overconfident');
  });

  it('returns underconfident when observed up-ratio is materially above midpoint', () => {
    const agg = {
      confidenceBucket: '0.0-0.2',
      bucketMidpoint: 0.1,
      observedUpRatio: 0.5, // 0.4 above midpoint -> underconfident
      sampleSize: 10,
      upCount: 5,
      downCount: 5,
    };
    expect(classifyBucket(agg, thresholds)).toBe('underconfident');
  });

  it('returns well_calibrated when within the tolerance band', () => {
    const agg = {
      confidenceBucket: '0.6-0.8',
      bucketMidpoint: 0.7,
      observedUpRatio: 0.65, // 0.05 deviation, within 0.15 tolerance
      sampleSize: 20,
      upCount: 13,
      downCount: 7,
    };
    expect(classifyBucket(agg, thresholds)).toBe('well_calibrated');
  });
});

describe('detectCalibrationCandidates (REQ-RLHF-006)', () => {
  it('returns an overconfident candidate when a high-confidence bucket is downvoted', () => {
    // 0.8-1.0 bucket, midpoint 0.9. All 6 down -> observed ratio 0.0,
    // delta = -0.9 (overconfident), sampleSize 6 >= min 5.
    const samples: ConfidenceFeedbackSample[] = [
      { confidence: 0.9, rating: 'down' },
      { confidence: 0.85, rating: 'down' },
      { confidence: 0.95, rating: 'down' },
      { confidence: 0.88, rating: 'down' },
      { confidence: 0.92, rating: 'down' },
      { confidence: 0.97, rating: 'down' },
    ];
    const candidates = detectCalibrationCandidates(samples);
    expect(candidates).toHaveLength(1);
    expect(candidates[0]?.confidenceBucket).toBe('0.8-1.0');
    expect(candidates[0]?.verdict).toBe('overconfident');
    expect(candidates[0]?.sampleSize).toBe(6);
    expect(candidates[0]?.observedUpRatio).toBe(0);
  });

  it('returns an underconfident candidate when a low-confidence bucket is upvoted', () => {
    // 0.0-0.2 bucket, midpoint 0.1. All 5 up -> observed ratio 1.0,
    // delta = +0.9 (underconfident), sampleSize 5 >= min 5.
    const samples: ConfidenceFeedbackSample[] = [
      { confidence: 0.05, rating: 'up' },
      { confidence: 0.1, rating: 'up' },
      { confidence: 0.15, rating: 'up' },
      { confidence: 0.02, rating: 'up' },
      { confidence: 0.18, rating: 'up' },
    ];
    const candidates = detectCalibrationCandidates(samples);
    expect(candidates).toHaveLength(1);
    expect(candidates[0]?.confidenceBucket).toBe('0.0-0.2');
    expect(candidates[0]?.verdict).toBe('underconfident');
  });

  it('returns NO candidate for a well-calibrated bucket', () => {
    // 0.6-0.8 bucket, midpoint 0.7. 7 up / 3 down -> ratio 0.7, delta 0.
    const samples: ConfidenceFeedbackSample[] = [
      { confidence: 0.7, rating: 'up' },
      { confidence: 0.72, rating: 'up' },
      { confidence: 0.75, rating: 'up' },
      { confidence: 0.78, rating: 'up' },
      { confidence: 0.71, rating: 'up' },
      { confidence: 0.73, rating: 'up' },
      { confidence: 0.77, rating: 'up' },
      { confidence: 0.74, rating: 'down' },
      { confidence: 0.76, rating: 'down' },
      { confidence: 0.79, rating: 'down' },
    ];
    const candidates = detectCalibrationCandidates(samples);
    expect(candidates).toEqual([]);
  });

  it('returns NO candidate when sample size is below the minimum', () => {
    // 0.8-1.0 bucket, 2 down (overconfident pattern) but sampleSize 2 < 5.
    const samples: ConfidenceFeedbackSample[] = [
      { confidence: 0.9, rating: 'down' },
      { confidence: 0.85, rating: 'down' },
    ];
    const candidates = detectCalibrationCandidates(samples);
    expect(candidates).toEqual([]);
  });

  it('respects overridden thresholds', () => {
    // With minSampleSize=2 + maxTolerance=0.05, the 2-sample overconfident
    // case above now qualifies (delta -0.9 > 0.05).
    const samples: ConfidenceFeedbackSample[] = [
      { confidence: 0.9, rating: 'down' },
      { confidence: 0.85, rating: 'down' },
    ];
    const candidates = detectCalibrationCandidates(samples, {
      minSampleSize: 2,
      maxTolerance: 0.05,
    });
    expect(candidates).toHaveLength(1);
    expect(candidates[0]?.verdict).toBe('overconfident');
  });

  it('returns multiple candidates when several buckets are miscalibrated', () => {
    // 0.8-1.0 overconfident (5 down) AND 0.0-0.2 underconfident (5 up).
    const samples: ConfidenceFeedbackSample[] = [
      { confidence: 0.9, rating: 'down' },
      { confidence: 0.85, rating: 'down' },
      { confidence: 0.95, rating: 'down' },
      { confidence: 0.88, rating: 'down' },
      { confidence: 0.92, rating: 'down' },
      { confidence: 0.05, rating: 'up' },
      { confidence: 0.1, rating: 'up' },
      { confidence: 0.15, rating: 'up' },
      { confidence: 0.02, rating: 'up' },
      { confidence: 0.18, rating: 'up' },
    ];
    const candidates = detectCalibrationCandidates(samples);
    expect(candidates).toHaveLength(2);
    const verdicts = candidates.map((c) => c.verdict).sort();
    expect(verdicts).toEqual(['overconfident', 'underconfident']);
  });
});
