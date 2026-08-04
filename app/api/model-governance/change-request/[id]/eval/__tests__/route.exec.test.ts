// @vitest-environment node
// @MX:NOTE [AUTO] Execution tests for POST /api/model-governance/change-request/[id]/eval (SPEC-REGULA-MODEL-GOVERNANCE-001).
// @MX:SPEC SPEC-REGULA-MODEL-GOVERNANCE-001 (REQ-MODELGOV-010/011)

import { beforeEach, describe, expect, it, vi } from 'vitest';

let authenticated = true;
let organizationId = 'org-001';

const assertChangeRequestAccess = vi.fn(
  async (): Promise<{ id: string } | null> => ({ id: 'cr-1' }),
);
const recordEvalResult = vi.fn();

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

vi.mock('@/lib/model-governance/access', () => ({ assertChangeRequestAccess }));
vi.mock('@/lib/model-governance/change-workflow', () => ({ recordEvalResult }));

const { POST } = await import('@/app/api/model-governance/change-request/[id]/eval/route');

function postReq(body: unknown): Request {
  return new Request('http://localhost/api/model-governance/change-request/cr-1/eval', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  authenticated = true;
  organizationId = 'org-001';
  assertChangeRequestAccess.mockResolvedValue({ id: 'cr-1' });
  recordEvalResult.mockResolvedValue({ passed: true, score: 0.92, threshold: 0.85, reason: '' });
});

describe('POST /api/model-governance/change-request/[id]/eval (REQ-MODELGOV-010/011)', () => {
  it('returns 200 with evalStatus passed when the gate passes', async () => {
    const res = await POST(postReq({ evalResultJson: { pass: 10 } }), {
      params: { id: 'cr-1' },
    });
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body).toMatchObject({ evalStatus: 'passed', score: 0.92, threshold: 0.85 });
  });

  it('returns 200 with evalStatus failed when the gate fails', async () => {
    recordEvalResult.mockResolvedValueOnce({
      passed: false,
      score: 0.4,
      threshold: 0.85,
      reason: 'below_threshold',
    });
    const res = await POST(postReq({ evalResultJson: { pass: 2 } }), {
      params: { id: 'cr-1' },
    });
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.evalStatus).toBe('failed');
    expect(body.reason).toBe('below_threshold');
  });

  it('returns 404 Change request not found on IDOR miss', async () => {
    assertChangeRequestAccess.mockResolvedValueOnce(null);
    const res = await POST(postReq({ evalResultJson: {} }), { params: { id: 'cr-x' } });
    expect(res.status).toBe(404);
  });

  it('returns 400 Missing change request id when id is absent', async () => {
    const res = await POST(postReq({ evalResultJson: {} }), { params: {} });
    expect(res.status).toBe(400);
  });

  it('returns 400 Invalid input when evalResultJson is missing', async () => {
    const res = await POST(postReq({ evalRunId: 'er-1' }), { params: { id: 'cr-1' } });
    expect(res.status).toBe(400);
  });

  it('returns 403 when organizationId is missing', async () => {
    organizationId = undefined as unknown as string;
    const res = await POST(postReq({ evalResultJson: {} }), { params: { id: 'cr-1' } });
    expect(res.status).toBe(403);
  });
});
