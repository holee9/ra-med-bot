// @vitest-environment node
// @MX:NOTE [AUTO] Execution tests for POST /api/corpus-license/entitlement (SPEC-REGULA-CORPUS-LICENSE-001).
// @MX:SPEC SPEC-REGULA-CORPUS-LICENSE-001 (REQ-CORPUSLIC-008/012)

import { beforeEach, describe, expect, it, vi } from 'vitest';

let authenticated = true;
let organizationId = 'org-001';

const assertSourceLicenseInOrg = vi.fn(
  async (): Promise<{ id: string } | null> => ({
    id: 'lic-1',
  }),
);
const grantEntitlement = vi.fn();
const revokeEntitlement = vi.fn();
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
vi.mock('@/lib/corpus-license/access', () => ({ assertSourceLicenseInOrg }));
vi.mock('@/lib/corpus-license/entitlement', () => ({ grantEntitlement, revokeEntitlement }));
vi.mock('@/lib/corpus-license/types', () => ({ entitlementInputSchema: { safeParse } }));

const { POST } = await import('@/app/api/corpus-license/entitlement/route');

function postReq(body: unknown): Request {
  return new Request('http://localhost/api/corpus-license/entitlement', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  authenticated = true;
  organizationId = 'org-001';
  assertSourceLicenseInOrg.mockResolvedValue({ id: 'lic-1' });
  grantEntitlement.mockResolvedValue({ id: 'e-1', action: 'grant' });
  revokeEntitlement.mockResolvedValue({ id: 'e-1', action: 'revoke' });
  safeParse.mockReturnValue({ success: true, data: { sourceLicenseId: 'lic-1', action: 'grant' } });
});

describe('POST /api/corpus-license/entitlement (REQ-CORPUSLIC-008/012)', () => {
  it('returns 201 via grantEntitlement when action=grant', async () => {
    const res = await POST(postReq({ sourceLicenseId: 'lic-1', action: 'grant' }), {});
    expect(res.status).toBe(201);
    expect(grantEntitlement).toHaveBeenCalled();
  });

  it('returns 200 via revokeEntitlement when action=revoke', async () => {
    safeParse.mockReturnValueOnce({
      success: true,
      data: { sourceLicenseId: 'lic-1', action: 'revoke' },
    });
    const res = await POST(postReq({ sourceLicenseId: 'lic-1', action: 'revoke' }), {});
    expect(res.status).toBe(200);
    expect(revokeEntitlement).toHaveBeenCalled();
  });

  it('returns 404 source_license_not_found on IDOR miss', async () => {
    assertSourceLicenseInOrg.mockResolvedValueOnce(null);
    const res = await POST(postReq({ sourceLicenseId: 'lic-x', action: 'grant' }), {});
    expect(res.status).toBe(404);
  });

  it('returns 400 validation_failed when the schema rejects', async () => {
    safeParse.mockReturnValueOnce({ success: false, error: { issues: [] } });
    const res = await POST(postReq({}), {});
    expect(res.status).toBe(400);
  });

  it('returns 403 when organizationId is missing', async () => {
    organizationId = undefined as unknown as string;
    const res = await POST(postReq({ sourceLicenseId: 'lic-1', action: 'grant' }), {});
    expect(res.status).toBe(403);
  });
});
