// @MX:NOTE [AUTO] Unit tests for governance dashboard (SPEC-REGULA-SOURCE-GOVERNANCE-001, AC-06).
// @MX:SPEC SPEC-REGULA-SOURCE-GOVERNANCE-001 (REQ-SOURCE-GOV-012/014, AC-06, Issue #48)
// @MX:REASON AC-06 gate: getGovernanceDashboard aggregates 5 corpus counts +
//   review-due list + stale-citation artifacts. getStaleCitationArtifacts
//   reason branches (superseded vs sunset) are exercised.

import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mock db — thenable pattern extended for count + innerJoin chains.
//
// The dashboard calls 5 count queries (select().from().where()), 1 review-due
// query (same chain, delegated to the real getReviewDueSources), and 1 stale-
// artifacts query (select().from().innerJoin().where().limit()). The count
// queries are queued in Promise.all construction order; the innerJoin path
// returns a separate result set.
// ---------------------------------------------------------------------------
let countQueue: unknown[][] = [];
let staleArtifactsRows: unknown[] = [];

function makeMockDb() {
  const selectMock = () => ({
    from: () => ({
      // Count queries + review-due query use this path (thenable).
      where: () => Promise.resolve(countQueue.shift() ?? []),
      // Stale-citation artifacts query uses innerJoin → where → limit.
      innerJoin: () => ({
        where: () => ({
          limit: () => Promise.resolve(staleArtifactsRows),
        }),
      }),
    }),
  });
  return { select: vi.fn(selectMock) };
}

beforeEach(() => {
  countQueue = [];
  staleArtifactsRows = [];
  vi.resetModules();
  vi.doMock('@/lib/kernel/db/client', () => ({ db: makeMockDb() }));
});

