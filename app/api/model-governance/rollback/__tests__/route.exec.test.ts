// @vitest-environment node
// @MX:NOTE [AUTO] Execution tests for POST /api/model-governance/rollback (SPEC-REGULA-MODEL-GOVERNANCE-001).
// @MX:SPEC SPEC-REGULA-MODEL-GOVERNANCE-001 (REQ-MODELGOV-006, AC-03)

import { beforeEach, describe, expect, it, vi } from 'vitest';

let authenticated = true;
let organizationId = 'org-001';

class RollbackError extends Error {
  reason: string;
  constructor(reason: string) {
    super(reason);
    this.name = 'RollbackError';
    this.reason = reason;
  }
}

const rollbackCombination = vi.fn();
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
        return handler(req, ctx, { user: { id: 'user-001', role: 'ra-lead', organizationId } });
      },
  ),
}));
vi.mock('@/lib/model-governance/rollback', () => ({ rollbackCombination, RollbackError }));
vi.mock('@/lib/model-governance/types', () => ({ rollbackInputSchema: { safeParse } }));

const { POST } = await import('@/app/api/model-governance/rollback/route');

function postReq(body: unknown): Request {
  return new Request('http://localhost/api/model-governance/rollback', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  authenticated = true;
  organizationId = 'org-001';
  rollbackCombination.mockResolvedValue({ fromId: 'c-2', toId: 'c-1' });
  safeParse.mockReturnValue({ success: true, data: { toCombinationId: 'c-1' } });
});

describe('POST /api/model-governance/rollback (REQ-MODELGOV-006, AC-03)', () => {
  it('returns 200 with from/to ids on success', async () => {
    const res = await POST(postReq({ toCombinationId: 'c-1' }), {});
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ fromId: 'c-2', toId: 'c-1' });
  });

  it('returns 404 when the rollback target is not found', async () => {
    rollbackCombination.mockRejectedValueOnce(new RollbackError('combination_not_found'));
    const res = await POST(postReq({ toCombinationId: 'cx' }), {});
    expect(res.status).toBe(404);
  });

  it('returns 409 on a non-not-found RollbackError', async () => {
    rollbackCombination.mockRejectedValueOnce(new RollbackError('no_previous_version'));
    const res = await POST(postReq({ toCombinationId: 'c-1' }), {});
    expect(res.status).toBe(409);
  });

  it('returns 500 on a generic rollback error', async () => {
    rollbackCombination.mockRejectedValueOnce(new Error('tx aborted'));
    const res = await POST(postReq({ toCombinationId: 'c-1' }), {});
    expect(res.status).toBe(500);
  });

  it('returns 400 Invalid input when the schema rejects', async () => {
    safeParse.mockReturnValueOnce({ success: false, error: { flatten: () => ({}) } });
    const res = await POST(postReq({}), {});
    expect(res.status).toBe(400);
  });

  it('returns 403 when organizationId is missing', async () => {
    organizationId = undefined as unknown as string;
    const res = await POST(postReq({ toCombinationId: 'c-1' }), {});
    expect(res.status).toBe(403);
  });
});
