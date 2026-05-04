/**
 * Tests for 3-tier classifier (REQ-RADAR-004 through REQ-RADAR-009)
 * TDD: RED phase — tests written before implementation
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock Anthropic client
vi.mock('../../lib/ai/anthropic-client', () => ({
  sharedAnthropicClient: {
    messages: {
      create: vi.fn(),
    },
  },
}));

describe('Classifier — Tier 1 (Medical Device Relevance)', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('should return relevant=true for medical device regulation titles', async () => {
    const { sharedAnthropicClient } = await import('../../lib/ai/anthropic-client');
    vi.mocked(sharedAnthropicClient.messages.create).mockResolvedValue({
      content: [{ type: 'text', text: JSON.stringify({ relevant: true, confidence: 0.97 }) }],
    } as unknown as Awaited<ReturnType<typeof sharedAnthropicClient.messages.create>>);

    const { classifyTier1 } = await import('../../lib/radar/classifier');

    const result = await classifyTier1({
      title: 'FDA guidance on 510(k) premarket notification for medical devices',
      raw_content: 'This guidance covers Class II medical devices...',
    });

    expect(result.relevant).toBe(true);
  });

  it('should return relevant=false for clearly unrelated titles', async () => {
    const { sharedAnthropicClient } = await import('../../lib/ai/anthropic-client');
    vi.mocked(sharedAnthropicClient.messages.create).mockResolvedValue({
      content: [{ type: 'text', text: JSON.stringify({ relevant: false, confidence: 0.98 }) }],
    } as unknown as Awaited<ReturnType<typeof sharedAnthropicClient.messages.create>>);

    const { classifyTier1 } = await import('../../lib/radar/classifier');

    const result = await classifyTier1({
      title: 'Agricultural pest control regulations 2024',
      raw_content: 'Regulations on pesticide use in farming...',
    });

    expect(result.relevant).toBe(false);
  });

  it('should force relevant=true when title contains "recall" keyword (safety net)', async () => {
    const { sharedAnthropicClient } = await import('../../lib/ai/anthropic-client');
    // LLM says NOT relevant, but keyword check should override
    vi.mocked(sharedAnthropicClient.messages.create).mockResolvedValue({
      content: [{ type: 'text', text: JSON.stringify({ relevant: false, confidence: 0.7 }) }],
    } as unknown as Awaited<ReturnType<typeof sharedAnthropicClient.messages.create>>);

    const { classifyTier1 } = await import('../../lib/radar/classifier');

    const result = await classifyTier1({
      title: 'Medical device recall notice - Class I',
      raw_content: 'Recall of cardiac monitors due to software defect...',
    });

    expect(result.relevant).toBe(true);
    expect(result.forced_by_keyword).toBe(true);
  });

  it('should force relevant=true when content contains Korean recall keyword 리콜', async () => {
    const { sharedAnthropicClient } = await import('../../lib/ai/anthropic-client');
    vi.mocked(sharedAnthropicClient.messages.create).mockResolvedValue({
      content: [{ type: 'text', text: JSON.stringify({ relevant: false, confidence: 0.6 }) }],
    } as unknown as Awaited<ReturnType<typeof sharedAnthropicClient.messages.create>>);

    const { classifyTier1 } = await import('../../lib/radar/classifier');

    const result = await classifyTier1({
      title: '리콜 대상 의료기기 목록',
      raw_content: '리콜 의료기기 회수 절차...',
    });

    expect(result.relevant).toBe(true);
    expect(result.forced_by_keyword).toBe(true);
  });
});

describe('Classifier — Tier 2 (Device Class & Product Category)', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('should classify device class from relevant regulatory document', async () => {
    const { sharedAnthropicClient } = await import('../../lib/ai/anthropic-client');
    vi.mocked(sharedAnthropicClient.messages.create).mockResolvedValue({
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            device_class: 'II',
            product_categories: ['diagnostic_imaging', 'software'],
            confidence: 0.88,
          }),
        },
      ],
    } as unknown as Awaited<ReturnType<typeof sharedAnthropicClient.messages.create>>);

    const { classifyTier2 } = await import('../../lib/radar/classifier');

    const result = await classifyTier2({
      title: 'Class II 510(k) requirements for AI diagnostic software',
      raw_content: 'Requirements for artificial intelligence diagnostic imaging...',
    });

    expect(result.device_class).toBe('II');
    expect(result.product_categories).toContain('diagnostic_imaging');
  });
});

describe('Classifier — Tier 3 (Impact Type)', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('should classify impact type as recall for recall documents', async () => {
    const { sharedAnthropicClient } = await import('../../lib/ai/anthropic-client');
    vi.mocked(sharedAnthropicClient.messages.create).mockResolvedValue({
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            impact_type: 'recall',
            confidence: 0.96,
          }),
        },
      ],
    } as unknown as Awaited<ReturnType<typeof sharedAnthropicClient.messages.create>>);

    const { classifyTier3 } = await import('../../lib/radar/classifier');

    const result = await classifyTier3({
      title: 'Class I Recall of infusion pumps',
      raw_content: 'FDA is recalling infusion pumps due to software error...',
    });

    expect(result.impact_type).toBe('recall');
  });

  it('should classify impact type as legislation for regulatory rules', async () => {
    const { sharedAnthropicClient } = await import('../../lib/ai/anthropic-client');
    vi.mocked(sharedAnthropicClient.messages.create).mockResolvedValue({
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            impact_type: 'legislation',
            confidence: 0.93,
          }),
        },
      ],
    } as unknown as Awaited<ReturnType<typeof sharedAnthropicClient.messages.create>>);

    const { classifyTier3 } = await import('../../lib/radar/classifier');

    const result = await classifyTier3({
      title: 'Final Rule: Medical Device Safety Action Plan',
      raw_content: 'This final rule establishes new requirements...',
    });

    expect(result.impact_type).toBe('legislation');
  });
});
