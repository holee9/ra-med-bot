// @vitest-environment node
// @MX:NOTE [AUTO] Unit tests for lib/source-governance/access (SPEC-REGULA-SOURCE-GOVERNANCE-001).
// @MX:SPEC SPEC-REGULA-SOURCE-GOVERNANCE-001 (REQ-SOURCE-GOV-015)

import { beforeEach, describe, expect, it, vi } from 'vitest';

let rows: unknown[] = [];

vi.mock('@/lib/db/client', () => {
  const chain: Record<string, unknown> = {};
  chain.from = () => chain;
  chain.where = () => chain;
  chain.limit = () => chain;
  // Intentional thenable: `await` on the chain resolves to rows.
  // biome-ignore lint/suspicious/noThenProperty: deliberate chainable thenable for the db mock
  chain.then = (resolve: (v: unknown) => void) => resolve(rows);
  return { db: { select: () => chain } };
});

const { getSourceInOrg } = await import('../access');

beforeEach(() => {
  vi.clearAllMocks();
  rows = [];
});

describe('getSourceInOrg (REQ-SOURCE-GOV-015 IDOR)', () => {
  it('returns the source row when it belongs to the org', async () => {
    rows = [{ id: 'src-1', approvalStatus: 'approved' }];
    expect(await getSourceInOrg('src-1', 'org-1')).toEqual({
      id: 'src-1',
      approvalStatus: 'approved',
    });
  });

  it('returns null when no row matches (missing or cross-org)', async () => {
    rows = [];
    expect(await getSourceInOrg('src-x', 'org-1')).toBeNull();
  });
});
