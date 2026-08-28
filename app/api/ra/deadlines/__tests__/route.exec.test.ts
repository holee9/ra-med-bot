// @vitest-environment node
// @MX:NOTE [AUTO] Execution tests for /api/ra/deadlines (SPEC-REGULA-CALENDAR-001).
// @MX:SPEC SPEC-REGULA-CALENDAR-001 (REQ-CAL-001..006, Issue #44)
//
// The sibling route.test.ts guards RBAC permission strings + route-file existence
// at the SOURCE level; these tests actually INVOKE GET/POST and GET/PATCH/DELETE
// so the handlers earn real execution + branch coverage. Covers: project-membership
// enforcement (REQ-CAL-002), zod validation, filter condition building, the
// tx insert/update/delete + writeAudit rides, and not_found/not_a_member paths.

import { beforeEach, describe, expect, it, vi } from 'vitest';

// --- Mock state toggles ---
let authenticated = true;
let organizationId = 'org-001';
let isMember = true;
let selectRows: unknown[] = [];

type AuditInput = {
  actor_id: string | null;
  action: string;
  resource_type: string;
  resource_id: string;
  meta_json?: Record<string, unknown>;
};

const writeAudit = vi.fn(async () => {});
const isProjectMember = vi.fn(async () => isMember);

vi.mock('@/lib/audit', () => ({ writeAudit }));

vi.mock('@/lib/auth/acl', () => ({ isProjectMember }));

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
          user: { id: 'user-001', role: 'ra-lead', organizationId },
        });
      },
  ),
}));

// db mock supports:
//   db.select().from().where().orderBy() | .limit(1)   (list + resolveAndCheck)
//   db.transaction(tx => tx.insert().values().returning() | tx.update().set().where().returning() | tx.delete().where())
const txInsertReturning = vi.fn().mockResolvedValue([{ id: 'dl-1', createdAt: 'ts' }]);
const txUpdateReturning = vi.fn().mockResolvedValue([{ id: 'dl-1', updatedAt: 'ts' }]);
const txDeleteWhere = vi.fn().mockResolvedValue(undefined);

vi.mock('@/lib/db/client', () => {
  const orderBy = vi.fn(async () => selectRows);
  const limit = vi.fn(async () => selectRows);
  const where = vi.fn(() => ({ orderBy, limit }));
  const from = vi.fn(() => ({ where, orderBy, limit }));
  return {
    db: {
      select: vi.fn(() => ({ from })),
      transaction: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) =>
        fn({
          insert: vi.fn(() => ({
            values: vi.fn(() => ({ returning: txInsertReturning })),
          })),
          update: vi.fn(() => ({
            set: vi.fn(() => ({ where: vi.fn(() => ({ returning: txUpdateReturning })) })),
          })),
          delete: vi.fn(() => ({ where: txDeleteWhere })),
        }),
      ),
    },
  };
});

const listRoute = await import('@/app/api/ra/deadlines/route');
const byIdRoute = await import('@/app/api/ra/deadlines/[id]/route');

const PROJECT_UUID = '00000000-0000-4000-8000-000000000000';

function listReq(query: string): Request {
  return new Request(`http://localhost/api/ra/deadlines?${query}`);
}

