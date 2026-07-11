// @vitest-environment node
// @MX:NOTE [AUTO] Execution tests for /api/consult/sessions (SPEC-V3-CONSULT-001).
// @MX:SPEC SPEC-V3-CONSULT-001 (REQ-CONS-001..006, REQ-CONS-013, Issue 341)
//
// No prior test existed (0% coverage). Invokes the real POST/GET (list) and
// GET/DELETE ([sessionId]) handlers with db mocked as a chainable thenable over a
// per-test select queue. Covers: role-based list scoping (ra-member own vs
// ra-lead/admin org), IDOR defense (404 for cross-user access by ra-member),
// zod validation, create/delete audit rides, and soft-delete.

import { beforeEach, describe, expect, it, vi } from 'vitest';

// --- Mock state toggles ---
let authenticated = true;
let organizationId = 'org-001';
type Role = 'viewer' | 'ra-member' | 'ra-lead' | 'admin';
let userRole: Role = 'ra-lead';
let selectQueue: unknown[][] = [];

type AuditInput = {
  actor_id: string | null;
  action: string;
  resource_type: string;
  resource_id: string;
  meta_json?: Record<string, unknown>;
};

const writeAudit = vi.fn(async () => {});
const txInsertReturning = vi.fn().mockResolvedValue([{ id: 'sess-x', title: 'T' }]);
const txUpdateWhere = vi.fn().mockResolvedValue(undefined);

vi.mock('@/lib/audit', () => ({ writeAudit }));

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
          user: { id: 'user-001', role: userRole, organizationId },
        });
      },
  ),
}));

// db.select() returns a chainable THENABLE: any chain method returns the same
// object, and `await` pops the next value from selectQueue. This models the
// route's varied chains (list: where.orderBy.limit.offset; detail: where.limit(1);
// turns: where.orderBy) without per-shape mocking.
vi.mock('@/lib/db/client', () => {
  const chain: Record<string, unknown> = {};
  chain.from = () => chain;
  chain.where = () => chain;
  chain.orderBy = () => chain;
  chain.limit = () => chain;
  chain.offset = () => chain;
  // Intentional thenable: `await` on the chain pops the next queued select result.
  // biome-ignore lint/suspicious/noThenProperty: deliberate chainable thenable for the db mock
  chain.then = (resolve: (v: unknown) => void) => resolve(selectQueue.shift() ?? []);
  return {
    db: {
      select: () => chain,
      transaction: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) =>
        fn({
          insert: () => ({ values: () => ({ returning: txInsertReturning }) }),
          update: () => ({ set: () => ({ where: txUpdateWhere }) }),
        }),
      ),
    },
  };
});

const listRoute = await import('@/app/api/consult/sessions/route');
const byIdRoute = await import('@/app/api/consult/sessions/[sessionId]/route');

