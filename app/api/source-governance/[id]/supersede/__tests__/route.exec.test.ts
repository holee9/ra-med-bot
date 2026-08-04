// @vitest-environment node
// @MX:NOTE [AUTO] Execution tests for POST /api/source-governance/[id]/supersede (SPEC-REGULA-SOURCE-GOVERNANCE-001).
// @MX:SPEC SPEC-REGULA-SOURCE-GOVERNANCE-001 (REQ-SOURCE-GOV-005/006, AC-02)

import { beforeEach, describe, expect, it, vi } from 'vitest';

let authenticated = true;
let organizationId = 'org-001';

const markSuperseded = vi.fn();
const safeParse = vi.fn();

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
          user: { id: 'user-001', role: 'admin', organizationId },
        });
      },
  ),
}));

vi.mock('@/lib/source-governance/review-workflow', () => ({ markSuperseded }));
vi.mock('@/lib/source-governance/types', () => ({ supersedeRequestSchema: { safeParse } }));

const { POST } = await import('@/app/api/source-governance/[id]/supersede/route');

function postReq(body: unknown): Request {
  return new Request('http://localhost/api/source-governance/s-1/supersede', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  authenticated = true;
  organizationId = 'org-001';
  markSuperseded.mockResolvedValue({ ok: true, sourceId: 's-1', supersededBy: 's-2' });
  safeParse.mockReturnValue({ success: true, data: { supersededBy: 's-2' } });
});

describe('POST /api/source-governance/[id]/supersede (REQ-SOURCE-GOV-005/006)', () => {
  it('returns 200 with the supersede result on success', async () => {
    const res = await POST(postReq({ supersededBy: 's-2' }), { params: { id: 's-1' } });
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body).toMatchObject({ ok: true, sourceId: 's-1', supersededBy: 's-2' });
  });

  it('returns 404 source_not_found on IDOR miss (null result)', async () => {
    markSuperseded.mockResolvedValueOnce(null);
    const res = await POST(postReq({ supersededBy: 's-2' }), { params: { id: 'sx' } });
    expect(res.status).toBe(404);
    expect((await res.json()).error).toBe('source_not_found');
  });

  it('returns 400 invalid_supersede on self-cycle / successor not in org (!ok)', async () => {
    markSuperseded.mockResolvedValueOnce({ ok: false });
    const res = await POST(postReq({ supersededBy: 's-1' }), { params: { id: 's-1' } });
    expect(res.status).toBe(400);
    expect((await res.json()).reason).toBe('self_cycle_or_successor_not_in_org');
  });

  it('returns 400 validation_failed when the schema rejects', async () => {
    safeParse.mockReturnValueOnce({ success: false, error: { issues: [] } });
    const res = await POST(postReq({}), { params: { id: 's-1' } });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('validation_failed');
  });

  it('returns 400 source_id_required when id is absent', async () => {
    const res = await POST(postReq({ supersededBy: 's-2' }), { params: {} });
    expect(res.status).toBe(400);
  });

  it('returns 403 when organizationId is missing', async () => {
    organizationId = undefined as unknown as string;
    const res = await POST(postReq({ supersededBy: 's-2' }), { params: { id: 's-1' } });
    expect(res.status).toBe(403);
  });
});
