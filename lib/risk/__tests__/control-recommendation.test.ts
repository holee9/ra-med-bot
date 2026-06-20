// @MX:NOTE [AUTO] Unit tests for control-recommendation.ts — SPEC-REGULA-RISK-001 Phase 1 (T1.9~T1.10).

import { describe, expect, it, vi } from 'vitest';
import { recommendControls, validateControlHierarchy } from '../control-recommendation';

// ---------------------------------------------------------------------------
// T1.9 — recommendControls (RAG integration, mocked)
// ---------------------------------------------------------------------------
describe('recommendControls', () => {
  const mockControls = {
    controls: [
      {
        tier: 'inherent' as const,
        description: 'Design dose-limiting hardware interlock',
        rationale: null,
      },
      {
        tier: 'protective' as const,
        description: 'Implement software watchdog with automatic shutdown',
        rationale: null,
      },
      {
        tier: 'information' as const,
        description: 'Label: maximum recommended dosage',
        rationale: 'Information for safety as last resort measure',
      },
    ],
  };

  it('returns 3-tier control candidates from RAG', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      json: vi.fn().mockResolvedValue({ answer: JSON.stringify(mockControls) }),
    });

    const result = await recommendControls('risk-item-uuid-123', mockFetch);
    expect(result).toHaveLength(3);

    const tiers = result.map((c) => c.tier);
    expect(tiers).toContain('inherent');
    expect(tiers).toContain('protective');
    expect(tiers).toContain('information');
  });

  it('propagates RAG fetch errors', async () => {
    const mockFetch = vi.fn().mockRejectedValue(new Error('Network error'));
    await expect(recommendControls('risk-item-uuid-123', mockFetch)).rejects.toThrow(
      'Network error',
    );
  });
});

// ---------------------------------------------------------------------------
// T1.10 — validateControlHierarchy
// ---------------------------------------------------------------------------
describe('validateControlHierarchy', () => {
  it('inherent tier without rationale → valid', () => {
    expect(() => validateControlHierarchy('inherent')).not.toThrow();
  });

  it('protective tier without rationale → valid', () => {
    expect(() => validateControlHierarchy('protective')).not.toThrow();
  });

  it('information tier with rationale → valid', () => {
    expect(() => validateControlHierarchy('information', 'Safety label as last resort')).not.toThrow();
  });

  it('information tier without rationale → throws (ISO 14971 §7.1 hierarchy violation)', () => {
    expect(() => validateControlHierarchy('information')).toThrow(
      /rationale.*required/i,
    );
  });

  it('information tier with empty rationale → throws', () => {
    expect(() => validateControlHierarchy('information', '')).toThrow();
  });
});
