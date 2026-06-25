import {
  DEFAULT_FEEDBACK_LAMBDA,
  type RerankableResult,
  applyReranking,
  computeFeedbackWeight,
} from '@/lib/rlhf/reranker';
// @MX:SPEC SPEC-REGULA-RLHF-001 (REQ-RLHF-009, REQ-RLHF-010, AC-05)
import { describe, expect, it } from 'vitest';

describe('computeFeedbackWeight (REQ-RLHF-010)', () => {
  it('returns the base score when feedbackScore is 0/null', () => {
    expect(computeFeedbackWeight(0.8, 0)).toBeCloseTo(0.8 * (1 - DEFAULT_FEEDBACK_LAMBDA));
    expect(computeFeedbackWeight(0.8, null)).toBeCloseTo(0.8 * (1 - DEFAULT_FEEDBACK_LAMBDA));
    expect(computeFeedbackWeight(0.8, undefined)).toBeCloseTo(0.8 * (1 - DEFAULT_FEEDBACK_LAMBDA));
  });

  it('boosts score when feedback is positive (tanh normalizes)', () => {
    const base = 0.5;
    const noFeedback = computeFeedbackWeight(base, 0);
    const positiveFeedback = computeFeedbackWeight(base, 5);
    expect(positiveFeedback).toBeGreaterThan(noFeedback);
  });

  it('suppresses score when feedback is negative', () => {
    const base = 0.9;
    const noFeedback = computeFeedbackWeight(base, 0);
    const negativeFeedback = computeFeedbackWeight(base, -5);
    expect(negativeFeedback).toBeLessThan(noFeedback);
  });

  it('clamps via tanh so a huge feedback value cannot dominate', () => {
    // tanh(100) ~= 1, tanh(1000) ~= 1 — same blended score.
    const a = computeFeedbackWeight(0.5, 100);
    const b = computeFeedbackWeight(0.5, 1000);
    expect(a).toBeCloseTo(b, 5);
  });

  it('respects the lambda knob (lambda=0 disables feedback influence)', () => {
    expect(computeFeedbackWeight(0.7, 10, 0)).toBeCloseTo(0.7);
  });

  it('lambda=1 makes the blended score purely feedback-driven', () => {
    // tanh(0.5) ~= 0.4621
    expect(computeFeedbackWeight(0.99, 0.5, 1)).toBeCloseTo(Math.tanh(0.5), 4);
  });
});

describe('applyReranking (REQ-RLHF-010, AC-05)', () => {
  type R = RerankableResult & { label: string };

  it('preserves order when all feedback scores are equal', () => {
    const results: R[] = [
      { label: 'a', sourceSectionId: 's1', score: 0.9 },
      { label: 'b', sourceSectionId: 's2', score: 0.5 },
      { label: 'c', sourceSectionId: 's3', score: 0.3 },
    ];
    const scores = { s1: 0, s2: 0, s3: 0 };
    const out = applyReranking(results, scores);
    expect(out.map((r) => r.label)).toEqual(['a', 'b', 'c']);
    expect(out[0]?.label).toBe('a');
  });

  it('boosts high-feedback sections above higher-base sections', () => {
    // Realistic numbers: base scores are close (0.50 vs 0.45) so the strong
    // positive feedback (tanh -> ~1) on s2 overtakes s1 under lambda=0.2.
    // s1: 0.8*0.50 + 0.2*0 = 0.40 ; s2: 0.8*0.45 + 0.2*1.0 = 0.56 -> s2 wins.
    const results: R[] = [
      { label: 'highBase_lowFb', sourceSectionId: 's1', score: 0.5 },
      { label: 'lowBase_highFb', sourceSectionId: 's2', score: 0.45 },
    ];
    const scores = { s1: 0, s2: 10 };
    const out = applyReranking(results, scores);
    expect(out[0]?.label).toBe('lowBase_highFb');
  });

  it('suppresses negative-feedback sections below lower-base sections', () => {
    // s1: 0.8*0.50 + 0.2*tanh(-10)=0.40 - 0.20 = 0.20 ;
    // s2: 0.8*0.45 + 0.2*0 = 0.36 -> s2 wins.
    const results: R[] = [
      { label: 'highBase_negFb', sourceSectionId: 's1', score: 0.5 },
      { label: 'lowBase_noFb', sourceSectionId: 's2', score: 0.45 },
    ];
    const scores = { s1: -10, s2: 0 };
    const out = applyReranking(results, scores);
    expect(out[0]?.label).toBe('lowBase_noFb');
  });

  it('does not mutate the input array', () => {
    const results: R[] = [
      { label: 'a', sourceSectionId: 's1', score: 0.5 },
      { label: 'b', sourceSectionId: 's2', score: 0.5 },
    ];
    const snapshot = results.map((r) => ({ ...r }));
    applyReranking(results, { s1: 5, s2: -5 });
    expect(results).toEqual(snapshot);
  });

  it('handles results without a sourceSectionId (neutral feedback)', () => {
    const results: R[] = [
      { label: 'noSection', score: 0.5 },
      { label: 'withSection', sourceSectionId: 's1', score: 0.5 },
    ];
    const scores = { s1: 10 };
    const out = applyReranking(results, scores);
    expect(out[0]?.label).toBe('withSection');
  });

  it('DEFAULT_FEEDBACK_LAMBDA is 0.2', () => {
    expect(DEFAULT_FEEDBACK_LAMBDA).toBe(0.2);
  });
});
