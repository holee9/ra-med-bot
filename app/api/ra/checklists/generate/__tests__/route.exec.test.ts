// @vitest-environment node
// @MX:NOTE [AUTO] Execution tests for POST /api/ra/checklists/generate (SPEC-INTEGRATION-001).
// @MX:SPEC SPEC-INTEGRATION-001, Issue #170

import { beforeEach, describe, expect, it, vi } from 'vitest';

let authenticated = true;
let organizationId = 'org-001';

type AuditInput = {
  actor_id: string | null;
  action: string;
  resource_type: string;
  resource_id: string;
  meta_json?: Record<string, unknown>;
};

class HybridRaClientError extends Error {
  statusCode: number;
  constructor(message: string, statusCode: number) {
    super(message);
    this.name = 'HybridRaClientError';
    this.statusCode = statusCode;
  }
}

const writeAudit = vi.fn(async (_input: AuditInput) => {});
const hybridFetch = vi.fn();

vi.mock('@/lib/audit', () => ({ writeAudit }));
vi.mock('@/lib/auth/with-permission', () => ({
  withPermission: vi.fn(
    (
      _action: string,
      handler: (req: Request, ctx: unknown, session: unknown) => Promise<Response>,
    ) =>
      (req: Request, ctx: unknown) => {
        if (!authenticated)
          return Promise.resolve(Response.json({ error: 'Unauthorized' }, { status: 401 }));
        return handler(req, ctx, { user: { id: 'user-001', role: 'ra-lead', organizationId } });
      },
  ),
}));
vi.mock('@/lib/api/hybrid-ra-client', () => ({
  createHybridRaFetch: vi.fn(() => hybridFetch),
  HybridRaClientError,
}));

const { POST } = await import('@/app/api/ra/checklists/generate/route');

function postReq(body: unknown): Request {
  return new Request('http://localhost/api/ra/checklists/generate', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  authenticated = true;
  organizationId = 'org-001';
  hybridFetch.mockResolvedValue({ json: async () => ({ id: 'cl-1' }) });
});

describe('POST /api/ra/checklists/generate (BFF proxy + audit)', () => {
  it('returns 201 + workflow.start audit (resource_id from projectId) on success', async () => {
    const res = await POST(postReq({ projectId: 'proj-9', deviceClass: 'II' }), {});
    expect(res.status).toBe(201);
    const audits = writeAudit.mock.calls.map((c) => (c as unknown[])[0] as AuditInput);
    expect(audits).toHaveLength(1);
    expect(audits[0]?.resource_id).toBe('proj-9');
    expect(audits[0]?.meta_json?.requestFields).toEqual(['deviceClass', 'projectId']);
  });

  it('uses a fallback resource_id when projectId is absent', async () => {
    await POST(postReq({ deviceClass: 'II' }), {});
    const audits = writeAudit.mock.calls.map((c) => (c as unknown[])[0] as AuditInput);
    expect(audits[0]?.resource_id).toBe('checklist.generate');
  });

  it('passes HybridRaClientError status + message through', async () => {
    hybridFetch.mockRejectedValueOnce(new HybridRaClientError('upstream unavailable', 502));
    const res = await POST(postReq({ projectId: 'p' }), {});
    expect(res.status).toBe(502);
    expect((await res.json()).error).toBe('upstream unavailable');
  });
});
