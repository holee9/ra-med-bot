// @vitest-environment node
// @MX:NOTE [AUTO] Execution tests for GET /api/admin/radar/health (SPEC-REGULA-RADAR-001).
// @MX:SPEC SPEC-REGULA-RADAR-001

import { beforeEach, describe, expect, it, vi } from 'vitest';

let authenticated = true;
let organizationId = 'org-001';
let selectQueue: unknown[][] = [];

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

vi.mock('@/lib/db/client', () => {
  const chain: Record<string, unknown> = {};
  chain.from = () => chain;
  chain.where = () => chain;
  chain.orderBy = () => chain;
  chain.limit = () => chain;
  // Intentional thenable: `await` on the chain pops the next queued select result.
  // biome-ignore lint/suspicious/noThenProperty: deliberate chainable thenable for the db mock
  chain.then = (resolve: (v: unknown) => void) => resolve(selectQueue.shift() ?? []);
  return { db: { select: () => chain } };
});

const { GET } = await import('@/app/api/admin/radar/health/route');

beforeEach(() => {
  vi.clearAllMocks();
  authenticated = true;
  organizationId = 'org-001';
  selectQueue = [];
});

describe('GET /api/admin/radar/health (SPEC-REGULA-RADAR-001)', () => {
  it('returns 200 ok with last crawler run + 24h update count', async () => {
    selectQueue = [
      [{ crawlerName: 'fda', startedAt: 'ts', status: 'ok' }], // last run
      [{ count: '5' }], // count(*) — pg returns numeric as string
    ];
    const res = await GET(new Request('http://localhost/api/admin/radar/health'), {});
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.status).toBe('ok');
    expect(body.last_crawler_run).toMatchObject({ crawlerName: 'fda' });
    expect(body.updates_last_24h).toBe(5);
  });

  it('returns 200 with null last_crawler_run when no runs exist', async () => {
    selectQueue = [[], [{ count: '0' }]];
    const res = await GET(new Request('http://localhost/api/admin/radar/health'), {});
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.last_crawler_run).toBeNull();
    expect(body.updates_last_24h).toBe(0);
  });
});
