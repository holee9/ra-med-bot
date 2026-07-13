// @vitest-environment node
// @MX:NOTE [AUTO] Unit tests for lib/source-governance/review-notifier (SPEC-REGULA-SOURCE-GOVERNANCE-001).
// @MX:SPEC SPEC-REGULA-SOURCE-GOVERNANCE-001 (REQ-SOURCE-GOV-011/013)

import { beforeEach, describe, expect, it, vi } from 'vitest';

let rows: unknown[] = [];

vi.mock('@/lib/db/client', () => {
  const chain: Record<string, unknown> = {};
  chain.from = () => chain;
  chain.where = () => chain;
  // Intentional thenable: `await` on the chain resolves to rows.
  // biome-ignore lint/suspicious/noThenProperty: deliberate chainable thenable for the db mock
  chain.then = (resolve: (v: unknown) => void) => resolve(rows);
  return { db: { select: () => chain } };
});

const { getReviewDueSources } = await import('../review-notifier');

beforeEach(() => {
  vi.clearAllMocks();
  rows = [];
});

describe('getReviewDueSources (REQ-SOURCE-GOV-011/013)', () => {
  it('returns [] when no sources are due', async () => {
    expect(await getReviewDueSources({ orgId: 'org-1' })).toEqual([]);
  });

  it('maps rows with daysOverdue calculation', async () => {
    // Source reviewed ~400 days ago with a 365-day cycle → ~35 days overdue.
    const oldDate = new Date(Date.now() - 400 * 24 * 60 * 60 * 1000).toISOString();
    rows = [
      {
        id: 's1',
        title: 'ISO 13485',
        ownerDepartment: 'QA',
        reviewCycleDays: 365,
        lastReviewedAt: oldDate,
      },
    ];
    const result = await getReviewDueSources({ orgId: 'org-1' });
    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe('s1');
    expect(typeof result[0]?.daysOverdue).toBe('number');
    expect(result[0]?.daysOverdue).toBeGreaterThan(0);
  });

  it('returns daysOverdue 0 for sources with no cycle', async () => {
    rows = [
      {
        id: 's2',
        title: 'Open',
        ownerDepartment: null,
        reviewCycleDays: null,
        lastReviewedAt: null,
      },
    ];
    const result = await getReviewDueSources({ orgId: 'org-1' });
    expect(result[0]?.daysOverdue).toBe(0);
  });
});
