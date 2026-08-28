// @vitest-environment node
// @MX:NOTE [AUTO] Execution tests for ra/risk BFF routes (SPEC-REGULA-RISK-001).
// @MX:SPEC SPEC-REGULA-RISK-001 (T2.1, T2.4, T2.5, REQ-RISK-011..015, REQ-RISK-028)
//
// The sibling bff-routes.test.ts guards permission strings at the SOURCE level;
// these tests actually INVOKE the POST/PATCH/DELETE handlers so they earn real
// execution + branch coverage. Covers: hybrid-ra BFF proxy success, the
// HybridRaClientError pass-through (status/message), audit emissions, the
// evaluate-route scale validation (400) + risk-level computation.

import { beforeEach, describe, expect, it, vi } from 'vitest';

// --- Mock state toggles ---
let authenticated = true;
let organizationId = 'org-001';

type AuditInput = {
  actor_id: string | null;
  action: string;
  resource_type: string;
  resource_id: string;
  meta_json?: Record<string, unknown>;
};

const writeAudit = vi.fn(async () => {});

// Real-shape error class so `err instanceof HybridRaClientError` resolves against
// the same class the route imports from the (mocked) module.
class HybridRaClientError extends Error {
  statusCode: number;
  constructor(message: string, statusCode: number) {
    super(message);
    this.name = 'HybridRaClientError';
    this.statusCode = statusCode;
  }
}

const hybridFetch = vi.fn();

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

vi.mock('@/lib/api/hybrid-ra-client', () => ({
  createHybridRaFetch: vi.fn(() => hybridFetch),
  HybridRaClientError,
}));

// NOTE: @/lib/risk/risk-evaluation is intentionally NOT mocked — the evaluate
// route exercises the real validateScale + evaluateRiskLevel (covers the lib too).

const runsRoute = await import('@/app/api/ra/risk/runs/route');
const itemsRoute = await import('@/app/api/ra/risk/items/[id]/route');
const evaluateRoute = await import('@/app/api/ra/risk/items/[id]/evaluate/route');

function postReq(url: string, body: unknown): Request {
  return new Request(url, { method: 'POST', body: JSON.stringify(body) });
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
  hybridFetch.mockResolvedValue({ json: async () => ({ id: 'run-1', status: 'ok' }) });
});

describe('POST /api/ra/risk/runs — create run (T2.1, REQ-RISK-028)', () => {
  it('proxies to hybrid-ra, returns 201 + workflow.start audit', async () => {
    const res = await runsRoute.POST(
      postReq('http://localhost/api/ra/risk/runs', { name: 'run' }),
      {},
    );
    const body = await res.json();
    expect(res.status).toBe(201);
    expect(body.id).toBe('run-1');
    const audits = auditCalls(
      (i) => i.action === 'workflow.start' && i.resource_type === 'risk_run',
    );
    expect(audits).toHaveLength(1);
    expect(audits[0]?.resource_id).toBe('run-1');
  });

  it('passes HybridRaClientError status + message through (no 500 mask)', async () => {
    hybridFetch.mockRejectedValueOnce(new HybridRaClientError('upstream unavailable', 502));
    const res = await runsRoute.POST(postReq('http://localhost/api/ra/risk/runs', {}), {});
    expect(res.status).toBe(502);
    expect((await res.json()).error).toBe('upstream unavailable');
  });

  it('records resource_id "unknown" when the upstream payload has no id', async () => {
    hybridFetch.mockResolvedValueOnce({ json: async () => ({ ok: true }) });
    await runsRoute.POST(postReq('http://localhost/api/ra/risk/runs', {}), {});
    const audits = auditCalls((i) => i.action === 'workflow.start');
    expect(audits[0]?.resource_id).toBe('unknown');
  });
});

describe('PATCH/DELETE /api/ra/risk/items/[id] (T2.4, REQ-RISK-011..015)', () => {
  it('PATCH proxies + audits risk.matrix_evaluated', async () => {
    hybridFetch.mockResolvedValueOnce({ json: async () => ({ id: 'it-1', severity: 3 }) });
    const res = await itemsRoute.PATCH(
      new Request('http://localhost/api/ra/risk/items/it-1', {
        method: 'PATCH',
        body: JSON.stringify({ severity: 3 }),
      }),
      { params: { id: 'it-1' } },
    );
    expect(res.status).toBe(200);
    expect(auditCalls((i) => i.action === 'risk.matrix_evaluated')).toHaveLength(1);
  });

  it('DELETE proxies + audits risk.item_deleted, returns 204', async () => {
    const res = await itemsRoute.DELETE(
      new Request('http://localhost/api/ra/risk/items/it-1', { method: 'DELETE' }),
      { params: { id: 'it-1' } },
    );
    expect(res.status).toBe(204);
    expect(auditCalls((i) => i.action === 'risk.item_deleted')).toHaveLength(1);
  });
});

describe('POST /api/ra/risk/items/[id]/evaluate (T2.5, REQ-RISK-011..015)', () => {
  it('returns 200 with the computed riskLevel + audit meta', async () => {
    const res = await evaluateRoute.POST(
      postReq('http://localhost/api/ra/risk/items/it-1/evaluate', { severity: 5, probability: 5 }),
      { params: { id: 'it-1' } },
    );
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.id).toBe('it-1');
    expect(body.riskLevel).toEqual(expect.any(String));
    const audits = auditCalls((i) => i.action === 'risk.matrix_evaluated');
    expect(audits).toHaveLength(1);
    expect(audits[0]?.meta_json).toMatchObject({ severity: 5, probability: 5 });
  });

  it('returns 400 when severity/probability are outside the 1–5 scale', async () => {
    const res = await evaluateRoute.POST(
      postReq('http://localhost/api/ra/risk/items/it-1/evaluate', { severity: 6, probability: 2 }),
      { params: { id: 'it-1' } },
    );
    expect(res.status).toBe(400);
  });
});
