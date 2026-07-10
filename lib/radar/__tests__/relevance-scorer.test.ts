// @MX:NOTE [AUTO] Unit tests for shouldBundleAsDigest (coverage 402).
// @MX:SPEC SPEC-REGULA-RADAR-001 (alert fatigue detection)

import { describe, expect, it } from 'vitest';
import { shouldBundleAsDigest } from '../relevance-scorer';

const NOW = new Date('2026-07-10T00:00:00Z');
function daysAgo(n: number): Date {
  const d = new Date(NOW);
  d.setDate(d.getDate() - n);
  return d;
}

describe('shouldBundleAsDigest (alert fatigue: 3+ same source+category in 7 days)', () => {
  it('returns false when recentAlerts is empty', () => {
    expect(
      shouldBundleAsDigest({
        source_crawler: 'fda',
        product_category: 'imaging',
        recentAlerts: [],
      }),
    ).toBe(false);
  });

  it('returns true when 3+ matching alerts are within the 7-day window', () => {
    const r = shouldBundleAsDigest({
      source_crawler: 'fda',
      product_category: 'imaging',
      recentAlerts: [
        { source_crawler: 'fda', product_category: 'imaging', created_at: daysAgo(1) },
        { source_crawler: 'fda', product_category: 'imaging', created_at: daysAgo(3) },
        { source_crawler: 'fda', product_category: 'imaging', created_at: daysAgo(6) },
      ],
    });
    expect(r).toBe(true);
  });

  it('returns false when only 2 matching alerts in the window', () => {
    const r = shouldBundleAsDigest({
      source_crawler: 'fda',
      product_category: 'imaging',
      recentAlerts: [
        { source_crawler: 'fda', product_category: 'imaging', created_at: daysAgo(1) },
        { source_crawler: 'fda', product_category: 'imaging', created_at: daysAgo(2) },
      ],
    });
    expect(r).toBe(false);
  });

  it('returns false when only 1 matching alert falls in the 7-day window (others too old)', () => {
    const r = shouldBundleAsDigest({
      source_crawler: 'fda',
      product_category: 'imaging',
      recentAlerts: [
        { source_crawler: 'fda', product_category: 'imaging', created_at: daysAgo(1) },
        { source_crawler: 'fda', product_category: 'imaging', created_at: daysAgo(10) },
        { source_crawler: 'fda', product_category: 'imaging', created_at: daysAgo(14) },
      ],
    });
    expect(r).toBe(false);
  });

  it('ignores alerts with a different source or category', () => {
    const r = shouldBundleAsDigest({
      source_crawler: 'fda',
      product_category: 'imaging',
      recentAlerts: [
        { source_crawler: 'ema', product_category: 'imaging', created_at: daysAgo(1) },
        { source_crawler: 'fda', product_category: 'cardio', created_at: daysAgo(1) },
        { source_crawler: 'fda', product_category: 'imaging', created_at: daysAgo(1) },
      ],
    });
    expect(r).toBe(false);
  });

  it('uses the most recent alert to set the 7-day window (not "now")', () => {
    // mostRecent = daysAgo(20); window = daysAgo(20)..daysAgo(27).
    // The 3 matching alerts at daysAgo(21..23) are inside that window.
    const r = shouldBundleAsDigest({
      source_crawler: 'fda',
      product_category: 'imaging',
      recentAlerts: [
        { source_crawler: 'fda', product_category: 'imaging', created_at: daysAgo(21) },
        { source_crawler: 'fda', product_category: 'imaging', created_at: daysAgo(22) },
        { source_crawler: 'fda', product_category: 'imaging', created_at: daysAgo(23) },
      ],
    });
    expect(r).toBe(true);
  });
});
