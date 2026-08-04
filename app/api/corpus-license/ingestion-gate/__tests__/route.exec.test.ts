// @vitest-environment node
// @MX:NOTE [AUTO] Execution tests for POST /api/corpus-license/ingestion-gate (SPEC-REGULA-CORPUS-LICENSE-001).
// @MX:SPEC SPEC-REGULA-CORPUS-LICENSE-001 (REQ-CORPUSLIC-002/003/004)

import { beforeEach, describe, expect, it, vi } from 'vitest';

let authenticated = true;
let organizationId = 'org-001';

const assertIngestionLicensed = vi.fn();
const safeParse = vi.fn();

vi.mock('@/lib/auth/with-permission', () => ({
  withPermission: vi.fn(
    (
      _action: string,
      handler: (req: Request, ctx: unknown, session: unknown) => Promise<Response>,
    ) =>
      (req: Request, ctx: unknown) => {
        if (!authenticated)
          return Promise.resolve(Response.json({ error: 'Unauthorized' }, { status: 401 }));
        return handler(req, ctx, { user: { id: 'user-001', role: 'admin', organizationId } });
      },
  ),
}));
vi.mock('@/lib/corpus-license/license-gate', () => ({ assertIngestionLicensed }));
vi.mock('@/lib/corpus-license/types', () => ({ ingestionGateInputSchema: { safeParse } }));

const { POST } = await import('@/app/api/corpus-license/ingestion-gate/route');

function postReq(body: unknown): Request {
  return new Request('http://localhost/api/corpus-license/ingestion-gate', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  authenticated = true;
  organizationId = 'org-001';
  assertIngestionLicensed.mockResolvedValue({ allowed: true });
  safeParse.mockReturnValue({ success: true, data: { sourceId: 's-1', wantsFullText: true } });
});

describe('POST /api/corpus-license/ingestion-gate (REQ-CORPUSLIC-002/003/004)', () => {
  it('returns 200 when ingestion is allowed', async () => {
    const res = await POST(postReq({ sourceId: 's-1', wantsFullText: true }), {});
    expect(res.status).toBe(200);
    expect((await res.json()).allowed).toBe(true);
  });

  it('returns 403 when ingestion is blocked', async () => {
    assertIngestionLicensed.mockResolvedValueOnce({ allowed: false, reason: 'no_license' });
    const res = await POST(postReq({ sourceId: 's-1' }), {});
    expect(res.status).toBe(403);
    expect((await res.json()).allowed).toBe(false);
  });

  it('returns 400 validation_failed when the schema rejects', async () => {
    safeParse.mockReturnValueOnce({ success: false, error: { issues: [] } });
    const res = await POST(postReq({}), {});
    expect(res.status).toBe(400);
  });

  it('returns 403 when organizationId is missing', async () => {
    organizationId = undefined as unknown as string;
    const res = await POST(postReq({ sourceId: 's-1' }), {});
    expect(res.status).toBe(403);
  });
});
