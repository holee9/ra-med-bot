// @MX:NOTE [AUTO] Unit tests for review-notifier (SPEC-REGULA-SOURCE-GOVERNANCE-001, AC-06).
// @MX:SPEC SPEC-REGULA-SOURCE-GOVERNANCE-001 (REQ-SOURCE-GOV-011/013, AC-06, Issue #48)
// @MX:REASON AC-06 gate: getReviewDueSources must return sources whose review
//   cycle has elapsed (or will within withinDays). daysOverdue arithmetic and
//   the never-reviewed-approved branch are exercised.

import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mock db — same thenable pattern as stale-check.test.ts.
// ---------------------------------------------------------------------------
let mockRows: unknown[] = [];

function makeThenable(rowsFor: () => unknown[]) {
  return Promise.resolve(rowsFor()) as Promise<unknown[]>;
}

function makeMockDb(rows: () => unknown[]) {
  const selectMock = () => ({
    from: () => ({
      where: () => makeThenable(rows),
    }),
  });
  return { select: vi.fn(selectMock) };
}

beforeEach(() => {
  mockRows = [];
  vi.resetModules();
  vi.doMock('@/lib/db/client', () => ({ db: makeMockDb(() => mockRows) }));
});

// ---------------------------------------------------------------------------
// getReviewDueSources — empty result
// ---------------------------------------------------------------------------
describe('getReviewDueSources — empty result (AC-06)', () => {
  it('returns empty array when DB returns no rows', async () => {
    const { getReviewDueSources } = await import('@/lib/source-governance/review-notifier');
    const result = await getReviewDueSources({ orgId: 'org-1' });
    expect(result).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// getReviewDueSources — daysOverdue calculation
// ---------------------------------------------------------------------------
describe('getReviewDueSources — daysOverdue arithmetic (REQ-SOURCE-GOV-013)', () => {
  it('computes positive daysOverdue when review cycle has elapsed', async () => {
    // 100-day cycle, last reviewed 150 days ago → 50 days overdue.
    const cycleDays = 100;
    const elapsedDays = 150;
    const lastReviewedAt = new Date(Date.now() - elapsedDays * 24 * 60 * 60 * 1000).toISOString();
    mockRows = [
      {
        id: 'src-1',
        title: 'FDA Guidance',
        ownerDepartment: 'QA',
        reviewCycleDays: cycleDays,
        lastReviewedAt,
      },
    ];
    const { getReviewDueSources } = await import('@/lib/source-governance/review-notifier');
    const result = await getReviewDueSources({ orgId: 'org-1' });
    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe('src-1');
    expect(result[0]?.daysOverdue).toBeGreaterThanOrEqual(49); // ~50 (allow ±1 for timing)
    expect(result[0]?.daysOverdue).toBeLessThanOrEqual(51);
  });

  it('computes zero or negative daysOverdue when review is not yet due', async () => {
    // 365-day cycle, last reviewed 10 days ago → -355 days "overdue" (not yet due).
    const cycleDays = 365;
    const elapsedDays = 10;
    const lastReviewedAt = new Date(Date.now() - elapsedDays * 24 * 60 * 60 * 1000).toISOString();
    mockRows = [
      {
        id: 'src-future',
        title: 'Recent Source',
        ownerDepartment: 'RA',
        reviewCycleDays: cycleDays,
        lastReviewedAt,
      },
    ];
    const { getReviewDueSources } = await import('@/lib/source-governance/review-notifier');
    const result = await getReviewDueSources({ orgId: 'org-1' });
    expect(result[0]?.daysOverdue).toBeLessThan(0);
  });

  it('returns daysOverdue=0 when reviewCycleDays is null', async () => {
    // Null cycle → cycle=0 → daysOverdue=0 (the never-reviewed-but-approved branch).
    mockRows = [
      {
        id: 'src-null-cycle',
        title: 'No Cycle',
        ownerDepartment: null,
        reviewCycleDays: null,
        lastReviewedAt: null,
      },
    ];
    const { getReviewDueSources } = await import('@/lib/source-governance/review-notifier');
    const result = await getReviewDueSources({ orgId: 'org-1' });
    expect(result[0]?.daysOverdue).toBe(0);
    expect(result[0]?.reviewCycleDays).toBeNull();
    expect(result[0]?.lastReviewedAt).toBeNull();
  });

  it('returns daysOverdue=0 when reviewCycleDays is 0', async () => {
    mockRows = [
      {
        id: 'src-zero-cycle',
        title: 'Zero Cycle',
        ownerDepartment: 'QA',
        reviewCycleDays: 0,
        lastReviewedAt: '2025-01-01T00:00:00.000Z',
      },
    ];
    const { getReviewDueSources } = await import('@/lib/source-governance/review-notifier');
    const result = await getReviewDueSources({ orgId: 'org-1' });
    expect(result[0]?.daysOverdue).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// getReviewDueSources — withinDays parameter
// ---------------------------------------------------------------------------
describe('getReviewDueSources — withinDays parameter', () => {
  it('defaults withinDays to 30 when not provided', async () => {
    mockRows = [
      {
        id: 'src-default',
        title: 'Default Window',
        ownerDepartment: 'QA',
        reviewCycleDays: 90,
        lastReviewedAt: new Date(Date.now() - 100 * 24 * 60 * 60 * 1000).toISOString(),
      },
    ];
    const { getReviewDueSources } = await import('@/lib/source-governance/review-notifier');
    const result = await getReviewDueSources({ orgId: 'org-1' });
    expect(result).toHaveLength(1);
    // The mock db doesn't enforce the SQL predicate; we verify the function
    // accepts the default and returns rows. The SQL interval comparison is
    // exercised in integration tests with a real DB.
  });

  it('accepts a custom withinDays value', async () => {
    mockRows = [
      {
        id: 'src-custom',
        title: 'Custom Window',
        ownerDepartment: 'QA',
        reviewCycleDays: 90,
        lastReviewedAt: new Date(Date.now() - 100 * 24 * 60 * 60 * 1000).toISOString(),
      },
    ];
    const { getReviewDueSources } = await import('@/lib/source-governance/review-notifier');
    const result = await getReviewDueSources({ orgId: 'org-1', withinDays: 60 });
    expect(result).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// getReviewDueSources — multiple rows + field mapping
// ---------------------------------------------------------------------------
describe('getReviewDueSources — multiple rows and field mapping', () => {
  it('maps all returned rows preserving id/title/ownerDepartment/reviewCycleDays/lastReviewedAt', async () => {
    const lastReviewed = new Date(Date.now() - 200 * 24 * 60 * 60 * 1000).toISOString();
    mockRows = [
      {
        id: 'src-a',
        title: 'Source A',
        ownerDepartment: 'QA',
        reviewCycleDays: 90,
        lastReviewedAt: lastReviewed,
      },
      {
        id: 'src-b',
        title: 'Source B',
        ownerDepartment: 'RA',
        reviewCycleDays: 365,
        lastReviewedAt: lastReviewed,
      },
      {
        id: 'src-c',
        title: 'Source C',
        ownerDepartment: null,
        reviewCycleDays: null,
        lastReviewedAt: null,
      },
    ];
    const { getReviewDueSources } = await import('@/lib/source-governance/review-notifier');
    const result = await getReviewDueSources({ orgId: 'org-1' });
    expect(result).toHaveLength(3);
    expect(result[0]?.id).toBe('src-a');
    expect(result[0]?.title).toBe('Source A');
    expect(result[0]?.ownerDepartment).toBe('QA');
    expect(result[1]?.id).toBe('src-b');
    expect(result[2]?.ownerDepartment).toBeNull();
    // src-c has null cycle → daysOverdue = 0
    expect(result[2]?.daysOverdue).toBe(0);
    // src-a (90-day cycle, 200 days elapsed) → ~110 days overdue
    expect(result[0]?.daysOverdue).toBeGreaterThan(100);
    // src-b (365-day cycle, 200 days elapsed) → negative (not yet due)
    expect(result[1]?.daysOverdue).toBeLessThan(0);
  });

  it('preserves null ownerDepartment in mapped rows', async () => {
    mockRows = [
      {
        id: 'src-null-owner',
        title: 'No Owner',
        ownerDepartment: null,
        reviewCycleDays: 30,
        lastReviewedAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(),
      },
    ];
    const { getReviewDueSources } = await import('@/lib/source-governance/review-notifier');
    const result = await getReviewDueSources({ orgId: 'org-1' });
    expect(result[0]?.ownerDepartment).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// getReviewDueSources — ReviewDueSource shape
// ---------------------------------------------------------------------------
describe('getReviewDueSources — return type shape', () => {
  it('returns objects with all ReviewDueSource fields', async () => {
    mockRows = [
      {
        id: 'src-shape',
        title: 'Shape Test',
        ownerDepartment: 'QA',
        reviewCycleDays: 30,
        lastReviewedAt: '2025-01-01T00:00:00.000Z',
      },
    ];
    const { getReviewDueSources } = await import('@/lib/source-governance/review-notifier');
    const result = await getReviewDueSources({ orgId: 'org-1' });
    expect(result[0]).toHaveProperty('id');
    expect(result[0]).toHaveProperty('title');
    expect(result[0]).toHaveProperty('ownerDepartment');
    expect(result[0]).toHaveProperty('reviewCycleDays');
    expect(result[0]).toHaveProperty('lastReviewedAt');
    expect(result[0]).toHaveProperty('daysOverdue');
    expect(typeof result[0]?.daysOverdue).toBe('number');
  });
});
