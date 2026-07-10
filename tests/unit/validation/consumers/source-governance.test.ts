// @MX:NOTE [AUTO] Unit tests for source-governance consumer (SPEC-REGULA-VALIDATION-002, M0).
// @MX:SPEC SPEC-REGULA-VALIDATION-002 (M0, REQ-SOURCE-GOV-012)
// @MX:REASON M0 gate: snapshotSourceGovernance is a thin pass-through wrapper
//   around getGovernanceDashboard. Mock the wrapped function to verify
//   transparent delegation (params pass through, result returns unmodified).

import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mock the wrapped dependency: getGovernanceDashboard.
// The consumer imports it at module top-level, so vi.doMock + vi.resetModules
// + dynamic import isolates each test.
// ---------------------------------------------------------------------------
const getGovernanceDashboardMock = vi.fn();

beforeEach(() => {
  vi.resetModules();
  getGovernanceDashboardMock.mockReset();
  vi.doMock('@/lib/source-governance/dashboard', () => ({
    getGovernanceDashboard: getGovernanceDashboardMock,
  }));
});

// ---------------------------------------------------------------------------
// snapshotSourceGovernance — transparent pass-through (REQ-SOURCE-GOV-012)
// ---------------------------------------------------------------------------
describe('snapshotSourceGovernance — pass-through (REQ-SOURCE-GOV-012)', () => {
  it('delegates to getGovernanceDashboard with orgId', async () => {
    const dashboard = {
      counts: { approved: 10, pendingReview: 2, rejected: 1, stale: 0, superseded: 0 },
      reviewDue: [],
      staleCitationArtifacts: [],
    };
    getGovernanceDashboardMock.mockResolvedValue(dashboard);

    const { snapshotSourceGovernance } = await import(
      '@/lib/validation/consumers/source-governance'
    );
    const result = await snapshotSourceGovernance({ orgId: 'org-1' });

    expect(getGovernanceDashboardMock).toHaveBeenCalledTimes(1);
    expect(getGovernanceDashboardMock).toHaveBeenCalledWith({ orgId: 'org-1' });
    expect(result).toBe(dashboard);
  });

  it('returns the exact object from getGovernanceDashboard (no transformation)', async () => {
    const dashboard = {
      counts: { approved: 42, pendingReview: 3, rejected: 5, stale: 7, superseded: 2 },
      reviewDue: [{ sourceId: 'src-1', title: 'Due Tomorrow', reviewDueDate: '2099-01-01' }],
      staleCitationArtifacts: [
        { messageId: 'msg-1', sourceId: 'src-2', sourceTitle: 'Stale Doc', reason: 'sunset' },
      ],
    };
    getGovernanceDashboardMock.mockResolvedValue(dashboard);

    const { snapshotSourceGovernance } = await import(
      '@/lib/validation/consumers/source-governance'
    );
    const result = await snapshotSourceGovernance({ orgId: 'org-2' });

    // Identity check — the wrapper must return the exact object, not a copy.
    expect(result).toBe(dashboard);
    expect(result.counts.approved).toBe(42);
    expect(result.reviewDue).toHaveLength(1);
    expect(result.staleCitationArtifacts).toHaveLength(1);
  });

  it('passes different orgId values correctly', async () => {
    getGovernanceDashboardMock.mockResolvedValue({
      counts: { approved: 0, pendingReview: 0, rejected: 0, stale: 0, superseded: 0 },
      reviewDue: [],
      staleCitationArtifacts: [],
    });

    const { snapshotSourceGovernance } = await import(
      '@/lib/validation/consumers/source-governance'
    );
    await snapshotSourceGovernance({ orgId: 'org-aaa' });
    await snapshotSourceGovernance({ orgId: 'org-bbb' });

    expect(getGovernanceDashboardMock).toHaveBeenCalledTimes(2);
    expect(getGovernanceDashboardMock).toHaveBeenNthCalledWith(1, { orgId: 'org-aaa' });
    expect(getGovernanceDashboardMock).toHaveBeenNthCalledWith(2, { orgId: 'org-bbb' });
  });

  it('returns empty dashboard when getGovernanceDashboard returns empty', async () => {
    const empty = {
      counts: { approved: 0, pendingReview: 0, rejected: 0, stale: 0, superseded: 0 },
      reviewDue: [],
      staleCitationArtifacts: [],
    };
    getGovernanceDashboardMock.mockResolvedValue(empty);

    const { snapshotSourceGovernance } = await import(
      '@/lib/validation/consumers/source-governance'
    );
    const result = await snapshotSourceGovernance({ orgId: 'org-empty' });

    expect(result).toEqual(empty);
  });

  it('propagates error from getGovernanceDashboard', async () => {
    getGovernanceDashboardMock.mockRejectedValue(new Error('dashboard query failed'));

    const { snapshotSourceGovernance } = await import(
      '@/lib/validation/consumers/source-governance'
    );
    await expect(snapshotSourceGovernance({ orgId: 'org-err' })).rejects.toThrow(
      'dashboard query failed',
    );
  });
});

// ---------------------------------------------------------------------------
// Module exports
// ---------------------------------------------------------------------------
describe('module exports (REQ-SOURCE-GOV-012)', () => {
  it('exports snapshotSourceGovernance', async () => {
    const mod = await import('@/lib/validation/consumers/source-governance');
    expect(typeof mod.snapshotSourceGovernance).toBe('function');
  });
});
