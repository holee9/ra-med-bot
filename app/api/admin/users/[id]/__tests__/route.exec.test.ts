// @vitest-environment node
// @MX:NOTE [AUTO] Execution tests for PATCH /api/admin/users/[id] (SPEC-REGULA-ENTERPRISE-001).
// @MX:SPEC SPEC-REGULA-ENTERPRISE-001

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

const writeAudit = vi.fn(async (_input: AuditInput) => {});
const txUpdateWhere = vi.fn().mockResolvedValue(undefined);

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
        return handler(req, ctx, { user: { id: 'admin-1', role: 'admin', organizationId } });
      },
  ),
}));
vi.mock('@/lib/db/client', () => ({
  db: {
    transaction: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) =>
      fn({ update: () => ({ set: () => ({ where: txUpdateWhere }) }) }),
    ),
  },
}));

const { PATCH } = await import('@/app/api/admin/users/[id]/route');

function patchReq(body: unknown): Request {
  return new Request('http://localhost/api/admin/users/u-1', {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  authenticated = true;
  organizationId = 'org-001';
});

describe('PATCH /api/admin/users/[id]', () => {
  it('returns 200 + profile.update audit (admin) on a valid status', async () => {
    const res = await PATCH(patchReq({ status: 'active' }), { params: { id: 'u-1' } });
    expect(res.status).toBe(200);
    expect(txUpdateWhere).toHaveBeenCalled();
    const audits = writeAudit.mock.calls.map((c) => (c as unknown[])[0] as AuditInput);
    expect(audits).toHaveLength(1);
    expect(audits[0]?.meta_json).toMatchObject({ status: 'active', admin: true });
  });

  it('returns 400 on an invalid status enum', async () => {
    const res = await PATCH(patchReq({ status: 'banned' }), { params: { id: 'u-1' } });
    expect(res.status).toBe(400);
  });

  it('returns 400 when id is absent', async () => {
    const res = await PATCH(patchReq({ status: 'active' }), { params: {} });
    expect(res.status).toBe(400);
  });
});
