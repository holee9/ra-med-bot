// @MX:NOTE [AUTO] Route tests for POST|GET /api/ra/predicate/comparison (coverage 402, SPEC-REGULA-PREDICATE-001).
// @MX:SPEC SPEC-REGULA-PREDICATE-001 (REQ-PRE-011, REQ-PRE-017..020, REQ-PRE-029)

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
          user: { id: 'user-001', role: 'ra-lead', organizationId: 'org-001' },
        }),
  ),
}));

// --- Mock db: select chain (for getDepartment + GET list) + transaction (for POST insert) ---
const mockInsertChain = {
  values: vi.fn().mockReturnThis(),
  returning: vi.fn(),
};

// Queued select results: each db.select() call pops from this array.
const selectResults: unknown[][] = [];

function makeSelectChain(rows: unknown[]) {
  const thenable: Record<string, unknown> = {};
  const chain: Record<string, unknown> = {
    from: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockResolvedValue(rows),
    limit: vi.fn().mockResolvedValue(rows),
    where: vi.fn(() => thenable),
  };
  // Make thenable resolve to rows (for direct await after .where()) AND keep chaining
  Object.assign(thenable, chain, {
    // biome-ignore lint/suspicious/noThenProperty: intentional thenable mock for Drizzle query chain
    then: (resolve: (v: unknown) => unknown) => Promise.resolve(rows).then(resolve),
    catch: (reject: (e: unknown) => unknown) => Promise.resolve(rows).catch(reject),
  });
  return chain;
}

const mockDb = {
  select: vi.fn(() => makeSelectChain(selectResults.shift() ?? [])),
  transaction: vi.fn(async (cb: (tx: unknown) => Promise<unknown>) =>
    cb({ insert: vi.fn(() => mockInsertChain) }),
  ),
};

vi.mock('@/lib/kernel/db/client', () => ({ db: mockDb }));

// --- Mock audit ---
vi.mock('@/lib/kernel/audit', () => ({
  writeAudit: vi.fn().mockResolvedValue(undefined),
}));

// --- Mock LLM provider (route calls getLlmFastModel before builder) ---
vi.mock('@/lib/ai/llm-provider', () => ({
  getLlmFastModel: vi.fn(() => ({ id: 'mock-model' }) as unknown),
}));

// --- Mock comparison builder ---
const buildComparisonMock = vi.fn();
vi.mock('@/lib/predicate/comparison-builder', () => ({
  createComparisonBuilder: vi.fn(() => ({ buildComparison: buildComparisonMock })),
}));

// --- Mock predicate RBAC (mutable so tests can flip permission) ---
const canManageComparisonsMock = vi.fn().mockReturnValue(true);
const canViewComparisonsMock = vi.fn().mockReturnValue(true);
vi.mock('@/lib/kernel/auth/predicate-permissions', () => ({
  canManageComparisons: (...a: unknown[]) => canManageComparisonsMock(...a),
  canViewComparisons: (...a: unknown[]) => canViewComparisonsMock(...a),
}));