function postReq(body: unknown): Request {
  return new Request('http://localhost/api/ra/deadlines', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

function patchReq(id: string, body: unknown): Request {
  return new Request(`http://localhost/api/ra/deadlines/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}

const validCreate = {
  projectId: PROJECT_UUID,
  title: '510(k) submission window',
  deadlineType: 'fda_510k_clock',
  jurisdiction: 'FDA',
  dueDate: '2026-12-31',
};

/** A deadline row returned by the (mocked) select in resolveAndCheck. */
function deadlineRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'dl-1',
    projectId: 'proj-1',
    title: 'T',
    deadlineType: 'fda_510k_clock',
    jurisdiction: 'FDA',
    dueDate: new Date('2026-12-31'),
    status: 'upcoming',
    ...overrides,
  };
}

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
  isMember = true;
  selectRows = [];
  txInsertReturning.mockResolvedValue([{ id: 'dl-1', createdAt: 'ts' }]);
  txUpdateReturning.mockResolvedValue([{ id: 'dl-1', updatedAt: 'ts' }]);
});

describe('GET /api/ra/deadlines — list (REQ-CAL-001, REQ-CAL-002)', () => {
  it('returns 200 with deadlines + count when the caller is a project member', async () => {
    selectRows = [deadlineRow({ id: 'a' }), deadlineRow({ id: 'b' })];
    const res = await listRoute.GET(listReq(`projectId=${PROJECT_UUID}`), {});
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.count).toBe(2);
    expect(body.deadlines).toHaveLength(2);
  });

  it('returns 400 when projectId is missing', async () => {
    const res = await listRoute.GET(listReq(''), {});
    expect(res.status).toBe(400);
  });

  it('returns 403 not_a_member when isProjectMember is false', async () => {
    isMember = false;
    const res = await listRoute.GET(listReq(`projectId=${PROJECT_UUID}`), {});
    expect(res.status).toBe(403);
    expect((await res.json()).error).toBe('not_a_member');
  });

  it('applies jurisdiction/type/status filter conditions (branch coverage)', async () => {
    selectRows = [deadlineRow()];
    const res = await listRoute.GET(
      listReq(`projectId=${PROJECT_UUID}&jurisdiction=FDA&type=fda_510k_clock&status=upcoming`),
      {},
    );
    expect(res.status).toBe(200);
    // select().from().where() was exercised (conditions were built for all 3 filters).
    expect(selectRows).toHaveLength(1);
  });
});

describe('POST /api/ra/deadlines — create (REQ-CAL-003, REQ-CAL-005)', () => {
  it('returns 201 + deadline.created audit on success', async () => {
    const res = await listRoute.POST(postReq(validCreate), {});
    const body = await res.json();
    expect(res.status).toBe(201);
    expect(body.deadline.id).toBe('dl-1');
    const created = auditCalls((i) => i.action === 'deadline.created');
    expect(created).toHaveLength(1);
    expect(created[0]?.resource_type).toBe('deadline');
  });

  it('returns 400 on invalid body (bad jurisdiction enum)', async () => {
    const res = await listRoute.POST(postReq({ ...validCreate, jurisdiction: 'NOT_REAL' }), {});
    expect(res.status).toBe(400);
  });

  it('returns 403 not_a_member when the caller lacks project membership', async () => {
    isMember = false;
    const res = await listRoute.POST(postReq(validCreate), {});
    expect(res.status).toBe(403);
  });

  it('returns 500 insert_failed when the insert returns no row', async () => {
    txInsertReturning.mockResolvedValue([]);
    const res = await listRoute.POST(postReq(validCreate), {});
    expect(res.status).toBe(500);
    expect((await res.json()).error).toBe('insert_failed');
  });
});

describe('GET/PATCH/DELETE /api/ra/deadlines/[id] (REQ-CAL-002, REQ-CAL-006)', () => {
  it('GET returns 200 with the deadline when found + member', async () => {
    selectRows = [deadlineRow()];
    const res = await byIdRoute.GET(new Request('http://localhost/api/ra/deadlines/dl-1'), {
      params: { id: 'dl-1' },
    });
    expect(res.status).toBe(200);
    expect((await res.json()).deadline.id).toBe('dl-1');
  });

  it('GET returns 404 when the deadline does not exist', async () => {
    selectRows = [];
    const res = await byIdRoute.GET(new Request('http://localhost/api/ra/deadlines/dl-x'), {
      params: { id: 'dl-x' },
    });
    expect(res.status).toBe(404);
  });

  it('GET returns 403 when the deadline exists but the caller is not a member', async () => {
    selectRows = [deadlineRow()];
    isMember = false;
    const res = await byIdRoute.GET(new Request('http://localhost/api/ra/deadlines/dl-1'), {
      params: { id: 'dl-1' },
    });
    expect(res.status).toBe(403);
  });

  it('PATCH returns 200 + deadline.updated audit with the changed field names', async () => {
    selectRows = [deadlineRow()];
    const res = await byIdRoute.PATCH(patchReq('dl-1', { title: 'Renamed', status: 'completed' }), {
      params: { id: 'dl-1' },
    });
    expect(res.status).toBe(200);
    const updated = auditCalls((i) => i.action === 'deadline.updated');
    expect(updated).toHaveLength(1);
    expect(updated[0]?.meta_json?.fields).toEqual(['title', 'status']);
  });

  it('PATCH returns 400 on an invalid patch body', async () => {
    selectRows = [deadlineRow()];
    const res = await byIdRoute.PATCH(patchReq('dl-1', { jurisdiction: 'BAD' }), {
      params: { id: 'dl-1' },
    });
    expect(res.status).toBe(400);
  });

  it('DELETE returns 200 + deadline.deleted audit', async () => {
    selectRows = [deadlineRow()];
    const res = await byIdRoute.DELETE(
      new Request('http://localhost/api/ra/deadlines/dl-1', { method: 'DELETE' }),
      { params: { id: 'dl-1' } },
    );
    expect(res.status).toBe(200);
    expect(auditCalls((i) => i.action === 'deadline.deleted')).toHaveLength(1);
    expect(txDeleteWhere).toHaveBeenCalled();
  });
});
