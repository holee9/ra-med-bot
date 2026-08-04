// @vitest-environment node
// @MX:NOTE [AUTO] Execution tests for GET /api/ra/impact (SPEC-REGULA-IMPACT-001).
// @MX:SPEC SPEC-REGULA-IMPACT-001
//
// No prior test existed (0% coverage). Invokes GET with db mocked as a chainable
// thenable over a per-test select queue: the main assessments select, then one
// action-item select per assessment (Promise.all). Covers: counts mapping + 400.

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
  chain.orderBy = () => chain;
  chain.limit = () => chain;
  // Intentional thenable: `await` on the chain pops the next queued select result.
  // biome-ignore lint/suspicious/noThenProperty: deliberate chainable thenable for the db mock
  chain.then = (resolve: (v: unknown) => void) => resolve(selectQueue.shift() ?? []);
  return { db: { select: () => chain } };
});

const { GET } = await import('@/app/api/ra/impact/route');

beforeEach(() => {
  vi.clearAllMocks();
  authenticated = true;
  organizationId = 'org-001';
  selectQueue = [];
});

describe('GET /api/ra/impact (SPEC-REGULA-IMPACT-001)', () => {
  it('returns 200 with assessments + open/total action-item counts', async () => {
    selectQueue = [
      [{ id: 'a1' }, { id: 'a2' }], // main assessments select
      [
        { id: 'i1', status: 'open' },
        { id: 'i2', status: 'open' },
        { id: 'i3', status: 'done' },
      ], // a1 items
      [{ id: 'i4', status: 'done' }], // a2 items
    ];
    const res = await GET(new Request('http://localhost/api/ra/impact'), {});
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.assessments).toHaveLength(2);
    expect(body.assessments[0]).toMatchObject({ action_items_total: 3, action_items_open: 2 });
    expect(body.assessments[1]).toMatchObject({ action_items_total: 1, action_items_open: 0 });
  });

  it('returns 400 Organization context required when orgId is missing', async () => {
    organizationId = undefined as unknown as string;
    const res = await GET(new Request('http://localhost/api/ra/impact'), {});
    expect(res.status).toBe(400);
  });
});
