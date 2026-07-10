// @MX:NOTE [AUTO] Route tests for GET|PATCH|DELETE /api/ra/expert-review/[id]
//   (coverage 402, SPEC-REGULA-ENTERPRISE-001).
// @MX:SPEC SPEC-REGULA-ENTERPRISE-001 (REQ-ENTERPRISE-006..008)
// @MX:TODO The existing expert-review-route.test.ts covers the collection route
//   (POST + GET list) and has basic [id] coverage. This file adds deeper
//   branch coverage for the [id] item route: PATCH invalid JSON, PATCH
//   validation failure, PATCH with assignedTo/resolution optional fields,
//   and the inner withPermission guard pattern (requiredAction per transition).

import { beforeEach, describe, expect, it, vi } from 'vitest';

// --- Mutable session ---
let sessionUser: { id: string; role: string; organizationId: string | null } = {
  id: 'user-001',
  role: 'ra-lead',
  organizationId: 'org-001',
};

// withPermission is used BOTH at the top level (GET export) AND inside PATCH
// (inner guard per transition). The mock must handle both: pass the session
// through so the inner handler can access session.user.id for audit.
vi.mock('@/lib/auth/with-permission', () => ({
  withPermission: vi.fn(
    (
      _action: string,
      handler: (req: Request, ctx: unknown, session: unknown) => Promise<Response>,
    ) =>
      (req: Request, ctx: unknown) =>
        handler(req, ctx, { user: sessionUser }),
  ),
}));

// --- Mock db: queued select + update chain + transaction ---
const selectResults: unknown[][] = [];

function makeSelectChain(rows: unknown[]) {
  return {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockResolvedValue(rows),
  };
}

const mockUpdateChain = {
  set: vi.fn().mockReturnThis(),
  where: vi.fn().mockReturnThis(),
  returning: vi.fn(),
};

const mockDb = {
  select: vi.fn(() => makeSelectChain(selectResults.shift() ?? [])),
  update: vi.fn(() => mockUpdateChain),
  // Issue #378: PATCH wraps UPDATE + audit in db.transaction; tx reuses chain.
  transaction: vi.fn(async (cb: (tx: unknown) => Promise<unknown>) =>
    cb({ update: vi.fn(() => mockUpdateChain) }),
  ),
};

vi.mock('@/lib/db/client', () => ({ db: mockDb }));

