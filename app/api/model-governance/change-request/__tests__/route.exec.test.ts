// @vitest-environment node
// @MX:NOTE [AUTO] Execution tests for /api/model-governance/change-request (SPEC-REGULA-MODEL-GOVERNANCE-001).
// @MX:SPEC SPEC-REGULA-MODEL-GOVERNANCE-001 (REQ-MODELGOV-004/005)

import { beforeEach, describe, expect, it, vi } from 'vitest';

let authenticated = true;
let organizationId = 'org-001';
let rows: unknown[] = [];

const assertPromptAccess = vi.fn(async (): Promise<boolean> => true);
const assertModelPinAccess = vi.fn(async (): Promise<boolean> => true);
const createChangeRequest = vi.fn();
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

vi.mock('@/lib/db/client', () => {
  const chain: Record<string, unknown> = {};
  chain.from = () => chain;
  chain.where = () => chain;
  // Intentional thenable: `await` on the chain resolves to rows.
  // biome-ignore lint/suspicious/noThenProperty: deliberate chainable thenable for the db mock
  chain.then = (resolve: (v: unknown) => void) => resolve(rows);
  const dbs = { select: () => chain };
  return {
    withTenantScope: vi.fn(async (_orgId: string, fn: (dbs: unknown) => unknown) => fn(dbs)),
  };
});

vi.mock('@/lib/model-governance/access', () => ({
  assertPromptAccess,
  assertModelPinAccess,
}));
vi.mock('@/lib/model-governance/change-workflow', () => ({ createChangeRequest }));
vi.mock('@/lib/model-governance/types', () => ({
  createChangeRequestInputSchema: { safeParse },
}));

const { POST, GET } = await import('@/app/api/model-governance/change-request/route');

function postReq(body: unknown): Request {
  return new Request('http://localhost/api/model-governance/change-request', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

const validInput = { promptId: 'p-1', modelPinId: 'mp-1', evalRunId: 'er-1' };

beforeEach(() => {
  vi.clearAllMocks();
  authenticated = true;
  organizationId = 'org-001';
  rows = [];
  assertPromptAccess.mockResolvedValue(true);
  assertModelPinAccess.mockResolvedValue(true);
  createChangeRequest.mockResolvedValue({ id: 'cr-1', status: 'pending_eval' });
  safeParse.mockReturnValue({ success: true, data: validInput });
});

describe('POST /api/model-governance/change-request (REQ-MODELGOV-004/005)', () => {
  it('returns 201 with the created change request', async () => {
    const res = await POST(postReq(validInput), {});
    const body = await res.json();
    expect(res.status).toBe(201);
    expect(body.changeRequest.id).toBe('cr-1');
  });

  it('returns 404 Prompt not found on IDOR miss', async () => {
    assertPromptAccess.mockResolvedValueOnce(false);
    const res = await POST(postReq(validInput), {});
    expect(res.status).toBe(404);
    expect((await res.json()).error).toBe('Prompt not found');
  });

  it('returns 404 Model pin not found on IDOR miss', async () => {
    assertModelPinAccess.mockResolvedValueOnce(false);
    const res = await POST(postReq(validInput), {});
    expect(res.status).toBe(404);
    expect((await res.json()).error).toBe('Model pin not found');
  });

  it('returns 500 when createChangeRequest throws', async () => {
    createChangeRequest.mockRejectedValueOnce(new Error('tx'));
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

describe('GET /api/model-governance/change-request', () => {
  it('returns 200 with the org-scoped change requests', async () => {
    rows = [{ id: 'cr-1' }, { id: 'cr-2' }];
    const res = await GET(new Request('http://localhost/api/model-governance/change-request'), {});
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.changeRequests).toHaveLength(2);
  });

  it('returns 403 when organizationId is missing', async () => {
    organizationId = undefined as unknown as string;
    const res = await GET(new Request('http://localhost/api/model-governance/change-request'), {});
    expect(res.status).toBe(403);
  });
});
