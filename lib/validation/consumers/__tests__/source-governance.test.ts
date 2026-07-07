// @MX:NOTE [AUTO] Unit tests for source-governance consumer (SPEC-REGULA-VALIDATION-002 M0).
// @MX:SPEC SPEC-REGULA-VALIDATION-002 (M0)

import { describe, expect, it, vi } from 'vitest';
import { snapshotSourceGovernance } from '../source-governance';

// Mock getGovernanceDashboard
vi.mock('@/lib/source-governance/dashboard', () => ({
  getGovernanceDashboard: vi.fn(),
}));

describe('snapshotSourceGovernance', () => {
  it('should call getGovernanceDashboard with orgId and return result transparently', async () => {
    const { getGovernanceDashboard } = await import('@/lib/source-governance/dashboard');
    const mockDashboard = {
      counts: { approved: 10, pendingReview: 5, rejected: 2, stale: 1, superseded: 3 },
      reviewDue: [],
      staleCitationArtifacts: [],
    };
    vi.mocked(getGovernanceDashboard).mockResolvedValue(mockDashboard);

    const result = await snapshotSourceGovernance({ orgId: 'org-123' });

    expect(getGovernanceDashboard).toHaveBeenCalledWith({ orgId: 'org-123' });
    expect(result).toEqual(mockDashboard);
  });

  it('should pass through arbitrary GovernanceDashboard shapes', async () => {
    const { getGovernanceDashboard } = await import('@/lib/source-governance/dashboard');
    const mockDashboard = {
      counts: { approved: 999, pendingReview: 888, rejected: 777, stale: 666, superseded: 555 },
      reviewDue: [],
      staleCitationArtifacts: [
        { messageId: 'msg-1', sourceId: 'src-1', sourceTitle: 'Old Source', reason: 'superseded' },
      ],
    };
    vi.mocked(getGovernanceDashboard).mockResolvedValue(mockDashboard);

    const result = await snapshotSourceGovernance({ orgId: 'org-456' });

    expect(getGovernanceDashboard).toHaveBeenCalledWith({ orgId: 'org-456' });
    expect(result).toEqual(mockDashboard);
  });
});
