// @MX:NOTE [AUTO] TASK-002 TDD unit tests — Sources index API (GET /api/ra/sources).
// @MX:SPEC SPEC-REGULA-RELEASE-HARDENING-001 (TASK-002)

import { beforeEach, describe, expect, it, vi } from 'vitest';

// --- Mock withPermission: pass-through with fixed session ---
vi.mock('@/lib/kernel/auth/with-permission', () => ({
  withPermission: vi.fn(
    (
      _action: string,
      handler: (req: Request, ctx: unknown, session: unknown) => Promise<Response>,
    ) =>
      (req: Request, ctx: unknown) =>
        handler(req, ctx, {
          user: { id: 'user-001', role: 'ra-member', organizationId: 'org-001' },
        }),
  ),
}));

// --- Mock writeAudit ---
vi.mock('@/lib/kernel/audit', () => ({
  writeAudit: vi.fn().mockResolvedValue(undefined),
}));

// --- Mock db: support both .select(...).from(...).groupBy(...).orderBy(...) and
//     .select(...).from(...).leftJoin(...).groupBy(...).orderBy(...) chains.
const groupByResult: Array<{
  orgLabel: string;
  documentCount: number;
  sectionCount: number;
  lastUpdated: Date | null;
}> = [];

const chain = {
  from: vi.fn().mockReturnThis(),
  leftJoin: vi.fn().mockReturnThis(),
  innerJoin: vi.fn().mockReturnThis(),
  where: vi.fn().mockReturnThis(),
  groupBy: vi.fn().mockReturnThis(),
  orderBy: vi.fn(() => Promise.resolve(groupByResult)),
};

vi.mock('@/lib/kernel/db/client', () => ({
  db: {
    select: vi.fn(() => chain),
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
  groupByResult.length = 0;

  // Reset chain to return itself for fluent calls; orderBy resolves to result.
  chain.from.mockReturnThis();
  chain.leftJoin.mockReturnThis();
  chain.innerJoin.mockReturnThis();
  chain.where.mockReturnThis();
  chain.groupBy.mockReturnThis();
  chain.orderBy.mockImplementation(() => Promise.resolve(groupByResult));
});

const { GET } = await import('@/app/api/ra/sources/route');

describe('GET /api/ra/sources', () => {
  it('returns aggregated source corpora grouped by orgLabel', async () => {
    groupByResult.push(
      {
        orgLabel: 'FDA',
        documentCount: 12,
        sectionCount: 340,
        lastUpdated: new Date('2026-01-15T00:00:00Z'),
      },
      {
        orgLabel: 'EU MDR',
        documentCount: 5,
        sectionCount: 110,
        lastUpdated: new Date('2025-11-30T00:00:00Z'),
      },
    );

    const req = new Request('http://localhost/api/ra/sources');
    const res = await GET(req, {});
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(Array.isArray(body.corpora)).toBe(true);
    expect(body.corpora).toHaveLength(2);

    const fda = body.corpora.find((c: { corpus: string }) => c.corpus === 'FDA');
    expect(fda).toBeDefined();
    expect(fda.documentCount).toBe(12);
    expect(fda.sectionCount).toBe(340);
    expect(typeof fda.lastUpdated).toBe('string');
    expect(chain.where).toHaveBeenCalledTimes(1);
  });

  it('returns empty array when no sources exist', async () => {
    const req = new Request('http://localhost/api/ra/sources');
    const res = await GET(req, {});
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.corpora).toEqual([]);
  });

  it('serializes lastUpdated as ISO string (or null)', async () => {
    groupByResult.push({
      orgLabel: 'MFDS',
      documentCount: 3,
      sectionCount: 42,
      lastUpdated: null,
    });

    const req = new Request('http://localhost/api/ra/sources');
    const res = await GET(req, {});
    const body = await res.json();

    expect(body.corpora[0].lastUpdated).toBeNull();
  });
});
