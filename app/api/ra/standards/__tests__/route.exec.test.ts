// @vitest-environment node
// @MX:NOTE [AUTO] Execution tests for POST /api/ra/standards (SPEC-REGULA-STANDARDS-001).
// @MX:SPEC SPEC-REGULA-STANDARDS-001

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
const getApplicableStandards = vi.fn(() => [{ id: 'iso-13485' }, { id: 'iso-14971' }]);

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
          user: { id: 'user-001', role: 'ra-member', organizationId },
        });
      },
  ),
}));

vi.mock('@/lib/standards/applicability-engine', () => ({ getApplicableStandards }));

const { POST } = await import('@/app/api/ra/standards/route');

function postReq(body: unknown): Request {
  return new Request('http://localhost/api/ra/standards', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

const validBody = {
  deviceTypeKey: 'electrical_medical_device',
  regulatoryPathway: 'fda_510k',
  hasSoftware: true,
  isElectrical: true,
};

beforeEach(() => {
  vi.clearAllMocks();
  authenticated = true;
  organizationId = 'org-001';
  getApplicableStandards.mockReturnValue([{ id: 'iso-13485' }, { id: 'iso-14971' }]);
});

describe('POST /api/ra/standards (SPEC-REGULA-STANDARDS-001)', () => {
  it('returns 200 with applicable standards + standards_searched audit', async () => {
    const res = await POST(postReq(validBody), {});
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.totalCount).toBe(2);
    const audits = writeAudit.mock.calls.map((c) => (c as unknown[])[0] as AuditInput);
    expect(audits).toHaveLength(1);
    expect(audits[0]).toMatchObject({
      action: 'standards_searched',
      resource_type: 'standards_catalog',
      resource_id: 'electrical_medical_device',
    });
    expect(audits[0]?.meta_json?.count).toBe(2);
  });

  it('returns 200 with totalCount 0 when no standards apply', async () => {
    getApplicableStandards.mockReturnValueOnce([]);
    const res = await POST(postReq(validBody), {});
    expect(res.status).toBe(200);
    expect((await res.json()).totalCount).toBe(0);
  });

  it('returns 400 on an invalid deviceTypeKey enum', async () => {
    const res = await POST(postReq({ ...validBody, deviceTypeKey: 'not-a-device' }), {});
    expect(res.status).toBe(400);
  });
});
