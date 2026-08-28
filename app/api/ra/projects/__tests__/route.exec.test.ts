// @vitest-environment node
// @MX:NOTE [AUTO] Execution tests for /api/ra/projects (SPEC-REGULA-ENTERPRISE-001).
// @MX:SPEC SPEC-REGULA-ENTERPRISE-001 (REQ-ENTERPRISE-019)
//
// No prior test existed (0% coverage). Invokes GET/POST and GET/PATCH with db
// mocked as a chainable thenable over a per-test select queue. Covers: list,
// create (audit ride), missing-id/not-found, validation + invalid-json, and
// PATCH field-supersession audit.

import { beforeEach, describe, expect, it, vi } from 'vitest';

// --- Mock state toggles ---
let authenticated = true;
let organizationId = 'org-001';
let selectQueue: unknown[][] = [];

type AuditInput = {
  actor_id: string | null;
  action: string;
  resource_type: string;
  resource_id: string;
  meta_json?: Record<string, unknown>;
};

const writeAudit = vi.fn(async () => {});
const txInsertReturning = vi.fn().mockResolvedValue([{ id: 'p-1', name: 'Proj' }]);
const txUpdateReturning = vi.fn().mockResolvedValue([{ id: 'p-1', name: 'Proj2' }]);

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
          user: { id: 'user-001', role: 'ra-lead', organizationId },
        });
      },
  ),
}));

// chainable thenable: `await` pops the next queued select result.
vi.mock('@/lib/db/client', () => {
  const chain: Record<string, unknown> = {};
  chain.from = () => chain;
  chain.where = () => chain;
  chain.orderBy = () => chain;
  chain.limit = () => chain;
  // Intentional thenable: `await` on the chain pops the next queued select result.
  // biome-ignore lint/suspicious/noThenProperty: deliberate chainable thenable for the db mock
  chain.then = (resolve: (v: unknown) => void) => resolve(selectQueue.shift() ?? []);
  return {
    db: {
      select: () => chain,
      transaction: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) =>
        fn({
          insert: () => ({ values: () => ({ returning: txInsertReturning }) }),
          update: () => ({
            set: () => ({ where: vi.fn(() => ({ returning: txUpdateReturning })) }),
          }),
        }),
      ),
    },
  };
});

const listRoute = await import('@/app/api/ra/projects/route');
const byIdRoute = await import('@/app/api/ra/projects/[id]/route');

function postReq(body: unknown): Request {
  return new Request('http://localhost/api/ra/projects', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

function patchReq(id: string, body: unknown): Request {
  return new Request(`http://localhost/api/ra/projects/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
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
  selectQueue = [];
  txInsertReturning.mockResolvedValue([{ id: 'p-1', name: 'Proj' }]);
  txUpdateReturning.mockResolvedValue([{ id: 'p-1', name: 'Proj2' }]);
});

describe('GET /api/ra/projects — list (REQ-ENTERPRISE-019)', () => {
  it('returns 200 with the org-scoped project list', async () => {
    selectQueue = [[{ id: 'p-1' }, { id: 'p-2' }]];
    const res = await listRoute.GET(new Request('http://localhost/api/ra/projects'), {});
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.projects).toHaveLength(2);
  });
});

describe('POST /api/ra/projects — create', () => {
  it('returns 201 + project.create audit on success', async () => {
    const res = await listRoute.POST(postReq({ name: 'New Device' }), {});
    const body = await res.json();
    expect(res.status).toBe(201);
    expect(body.project.id).toBe('p-1');
    const created = auditCalls((i) => i.action === 'project.create');
    expect(created).toHaveLength(1);
    expect(created[0]?.resource_type).toBe('project');
  });

  it('returns 400 Invalid JSON when the body is not JSON', async () => {
    const res = await listRoute.POST(
      new Request('http://localhost/api/ra/projects', { method: 'POST', body: '{bad' }),
      {},
    );
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('Invalid JSON');
  });

  it('returns 400 Validation failed on an empty name', async () => {
    const res = await listRoute.POST(postReq({ name: '' }), {});
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('Validation failed');
  });

  it('returns 400 No organization context when orgId is empty', async () => {
    organizationId = '';
    const res = await listRoute.POST(postReq({ name: 'X' }), {});
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('No organization context');
  });
});

describe('GET /api/ra/projects/[id]', () => {
  it('returns 200 with the project when found', async () => {
    selectQueue = [[{ id: 'p-1', name: 'Proj' }]];
    const res = await byIdRoute.GET(new Request('http://localhost/api/ra/projects/p-1'), {
      params: { id: 'p-1' },
    });
    expect(res.status).toBe(200);
    expect((await res.json()).project.id).toBe('p-1');
  });

  it('returns 400 Missing id when id is absent', async () => {
    const res = await byIdRoute.GET(new Request('http://localhost/api/ra/projects/'), {
      params: {},
    });
    expect(res.status).toBe(400);
  });

  it('returns 404 when the project does not exist', async () => {
    selectQueue = [[]];
    const res = await byIdRoute.GET(new Request('http://localhost/api/ra/projects/px'), {
      params: { id: 'px' },
    });
    expect(res.status).toBe(404);
  });
});

describe('PATCH /api/ra/projects/[id]', () => {
  it('returns 200 + project.update audit with the changed field names', async () => {
    selectQueue = [[{ id: 'p-1' }]];
    const res = await byIdRoute.PATCH(patchReq('p-1', { name: 'Proj2', status: 'active' }), {
      params: { id: 'p-1' },
    });
    expect(res.status).toBe(200);
    const updated = auditCalls((i) => i.action === 'project.update');
    expect(updated).toHaveLength(1);
    expect(updated[0]?.meta_json?.fields).toEqual(['name', 'status']);
  });

  it('returns 404 when the project does not exist', async () => {
    selectQueue = [[]];
    const res = await byIdRoute.PATCH(patchReq('px', { name: 'X' }), { params: { id: 'px' } });
    expect(res.status).toBe(404);
  });

  it('returns 400 Invalid JSON when the body is not JSON', async () => {
    selectQueue = [[{ id: 'p-1' }]];
    const res = await byIdRoute.PATCH(
      new Request('http://localhost/api/ra/projects/p-1', { method: 'PATCH', body: '{bad' }),
      { params: { id: 'p-1' } },
    );
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('Invalid JSON');
  });
});
