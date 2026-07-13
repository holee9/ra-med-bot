// @vitest-environment node
// @MX:NOTE [AUTO] Unit tests for lib/source-governance/retrieval-gate (SPEC-REGULA-SOURCE-GOVERNANCE-001).
// @MX:SPEC SPEC-REGULA-SOURCE-GOVERNANCE-001 (REQ-SOURCE-GOV-004/005/006/009)

import { beforeEach, describe, expect, it, vi } from 'vitest';

let rows: unknown[] = [];

vi.mock('@/lib/observability/logger', () => ({
  logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

vi.mock('@/lib/db/client', () => {
  const chain: Record<string, unknown> = {};
  chain.from = () => chain;
  chain.where = () => chain;
  // Intentional thenable: `await` on the chain resolves to rows.
  // biome-ignore lint/suspicious/noThenProperty: deliberate chainable thenable for the db mock
  chain.then = (resolve: (v: unknown) => void) => resolve(rows);
  return { db: { select: () => chain } };
});

const { filterGovernanceEligible } = await import('../retrieval-gate');

beforeEach(() => {
  vi.clearAllMocks();
  rows = [];
});

describe('filterGovernanceEligible (REQ-SOURCE-GOV-005/006/009)', () => {
  it('returns an empty Set for empty sourceIds', async () => {
    expect(await filterGovernanceEligible([], { orgId: 'org-1' })).toEqual(new Set());
  });

  it('includes approved, non-superseded sources', async () => {
    rows = [{ id: 's1', approvalStatus: 'approved', supersededBy: null }];
    expect(await filterGovernanceEligible(['s1'], { orgId: 'org-1' })).toEqual(new Set(['s1']));
  });

  it('excludes pending_review / rejected sources (REQ-009)', async () => {
    rows = [
      { id: 's1', approvalStatus: 'approved', supersededBy: null },
      { id: 's2', approvalStatus: 'pending_review', supersededBy: null },
    ];
    expect(await filterGovernanceEligible(['s1', 's2'], { orgId: 'org-1' })).toEqual(
      new Set(['s1']),
    );
  });

  it('excludes superseded sources unless historical=true (REQ-005/006)', async () => {
    rows = [
      { id: 's1', approvalStatus: 'approved', supersededBy: null },
      { id: 's2', approvalStatus: 'approved', supersededBy: 's3' },
    ];
    expect(await filterGovernanceEligible(['s1', 's2'], { orgId: 'org-1' })).toEqual(
      new Set(['s1']),
    );
    expect(
      await filterGovernanceEligible(['s1', 's2'], { orgId: 'org-1', historical: true }),
    ).toEqual(new Set(['s1', 's2']));
  });
});
