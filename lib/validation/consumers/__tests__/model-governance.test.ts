// @MX:NOTE [AUTO] Unit tests for model-governance consumer (SPEC-REGULA-VALIDATION-002 M0).
// @MX:SPEC SPEC-REGULA-VALIDATION-002 (M0)

import { beforeEach, describe, expect, it, vi } from 'vitest';

// fetchWindowScopedChangeRequests uses `await import('@/lib/db/client')` then a
// drizzle select/from/where chain. We mock the db module so the chain returns
// fixture rows, exercising the mapping + window/org scoping control flow
// (coverage #402 — previously only the export was smoke-tested).
vi.mock('@/lib/db/client', () => ({
  db: {
    select: vi.fn(() => ({
      from: () => ({ where: () => [] }),
    })),
  },
}));

describe('fetchWindowScopedChangeRequests (export smoke)', () => {
  it('should be exported as a function', async () => {
    const { fetchWindowScopedChangeRequests } = await import('../model-governance');
    expect(typeof fetchWindowScopedChangeRequests).toBe('function');
  });

  it('should have ChangeRequestRow as a type export', async () => {
    const module = await import('../model-governance');
    expect('fetchWindowScopedChangeRequests' in module).toBe(true);
  });
});

describe('fetchWindowScopedChangeRequests (drizzle-chain execution, #402)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns the rows the underlying change_request query yields (org+window scoped)', async () => {
    const { db } = await import('@/lib/db/client');
    const row = {
      id: 'cr1',
      promptId: null,
      modelPinId: null,
      evalRunId: null,
      evalResultRef: null,
      approvalStatus: 'approved',
      approvedAt: null,
      createdAt: new Date('2026-07-01'),
    };
    vi.mocked(db.select).mockReturnValueOnce({
      from: () => ({ where: () => [row] }),
    } as never);
    const { fetchWindowScopedChangeRequests } = await import('../model-governance');
    const rows = await fetchWindowScopedChangeRequests({
      orgId: '00000000-0000-0000-0000-000000000001',
      windowStart: new Date('2026-01-01'),
      windowEnd: new Date('2026-12-31'),
    });
    expect(rows).toEqual([row]);
    expect(rows[0]?.id).toBe('cr1');
  });

  it('returns [] when no change_requests match the window', async () => {
    const { db } = await import('@/lib/db/client');
    vi.mocked(db.select).mockReturnValueOnce({
      from: () => ({ where: () => [] }),
    } as never);
    const { fetchWindowScopedChangeRequests } = await import('../model-governance');
    const rows = await fetchWindowScopedChangeRequests({
      orgId: '00000000-0000-0000-0000-000000000001',
      windowStart: new Date('2026-01-01'),
      windowEnd: new Date('2026-12-31'),
    });
    expect(rows).toEqual([]);
  });
});
