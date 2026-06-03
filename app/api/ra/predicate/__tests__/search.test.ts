// @vitest-environment node
// @MX:NOTE [AUTO] TDD unit tests — POST /api/ra/predicate/search route handler.
// @MX:SPEC SPEC-REGULA-PREDICATE-001 (REQ-PRE-001, REQ-PRE-007, REQ-PRE-009, REQ-PRE-010, REQ-PRE-029)
//
// Covers: department RBAC (RA/Dev allow, Exec/External deny), KV cache hit/miss,
// cascade-search invocation, audit logging with top-5 K-numbers, validation, and
// openFDA failure → 500.

import type { CascadeSearchResult, PredicateCandidate } from '@/lib/predicate/types';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// --- Mock withPermission: pass-through with a department-injectable session ---
// Department is NOT on the session (it lives on users.department); the route
// fetches it from the DB. We expose a mutable holder so each test sets the
// department the mocked db will return.
let currentDepartment: 'RA' | 'Dev' | 'Exec' | 'External' | null = 'RA';

vi.mock('@/lib/auth/with-permission', () => ({
  withPermission: vi.fn(
    (
      _action: string,
      handler: (req: Request, ctx: unknown, session: unknown) => Promise<Response>,
    ) =>
      (req: Request, ctx: unknown) =>
        handler(req, ctx, {
          user: { id: 'user-001', role: 'ra-member', organizationId: 'org-001' },
        }),
  ),
}));

// --- Mock db: department lookup returns currentDepartment ---
vi.mock('@/lib/db/client', () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn(async () => [{ department: currentDepartment }]),
    })),
  },
}));

// --- Mock audit ---
interface AuditEventArg {
  action: string;
  actor_id: string | null;
  resource_type: string;
  resource_id: string;
  meta_json: { query: string; result_count: number; top_k_numbers: string[] };
}
const writeAuditMock = vi.fn<[AuditEventArg], Promise<void>>(async () => {});
vi.mock('@/lib/audit', () => ({
  writeAudit: (arg: AuditEventArg) => writeAuditMock(arg),
}));

// --- Mock predicate cache ---
const cacheGet = vi.fn<[string], Promise<PredicateCandidate[] | null>>();
const cacheSet = vi.fn<[string, PredicateCandidate[]], Promise<void>>(async () => {});
vi.mock('@/lib/predicate/cache', () => ({
  createPredicateCache: vi.fn(() => ({
    get: cacheGet,
    set: cacheSet,
    invalidateAll: vi.fn(async () => {}),
  })),
}));

// --- Mock openFDA client factory (route builds the client, then cascade uses it) ---
vi.mock('@/lib/predicate/openfda-client', () => ({
  createOpenFDAClient: vi.fn(() => ({
    requestsPerMinute: 240,
    search: vi.fn(),
    paginate: vi.fn(),
  })),
}));

// --- Mock cascade search ---
const cascadeSearch = vi.fn<[string, unknown], Promise<CascadeSearchResult>>();
vi.mock('@/lib/predicate/cascade-search', () => ({
  createCascadeSearch: vi.fn(() => ({ search: cascadeSearch })),
}));

function candidate(k: string): PredicateCandidate {
  return {
    k_number: k,
    applicant_name: 'Acme',
    device_name: 'Infusion Pump',
    decision_date: '2023-01-01',
    decision: 'SESE',
    product_code: 'ABC',
    statement_or_summary: 'S',
    device_description: 'D',
  };
}

function cascadeResult(over: Partial<CascadeSearchResult> = {}): CascadeSearchResult {
  return {
    candidates: [candidate('K1'), candidate('K2'), candidate('K3')],
    total: 20,
    search_strategy: 'device_name',
    cached: false,
    has_coverage_gap: false,
    ...over,
  };
}

const { POST } = await import('@/app/api/ra/predicate/search/route');

function postReq(body: unknown): Request {
  return new Request('http://localhost/api/ra/predicate/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  currentDepartment = 'RA';
  cacheGet.mockResolvedValue(null);
  cascadeSearch.mockResolvedValue(cascadeResult());
});

describe('POST /api/ra/predicate/search — happy path (REQ-PRE-001)', () => {
  it('returns 200 with a candidates array for an RA user', async () => {
    const res = await POST(postReq({ device_name: 'Infusion Pump' }), {});
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(Array.isArray(body.candidates)).toBe(true);
    expect(body.candidates).toHaveLength(3);
    expect(body.search_strategy).toBe('device_name');
  });

  it('allows a Dev-department user', async () => {
    currentDepartment = 'Dev';
    const res = await POST(postReq({ device_name: 'Infusion Pump' }), {});
    expect(res.status).toBe(200);
  });
});

