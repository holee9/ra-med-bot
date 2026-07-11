// @vitest-environment node
// @MX:NOTE [AUTO] Execution tests for POST /api/model-governance/approve (SPEC-REGULA-MODEL-GOVERNANCE-001).
// @MX:SPEC SPEC-REGULA-MODEL-GOVERNANCE-001 (REQ-MODELGOV-005/012/013/014, AC-02/07)
//
// No prior test existed (0% coverage). Invokes POST with model-governance lib fns
// mocked. Covers: success, IDOR 404, invalid 400, ChangeRequestBlockedError 403/404
// (reason-based split), generic 500, no-org 403.

import { beforeEach, describe, expect, it, vi } from 'vitest';

let authenticated = true;
let organizationId = 'org-001';

class ChangeRequestBlockedError extends Error {
  reason: string;
  constructor(reason: string) {
    super(reason);
    this.name = 'ChangeRequestBlockedError';
    this.reason = reason;
  }
}

const assertChangeRequestAccess = vi.fn(
  async (): Promise<{ id: string } | null> => ({
    id: 'cr-1',
  }),
);
const approveChangeRequest = vi.fn();
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
          user: { id: 'user-001', role: 'ra-lead', organizationId },
        });
      },
  ),
}));

vi.mock('@/lib/model-governance/access', () => ({ assertChangeRequestAccess }));
vi.mock('@/lib/model-governance/change-workflow', () => ({
  approveChangeRequest,
  ChangeRequestBlockedError,
}));
vi.mock('@/lib/model-governance/types', () => ({
  approveChangeRequestInputSchema: { safeParse },
}));

const { POST } = await import('@/app/api/model-governance/approve/route');

function postReq(body: unknown): Request {
  return new Request('http://localhost/api/model-governance/approve', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

const validInput = { changeRequestId: 'cr-1', evalResultRef: 'eval-9' };

beforeEach(() => {
  vi.clearAllMocks();
  authenticated = true;
  organizationId = 'org-001';
  assertChangeRequestAccess.mockResolvedValue({ id: 'cr-1' });
  approveChangeRequest.mockResolvedValue({ combinationId: 'combo-1' });
  safeParse.mockReturnValue({ success: true, data: validInput });
});

describe('POST /api/model-governance/approve (REQ-MODELGOV-005/012/014)', () => {
  it('returns 200 with the approved combination id on success', async () => {
    const res = await POST(postReq(validInput), {});
    expect(res.status).toBe(200);
    expect((await res.json()).approvedCombinationId).toBe('combo-1');
  });

  it('returns 400 Invalid input when the schema rejects', async () => {
    safeParse.mockReturnValueOnce({ success: false, error: { flatten: () => ({}) } });
    const res = await POST(postReq(validInput), {});
    expect(res.status).toBe(400);
  });

  it('returns 404 Change request not found on IDOR miss', async () => {
    assertChangeRequestAccess.mockResolvedValueOnce(null);
    const res = await POST(postReq(validInput), {});
    expect(res.status).toBe(404);
  });

  it('returns 403 when the change is blocked (eval not passed)', async () => {
    approveChangeRequest.mockRejectedValueOnce(new ChangeRequestBlockedError('eval_not_passed'));
    const res = await POST(postReq(validInput), {});
    expect(res.status).toBe(403);
    expect((await res.json()).error).toBe('eval_not_passed');
  });

  it('returns 404 when the block reason includes not_found', async () => {
    approveChangeRequest.mockRejectedValueOnce(new ChangeRequestBlockedError('change_not_found'));
    const res = await POST(postReq(validInput), {});
    expect(res.status).toBe(404);
  });

  it('returns 500 on a generic approval error', async () => {
    approveChangeRequest.mockRejectedValueOnce(new Error('tx aborted'));
    const res = await POST(postReq(validInput), {});
    expect(res.status).toBe(500);
  });

  it('returns 403 when organizationId is missing', async () => {
    organizationId = undefined as unknown as string;
    const res = await POST(postReq(validInput), {});
    expect(res.status).toBe(403);
  });
});
