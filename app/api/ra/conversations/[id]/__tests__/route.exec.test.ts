// @vitest-environment node
// @MX:NOTE [AUTO] Execution tests for /api/ra/conversations/[id] (SPEC-REGULA-ENTERPRISE-001).
// @MX:SPEC SPEC-REGULA-ENTERPRISE-001 (REQ-ENTERPRISE-019)

import { beforeEach, describe, expect, it, vi } from 'vitest';

let authenticated = true;
let organizationId = 'org-001';
let selectQueue: unknown[][] = [];

type AuditInput = {
  actor_id: string | null;
  action: string;
  resource_type: string;
  resource_id: string;
  meta_json?: Record<string, unknown>;
};

const writeAudit = vi.fn(async (_input: AuditInput) => {});
const txDeleteWhere = vi.fn().mockResolvedValue(undefined);

vi.mock('@/lib/audit', () => ({ writeAudit }));

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
  chain.where = () => chain;
  chain.limit = () => chain;
  // Intentional thenable: `await` on the chain pops the next queued select result.
  // biome-ignore lint/suspicious/noThenProperty: deliberate chainable thenable for the db mock
  chain.then = (resolve: (v: unknown) => void) => resolve(selectQueue.shift() ?? []);
  return {
    db: {
      select: () => chain,
      transaction: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) =>
        fn({ delete: () => ({ where: txDeleteWhere }) }),
      ),
    },
  };
});

const { GET, DELETE } = await import('@/app/api/ra/conversations/[id]/route');

beforeEach(() => {
  vi.clearAllMocks();
  authenticated = true;
  organizationId = 'org-001';
  selectQueue = [];
});

describe('GET /api/ra/conversations/[id] (REQ-ENTERPRISE-019)', () => {
  it('returns 200 with the conversation when found', async () => {
    selectQueue = [[{ id: 'c-1', title: 'T' }]];
    const res = await GET(new Request('http://localhost/api/ra/conversations/c-1'), {
      params: { id: 'c-1' },
    });
    expect(res.status).toBe(200);
    expect((await res.json()).conversation.id).toBe('c-1');
  });

  it('returns 404 when the conversation does not exist', async () => {
    selectQueue = [[]];
    const res = await GET(new Request('http://localhost/api/ra/conversations/cx'), {
      params: { id: 'cx' },
    });
    expect(res.status).toBe(404);
  });

  it('returns 400 Missing id when id is absent', async () => {
    const res = await GET(new Request('http://localhost/api/ra/conversations/'), {
      params: {},
    });
    expect(res.status).toBe(400);
  });
});

describe('DELETE /api/ra/conversations/[id] (ownership + audit)', () => {
  it('returns 204 + conversation.delete audit when the caller owns it', async () => {
    selectQueue = [[{ userId: 'user-001' }]];
    const res = await DELETE(
      new Request('http://localhost/api/ra/conversations/c-1', { method: 'DELETE' }),
      { params: { id: 'c-1' } },
    );
    expect(res.status).toBe(204);
    expect(txDeleteWhere).toHaveBeenCalled();
    const audits = writeAudit.mock.calls.map((c) => (c as unknown[])[0] as AuditInput);
    expect(audits).toHaveLength(1);
    expect(audits[0]?.action).toBe('conversation.delete');
  });

  it('returns 404 when the caller does not own the conversation', async () => {
    selectQueue = [[]];
    const res = await DELETE(
      new Request('http://localhost/api/ra/conversations/c-1', { method: 'DELETE' }),
      { params: { id: 'c-1' } },
    );
    expect(res.status).toBe(404);
    expect(txDeleteWhere).not.toHaveBeenCalled();
  });

  it('returns 400 Missing id when id is absent', async () => {
    const res = await DELETE(
      new Request('http://localhost/api/ra/conversations/', { method: 'DELETE' }),
      { params: {} },
    );
    expect(res.status).toBe(400);
  });
});