describe('POST /api/ra/predicate/search — caching (REQ-PRE-009)', () => {
  it('returns cached:true and does NOT call cascade-search on a cache hit', async () => {
    cacheGet.mockResolvedValue([candidate('K1'), candidate('K2')]);

    const res = await POST(postReq({ device_name: 'Infusion Pump' }), {});
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.cached).toBe(true);
    expect(body.candidates).toHaveLength(2);
    expect(cascadeSearch).not.toHaveBeenCalled();
  });

  it('runs cascade-search, caches the result, and returns cached:false on a cache miss', async () => {
    cacheGet.mockResolvedValue(null);

    const res = await POST(postReq({ device_name: 'Infusion Pump' }), {});
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.cached).toBe(false);
    expect(cascadeSearch).toHaveBeenCalledOnce();
    expect(cacheSet).toHaveBeenCalledOnce();
    // The cached payload must be the cascade candidates.
    const cachedArg = cacheSet.mock.calls[0]?.[1] as PredicateCandidate[] | undefined;
    expect(cachedArg).toHaveLength(3);
  });

  it('checks the cache BEFORE invoking cascade-search', async () => {
    const order: string[] = [];
    cacheGet.mockImplementation(async () => {
      order.push('cache');
      return null;
    });
    cascadeSearch.mockImplementation(async () => {
      order.push('cascade');
      return cascadeResult();
    });

    await POST(postReq({ device_name: 'Infusion Pump' }), {});

    expect(order).toEqual(['cache', 'cascade']);
  });
});

describe('POST /api/ra/predicate/search — audit (REQ-PRE-010)', () => {
  it('writes a predicate_search audit row with query, result_count, and top-5 K-numbers', async () => {
    cascadeSearch.mockResolvedValue(
      cascadeResult({
        candidates: ['K1', 'K2', 'K3', 'K4', 'K5', 'K6'].map(candidate),
      }),
    );

    await POST(postReq({ device_name: 'Infusion Pump' }), {});

    expect(writeAuditMock).toHaveBeenCalledOnce();
    const event = (writeAuditMock.mock.calls[0] as unknown[])[0] as Record<string, unknown>;
    expect(event.action).toBe('predicate_search');
    const meta = event.meta_json as Record<string, unknown>;
    expect(meta.query).toBe('Infusion Pump');
    expect(meta.result_count).toBe(6);
    // Only the top-5 K-numbers are recorded.
    expect(meta.top_k_numbers).toEqual(['K1', 'K2', 'K3', 'K4', 'K5']);
  });

  it('writes an audit row on a cache hit as well', async () => {
    cacheGet.mockResolvedValue([candidate('K1')]);
    await POST(postReq({ device_name: 'Infusion Pump' }), {});
    expect(writeAuditMock).toHaveBeenCalledOnce();
  });
});

describe('POST /api/ra/predicate/search — coverage gap (REQ-PRE-007)', () => {
  it('propagates has_coverage_gap:true from the cascade result', async () => {
    cascadeSearch.mockResolvedValue(cascadeResult({ has_coverage_gap: true }));
    const res = await POST(postReq({ device_name: 'Rare Device' }), {});
    const body = await res.json();
    expect(body.has_coverage_gap).toBe(true);
  });
});

describe('POST /api/ra/predicate/search — validation', () => {
  it('returns 400 when device_name is missing', async () => {
    const res = await POST(postReq({}), {});
    expect(res.status).toBe(400);
    expect(cascadeSearch).not.toHaveBeenCalled();
  });

  it('returns 400 when device_name is an empty string', async () => {
    const res = await POST(postReq({ device_name: '' }), {});
    expect(res.status).toBe(400);
  });

  it('returns 400 on invalid JSON', async () => {
    const req = new Request('http://localhost/api/ra/predicate/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'not json',
    });
    const res = await POST(req, {});
    expect(res.status).toBe(400);
  });
});

describe('POST /api/ra/predicate/search — department RBAC (REQ-PRE-029)', () => {
  it('returns 403 for an External-department user', async () => {
    currentDepartment = 'External';
    const res = await POST(postReq({ device_name: 'Infusion Pump' }), {});
    expect(res.status).toBe(403);
    expect(cascadeSearch).not.toHaveBeenCalled();
  });

  it('returns 403 for an Exec-department user (read-only on saved comparisons, not search)', async () => {
    currentDepartment = 'Exec';
    const res = await POST(postReq({ device_name: 'Infusion Pump' }), {});
    expect(res.status).toBe(403);
    expect(cascadeSearch).not.toHaveBeenCalled();
  });

  it('returns 403 when the user has no department set', async () => {
    currentDepartment = null;
    const res = await POST(postReq({ device_name: 'Infusion Pump' }), {});
    expect(res.status).toBe(403);
  });
});

describe('POST /api/ra/predicate/search — openFDA failure (REQ-PRE-001)', () => {
  it('returns 500 with an error message when cascade-search throws', async () => {
    cascadeSearch.mockRejectedValue(new Error('openFDA request failed: 502'));
    const res = await POST(postReq({ device_name: 'Infusion Pump' }), {});
    const body = await res.json();
    expect(res.status).toBe(500);
    expect(body.error).toBeDefined();
  });
});
