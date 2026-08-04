// @vitest-environment node
// @MX:NOTE [AUTO] Execution tests for POST /api/admin/radar/impact (SPEC-REGULA-IMPACT-001).
// @MX:SPEC SPEC-REGULA-IMPACT-001

import { beforeEach, describe, expect, it, vi } from 'vitest';

let authenticated = true;
let organizationId = 'org-001';
type Role = 'viewer' | 'ra-member' | 'ra-lead' | 'admin';
let userRole: Role = 'admin';

const analyzeImpact = vi.fn();

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
          user: { id: 'user-001', role: userRole, organizationId },
        });
      },
  ),
}));

vi.mock('@/lib/db/client', () => ({ db: {} }));
vi.mock('@/lib/domains/impact/analyzer', () => ({ analyzeImpact }));

const { POST } = await import('@/app/api/admin/radar/impact/route');

function postReq(body: unknown): Request {
  return new Request('http://localhost/api/admin/radar/impact', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

const UPDATE_UUID = '00000000-0000-4000-8000-000000000000';

beforeEach(() => {
  vi.clearAllMocks();
  authenticated = true;
  organizationId = 'org-001';
  userRole = 'admin';
  analyzeImpact.mockResolvedValue({ impact_level: 'high', summary: 'analysis' });
});

describe('POST /api/admin/radar/impact (SPEC-REGULA-IMPACT-001)', () => {
  it('returns 200 with the impact analysis on success', async () => {
    const res = await POST(postReq({ regulatory_update_id: UPDATE_UUID }), {});
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.impact_level).toBe('high');
    expect(analyzeImpact).toHaveBeenCalledWith(
      expect.objectContaining({ regulatory_update_id: UPDATE_UUID, org_id: 'org-001' }),
      expect.anything(),
    );
  });

  it('returns 403 Admin access required for non-admin roles', async () => {
    userRole = 'ra-lead';
    const res = await POST(postReq({ regulatory_update_id: UPDATE_UUID }), {});
    expect(res.status).toBe(403);
    expect(analyzeImpact).not.toHaveBeenCalled();
  });

  it('returns 400 Invalid JSON when the body is not JSON', async () => {
    const res = await POST(
      new Request('http://localhost/api/admin/radar/impact', { method: 'POST', body: '{bad' }),
      {},
    );
    expect(res.status).toBe(400);
  });

  it('returns 422 when regulatory_update_id is not a uuid', async () => {
    const res = await POST(postReq({ regulatory_update_id: 'not-a-uuid' }), {});
    expect(res.status).toBe(422);
  });

  it('returns 404 when analyzeImpact reports not found', async () => {
    analyzeImpact.mockRejectedValueOnce(new Error('regulatory update not found'));
    const res = await POST(postReq({ regulatory_update_id: UPDATE_UUID }), {});
    expect(res.status).toBe(404);
  });

  it('returns 500 on a generic analyzer error', async () => {
    analyzeImpact.mockRejectedValueOnce(new Error('llm down'));
    const res = await POST(postReq({ regulatory_update_id: UPDATE_UUID }), {});
    expect(res.status).toBe(500);
  });
});
