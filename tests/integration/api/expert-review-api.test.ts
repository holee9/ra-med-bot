// @MX:NOTE [AUTO] T-006 TDD RED phase — Expert Review API integration tests.
// @MX:SPEC SPEC-REGULA-ENTERPRISE-001 (REQ-ENTERPRISE-001..008)
// Full POST → GET → PATCH state machine flow tests.

import { beforeEach, describe, expect, it, vi } from 'vitest';

// --- Mock withPermission: pass-through ---
vi.mock('@/lib/auth/with-permission', () => ({
  withPermission: vi.fn(
    (
      _action: string,
      handler: (req: Request, ctx: unknown, session: unknown) => Promise<Response>,
    ) =>
      (req: Request, ctx: unknown) =>
        handler(req, ctx, { user: { id: 'user-001', role: 'ra-lead', organizationId: 'org-001' } }),
  ),
}));

// In-memory store for integration flow
let store: Record<string, Record<string, unknown>> = {};
let idCounter = 0;

function makeRecord(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  const id = `review-${++idCounter}`;
  const record = {
    id,
    conversationId: 'conv-001',
    messageId: 'msg-001',
    requestedBy: 'user-001',
    assignedTo: null,
    status: 'pending',
    notes: null,
    createdAt: new Date(),
    resolvedAt: null,
    ...overrides,
  };
  store[id] = record;
  return record;
}

const mockInsertChain = {
  values: vi.fn().mockReturnThis(),
  onConflictDoNothing: vi.fn().mockReturnThis(),
  returning: vi.fn(),
};

const mockSelectChain = {
  from: vi.fn().mockReturnThis(),
  where: vi.fn().mockReturnThis(),
  orderBy: vi.fn().mockReturnThis(),
  limit: vi.fn().mockReturnThis(),
  offset: vi.fn().mockReturnThis(),
};

const mockUpdateChain = {
  set: vi.fn().mockReturnThis(),
  where: vi.fn().mockReturnThis(),
  returning: vi.fn(),
};

vi.mock('@/lib/db/client', () => ({
  db: {
    insert: vi.fn(() => mockInsertChain),
    select: vi.fn(() => mockSelectChain),
    update: vi.fn(() => mockUpdateChain),
  },
}));

vi.mock('@/lib/audit', () => ({
  writeAudit: vi.fn().mockResolvedValue(undefined),
}));

describe('Expert Review API — integration flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    store = {};
    idCounter = 0;
  });

  it('POST → GET detail: creates record then retrieves it', async () => {
    const created = makeRecord({ notes: 'full flow test' });

    // POST: insert returns the created record
    mockInsertChain.returning.mockResolvedValueOnce([created]);

    const { POST } = await import('@/app/api/ra/expert-review/route');
    const postReq = new Request('http://localhost/api/ra/expert-review', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        conversationId: 'conv-001',
        messageId: 'msg-001',
        reason: 'full flow test',
      }),
    });
    const postRes = await POST(postReq, {});
    expect(postRes.status).toBe(201);
    const postBody = await postRes.json();
    const createdId = postBody.id;
    expect(createdId).toBeTruthy();

    // GET detail: select returns the same record
    mockSelectChain.where.mockResolvedValueOnce([created]);

    const { GET } = await import('@/app/api/ra/expert-review/[id]/route');
    const getReq = new Request(`http://localhost/api/ra/expert-review/${createdId}`);
    const getCtx = { params: Promise.resolve({ id: createdId }) };
    const getRes = await GET(getReq, getCtx as never);

    expect(getRes.status).toBe(200);
    const getBody = await getRes.json();
    expect(getBody.id).toBe(createdId);
    expect(getBody.status).toBe('pending');
  });

  it('full state machine: POST → PATCH pending→in_progress → PATCH in_progress→resolved', async () => {
    const record = makeRecord();

    // POST
    mockInsertChain.returning.mockResolvedValueOnce([record]);

    const { POST } = await import('@/app/api/ra/expert-review/route');
    const postReq = new Request('http://localhost/api/ra/expert-review', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        conversationId: 'conv-001',
        messageId: 'msg-001',
        reason: 'state machine test',
      }),
    });
    const postRes = await POST(postReq, {});
    expect(postRes.status).toBe(201);
    const { id } = await postRes.json();

    const { PATCH } = await import('@/app/api/ra/expert-review/[id]/route');

    // PATCH: pending → in_progress
    const inProgressRecord = { ...record, status: 'in_progress' };
    mockSelectChain.where.mockResolvedValueOnce([record]); // current = pending
    mockUpdateChain.returning.mockResolvedValueOnce([inProgressRecord]);

    const patch1Req = new Request(`http://localhost/api/ra/expert-review/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'in_progress' }),
    });
    const patch1Res = await PATCH(patch1Req, { params: Promise.resolve({ id }) } as never);
    expect(patch1Res.status).toBe(200);
    expect((await patch1Res.json()).status).toBe('in_progress');

    // PATCH: in_progress → resolved
    const resolvedRecord = { ...record, status: 'resolved', resolvedAt: new Date() };
    mockSelectChain.where.mockResolvedValueOnce([inProgressRecord]); // current = in_progress
    mockUpdateChain.returning.mockResolvedValueOnce([resolvedRecord]);

    const patch2Req = new Request(`http://localhost/api/ra/expert-review/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'resolved' }),
    });
    const patch2Res = await PATCH(patch2Req, { params: Promise.resolve({ id }) } as never);
    expect(patch2Res.status).toBe(200);
    expect((await patch2Res.json()).status).toBe('resolved');
  });
});
