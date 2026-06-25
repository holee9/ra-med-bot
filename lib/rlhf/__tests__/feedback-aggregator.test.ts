import {
  TREND_WINDOW_DAYS,
  aggregateFeedback,
  computeMessageScore,
  dailyMeanSeries,
  detectDownwardTrend,
} from '@/lib/rlhf/feedback-aggregator';
// @MX:SPEC SPEC-REGULA-RLHF-001 (REQ-RLHF-005, REQ-RLHF-006)
import { describe, expect, it } from 'vitest';

function date(iso: string): Date {
  return new Date(iso);
}

describe('computeMessageScore (REQ-RLHF-005)', () => {
  it('returns 0 for empty input', () => {
    expect(computeMessageScore([])).toBe(0);
  });

  it('returns +1 for all up votes', () => {
    const records = [
      { rating: 'up' as const, createdAt: date('2026-06-01T00:00:00Z') },
      { rating: 'up' as const, createdAt: date('2026-06-02T00:00:00Z') },
    ];
    expect(computeMessageScore(records)).toBe(1);
  });

  it('returns -1 for all down votes', () => {
    const records = [
      { rating: 'down' as const, createdAt: date('2026-06-01T00:00:00Z') },
      { rating: 'down' as const, createdAt: date('2026-06-02T00:00:00Z') },
    ];
    expect(computeMessageScore(records)).toBe(-1);
  });

  it('returns 0 for balanced up/down', () => {
    const records = [
      { rating: 'up' as const, createdAt: date('2026-06-01T00:00:00Z') },
      { rating: 'down' as const, createdAt: date('2026-06-02T00:00:00Z') },
    ];
    expect(computeMessageScore(records)).toBe(0);
  });

  it('returns weighted mean for mixed votes', () => {
    // 3 up, 1 down -> (1+1+1-1)/4 = 0.5
    const records = [
      { rating: 'up' as const, createdAt: date('2026-06-01T00:00:00Z') },
      { rating: 'up' as const, createdAt: date('2026-06-02T00:00:00Z') },
      { rating: 'up' as const, createdAt: date('2026-06-03T00:00:00Z') },
      { rating: 'down' as const, createdAt: date('2026-06-04T00:00:00Z') },
    ];
    expect(computeMessageScore(records)).toBeCloseTo(0.5);
  });
});

describe('aggregateFeedback (REQ-RLHF-005)', () => {
  it('aggregates counts and mean score', () => {
    const records = [
      { rating: 'up' as const, createdAt: date('2026-06-01T00:00:00Z') },
      { rating: 'up' as const, createdAt: date('2026-06-02T00:00:00Z') },
      { rating: 'down' as const, createdAt: date('2026-06-03T00:00:00Z') },
    ];
    const agg = aggregateFeedback(records);
    expect(agg.total).toBe(3);
    expect(agg.upCount).toBe(2);
    expect(agg.downCount).toBe(1);
    expect(agg.meanScore).toBeCloseTo(0.333, 2);
  });

  it('handles empty input', () => {
    const agg = aggregateFeedback([]);
    expect(agg.total).toBe(0);
    expect(agg.upCount).toBe(0);
    expect(agg.downCount).toBe(0);
    expect(agg.meanScore).toBe(0);
  });
});

describe('dailyMeanSeries', () => {
  it('groups records by UTC day', () => {
    const records = [
      { rating: 'up' as const, createdAt: date('2026-06-01T10:00:00Z') },
      { rating: 'down' as const, createdAt: date('2026-06-01T22:00:00Z') },
      { rating: 'up' as const, createdAt: date('2026-06-02T05:00:00Z') },
    ];
    const series = dailyMeanSeries(records);
    expect(series).toHaveLength(2);
    // Day 1: 1 up + 1 down = 0
    expect(series[0]?.score).toBe(0);
    // Day 2: 1 up = 1
    expect(series[1]?.score).toBe(1);
  });

  it('sorts chronologically', () => {
    const records = [
      { rating: 'up' as const, createdAt: date('2026-06-03T00:00:00Z') },
      { rating: 'up' as const, createdAt: date('2026-06-01T00:00:00Z') },
    ];
    const series = dailyMeanSeries(records);
    expect(series[0]?.date.getUTCDate()).toBe(1);
    expect(series[1]?.date.getUTCDate()).toBe(3);
  });
});

describe('detectDownwardTrend (REQ-RLHF-006)', () => {
  it('returns stable when fewer than min points', () => {
    const records = [
      { rating: 'up' as const, createdAt: date('2026-06-01T00:00:00Z') },
      { rating: 'down' as const, createdAt: date('2026-06-02T00:00:00Z') },
    ];
    const result = detectDownwardTrend(records);
    expect(result.trend).toBe('stable');
  });

  it('detects a downward trend when scores decline over time', () => {
    // 3 days, each worse than the last.
    const records = [
      // Day 1: all up -> +1
      { rating: 'up' as const, createdAt: date('2026-06-01T00:00:00Z') },
      // Day 2: balanced -> 0
      { rating: 'up' as const, createdAt: date('2026-06-02T00:00:00Z') },
      { rating: 'down' as const, createdAt: date('2026-06-02T00:00:00Z') },
      // Day 3: all down -> -1
      { rating: 'down' as const, createdAt: date('2026-06-03T00:00:00Z') },
    ];
    const result = detectDownwardTrend(records);
    expect(result.trend).toBe('down');
    expect(result.slope).toBeLessThan(0);
  });

  it('returns stable when scores are flat', () => {
    const records = [
      { rating: 'up' as const, createdAt: date('2026-06-01T00:00:00Z') },
      { rating: 'up' as const, createdAt: date('2026-06-02T00:00:00Z') },
      { rating: 'up' as const, createdAt: date('2026-06-03T00:00:00Z') },
    ];
    const result = detectDownwardTrend(records);
    expect(result.trend).toBe('stable');
    expect(result.slope).toBe(0);
  });

  it('respects the configurable window size', () => {
    // Build 10 days of declining data, then use a 3-day window.
    const records: { rating: 'up' | 'down'; createdAt: Date }[] = [];
    for (let d = 1; d <= 10; d++) {
      // Days 1-5 all up, days 6-10 all down.
      const rating = d <= 5 ? 'up' : 'down';
      records.push({ rating, createdAt: date(`2026-06-${String(d).padStart(2, '0')}T00:00:00Z`) });
    }
    const result = detectDownwardTrend(records, { windowDays: 3, minPoints: 2 });
    // The trailing 3 days are all 'down', so slope should be 0 (flat at -1),
    // trend stable. But the broader dataset clearly declined. This test just
    // confirms the window is applied (only the last 3 days are in window).
    expect(result.window.length).toBeLessThanOrEqual(3);
  });

  it('TREND_WINDOW_DAYS is 7', () => {
    expect(TREND_WINDOW_DAYS).toBe(7);
  });
});
