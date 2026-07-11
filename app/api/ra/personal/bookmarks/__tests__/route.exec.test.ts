// @vitest-environment node
// @MX:NOTE [AUTO] Execution tests for /api/ra/personal/bookmarks (SPEC-REGULA-PERSONAL-LIB-001).
// @MX:SPEC SPEC-REGULA-PERSONAL-LIB-001 (REQ-PERSONAL-001..008, Issue #86)
//
// The sibling personal/__tests__/route.test.ts guards RBAC strings + privacy
// invariant at the SOURCE level; these tests actually INVOKE GET/POST and
// GET/PATCH/DELETE so the handlers earn real execution + branch coverage.
// Covers: userId-scoped privacy (404 not 403 for not-owned), tag/q filter
// branches, POST duplicate 409 (unique-index 23505), insert_failed 500, and
// the create/delete audit rides.

import { beforeEach, describe, expect, it, vi } from 'vitest';

// --- Mock state toggles ---
let authenticated = true;
let organizationId = 'org-001';
let selectRows: unknown[] = [];

type AuditInput = {
  actor_id: string | null;
  action: string;
  resource_type: string;
  resource_id: string;
  meta_json?: Record<string, unknown>;
};

const writeAudit = vi.fn(async () => {});

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
          user: { id: 'user-001', role: 'ra-member', organizationId },
        });
      },
  ),
}));

// db mock supports:
//   GET list : db.select({...}).from().where().orderBy().limit() -> rows
//   [id] GET : db.select().from().where().limit(1) -> [row]
//   [id] PATCH: db.update().set().where().returning() -> [updated]
//   POST tx  : tx.insert().values().returning() + writeAudit
//   DELETE tx: tx.delete().where().returning() + writeAudit (if removed)
const txInsertReturning = vi.fn().mockResolvedValue([{ id: 'bm-1', createdAt: 'ts' }]);
const txDeleteReturning = vi.fn().mockResolvedValue([{ id: 'bm-1' }]);
const patchReturning = vi.fn().mockResolvedValue([{ id: 'bm-1', updatedAt: 'ts' }]);

vi.mock('@/lib/db/client', () => {
  const limit = vi.fn(async () => selectRows);
  const orderBy = vi.fn(() => ({ limit }));
  const where = vi.fn(() => ({ orderBy, limit }));
  const from = vi.fn(() => ({ where, orderBy, limit }));
  return {
    db: {
      select: vi.fn(() => ({ from })),
      update: vi.fn(() => ({
        set: vi.fn(() => ({ where: vi.fn(() => ({ returning: patchReturning })) })),
      })),
      transaction: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) =>
        fn({
          insert: vi.fn(() => ({
            values: vi.fn(() => ({ returning: txInsertReturning })),
          })),
          delete: vi.fn(() => ({ where: vi.fn(() => ({ returning: txDeleteReturning })) })),
        }),
      ),
    },
  };
});

const listRoute = await import('@/app/api/ra/personal/bookmarks/route');
const byIdRoute = await import('@/app/api/ra/personal/bookmarks/[id]/route');

function listReq(query: string): Request {
  return new Request(`http://localhost/api/ra/personal/bookmarks?${query}`);
}

function postReq(body: unknown): Request {
  return new Request('http://localhost/api/ra/personal/bookmarks', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

const MESSAGE_UUID = '00000000-0000-4000-8000-000000000000';

const validCreate = {
  messageId: MESSAGE_UUID,
  title: '510(k) predicate note',
  tags: ['predicate', '510k'],
};

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
  selectRows = [];
  txInsertReturning.mockResolvedValue([{ id: 'bm-1', createdAt: 'ts' }]);
  txDeleteReturning.mockResolvedValue([{ id: 'bm-1' }]);
  patchReturning.mockResolvedValue([{ id: 'bm-1', updatedAt: 'ts' }]);
});

describe('GET /api/ra/personal/bookmarks — list (REQ-PERSONAL-001, REQ-PERSONAL-002)', () => {
  it('returns 200 with bookmarks scoped to the session user', async () => {
    selectRows = [{ id: 'bm-1' }, { id: 'bm-2' }];
    const res = await listRoute.GET(listReq(''), {});
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.count).toBe(2);
    expect(body.bookmarks).toHaveLength(2);
  });

  it('applies tag + q filter branches when provided', async () => {
    selectRows = [{ id: 'bm-1' }];
    const res = await listRoute.GET(listReq('tag=predicate&q=510k&limit=10'), {});
    expect(res.status).toBe(200);
    expect(selectRows).toHaveLength(1);
  });
});