// ---------------------------------------------------------------------------
// getGovernanceDashboard — full aggregate
// ---------------------------------------------------------------------------
describe('getGovernanceDashboard — full aggregate (REQ-SOURCE-GOV-012)', () => {
  it('returns all counts populated with review-due and stale artifacts', async () => {
    // Promise.all order: approved, pending, rejected, stale, superseded, reviewDue, staleArtifacts.
    // First 5 are count queries ({n}), 6th is review-due source rows, 7th via innerJoin.
    countQueue = [
      [{ n: 3 }], // approved
      [{ n: 1 }], // pending_review
      [{ n: 0 }], // rejected
      [{ n: 2 }], // stale (sunset past)
      [{ n: 1 }], // superseded
      // review-due query returns source rows (delegated to real getReviewDueSources):
      [], // no review-due sources
    ];
    staleArtifactsRows = [
      {
        messageId: 'msg-1',
        sourceId: 'src-sup',
        sourceTitle: 'Old Guidance',
        supersededBy: 'src-new',
        sunsetDate: null,
      },
    ];

    const { getGovernanceDashboard } = await import('@/lib/source-governance/dashboard');
    const result = await getGovernanceDashboard({ orgId: 'org-1' });

    expect(result.counts).toEqual({
      approved: 3,
      pendingReview: 1,
      rejected: 0,
      stale: 2,
      superseded: 1,
    });
    expect(result.reviewDue).toEqual([]);
    expect(result.staleCitationArtifacts).toHaveLength(1);
    expect(result.staleCitationArtifacts[0]).toEqual({
      messageId: 'msg-1',
      sourceId: 'src-sup',
      sourceTitle: 'Old Guidance',
      reason: 'superseded by src-new',
    });
  });

  it('returns zero counts when DB returns empty arrays', async () => {
    countQueue = [[], [], [], [], [], []]; // all counts empty + no review-due
    staleArtifactsRows = [];

    const { getGovernanceDashboard } = await import('@/lib/source-governance/dashboard');
    const result = await getGovernanceDashboard({ orgId: 'org-empty' });

    expect(result.counts).toEqual({
      approved: 0,
      pendingReview: 0,
      rejected: 0,
      stale: 0,
      superseded: 0,
    });
    expect(result.reviewDue).toEqual([]);
    expect(result.staleCitationArtifacts).toEqual([]);
  });

  it('returns zero count when count query returns empty (rows[0] undefined)', async () => {
    countQueue = [
      [], // approved — no rows → num() returns 0
      [{ n: 5 }],
      [{ n: 2 }],
      [{ n: 1 }],
      [{ n: 3 }],
      [],
    ];
    staleArtifactsRows = [];

    const { getGovernanceDashboard } = await import('@/lib/source-governance/dashboard');
    const result = await getGovernanceDashboard({ orgId: 'org-1' });

    expect(result.counts.approved).toBe(0);
    expect(result.counts.pendingReview).toBe(5);
    expect(result.counts.rejected).toBe(2);
    expect(result.counts.stale).toBe(1);
    expect(result.counts.superseded).toBe(3);
  });

  it('maps review-due source rows through getReviewDueSources (daysOverdue computed)', async () => {
    const lastReviewed = new Date(Date.now() - 200 * 24 * 60 * 60 * 1000).toISOString();
    countQueue = [
      [{ n: 1 }],
      [{ n: 0 }],
      [{ n: 0 }],
      [{ n: 0 }],
      [{ n: 0 }],
      // 6th: review-due source rows
      [
        {
          id: 'src-due',
          title: 'Overdue Source',
          ownerDepartment: 'QA',
          reviewCycleDays: 90,
          lastReviewedAt: lastReviewed,
        },
      ],
    ];
    staleArtifactsRows = [];

    const { getGovernanceDashboard } = await import('@/lib/source-governance/dashboard');
    const result = await getGovernanceDashboard({ orgId: 'org-1' });

    expect(result.reviewDue).toHaveLength(1);
    expect(result.reviewDue[0]?.id).toBe('src-due');
    expect(result.reviewDue[0]?.daysOverdue).toBeGreaterThan(100);
  });

  it('maps stale artifacts with sunset reason (supersededBy is null)', async () => {
    countQueue = [[{ n: 0 }], [{ n: 0 }], [{ n: 0 }], [{ n: 0 }], [{ n: 0 }], []];
    staleArtifactsRows = [
      {
        messageId: 'msg-sunset',
        sourceId: 'src-sunset',
        sourceTitle: 'Expired Reg',
        supersededBy: null,
        sunsetDate: '2020-06-15',
      },
    ];

    const { getGovernanceDashboard } = await import('@/lib/source-governance/dashboard');
    const result = await getGovernanceDashboard({ orgId: 'org-1' });

    expect(result.staleCitationArtifacts).toHaveLength(1);
    expect(result.staleCitationArtifacts[0]?.reason).toContain('sunset date passed');
    expect(result.staleCitationArtifacts[0]?.reason).toContain('2020-06-15');
  });

  it('maps multiple stale artifacts with mixed reasons', async () => {
    countQueue = [[{ n: 0 }], [{ n: 0 }], [{ n: 0 }], [{ n: 0 }], [{ n: 0 }], []];
    staleArtifactsRows = [
      {
        messageId: 'msg-1',
        sourceId: 'src-1',
        sourceTitle: 'Superseded Doc',
        supersededBy: 'src-new',
        sunsetDate: null,
      },
      {
        messageId: 'msg-2',
        sourceId: 'src-2',
        sourceTitle: 'Expired Doc',
        supersededBy: null,
        sunsetDate: '2019-01-01',
      },
    ];

    const { getGovernanceDashboard } = await import('@/lib/source-governance/dashboard');
    const result = await getGovernanceDashboard({ orgId: 'org-1' });

    expect(result.staleCitationArtifacts).toHaveLength(2);
    expect(result.staleCitationArtifacts[0]?.reason).toBe('superseded by src-new');
    expect(result.staleCitationArtifacts[1]?.reason).toContain('sunset date passed');
  });

  it('handles null sourceTitle in stale artifacts', async () => {
    countQueue = [[{ n: 0 }], [{ n: 0 }], [{ n: 0 }], [{ n: 0 }], [{ n: 0 }], []];
    staleArtifactsRows = [
      {
        messageId: 'msg-3',
        sourceId: 'src-3',
        sourceTitle: null,
        supersededBy: 'src-new',
        sunsetDate: null,
      },
    ];

    const { getGovernanceDashboard } = await import('@/lib/source-governance/dashboard');
    const result = await getGovernanceDashboard({ orgId: 'org-1' });

    expect(result.staleCitationArtifacts[0]?.sourceTitle).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// getStaleCitationArtifacts — standalone reason branches (REQ-SOURCE-GOV-014)
// ---------------------------------------------------------------------------
describe('getStaleCitationArtifacts — reason branches (REQ-SOURCE-GOV-014)', () => {
  it('returns "superseded by X" reason when supersededBy is not null', async () => {
    staleArtifactsRows = [
      {
        messageId: 'msg-sup',
        sourceId: 'src-sup',
        sourceTitle: 'Old Doc',
        supersededBy: 'src-replacement',
        sunsetDate: null,
      },
    ];
    const { getStaleCitationArtifacts } = await import('@/lib/source-governance/dashboard');
    const result = await getStaleCitationArtifacts('org-1');
    expect(result).toHaveLength(1);
    expect(result[0]?.reason).toBe('superseded by src-replacement');
    expect(result[0]?.messageId).toBe('msg-sup');
    expect(result[0]?.sourceId).toBe('src-sup');
  });

  it('returns "sunset date passed (X)" reason when supersededBy is null', async () => {
    staleArtifactsRows = [
      {
        messageId: 'msg-sun',
        sourceId: 'src-sun',
        sourceTitle: 'Expired Doc',
        supersededBy: null,
        sunsetDate: '2021-03-20',
      },
    ];
    const { getStaleCitationArtifacts } = await import('@/lib/source-governance/dashboard');
    const result = await getStaleCitationArtifacts('org-1');
    expect(result[0]?.reason).toBe('sunset date passed (2021-03-20)');
  });

  it('returns empty array when no stale citations exist', async () => {
    staleArtifactsRows = [];
    const { getStaleCitationArtifacts } = await import('@/lib/source-governance/dashboard');
    const result = await getStaleCitationArtifacts('org-1');
    expect(result).toEqual([]);
  });

  it('returns multiple stale citation artifacts', async () => {
    staleArtifactsRows = [
      {
        messageId: 'msg-1',
        sourceId: 'src-1',
        sourceTitle: 'A',
        supersededBy: 'src-a',
        sunsetDate: null,
      },
      {
        messageId: 'msg-2',
        sourceId: 'src-2',
        sourceTitle: 'B',
        supersededBy: null,
        sunsetDate: '2020-01-01',
      },
      {
        messageId: 'msg-3',
        sourceId: 'src-3',
        sourceTitle: null,
        supersededBy: 'src-c',
        sunsetDate: null,
      },
    ];
    const { getStaleCitationArtifacts } = await import('@/lib/source-governance/dashboard');
    const result = await getStaleCitationArtifacts('org-1');
    expect(result).toHaveLength(3);
    expect(result.map((r) => r.reason)).toEqual([
      'superseded by src-a',
      'sunset date passed (2020-01-01)',
      'superseded by src-c',
    ]);
  });
});
