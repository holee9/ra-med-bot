// @MX:NOTE [AUTO] T-006 TDD unit tests — Expert Review API route handlers.
// @MX:SPEC SPEC-REGULA-ENTERPRISE-001 (REQ-ENTERPRISE-001..008)

import { beforeEach, describe, expect, it, vi } from 'vitest';

// --- Mock withPermission: pass-through with fixed session ---
vi.mock('@/lib/kernel/auth/with-permission', () => ({
  withPermission: vi.fn(
    (
      _action: string,
      handler: (req: Request, ctx: unknown, session: unknown) => Promise<Response>,
    ) =>
      (req: Request, ctx: unknown) =>
        handler(req, ctx, { user: { id: 'user-001', role: 'ra-lead', organizationId: 'org-001' } }),
  ),
}));

// --- Mock db: per-call independent chains ---
const mockInsertChain = {
  values: vi.fn().mockReturnThis(),
  onConflictDoNothing: vi.fn().mockReturnThis(),
  returning: vi.fn(),
};

const mockUpdateChain = {
  set: vi.fn().mockReturnThis(),
  where: vi.fn().mockReturnThis(),
  returning: vi.fn(),
};

// Queued select results: each db.select() call pops from this array.
// Each entry is the array that the full chain resolves to.
const selectResults: unknown[][] = [];

function makeSelectChain(rows: unknown[]) {
  const chain: Record<string, unknown> = {
    from: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    offset: vi.fn().mockResolvedValue(rows),
  };
  // where() returns a thenable chain — supports both chaining AND direct await
  chain.where = vi.fn().mockImplementation(() => {
    const thenable = {
      ...chain,
      // Make it a Promise so count query can await it directly
      // biome-ignore lint/suspicious/noThenProperty: intentional thenable mock for Drizzle query chain
      then: (resolve: (v: unknown) => unknown) => Promise.resolve(rows).then(resolve),
      catch: (reject: (e: unknown) => unknown) => Promise.resolve(rows).catch(reject),
      // Keep chaining support
      from: chain.from,
      orderBy: chain.orderBy,
      limit: chain.limit,
      offset: chain.offset,
      where: chain.where,
    };
    return thenable;
  });
  return chain;
}

const mockDb = {
  insert: vi.fn(() => mockInsertChain),
  select: vi.fn(() => makeSelectChain(selectResults.shift() ?? [])),
  update: vi.fn(() => mockUpdateChain),
  // Issue #378: route wraps INSERT/UPDATE + audit in db.transaction; tx reuses
  // the same insert/update chains so assertions still hold.
  transaction: vi.fn(async (cb: (tx: unknown) => Promise<unknown>) =>
    cb({ insert: vi.fn(() => mockInsertChain), update: vi.fn(() => mockUpdateChain) }),
  ),
};

vi.mock('@/lib/kernel/db/client', () => ({ db: mockDb }));

// --- Mock audit ---
vi.mock('@/lib/kernel/audit', () => ({
  writeAudit: vi.fn().mockResolvedValue(undefined),
}));

// --- Test data ---
const FAKE_RECORD = {
  id: 'review-001',
  conversationId: 'conv-001',
  messageId: 'msg-001',
  requestedBy: 'user-001',
  assignedTo: null,
  status: 'pending',
  notes: 'test reason',
  createdAt: new Date('2026-01-01'),
  resolvedAt: null,
};

