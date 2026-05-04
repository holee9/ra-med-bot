/**
 * Tests for relevance/impact scorer
 * TDD: RED phase — tests written before implementation
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../lib/ai/anthropic-client', () => ({
  sharedAnthropicClient: {
    messages: {
      create: vi.fn(),
    },
  },
}));

const mockPortfolio = {
  product_categories: ['diagnostic_imaging', 'software'],
  target_markets: ['US', 'EU'],
  device_classes: ['II'],
};

describe('Relevance Scorer', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('should return impact_score 0.0 for irrelevant updates (rule-based pre-filter)', async () => {
    const { scoreRelevance } = await import('../../lib/radar/relevance-scorer');

    const result = await scoreRelevance({
      update: {
        region: 'JP',
        product_categories: ['orthopaedic'],
        device_class: 'I',
        impact_type: 'informational',
      },
      portfolio: mockPortfolio,
    });

    // No region match, no category match → score should be very low or 0
    expect(result.impact_score).toBeLessThan(0.3);
  });

  it('should return high impact_score for highly relevant updates', async () => {
    const { sharedAnthropicClient } = await import('../../lib/ai/anthropic-client');
    vi.mocked(sharedAnthropicClient.messages.create).mockResolvedValue({
      content: [{ type: 'text', text: JSON.stringify({ score: 0.92, reasoning: 'Direct match' }) }],
    } as unknown as Awaited<ReturnType<typeof sharedAnthropicClient.messages.create>>);

    const { scoreRelevance } = await import('../../lib/radar/relevance-scorer');

    const result = await scoreRelevance({
      update: {
        region: 'US',
        product_categories: ['diagnostic_imaging', 'software'],
        device_class: 'II',
        impact_type: 'legislation',
      },
      portfolio: mockPortfolio,
    });

    expect(result.impact_score).toBeGreaterThan(0.7);
  });

  it('should detect alert fatigue and bundle digest for repeated patterns', async () => {
    const { shouldBundleAsDigest } = await import('../../lib/radar/relevance-scorer');

    // Same source + category appearing 3+ times in 7 days should be bundled
    const recentAlerts = [
      {
        source_crawler: 'fda-federal-register',
        product_category: 'software',
        created_at: new Date('2024-01-20'),
      },
      {
        source_crawler: 'fda-federal-register',
        product_category: 'software',
        created_at: new Date('2024-01-21'),
      },
      {
        source_crawler: 'fda-federal-register',
        product_category: 'software',
        created_at: new Date('2024-01-22'),
      },
    ];

    const result = shouldBundleAsDigest({
      source_crawler: 'fda-federal-register',
      product_category: 'software',
      recentAlerts,
    });

    expect(result).toBe(true);
  });

  it('should not bundle when fewer than 3 alerts in 7 days', async () => {
    const { shouldBundleAsDigest } = await import('../../lib/radar/relevance-scorer');

    const recentAlerts = [
      {
        source_crawler: 'fda-federal-register',
        product_category: 'software',
        created_at: new Date('2024-01-20'),
      },
      {
        source_crawler: 'fda-federal-register',
        product_category: 'software',
        created_at: new Date('2024-01-21'),
      },
    ];

    const result = shouldBundleAsDigest({
      source_crawler: 'fda-federal-register',
      product_category: 'software',
      recentAlerts,
    });

    expect(result).toBe(false);
  });
});
