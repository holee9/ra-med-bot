// @MX:NOTE [AUTO] feedback-aggregator.ts — pure functions for RLHF score aggregation.
// @MX:SPEC SPEC-REGULA-RLHF-001 (REQ-RLHF-005, REQ-RLHF-006)
// @MX:REASON Pure, deterministic functions with no I/O deps so they are trivially
//           testable and reusable from both the heatmap route and the trend detector.

/**
 * Minimal shape of a feedback record needed for aggregation. The full row lives
 * in `answer_feedback` (lib/db/schema.ts); callers project to this shape.
 */
export interface FeedbackRecord {
  rating: 'up' | 'down';
  createdAt: Date;
}

/**
 * A single (timestamp, score) datapoint used by the trend detector.
 */
export interface ScoreDatapoint {
  date: Date;
  score: number;
}

/** Up votes map to +1, down votes to -1 (REQ-RLHF-005). */
const RATING_WEIGHT: Record<'up' | 'down', number> = { up: 1, down: -1 };

/**
 * REQ-RLHF-005: compute the mean feedback score for a set of records.
 * Returns 0 for an empty set (no division-by-zero). Range: [-1.0, +1.0].
 *
 * @MX:ANCHOR [AUTO] computeMessageScore — mean of up/down ratings per message.
 * @MX:REASON Consumed by the heatmap route, the aggregate route, and the trend
 *           detector. fan_in >= 3 expected.
 */
export function computeMessageScore(records: readonly FeedbackRecord[]): number {
  if (records.length === 0) return 0;
  const sum = records.reduce((acc, r) => acc + RATING_WEIGHT[r.rating], 0);
  return sum / records.length;
}

/**
 * REQ-RLHF-005: aggregate feedback into a summary shape suitable for the API
 * (mean score, counts, breakdown).
 */
export function aggregateFeedback(records: readonly FeedbackRecord[]): {
  meanScore: number;
  total: number;
  upCount: number;
  downCount: number;
} {
  const upCount = records.filter((r) => r.rating === 'up').length;
  const downCount = records.length - upCount;
  return {
    meanScore: computeMessageScore(records),
    total: records.length,
    upCount,
    downCount,
  };
}

/**
 * Compute the daily mean score series for a set of records (one datapoint per
 * calendar day that has at least one record). Used by detectDownwardTrend and
 * the heatmap route.
 */
export function dailyMeanSeries(records: readonly FeedbackRecord[]): ScoreDatapoint[] {
  if (records.length === 0) return [];
  const buckets = new Map<string, FeedbackRecord[]>();
  for (const r of records) {
    const d = r.createdAt;
    const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(
      d.getUTCDate(),
    ).padStart(2, '0')}`;
    const arr = buckets.get(key) ?? [];
    arr.push(r);
    buckets.set(key, arr);
  }
  const series: ScoreDatapoint[] = [];
  for (const [key, bucket] of buckets) {
    series.push({ date: new Date(`${key}T00:00:00.000Z`), score: computeMessageScore(bucket) });
  }
  series.sort((a, b) => a.date.getTime() - b.date.getTime());
  return series;
}

/** Sliding-window size (days) for downward-trend detection (REQ-RLHF-006). */
export const TREND_WINDOW_DAYS = 7;
/** Minimum datapoints required before a trend is reported (avoids noise). */
export const TREND_MIN_POINTS = 3;

/**
 * REQ-RLHF-006: detect a downward trend in the most recent feedback scores.
 *
 * Algorithm: take the daily mean series, look at the trailing
 * `TREND_WINDOW_DAYS` window, fit a least-squares slope, and flag a downward
 * trend when the slope is negative AND there are at least `TREND_MIN_POINTS`
 * datapoints in the window.
 *
 * @returns `{ trend: 'down' | 'stable'; slope: number; window: ScoreDatapoint[] }`
 */
export function detectDownwardTrend(
  records: readonly FeedbackRecord[],
  opts: { windowDays?: number; minPoints?: number } = {},
): { trend: 'down' | 'stable'; slope: number; window: ScoreDatapoint[] } {
  const windowDays = opts.windowDays ?? TREND_WINDOW_DAYS;
  const minPoints = opts.minPoints ?? TREND_MIN_POINTS;

  const series = dailyMeanSeries(records);
  if (series.length < minPoints) {
    return { trend: 'stable', slope: 0, window: series.slice(-windowDays) };
  }

  const window = series.slice(-windowDays);
  if (window.length < minPoints) {
    return { trend: 'stable', slope: 0, window };
  }

  // Least-squares slope over (dayIndex, score).
  const n = window.length;
  const xs = window.map((_, i) => i);
  const ys = window.map((d) => d.score);
  const xMean = xs.reduce((a, b) => a + b, 0) / n;
  const yMean = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    // xs/ys are dense arrays from window.map; guard the index for type safety.
    const x = xs[i] ?? 0;
    const y = ys[i] ?? 0;
    num += (x - xMean) * (y - yMean);
    den += (x - xMean) ** 2;
  }
  const slope = den === 0 ? 0 : num / den;

  return {
    trend: slope < 0 ? 'down' : 'stable',
    slope,
    window,
  };
}
