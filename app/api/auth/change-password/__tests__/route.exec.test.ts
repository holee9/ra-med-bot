// @vitest-environment node
// @MX:NOTE [AUTO] Execution tests for PATCH /api/auth/change-password (SPEC-REGULA-AUTH-001).
// @MX:SPEC SPEC-REGULA-AUTH-001

import { beforeEach, describe, expect, it, vi } from 'vitest';

let session: { user: { id: string } } | null = { user: { id: 'u-1' } };
let userQueue: unknown[][] = [];

type AuditInput = {
  actor_id: string | null;
  action: string;
  resource_type: string;
  resource_id: string;
  meta_json?: Record<string, unknown>;
};

const writeAudit = vi.fn(async (_input: AuditInput) => {});
const txUpdateWhere = vi.fn().mockResolvedValue(undefined);

vi.mock('@/lib/audit', () => ({ writeAudit }));
vi.mock('@/lib/auth', () => ({ auth: vi.fn(async () => session) }));
vi.mock('bcryptjs', () => ({ default: { hash: vi.fn(async () => 'hashed') } }));

vi.mock('@/lib/db/client', () => {
  const chain: Record<string, unknown> = {};
  chain.from = () => chain;
  chain.where = () => chain;
  chain.limit = () => chain;
  // Intentional thenable: `await` on the chain pops the next queued user row.
  // biome-ignore lint/suspicious/noThenProperty: deliberate chainable thenable for the db mock
  chain.then = (resolve: (v: unknown) => void) => resolve(userQueue.shift() ?? []);
  return {
    db: {
      select: () => chain,
      transaction: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) =>
        fn({ update: () => ({ set: () => ({ where: txUpdateWhere }) }) }),
      ),
    },
  };
});

const { PATCH } = await import('@/app/api/auth/change-password/route');

function patchReq(body: unknown): Request {
  return new Request('http://localhost/api/auth/change-password', {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  session = { user: { id: 'u-1' } };
  userQueue = [];
});

describe('PATCH /api/auth/change-password (SPEC-REGULA-AUTH-001)', () => {
  it('returns 200 + profile.update audit (mustChangePasswordCleared) on success', async () => {
    userQueue = [[{ id: 'u-1', mustChangePassword: true }]];
    const res = await PATCH(patchReq({ password: 'newpassword1' }));
    expect(res.status).toBe(200);
    expect(txUpdateWhere).toHaveBeenCalled();
    const audits = writeAudit.mock.calls.map((c) => (c as unknown[])[0] as AuditInput);
    expect(audits).toHaveLength(1);
    expect(audits[0]?.meta_json).toMatchObject({
      passwordChanged: true,
      mustChangePasswordCleared: true,
    });
  });

  it('returns 401 when there is no session', async () => {
    session = null;
    const res = await PATCH(patchReq({ password: 'newpassword1' }));
    expect(res.status).toBe(401);
  });

  it('returns 404 when the user is not found', async () => {
    userQueue = [[]];
    const res = await PATCH(patchReq({ password: 'newpassword1' }));
    expect(res.status).toBe(404);
  });

  it('returns 400 on a too-short password', async () => {
    const res = await PATCH(patchReq({ password: 'short' }));
    expect(res.status).toBe(400);
  });
});