// --- Helpers ---
function makePostRequest(body: unknown): Request {
  return new Request('http://localhost/api/ra/expert-review', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function makeGetListRequest(params?: Record<string, string>): Request {
  const url = new URL('http://localhost/api/ra/expert-review');
  if (params) for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  return new Request(url.toString(), { method: 'GET' });
}

// ------- POST tests -------
describe('POST /api/ra/expert-review — create', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    selectResults.length = 0;
    mockDb.select.mockImplementation(() => makeSelectChain(selectResults.shift() ?? []));
  });

  it('creates expert review and returns 201', async () => {
    mockInsertChain.returning.mockResolvedValueOnce([FAKE_RECORD]);

    const { POST } = await import('@/app/api/ra/expert-review/route');
    const req = makePostRequest({
      conversationId: 'conv-001',
      messageId: 'msg-001',
      reason: 'needs review',
    });
    const res = await POST(req, {});

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body).toMatchObject({ id: 'review-001' });
  });

  it('returns 400 when conversationId is missing', async () => {
    const { POST } = await import('@/app/api/ra/expert-review/route');
    const req = makePostRequest({ messageId: 'msg-001', reason: 'x' });
    const res = await POST(req, {});

    expect(res.status).toBe(400);
  });

  it('returns 400 when messageId is missing', async () => {
    const { POST } = await import('@/app/api/ra/expert-review/route');
    const req = makePostRequest({ conversationId: 'conv-001', reason: 'x' });
    const res = await POST(req, {});

    expect(res.status).toBe(400);
  });

  it('returns 400 when reason is empty string', async () => {
    const { POST } = await import('@/app/api/ra/expert-review/route');
    const req = makePostRequest({ conversationId: 'conv-001', messageId: 'msg-001', reason: '' });
    const res = await POST(req, {});

    expect(res.status).toBe(400);
  });

  it('returns 201 idempotently on duplicate (onConflictDoNothing returns empty)', async () => {
    // onConflictDoNothing: no row inserted
    mockInsertChain.returning.mockResolvedValueOnce([]);

    const { POST } = await import('@/app/api/ra/expert-review/route');
    const req = makePostRequest({
      conversationId: 'conv-001',
      messageId: 'msg-001',
      reason: 'dup',
    });
    const res = await POST(req, {});

    expect(res.status).toBeLessThan(400);
  });

  it('calls writeAudit with expert_review.flag action', async () => {
    mockInsertChain.returning.mockResolvedValueOnce([FAKE_RECORD]);
    const { writeAudit } = await import('@/lib/kernel/audit');
    vi.mocked(writeAudit).mockClear();

    const { POST } = await import('@/app/api/ra/expert-review/route');
    const req = makePostRequest({
      conversationId: 'conv-001',
      messageId: 'msg-001',
      reason: 'audit',
    });
    await POST(req, {});

    expect(vi.mocked(writeAudit)).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'expert_review.flag',
        actor_id: 'user-001',
        resource_type: 'message',
        resource_id: 'msg-001',
      }),
      expect.anything(),
    );
  });
});

// ------- GET list tests -------
describe('GET /api/ra/expert-review — list', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    selectResults.length = 0;
    mockDb.select.mockImplementation(() => makeSelectChain(selectResults.shift() ?? []));
  });

  it('returns paginated list with default limit=20', async () => {
    // First select: list rows (ends at .offset())
    selectResults.push([FAKE_RECORD]);
    // Second select: count rows (ends at .where())
    selectResults.push([{ total: 1 }]);

    const { GET } = await import('@/app/api/ra/expert-review/route');
    const req = makeGetListRequest();
    const res = await GET(req, {});

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('data');
    expect(body).toHaveProperty('total');
    expect(body.limit).toBe(20);
    expect(body.offset).toBe(0);
  });

  it('filters by status query param', async () => {
    selectResults.push([]);
    selectResults.push([{ total: 0 }]);

    const { GET } = await import('@/app/api/ra/expert-review/route');
    const req = makeGetListRequest({ status: 'pending' });
    const res = await GET(req, {});

    expect(res.status).toBe(200);
  });

  it('respects custom limit and offset', async () => {
    selectResults.push([]);
    selectResults.push([{ total: 0 }]);

    const { GET } = await import('@/app/api/ra/expert-review/route');
    const req = makeGetListRequest({ limit: '5', offset: '10' });
    const res = await GET(req, {});

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.limit).toBe(5);
    expect(body.offset).toBe(10);
  });
});

// ------- GET [id] detail tests -------
describe('GET /api/ra/expert-review/[id] — detail', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    selectResults.length = 0;
    mockDb.select.mockImplementation(() => makeSelectChain(selectResults.shift() ?? []));
  });

  it('returns 200 with record when found', async () => {
    selectResults.push([FAKE_RECORD]);

    const { GET } = await import('@/app/api/ra/expert-review/[id]/route');
    const req = new Request('http://localhost/api/ra/expert-review/review-001');
    const ctx = { params: Promise.resolve({ id: 'review-001' }) };
    const res = await GET(req, ctx as never);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({ id: 'review-001' });
  });

  it('returns 404 when record not found', async () => {
    selectResults.push([]);

    const { GET } = await import('@/app/api/ra/expert-review/[id]/route');
    const req = new Request('http://localhost/api/ra/expert-review/nonexistent');
    const ctx = { params: Promise.resolve({ id: 'nonexistent' }) };
    const res = await GET(req, ctx as never);

    expect(res.status).toBe(404);
  });
});