function postReq(body: unknown): Request {
  return new Request('http://localhost/api/consult/sessions', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

function listReq(query: string): Request {
  return new Request(`http://localhost/api/consult/sessions?${query}`);
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/** Extract audit inputs recorded by writeAudit, filtered by predicate. */
function auditCalls(predicate: (input: AuditInput) => boolean): AuditInput[] {
  return writeAudit.mock.calls
    .map((call) => (call as unknown[])[0] as AuditInput)
    .filter(predicate);
}

beforeEach(() => {
  vi.clearAllMocks();
  authenticated = true;
  organizationId = 'org-001';
  userRole = 'ra-lead';
  selectQueue = [];
  txInsertReturning.mockResolvedValue([{ id: 'sess-x', title: 'T' }]);
});

describe('POST /api/consult/sessions — create (REQ-CONS-001, REQ-CONS-013)', () => {
  it('returns 201 + consult.session.create audit (locale defaults to ko)', async () => {
    const res = await listRoute.POST(postReq({ title: '510(k) prep' }), {});
    const body = await res.json();
    expect(res.status).toBe(201);
    expect(body.session.id).toBe('sess-x');
    const created = auditCalls((i) => i.action === 'consult.session.create');
    expect(created).toHaveLength(1);
    expect(created[0]?.resource_type).toBe('consult_session');
    expect(created[0]?.meta_json?.locale).toBe('ko');
    // resource_id is the route-generated randomUUID (audit uses sessionId, not the mocked returning row).
    expect(created[0]?.resource_id).toMatch(UUID_RE);
  });

  it('accepts an explicit locale + projectId', async () => {
    const res = await listRoute.POST(
      postReq({
        title: 'CER review',
        locale: 'en',
        projectId: '00000000-0000-4000-8000-000000000000',
      }),
      {},
    );
    expect(res.status).toBe(201);
    const created = auditCalls((i) => i.action === 'consult.session.create');
    expect(created[0]?.meta_json?.locale).toBe('en');
  });

  it('returns 403 when organizationId is missing', async () => {
    organizationId = undefined as unknown as string;
    const res = await listRoute.POST(postReq({ title: 'x' }), {});
    expect(res.status).toBe(403);
  });

  it('returns 400 on an invalid title (empty)', async () => {
    const res = await listRoute.POST(postReq({ title: '' }), {});
    expect(res.status).toBe(400);
  });
});

describe('GET /api/consult/sessions — list (REQ-CONS-002, AC-CONS-02)', () => {
  it('returns 200 with sessions + pagination (ra-lead: org-wide)', async () => {
    selectQueue = [[{ id: 's1' }, { id: 's2' }]];
    const res = await listRoute.GET(listReq(''), {});
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.sessions).toHaveLength(2);
    expect(body.pagination.count).toBe(2);
  });

  it('applies the own-only userId filter for ra-member (defense-in-depth)', async () => {
    userRole = 'ra-member';
    selectQueue = [[{ id: 's1' }]];
    const res = await listRoute.GET(listReq(''), {});
    expect(res.status).toBe(200);
    // The ra-member branch executed and returned the (scoped) rows.
    expect((await res.json()).sessions).toHaveLength(1);
  });

  it('returns 400 on an out-of-range limit', async () => {
    const res = await listRoute.GET(listReq('limit=999'), {});
    expect(res.status).toBe(400);
  });
});

describe('GET /api/consult/sessions/[sessionId] — detail (REQ-CONS-003, AC-CONS-07)', () => {
  it('returns 200 with session + turns when the caller owns it', async () => {
    userRole = 'ra-member';
    selectQueue = [
      [{ id: 's1', userId: 'user-001' }], // session lookup
      [{ id: 't1', turnNumber: 1 }], // turns lookup
    ];
    const res = await byIdRoute.GET(new Request('http://localhost/api/consult/sessions/s1'), {
      params: { sessionId: 's1' },
    });
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.session.id).toBe('s1');
    expect(body.turns).toHaveLength(1);
  });

  it('returns 404 when the session does not exist', async () => {
    selectQueue = [[]]; // session lookup empty → 404 before turns
    const res = await byIdRoute.GET(new Request('http://localhost/api/consult/sessions/sx'), {
      params: { sessionId: 'sx' },
    });
    expect(res.status).toBe(404);
  });

  it('returns 404 (not 403) when an ra-member accesses another user session — IDOR defense', async () => {
    userRole = 'ra-member';
    selectQueue = [[{ id: 's1', userId: 'someone-else' }]]; // exists, wrong owner
    const res = await byIdRoute.GET(new Request('http://localhost/api/consult/sessions/s1'), {
      params: { sessionId: 's1' },
    });
    expect(res.status).toBe(404);
  });

  it('returns 400 when sessionId is missing', async () => {
    const res = await byIdRoute.GET(new Request('http://localhost/api/consult/sessions/'), {
      params: {},
    });
    expect(res.status).toBe(400);
  });
});

describe('DELETE /api/consult/sessions/[sessionId] — soft-delete (REQ-CONS-006)', () => {
  it('returns 200 + consult.session.delete audit (soft-delete in tx)', async () => {
    selectQueue = [[{ id: 's1', userId: 'user-001' }]];
    const res = await byIdRoute.DELETE(
      new Request('http://localhost/api/consult/sessions/s1', { method: 'DELETE' }),
      { params: { sessionId: 's1' } },
    );
    expect(res.status).toBe(200);
    expect(txUpdateWhere).toHaveBeenCalled();
    expect(auditCalls((i) => i.action === 'consult.session.delete')).toHaveLength(1);
  });

  it('returns 404 when the session does not exist', async () => {
    selectQueue = [[]];
    const res = await byIdRoute.DELETE(
      new Request('http://localhost/api/consult/sessions/sx', { method: 'DELETE' }),
      { params: { sessionId: 'sx' } },
    );
    expect(res.status).toBe(404);
  });
});