// --- Mock audit ---
vi.mock('@/lib/audit', () => ({
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
function makeIdCtx(id: string): { params: Promise<{ id: string }> } {
  return { params: Promise.resolve({ id }) };
}

function makePatchRequest(body: unknown): Request {
  return new Request('http://localhost/api/ra/expert-review/review-001', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

describe('GET /api/ra/expert-review/[id] — detail', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionUser = { id: 'user-001', role: 'ra-lead', organizationId: 'org-001' };
    selectResults.length = 0;
    mockDb.select.mockImplementation(() => makeSelectChain(selectResults.shift() ?? []));
  });

  it('returns 200 with the record when found', async () => {
    selectResults.push([FAKE_RECORD]);

    const { GET } = await import('@/app/api/ra/expert-review/[id]/route');
    const res = await GET(
      new Request('http://localhost/api/ra/expert-review/review-001'),
      makeIdCtx('review-001'),
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({ id: 'review-001', status: 'pending' });
  });

  it('returns 404 not_found when record does not exist', async () => {
    selectResults.push([]);

    const { GET } = await import('@/app/api/ra/expert-review/[id]/route');
    const res = await GET(
      new Request('http://localhost/api/ra/expert-review/nonexistent'),
      makeIdCtx('nonexistent'),
    );

    expect(res.status).toBe(404);
    expect((await res.json()).error).toBe('not_found');
  });
});

describe('PATCH /api/ra/expert-review/[id] — state machine + optional fields', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionUser = { id: 'user-001', role: 'ra-lead', organizationId: 'org-001' };
    selectResults.length = 0;
    mockDb.select.mockImplementation(() => makeSelectChain(selectResults.shift() ?? []));
  });

  it('transitions pending → in_progress and writes expert_review.assign audit', async () => {
    const pendingRecord = { ...FAKE_RECORD, status: 'pending' };
    const updatedRecord = { ...FAKE_RECORD, status: 'in_progress' };
    selectResults.push([pendingRecord]);
    mockUpdateChain.returning.mockResolvedValueOnce([updatedRecord]);

    const { writeAudit } = await import('@/lib/audit');
    vi.mocked(writeAudit).mockClear();

    const { PATCH } = await import('@/app/api/ra/expert-review/[id]/route');
    const res = await PATCH(makePatchRequest({ status: 'in_progress' }), makeIdCtx('review-001'));

    expect(res.status).toBe(200);
    expect((await res.json()).status).toBe('in_progress');
    expect(vi.mocked(writeAudit)).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'expert_review.assign',
        actor_id: 'user-001',
        resource_type: 'expert_review',
        resource_id: 'review-001',
        meta_json: { from: 'pending', to: 'in_progress' },
      }),
      expect.anything(),
    );
    expect(mockDb.transaction).toHaveBeenCalled();
  });

  it('transitions in_progress → resolved and writes expert_review.resolve audit', async () => {
    const inProgressRecord = { ...FAKE_RECORD, status: 'in_progress' };
    const resolvedRecord = { ...FAKE_RECORD, status: 'resolved', resolvedAt: new Date() };
    selectResults.push([inProgressRecord]);
    mockUpdateChain.returning.mockResolvedValueOnce([resolvedRecord]);

    const { writeAudit } = await import('@/lib/audit');
    vi.mocked(writeAudit).mockClear();

    const { PATCH } = await import('@/app/api/ra/expert-review/[id]/route');
    const res = await PATCH(makePatchRequest({ status: 'resolved' }), makeIdCtx('review-001'));

    expect(res.status).toBe(200);
    expect(vi.mocked(writeAudit)).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'expert_review.resolve',
        meta_json: { from: 'in_progress', to: 'resolved' },
      }),
      expect.anything(),
    );
  });

  it('includes assignedTo in update payload when provided', async () => {
    const pendingRecord = { ...FAKE_RECORD, status: 'pending' };
    selectResults.push([pendingRecord]);
    mockUpdateChain.returning.mockResolvedValueOnce([
      { ...FAKE_RECORD, status: 'in_progress', assignedTo: 'expert-002' },
    ]);

    const { PATCH } = await import('@/app/api/ra/expert-review/[id]/route');
    const res = await PATCH(
      makePatchRequest({ status: 'in_progress', assignedTo: 'expert-002' }),
      makeIdCtx('review-001'),
    );

    expect(res.status).toBe(200);
    // set() should have been called with a payload containing assignedTo
    expect(mockUpdateChain.set).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'in_progress', assignedTo: 'expert-002' }),
    );
  });

  it('includes resolution as notes in update payload when provided', async () => {
    const inProgressRecord = { ...FAKE_RECORD, status: 'in_progress' };
    selectResults.push([inProgressRecord]);
    mockUpdateChain.returning.mockResolvedValueOnce([
      { ...FAKE_RECORD, status: 'resolved', notes: 'approved by RA' },
    ]);

    const { PATCH } = await import('@/app/api/ra/expert-review/[id]/route');
    const res = await PATCH(
      makePatchRequest({ status: 'resolved', resolution: 'approved by RA' }),
      makeIdCtx('review-001'),
    );

    expect(res.status).toBe(200);
    expect(mockUpdateChain.set).toHaveBeenCalledWith(
      expect.objectContaining({ notes: 'approved by RA' }),
    );
  });

  it('returns 400 on invalid JSON body', async () => {
    const { PATCH } = await import('@/app/api/ra/expert-review/[id]/route');
    const res = await PATCH(makePatchRequest('not-json'), makeIdCtx('review-001'));

    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('Invalid JSON');
  });

  it('returns 400 when status is not a valid enum value', async () => {
    const { PATCH } = await import('@/app/api/ra/expert-review/[id]/route');
    const res = await PATCH(makePatchRequest({ status: 'cancelled' }), makeIdCtx('review-001'));

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('Validation failed');
    expect(body.issues).toBeDefined();
  });

  it('returns 404 when PATCH target not found', async () => {
    selectResults.push([]);

    const { PATCH } = await import('@/app/api/ra/expert-review/[id]/route');
    const res = await PATCH(makePatchRequest({ status: 'in_progress' }), makeIdCtx('nonexistent'));

    expect(res.status).toBe(404);
    expect((await res.json()).error).toBe('not_found');
  });

  it('returns 422 invalid_transition for pending → resolved (skips a state)', async () => {
    selectResults.push([{ ...FAKE_RECORD, status: 'pending' }]);

    const { PATCH } = await import('@/app/api/ra/expert-review/[id]/route');
    const res = await PATCH(makePatchRequest({ status: 'resolved' }), makeIdCtx('review-001'));

    expect(res.status).toBe(422);
    expect((await res.json()).error).toBe('invalid_transition');
  });

  it('returns 422 invalid_transition for resolved → any (terminal state)', async () => {
    selectResults.push([{ ...FAKE_RECORD, status: 'resolved' }]);

    const { PATCH } = await import('@/app/api/ra/expert-review/[id]/route');
    const res = await PATCH(makePatchRequest({ status: 'in_progress' }), makeIdCtx('review-001'));

    expect(res.status).toBe(422);
  });
});

describe('DELETE /api/ra/expert-review/[id] — method not allowed', () => {
  it('returns 405 with Allow header', async () => {
    const { DELETE } = await import('@/app/api/ra/expert-review/[id]/route');
    const res = await DELETE(
      new Request('http://localhost/api/ra/expert-review/review-001', {
        method: 'DELETE',
      }),
      {},
    );

    expect(res.status).toBe(405);
    expect(res.headers.get('Allow')).toBe('GET, PATCH');
    expect((await res.json()).error).toBe('method_not_allowed');
  });
});
