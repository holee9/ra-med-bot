// @vitest-environment node
// @MX:NOTE [AUTO] Execution tests for /api/project-memory (SPEC-REGULA-PROJECT-MEMORY-001).
// @MX:SPEC SPEC-REGULA-PROJECT-MEMORY-001 (REQ-006..012, AC-01, AC-07, AC-08, Issue #51)
//
// No prior test existed (0% coverage). Invokes GET/POST and PATCH/DELETE with the
// project-memory lib fns mocked. Covers: IDOR guards (assertProjectInOrg /
// assertMemoryInOrg returning a denial), zod validation, unique-index 23505 → 409
// on create + update, no_org_context, and json-parse failure.

import { beforeEach, describe, expect, it, vi } from 'vitest';

// --- Mock state toggles ---
let authenticated = true;
let organizationId = 'org-001';

const assertProjectInOrg = vi.fn(async (): Promise<Response | null> => null);
const assertMemoryInOrg = vi.fn(async (): Promise<Response | null> => null);
const getValidMemories = vi.fn();
const createMemory = vi.fn();
const updateMemory = vi.fn();
const invalidateMemory = vi.fn();

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

vi.mock('@/lib/project-memory/access', () => ({
  assertProjectInOrg,
  assertMemoryInOrg,
}));

vi.mock('@/lib/project-memory/manager', () => ({
  createMemory,
  getValidMemories,
  updateMemory,
  invalidateMemory,
}));

const listRoute = await import('@/app/api/project-memory/route');
const byIdRoute = await import('@/app/api/project-memory/[id]/route');

const PROJECT_UUID = '00000000-0000-4000-8000-000000000000';

function getReq(query: string): Request {
  return new Request(`http://localhost/api/project-memory?${query}`);
}

function postReq(body: unknown): Request {
  return new Request('http://localhost/api/project-memory', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

function patchReq(id: string, body: unknown): Request {
  return new Request(`http://localhost/api/project-memory/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}

const validCreate = {
  projectId: PROJECT_UUID,
  memoryType: 'device_classification',
  key: 'device.class',
  value: 'Class II',
};

const validPatch = {
  memoryType: 'device_classification',
  key: 'device.class',
  value: 'Class III',
};

beforeEach(() => {
  vi.clearAllMocks();
  authenticated = true;
  organizationId = 'org-001';
  assertProjectInOrg.mockResolvedValue(null);
  assertMemoryInOrg.mockResolvedValue(null);
  getValidMemories.mockResolvedValue([{ id: 'mem-1' }]);
  createMemory.mockResolvedValue({ id: 'mem-1', status: 'active' });
  updateMemory.mockResolvedValue({ id: 'mem-1', status: 'active' });
  invalidateMemory.mockResolvedValue({ ok: true });
});

describe('GET /api/project-memory — list (REQ-006, AC-08)', () => {
  it('returns 200 with memories when the project is in-org', async () => {
    const res = await listRoute.GET(getReq(`projectId=${PROJECT_UUID}`), {});
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.memories).toHaveLength(1);
  });

  it('returns 400 when projectId is missing/invalid', async () => {
    const res = await listRoute.GET(getReq('projectId=not-a-uuid'), {});
    expect(res.status).toBe(400);
  });

  it('returns 403 no_org_context when organizationId is missing', async () => {
    organizationId = undefined as unknown as string;
    const res = await listRoute.GET(getReq(`projectId=${PROJECT_UUID}`), {});
    expect(res.status).toBe(403);
  });

  it('returns the IDOR denial response when assertProjectInOrg denies', async () => {
    assertProjectInOrg.mockResolvedValueOnce(
      Response.json({ error: 'project_not_in_org' }, { status: 403 }),
    );
    const res = await listRoute.GET(getReq(`projectId=${PROJECT_UUID}`), {});
    expect(res.status).toBe(403);
    expect((await res.json()).error).toBe('project_not_in_org');
  });
});

describe('POST /api/project-memory — create (REQ-007, AC-01)', () => {
  it('returns 201 with the created memory on success', async () => {
    const res = await listRoute.POST(postReq(validCreate), {});
    expect(res.status).toBe(201);
    expect((await res.json()).id).toBe('mem-1');
    expect(createMemory).toHaveBeenCalled();
  });

  it('returns 400 invalid_json when the body is not JSON', async () => {
    const res = await listRoute.POST(
      new Request('http://localhost/api/project-memory', { method: 'POST', body: '{bad' }),
      {},
    );
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('invalid_json');
  });

  it('returns 400 validation_failed on a bad memoryType enum', async () => {
    const res = await listRoute.POST(postReq({ ...validCreate, memoryType: 'nope' }), {});
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('validation_failed');
  });

  it('returns 409 memory_duplicate_active_key on unique-index violation (23505)', async () => {
    createMemory.mockRejectedValueOnce({ code: '23505' });
    const res = await listRoute.POST(postReq(validCreate), {});
    expect(res.status).toBe(409);
    expect((await res.json()).error).toBe('memory_duplicate_active_key');
  });

  it('returns 500 memory_create_failed on a generic createMemory error', async () => {
    createMemory.mockRejectedValueOnce(new Error('db down'));
    const res = await listRoute.POST(postReq(validCreate), {});
    expect(res.status).toBe(500);
    expect((await res.json()).error).toBe('memory_create_failed');
  });
});

describe('PATCH /api/project-memory/[id] — supersession (REQ-008, REQ-012)', () => {
  it('returns 200 with the updated memory on success', async () => {
    const res = await byIdRoute.PATCH(patchReq('mem-1', validPatch), { params: { id: 'mem-1' } });
    expect(res.status).toBe(200);
    expect(updateMemory).toHaveBeenCalled();
  });

  it('returns 400 missing_id when id is absent', async () => {
    const res = await byIdRoute.PATCH(patchReq('', validPatch), { params: {} });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('missing_id');
  });

  it('returns 409 memory_duplicate_active_key on concurrent same-key update', async () => {
    updateMemory.mockRejectedValueOnce({ code: '23505' });
    const res = await byIdRoute.PATCH(patchReq('mem-1', validPatch), { params: { id: 'mem-1' } });
    expect(res.status).toBe(409);
  });
});

describe('DELETE /api/project-memory/[id] — soft-invalidate (REQ-009)', () => {
  it('returns 200 with the invalidate result on success', async () => {
    const res = await byIdRoute.DELETE(
      new Request('http://localhost/api/project-memory/mem-1', { method: 'DELETE' }),
      { params: { id: 'mem-1' } },
    );
    expect(res.status).toBe(200);
    expect(invalidateMemory).toHaveBeenCalled();
  });

  it('returns 500 memory_invalidate_failed when invalidateMemory throws', async () => {
    invalidateMemory.mockRejectedValueOnce(new Error('tx abort'));
    const res = await byIdRoute.DELETE(
      new Request('http://localhost/api/project-memory/mem-1', { method: 'DELETE' }),
      { params: { id: 'mem-1' } },
    );
    expect(res.status).toBe(500);
    expect((await res.json()).error).toBe('memory_invalidate_failed');
  });
});
