// @vitest-environment node
// @MX:NOTE [AUTO] Execution tests for POST /api/auth/signup (OWASP A01:2021 deferred-role signup).
// @MX:SPEC SPEC-REGULA-AUTH-001

import { beforeEach, describe, expect, it, vi } from 'vitest';

let existingQueue: unknown[][] = [];

type AuditInput = {
  actor_id: string | null;
  action: string;
  resource_type: string;
  resource_id: string;
  meta_json?: Record<string, unknown>;
};

const writeAudit = vi.fn(async (_input: AuditInput) => {});
const txInsertReturning = vi.fn().mockResolvedValue([{ id: 'u-1' }]);

vi.mock('@/lib/audit', () => ({ writeAudit }));
vi.mock('bcryptjs', () => ({ default: { hash: vi.fn(async () => 'hashed') } }));

vi.mock('@/lib/db/client', () => {
  const chain: Record<string, unknown> = {};
  chain.from = () => chain;
  chain.where = () => chain;
  chain.limit = () => chain;
  // Intentional thenable: `await` on the chain pops the next queued existing-user result.
  // biome-ignore lint/suspicious/noThenProperty: deliberate chainable thenable for the db mock
  chain.then = (resolve: (v: unknown) => void) => resolve(existingQueue.shift() ?? []);
  return {
    db: {
      select: () => chain,
      transaction: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) =>
        fn({ insert: () => ({ values: () => ({ returning: txInsertReturning }) }) }),
      ),
    },
  };
});

const { POST } = await import('@/app/api/auth/signup/route');

function postReq(body: unknown): Request {
  return new Request('http://localhost/api/auth/signup', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

const validBody = { name: 'Regula User', email: 'reg@example.com', password: 'securepass1' };

beforeEach(() => {
  vi.clearAllMocks();
  existingQueue = [];
  txInsertReturning.mockResolvedValue([{ id: 'u-1' }]);
});

describe('POST /api/auth/signup (OWASP A01:2021 deferred role)', () => {
  it('returns 201 + profile.update audit (actor_id null, source signup) on success', async () => {
    existingQueue = [[]];
    const res = await POST(postReq(validBody));
    expect(res.status).toBe(201);
    const audits = writeAudit.mock.calls.map((c) => (c as unknown[])[0] as AuditInput);
    expect(audits).toHaveLength(1);
    expect(audits[0]).toMatchObject({
      actor_id: null,
      action: 'profile.update',
      resource_type: 'user',
    });
    expect(audits[0]?.meta_json).toMatchObject({ status: 'pending', source: 'signup' });
  });

  it('returns 409 when the email is already in use', async () => {
    existingQueue = [[{ id: 'u-x' }]];
    const res = await POST(postReq(validBody));
    expect(res.status).toBe(409);
  });

  it('returns 400 on an invalid email', async () => {
    const res = await POST(postReq({ ...validBody, email: 'not-an-email' }));
    expect(res.status).toBe(400);
  });

  it('returns 400 on a too-short password', async () => {
    const res = await POST(postReq({ ...validBody, password: 'short' }));
    expect(res.status).toBe(400);
  });

  it('returns 500 when the insert returns no row', async () => {
    existingQueue = [[]];
    txInsertReturning.mockResolvedValue([]);
    const res = await POST(postReq(validBody));
    expect(res.status).toBe(500);
  });
});