// --- Helpers ---
function makePostRequest(body: unknown): Request {
  return new Request('http://localhost/api/ra/predicate/comparison', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

function makeGetRequest(params?: Record<string, string>): Request {
  const url = new URL('http://localhost/api/ra/predicate/comparison');
  if (params) for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  return new Request(url.toString(), { method: 'GET' });
}

const VALID_BODY = {
  subject_device_name: 'Acme Pacemaker X1',
  subject_inputs: {
    intended_use: 'Bradycardia pacing',
    tech_characteristics: 'Dual-chamber, rate-responsive',
  },
  selected_predicate_knumbers: ['K123456'],
};

const FIXED_COMPARISON = {
  dimensions: { intended_use: { verdict: 'similar' } },
  summary: 'Substantially equivalent',
};

describe('POST /api/ra/predicate/comparison — create', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    selectResults.length = 0;
    mockDb.select.mockImplementation(() => makeSelectChain(selectResults.shift() ?? []));
    canManageComparisonsMock.mockReturnValue(true);
    canViewComparisonsMock.mockReturnValue(true);
    buildComparisonMock.mockResolvedValue(FIXED_COMPARISON);
    mockInsertChain.returning.mockResolvedValue([{ id: 'wf-run-001' }]);
    // getDepartment lookup returns RA department
    selectResults.push([{ department: 'RA' }]);
  });

  it('creates comparison and returns 200 with workflow_run_id', async () => {
    const { POST } = await import('@/app/api/ra/predicate/comparison/route');
    const req = makePostRequest(VALID_BODY);
    const res = await POST(req, {});

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({
      workflow_run_id: 'wf-run-001',
      comparison: FIXED_COMPARISON,
    });
    expect(buildComparisonMock).toHaveBeenCalled();
    expect(mockDb.transaction).toHaveBeenCalled();
  });

  it('calls writeAudit with predicate_comparison_generated action', async () => {
    const { writeAudit } = await import('@/lib/kernel/audit');
    vi.mocked(writeAudit).mockClear();

    const { POST } = await import('@/app/api/ra/predicate/comparison/route');
    await POST(makePostRequest(VALID_BODY), {});

    expect(vi.mocked(writeAudit)).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'predicate_comparison_generated',
        actor_id: 'user-001',
        resource_type: 'predicate_comparison',
        resource_id: 'wf-run-001',
        meta_json: expect.objectContaining({
          predicate_k_numbers: ['K123456'],
          subject_device_name: 'Acme Pacemaker X1',
        }),
      }),
      expect.anything(),
    );
  });

  it('returns 400 on invalid JSON body', async () => {
    const { POST } = await import('@/app/api/ra/predicate/comparison/route');
    const req = makePostRequest('not-json');
    const res = await POST(req, {});

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('Invalid JSON');
  });

  it('returns 400 when subject_device_name is empty', async () => {
    const { POST } = await import('@/app/api/ra/predicate/comparison/route');
    const req = makePostRequest({
      ...VALID_BODY,
      subject_device_name: '',
    });
    const res = await POST(req, {});

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('Validation failed');
  });

  it('returns 400 when no predicate k-numbers provided', async () => {
    const { POST } = await import('@/app/api/ra/predicate/comparison/route');
    const req = makePostRequest({
      ...VALID_BODY,
      selected_predicate_knumbers: [],
    });
    const res = await POST(req, {});

    expect(res.status).toBe(400);
  });

  it('returns 403 when department lacks manage permission', async () => {
    canManageComparisonsMock.mockReturnValue(false);
    // getDepartment returns 'External'
    selectResults.length = 0;
    selectResults.push([{ department: 'External' }]);

    const { POST } = await import('@/app/api/ra/predicate/comparison/route');
    const res = await POST(makePostRequest(VALID_BODY), {});

    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body).toMatchObject({ error: 'permission_denied', reason: 'department' });
    expect(mockDb.transaction).not.toHaveBeenCalled();
  });

  it('returns 403 when getDepartment returns null (user row missing)', async () => {
    selectResults.length = 0;
    selectResults.push([]);
    // canManageComparisons(null) returns false in real impl
    canManageComparisonsMock.mockReturnValue(false);

    const { POST } = await import('@/app/api/ra/predicate/comparison/route');
    const res = await POST(makePostRequest(VALID_BODY), {});

    expect(res.status).toBe(403);
  });
});

describe('GET /api/ra/predicate/comparison — list', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    selectResults.length = 0;
    mockDb.select.mockImplementation(() => makeSelectChain(selectResults.shift() ?? []));
    canManageComparisonsMock.mockReturnValue(true);
    canViewComparisonsMock.mockReturnValue(true);
    selectResults.push([{ department: 'RA' }]);
  });

  it('returns comparison history list', async () => {
    // First select: getDepartment lookup
    // Second select: comparison rows
    selectResults.length = 0;
    selectResults.push([{ department: 'RA' }]);
    selectResults.push([
      {
        id: 'wf-run-001',
        resultJson: { summary: 'test' },
        createdAt: '2026-01-01T00:00:00Z',
      },
    ]);

    const { GET } = await import('@/app/api/ra/predicate/comparison/route');
    const res = await GET(makeGetRequest(), {});

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.comparisons).toHaveLength(1);
    expect(body.comparisons?.[0]?.id).toBe('wf-run-001');
  });

  it('returns empty list when no history exists', async () => {
    selectResults.length = 0;
    selectResults.push([{ department: 'RA' }]);
    selectResults.push([]);

    const { GET } = await import('@/app/api/ra/predicate/comparison/route');
    const res = await GET(makeGetRequest(), {});

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.comparisons).toEqual([]);
  });

  it('returns 403 when department lacks view permission', async () => {
    canViewComparisonsMock.mockReturnValue(false);
    selectResults.length = 0;
    selectResults.push([{ department: 'External' }]);

    const { GET } = await import('@/app/api/ra/predicate/comparison/route');
    const res = await GET(makeGetRequest(), {});

    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body).toMatchObject({ error: 'permission_denied', reason: 'department' });
  });

  it('respects sort=asc query param without error', async () => {
    selectResults.length = 0;
    selectResults.push([{ department: 'RA' }]);
    selectResults.push([]);

    const { GET } = await import('@/app/api/ra/predicate/comparison/route');
    const res = await GET(makeGetRequest({ sort: 'asc' }), {});

    expect(res.status).toBe(200);
  });
});