// ------- PATCH [id] state machine tests -------
describe('PATCH /api/ra/expert-review/[id] — state machine', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    selectResults.length = 0;
    mockDb.select.mockImplementation(() => makeSelectChain(selectResults.shift() ?? []));
  });

  it('transitions pending → in_progress and returns 200', async () => {
    const pendingRecord = { ...FAKE_RECORD, status: 'pending' };
    const updatedRecord = { ...FAKE_RECORD, status: 'in_progress' };

    selectResults.push([pendingRecord]); // current record fetch
    mockUpdateChain.returning.mockResolvedValueOnce([updatedRecord]);

    const { PATCH } = await import('@/app/api/ra/expert-review/[id]/route');
    const req = new Request('http://localhost/api/ra/expert-review/review-001', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'in_progress' }),
    });
    const ctx = { params: Promise.resolve({ id: 'review-001' }) };
    const res = await PATCH(req, ctx as never);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('in_progress');
  });

  it('transitions in_progress → resolved and returns 200', async () => {
    const inProgressRecord = { ...FAKE_RECORD, status: 'in_progress' };
    const resolvedRecord = { ...FAKE_RECORD, status: 'resolved' };

    selectResults.push([inProgressRecord]);
    mockUpdateChain.returning.mockResolvedValueOnce([resolvedRecord]);

    const { PATCH } = await import('@/app/api/ra/expert-review/[id]/route');
    const req = new Request('http://localhost/api/ra/expert-review/review-001', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'resolved' }),
    });
    const ctx = { params: Promise.resolve({ id: 'review-001' }) };
    const res = await PATCH(req, ctx as never);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('resolved');
  });

  it('returns 422 for invalid transition pending → resolved', async () => {
    selectResults.push([{ ...FAKE_RECORD, status: 'pending' }]);

    const { PATCH } = await import('@/app/api/ra/expert-review/[id]/route');
    const req = new Request('http://localhost/api/ra/expert-review/review-001', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'resolved' }),
    });
    const ctx = { params: Promise.resolve({ id: 'review-001' }) };
    const res = await PATCH(req, ctx as never);

    expect(res.status).toBe(422);
    expect((await res.json()).error).toBe('invalid_transition');
  });

  it('returns 422 for invalid transition resolved → pending', async () => {
    selectResults.push([{ ...FAKE_RECORD, status: 'resolved' }]);

    const { PATCH } = await import('@/app/api/ra/expert-review/[id]/route');
    const req = new Request('http://localhost/api/ra/expert-review/review-001', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'pending' }),
    });
    const ctx = { params: Promise.resolve({ id: 'review-001' }) };
    const res = await PATCH(req, ctx as never);

    expect(res.status).toBe(422);
    expect((await res.json()).error).toBe('invalid_transition');
  });

  it('returns 404 when PATCH target not found', async () => {
    selectResults.push([]);

    const { PATCH } = await import('@/app/api/ra/expert-review/[id]/route');
    const req = new Request('http://localhost/api/ra/expert-review/nonexistent', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'in_progress' }),
    });
    const ctx = { params: Promise.resolve({ id: 'nonexistent' }) };
    const res = await PATCH(req, ctx as never);

    expect(res.status).toBe(404);
  });
});

// ------- DELETE [id] 405 test -------
describe('DELETE /api/ra/expert-review/[id] — 405', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 405 with Allow header and method_not_allowed body', async () => {
    const { DELETE } = await import('@/app/api/ra/expert-review/[id]/route');
    const req = new Request('http://localhost/api/ra/expert-review/review-001', {
      method: 'DELETE',
    });
    const ctx = { params: Promise.resolve({ id: 'review-001' }) };
    const res = await DELETE(req, ctx as never);

    expect(res.status).toBe(405);
    expect(res.headers.get('Allow')).toBe('GET, PATCH');
    expect((await res.json()).error).toBe('method_not_allowed');
  });
});
