// @vitest-environment node
// @MX:NOTE [AUTO] Execution tests for /api/model-governance/model-pinning (SPEC-REGULA-MODEL-GOVERNANCE-001).
// @MX:SPEC SPEC-REGULA-MODEL-GOVERNANCE-001 (REQ-MODELGOV-002/003)

import { beforeEach, describe, expect, it, vi } from 'vitest';

let authenticated = true;
let organizationId = 'org-001';

const registerModelPin = vi.fn();
const listModelPins = vi.fn();
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
vi.mock('@/lib/model-governance/model-pinning', () => ({ registerModelPin, listModelPins }));
vi.mock('@/lib/model-governance/types', () => ({ registerModelPinInputSchema: { safeParse } }));

const { POST, GET } = await import('@/app/api/model-governance/model-pinning/route');

function postReq(body: unknown): Request {
  return new Request('http://localhost/api/model-governance/model-pinning', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

const validInput = {
  provider: 'anthropic',
  modelId: 'claude',
  modelVersion: '1',
  retrievalConfig: {},
};

beforeEach(() => {
  vi.clearAllMocks();
  authenticated = true;
  organizationId = 'org-001';
  registerModelPin.mockResolvedValue({ id: 'mp-1', provider: 'anthropic' });
  listModelPins.mockResolvedValue([{ id: 'mp-1' }]);
  safeParse.mockReturnValue({ success: true, data: validInput });
});

describe('POST /api/model-governance/model-pinning (REQ-MODELGOV-002/003)', () => {
  it('returns 201 with the registered pin on success', async () => {
    const res = await POST(postReq(validInput), {});
    expect(res.status).toBe(201);
    expect((await res.json()).modelPin.id).toBe('mp-1');
  });

  it('returns 500 when registerModelPin throws', async () => {
    registerModelPin.mockRejectedValueOnce(new Error('dupe'));
    const res = await POST(postReq(validInput), {});
    expect(res.status).toBe(500);
  });

  it('returns 400 Invalid input when the schema rejects', async () => {
    safeParse.mockReturnValueOnce({ success: false, error: { flatten: () => ({}) } });
    const res = await POST(postReq(validInput), {});
    expect(res.status).toBe(400);
  });

  it('returns 403 when organizationId is missing', async () => {
    organizationId = undefined as unknown as string;
    const res = await POST(postReq(validInput), {});
    expect(res.status).toBe(403);
  });
});

describe('GET /api/model-governance/model-pinning', () => {
  it('returns 200 with the org-scoped pins', async () => {
    const res = await GET(new Request('http://localhost/api/model-governance/model-pinning'), {});
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.modelPins).toHaveLength(1);
  });

  it('returns 403 when organizationId is missing', async () => {
    organizationId = undefined as unknown as string;
    const res = await GET(new Request('http://localhost/api/model-governance/model-pinning'), {});
    expect(res.status).toBe(403);
  });
});
