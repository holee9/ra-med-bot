// @vitest-environment node
// @MX:NOTE [AUTO] Execution tests for GET /api/knowledge-gap/queue (SPEC-REGULA-KNOWLEDGE-GAP-001).
// @MX:SPEC SPEC-REGULA-KNOWLEDGE-GAP-001 (REQ-KNOWLEDGE-GAP-008, AC-08, Issue #35)
//
// No prior test existed (0% coverage). Invokes GET with withTenantScope mocked over a
// chainable thenable + per-test row queue. Covers: org scoping, filter branches,
// pagination, Date→ISO row mapping, invalid-query 400, and no_org_context 403.

import { beforeEach, describe, expect, it, vi } from 'vitest';

let authenticated = true;
let organizationId = 'org-001';
let rows: unknown[] = [];

vi.mock('@/lib/auth/with-permission', () => ({
  withPermission: vi.fn(
    (
      _action: string,
      handler: (req: Request, ctx: unknown, session: unknown) => Promise<Response>,
    ) =>
      (req: Request, ctx: unknown) => {
        if (!authenticated) {
          return Promise.resolve(Response.json({ error: 'Unauthorized' }, { status: 401 }));
        }
        return handler(req, ctx, {
          user: { id: 'user-001', role: 'ra-member', organizationId },
        });
      },
  ),
}));

// withTenantScope invokes the callback with a dbs handle whose select() chain is
// a chainable thenable that resolves to rows.
vi.mock('@/lib/db/client', () => {
  const chain: Record<string, unknown> = {};
  chain.from = () => chain;
  chain.where = () => chain;
  chain.orderBy = () => chain;
  chain.limit = () => chain;
  chain.offset = () => chain;
  // Intentional thenable: `await` on the chain resolves to rows.
  // biome-ignore lint/suspicious/noThenProperty: deliberate chainable thenable for the db mock
  chain.then = (resolve: (v: unknown) => void) => resolve(rows);
  const dbs = { select: () => chain };
  return {
    withTenantScope: vi.fn(async (_orgId: string, fn: (dbs: unknown) => unknown) => fn(dbs)),
  };
});

const { GET } = await import('@/app/api/knowledge-gap/queue/route');

function getReq(query: string): Request {
  return new Request(`http://localhost/api/knowledge-gap/queue?${query}`);
}

beforeEach(() => {
  vi.clearAllMocks();
  authenticated = true;
  organizationId = 'org-001';
  rows = [];
});

describe('GET /api/knowledge-gap/queue (REQ-KNOWLEDGE-GAP-008, AC-08)', () => {
  it('returns 200 with paginated items + Date→ISO mapping', async () => {
    rows = [
      {
        id: 'q1',
        createdAt: new Date('2026-01-01T00:00:00Z'),
        resolvedAt: null,
      },
      {
        id: 'q2',
        createdAt: new Date('2026-02-01T00:00:00Z'),
        resolvedAt: new Date('2026-03-01T00:00:00Z'),
      },
    ];
    const res = await GET(getReq('page=1&pageSize=10'), {});
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.items).toHaveLength(2);
    expect(body.items[0].createdAt).toBe('2026-01-01T00:00:00.000Z');
    expect(body.items[1].resolvedAt).toBe('2026-03-01T00:00:00.000Z');
    expect(body.items[0].resolvedAt).toBeNull();
  });

  it('accepts status/reason/classification filters (filter branch coverage)', async () => {
    rows = [{ id: 'q1', createdAt: new Date('2026-01-01T00:00:00Z'), resolvedAt: null }];
    const res = await GET(getReq('status=open&reason=no_results&classification=bug'), {});
    expect(res.status).toBe(200);
    expect((await res.json()).items).toHaveLength(1);
  });

  it('returns 400 invalid_query on an out-of-range pageSize', async () => {
    const res = await GET(getReq('pageSize=51'), {});
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('invalid_query');
  });

  it('returns 403 no_org_context when organizationId is missing', async () => {
    organizationId = undefined as unknown as string;
    const res = await GET(getReq(''), {});
    expect(res.status).toBe(403);
  });
});
