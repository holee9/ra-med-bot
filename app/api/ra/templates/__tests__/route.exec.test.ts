// @vitest-environment node
// @MX:NOTE [AUTO] Execution tests for GET /api/ra/templates (SPEC-REGULA-ENTERPRISE-001).
// @MX:SPEC SPEC-REGULA-ENTERPRISE-001 (REQ-ENTERPRISE-019)

import { beforeEach, describe, expect, it, vi } from 'vitest';

let rows: unknown[] = [];

vi.mock('@/lib/auth/with-permission', () => ({
  withPermission: vi.fn(
    (
      _action: string,
      handler: (req: Request, ctx: unknown, session: unknown) => Promise<Response>,
    ) =>
      (req: Request, ctx: unknown) =>
        handler(req, ctx, {
          user: { id: 'user-001', role: 'ra-member', organizationId: 'org-001' },
        }),
  ),
}));

vi.mock('@/lib/db/client', () => {
  const chain: Record<string, unknown> = {};
  chain.from = () => chain;
  chain.orderBy = () => chain;
  // Intentional thenable: `await` on the chain resolves to rows.
  // biome-ignore lint/suspicious/noThenProperty: deliberate chainable thenable for the db mock
  chain.then = (resolve: (v: unknown) => void) => resolve(rows);
  return { db: { select: () => chain } };
});

const { GET } = await import('@/app/api/ra/templates/route');

beforeEach(() => {
  vi.clearAllMocks();
  rows = [];
});

describe('GET /api/ra/templates (REQ-ENTERPRISE-019)', () => {
  it('returns 200 with the template list', async () => {
    rows = [{ id: 't1' }, { id: 't2' }];
    const res = await GET(new Request('http://localhost/api/ra/templates'), {});
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.templates).toHaveLength(2);
  });
});
