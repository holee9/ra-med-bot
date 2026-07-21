// @MX:NOTE [AUTO] TDD unit tests — Dashboard API route handler.
// @MX:SPEC SPEC-REGULA-RELEASE-HARDENING-001 (TASK-001)
// Verifies that GET /api/ra/dashboard returns real Drizzle aggregate counts
// rather than the previous hardcoded stub.

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

// --- Mock db ---
// Each db.select(...).from(table) call returns its own chain. We push results
// onto a queue in the order the route invokes the queries:
//   1. total_documents      (source_sections count)
//   2. total_sessions       (conversations count)
//   3. recent_sessions_7d   (conversations created_at > now-7d count)
//   4. active_users         (distinct user_id count over last 7d)
const resultQueue: unknown[][] = [];

const makeChain = () => {
  const chain: {
    from: ReturnType<typeof vi.fn>;
    where: ReturnType<typeof vi.fn>;
    then: (resolve: (v: unknown) => unknown) => Promise<unknown>;
  } = {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    // Drizzle query builders are thenable; await resolves to the row array.
    // biome-ignore lint/suspicious/noThenProperty: intentional thenable mock for Drizzle query chain
    then: (resolve: (v: unknown) => unknown) => {
      const next = resultQueue.shift() ?? [];
      return Promise.resolve(resolve(next));
    },
  };
  return chain;
};

vi.mock('@/lib/kernel/db/client', () => ({
  db: {
    select: vi.fn(() => makeChain()),
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
  resultQueue.length = 0;
});

// Import handler after mocks are in place
const { GET } = await import('@/app/api/ra/dashboard/route');

describe('GET /api/ra/dashboard', () => {
  it('returns real aggregate counts (not hardcoded stub)', async () => {
    // Push fake aggregate results in the order the route queries them.
    resultQueue.push([{ count: 1234 }]); // total_documents
    resultQueue.push([{ count: 87 }]); // total_sessions
    resultQueue.push([{ count: 12 }]); // recent_sessions_7d
    resultQueue.push([{ count: 5 }]); // active_users

    const req = new Request('http://localhost/api/ra/dashboard');
    const res = await GET(req, {});
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.orgId).toBe('org-001');
    expect(body.stats).toEqual({
      total_documents: 1234,
      total_sessions: 87,
      recent_sessions_7d: 12,
      active_users: 5,
    });
  });

  it('returns zeros when DB is empty (count rows still arrive as 0)', async () => {
    resultQueue.push([{ count: 0 }]);
    resultQueue.push([{ count: 0 }]);
    resultQueue.push([{ count: 0 }]);
    resultQueue.push([{ count: 0 }]);

    const req = new Request('http://localhost/api/ra/dashboard');
    const res = await GET(req, {});
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.stats.total_documents).toBe(0);
    expect(body.stats.total_sessions).toBe(0);
    expect(body.stats.recent_sessions_7d).toBe(0);
    expect(body.stats.active_users).toBe(0);
  });

  it('coerces null/missing count rows to 0 (defensive)', async () => {
    // Drizzle's count() should always yield a row, but guard against drivers
    // returning string-typed counts (postgres-js returns bigint as string).
    resultQueue.push([{ count: '42' }]); // simulate string-typed count
    resultQueue.push([]); // simulate empty result set
    resultQueue.push([{ count: null }]);
    resultQueue.push([{ count: 3 }]);

    const req = new Request('http://localhost/api/ra/dashboard');
    const res = await GET(req, {});
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.stats.total_documents).toBe(42);
    expect(body.stats.total_sessions).toBe(0);
    expect(body.stats.recent_sessions_7d).toBe(0);
    expect(body.stats.active_users).toBe(3);
  });

  it('issues exactly 4 db.select() calls (one per aggregate)', async () => {
    resultQueue.push([{ count: 0 }]);
    resultQueue.push([{ count: 0 }]);
    resultQueue.push([{ count: 0 }]);
    resultQueue.push([{ count: 0 }]);

    const { db } = await import('@/lib/kernel/db/client');
    const req = new Request('http://localhost/api/ra/dashboard');
    await GET(req, {});

    expect(db.select).toHaveBeenCalledTimes(4);
  });
});
