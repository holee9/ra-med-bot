// @vitest-environment node
// @MX:NOTE [AUTO] Execution tests for GET /api/audit-logs (SPEC-REGULA-ENTERPRISE-001).
// @MX:SPEC SPEC-REGULA-ENTERPRISE-001 (REQ-FND-044, REQ-LAUNCH-020)

import { beforeEach, describe, expect, it, vi } from 'vitest';

let authenticated = true;
let organizationId = 'org-001';
let rows: unknown[] = [];

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

vi.mock('@/lib/db/client', () => {
  const chain: Record<string, unknown> = {};
  chain.from = () => chain;
  chain.orderBy = () => chain;
  chain.limit = () => chain;
  chain.offset = () => chain;
  // Intentional thenable: `await` on the chain resolves to rows.
  // biome-ignore lint/suspicious/noThenProperty: deliberate chainable thenable for the db mock
  chain.then = (resolve: (v: unknown) => void) => resolve(rows);
  return { db: { select: () => chain } };
});

const { GET } = await import('@/app/api/audit-logs/route');

function getReq(query: string): Request {
  return new Request(`http://localhost/api/audit-logs?${query}`);
}

beforeEach(() => {
  vi.clearAllMocks();
  authenticated = true;
  organizationId = 'org-001';
  rows = [{ id: 'a1' }, { id: 'a2' }];
});

describe('GET /api/audit-logs (REQ-FND-044)', () => {
  it('returns 200 with rows + default limit 20 / offset 0', async () => {
    const res = await GET(getReq(''), {});
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.data).toHaveLength(2);
    expect(body).toMatchObject({ limit: 20, offset: 0 });
  });

  it('honors explicit limit + offset', async () => {
    const res = await GET(getReq('limit=5&offset=10'), {});
    const body = await res.json();
    expect(body).toMatchObject({ limit: 5, offset: 10 });
  });

  it('caps limit at 100', async () => {
    const res = await GET(getReq('limit=999'), {});
    expect((await res.json()).limit).toBe(100);
  });

  it('falls back to defaults on non-numeric / negative params', async () => {
    const res = await GET(getReq('limit=abc&offset=-5'), {});
    const body = await res.json();
    expect(body).toMatchObject({ limit: 20, offset: 0 });
  });
});
