// @vitest-environment node
// @MX:NOTE [AUTO] Execution tests for GET /api/rlhf/feedback/aggregate (SPEC-REGULA-RLHF-001).
// @MX:SPEC SPEC-REGULA-RLHF-001 (REQ-RLHF-005/006)

import { beforeEach, describe, expect, it, vi } from 'vitest';

let authenticated = true;
let organizationId = 'org-001';
let rows: unknown[] = [];

const assertMessageInOrg = vi.fn(async (): Promise<Response | null> => null);
const aggregateFeedback = vi.fn(() => ({ positive: 3, negative: 1, total: 4 }));
const detectDownwardTrend = vi.fn(() => false);

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

vi.mock('@/lib/db/client', () => {
  const chain: Record<string, unknown> = {};
  chain.from = () => chain;
  chain.innerJoin = () => chain;
  chain.where = () => chain;
  // Intentional thenable: `await` on the chain resolves to rows.
  // biome-ignore lint/suspicious/noThenProperty: deliberate chainable thenable for the db mock
  chain.then = (resolve: (v: unknown) => void) => resolve(rows);
  const dbs = { select: () => chain };
  return {
    withTenantScope: vi.fn(async (_orgId: string, fn: (dbs: unknown) => unknown) => fn(dbs)),
  };
});

vi.mock('@/lib/rlhf/access', () => ({ assertMessageInOrg }));
vi.mock('@/lib/rlhf/feedback-aggregator', () => ({ aggregateFeedback, detectDownwardTrend }));

const { GET } = await import('@/app/api/rlhf/feedback/aggregate/route');

function getReq(query: string): Request {
  return new Request(`http://localhost/api/rlhf/feedback/aggregate?${query}`);
}

beforeEach(() => {
  vi.clearAllMocks();
  authenticated = true;
  organizationId = 'org-001';
  rows = [];
  assertMessageInOrg.mockResolvedValue(null);
});

describe('GET /api/rlhf/feedback/aggregate (REQ-RLHF-005/006, C-2 IDOR)', () => {
  it('returns 200 with aggregate + trend on success', async () => {
    rows = [{ rating: 'positive', createdAt: new Date() }];
    const res = await GET(getReq('messageId=m-1'), {});
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.messageId).toBe('m-1');
    expect(body.aggregate).toEqual({ positive: 3, negative: 1, total: 4 });
    expect(body.trend).toBe(false);
    expect(aggregateFeedback).toHaveBeenCalledWith(rows);
  });

  it('returns 400 messageId_required when messageId is absent', async () => {
    const res = await GET(getReq(''), {});
    expect(res.status).toBe(400);
  });

  it('returns the IDOR denial response when assertMessageInOrg denies', async () => {
    assertMessageInOrg.mockResolvedValueOnce(
      Response.json({ error: 'message_not_in_org' }, { status: 403 }),
    );
    const res = await GET(getReq('messageId=m-x'), {});
    expect(res.status).toBe(403);
    expect((await res.json()).error).toBe('message_not_in_org');
  });

  it('returns 403 no_org_context when organizationId is missing', async () => {
    organizationId = undefined as unknown as string;
    const res = await GET(getReq('messageId=m-1'), {});
    expect(res.status).toBe(403);
  });
});