describe('POST /api/ra/personal/bookmarks — create (REQ-PERSONAL-003, REQ-PERSONAL-004)', () => {
  it('returns 201 + personal_bookmark.created audit on success', async () => {
    const res = await listRoute.POST(postReq(validCreate), {});
    const body = await res.json();
    expect(res.status).toBe(201);
    expect(body.bookmark.id).toBe('bm-1');
    const created = auditCalls((i) => i.action === 'personal_bookmark.created');
    expect(created).toHaveLength(1);
    expect(created[0]?.resource_type).toBe('personalBookmark');
    expect(created[0]?.meta_json?.tagCount).toBe(2);
  });

  it('returns 400 on invalid body (missing messageId)', async () => {
    const res = await listRoute.POST(postReq({ title: 'no message' }), {});
    expect(res.status).toBe(400);
  });

  it('returns 409 duplicate_bookmark on unique-index violation (23505)', async () => {
    txInsertReturning.mockRejectedValueOnce({ code: '23505' });
    const res = await listRoute.POST(postReq(validCreate), {});
    expect(res.status).toBe(409);
    expect((await res.json()).error).toBe('duplicate_bookmark');
  });

  it('returns 500 insert_failed when the insert returns no row', async () => {
    txInsertReturning.mockResolvedValueOnce([]);
    const res = await listRoute.POST(postReq(validCreate), {});
    expect(res.status).toBe(500);
    expect((await res.json()).error).toBe('insert_failed');
  });
});

describe('GET/PATCH/DELETE /api/ra/personal/bookmarks/[id] (REQ-PERSONAL-002, 005, 006, 008)', () => {
  it('GET returns 200 with the bookmark when owned by the session user', async () => {
    selectRows = [{ id: 'bm-1', userId: 'user-001' }];
    const res = await byIdRoute.GET(
      new Request('http://localhost/api/ra/personal/bookmarks/bm-1'),
      {
        params: { id: 'bm-1' },
      },
    );
    expect(res.status).toBe(200);
    expect((await res.json()).bookmark.id).toBe('bm-1');
  });

  it('GET returns 404 (not 403) when not found / not owned — privacy invariant', async () => {
    selectRows = [];
    const res = await byIdRoute.GET(
      new Request('http://localhost/api/ra/personal/bookmarks/bm-x'),
      {
        params: { id: 'bm-x' },
      },
    );
    expect(res.status).toBe(404);
  });

  it('PATCH returns 200 with the updated bookmark', async () => {
    const res = await byIdRoute.PATCH(
      new Request('http://localhost/api/ra/personal/bookmarks/bm-1', {
        method: 'PATCH',
        body: JSON.stringify({ note: 'updated note', tags: ['x'] }),
      }),
      { params: { id: 'bm-1' } },
    );
    expect(res.status).toBe(200);
    expect((await res.json()).bookmark.id).toBe('bm-1');
  });

  it('PATCH returns 404 when the update matches no owned row', async () => {
    patchReturning.mockResolvedValueOnce([]);
    const res = await byIdRoute.PATCH(
      new Request('http://localhost/api/ra/personal/bookmarks/bm-x', {
        method: 'PATCH',
        body: JSON.stringify({ note: 'x' }),
      }),
      { params: { id: 'bm-x' } },
    );
    expect(res.status).toBe(404);
  });

  it('PATCH returns 400 on an invalid patch body', async () => {
    const res = await byIdRoute.PATCH(
      new Request('http://localhost/api/ra/personal/bookmarks/bm-1', {
        method: 'PATCH',
        body: JSON.stringify({ tags: [''] }),
      }),
      { params: { id: 'bm-1' } },
    );
    expect(res.status).toBe(400);
  });

  it('DELETE returns 200 + personal_bookmark.deleted audit when the row is removed', async () => {
    const res = await byIdRoute.DELETE(
      new Request('http://localhost/api/ra/personal/bookmarks/bm-1', { method: 'DELETE' }),
      { params: { id: 'bm-1' } },
    );
    expect(res.status).toBe(200);
    expect(auditCalls((i) => i.action === 'personal_bookmark.deleted')).toHaveLength(1);
  });

  it('DELETE returns 404 (no audit) when nothing is removed', async () => {
    txDeleteReturning.mockResolvedValueOnce([]);
    const res = await byIdRoute.DELETE(
      new Request('http://localhost/api/ra/personal/bookmarks/bm-x', { method: 'DELETE' }),
      { params: { id: 'bm-x' } },
    );
    expect(res.status).toBe(404);
    expect(auditCalls((i) => i.action === 'personal_bookmark.deleted')).toHaveLength(0);
  });
});
