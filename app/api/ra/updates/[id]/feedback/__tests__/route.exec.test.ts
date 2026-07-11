// @vitest-environment node
// @MX:NOTE [AUTO] Execution tests for POST /api/ra/updates/[id]/feedback (SPEC-REGULA-RADAR-001).
// @MX:SPEC SPEC-REGULA-RADAR-001
//
// No prior test existed (0% coverage). Invokes POST with db transaction mocked
// (tx select + update/insert upsert + audit). Covers: insert path, update path,
// invalid feedback 422, no-org 403, missing-id 400.

import { beforeEach, describe, expect, it, vi } from 'vitest';

let authenticated = true;
let organizationId = 'org-001';
let existingQueue: unknown[][] = [];

type AuditInput = {
  actor_id: string | null;
  action: string;
  resource_type: string;
  resource_id: string;
  meta_json?: Record<string, unknown>;
};

const writeAudit = vi.fn(async (_input: AuditInput) => {});
const txUpdateWhere = vi.fn().mockResolvedValue(undefined);
const txInsertValues = vi.fn().mockResolvedValue(undefined);

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
  chain.then = (resolve: (v: unknown) => void) => resolve(existingQueue.shift() ?? []);
  return {
    db: {
      transaction: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) =>
        fn({
          select: () => chain,
          update: () => ({ set: () => ({ where: txUpdateWhere }) }),
          insert: () => ({ values: txInsertValues }),
        }),
      ),
    },
  };
});

const { POST } = await import('@/app/api/ra/updates/[id]/feedback/route');

function postReq(body: unknown): Request {
  return new Request('http://localhost/api/ra/updates/u-1/feedback', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

/** Extract audit inputs recorded by writeAudit, filtered by predicate. */
function auditCalls(predicate: (input: AuditInput) => boolean): AuditInput[] {
  return writeAudit.mock.calls
    .map((call) => (call as unknown[])[0] as AuditInput)
    .filter(predicate);
}

beforeEach(() => {
  vi.clearAllMocks();
  authenticated = true;
  organizationId = 'org-001';
  existingQueue = [];
});

describe('POST /api/ra/updates/[id]/feedback (SPEC-REGULA-RADAR-001)', () => {
  it('inserts a new relevance row + message.feedback audit when none exists', async () => {
    existingQueue = [[]];
    const res = await POST(postReq({ feedback: 'not_interested' }), { params: { id: 'u-1' } });
    expect(res.status).toBe(200);
    expect(txInsertValues).toHaveBeenCalled();
    expect(txUpdateWhere).not.toHaveBeenCalled();
    expect(auditCalls((i) => i.action === 'message.feedback')).toHaveLength(1);
  });

  it('updates the existing relevance row when one already exists', async () => {
    existingQueue = [[{ id: 'rel-1' }]];
    const res = await POST(postReq({ feedback: 'not_interested' }), { params: { id: 'u-1' } });
    expect(res.status).toBe(200);
    expect(txUpdateWhere).toHaveBeenCalled();
    expect(txInsertValues).not.toHaveBeenCalled();
  });

  it('returns 422 Invalid feedback value on a bad enum', async () => {
    const res = await POST(postReq({ feedback: 'love_it' }), { params: { id: 'u-1' } });
    expect(res.status).toBe(422);
  });

  it('returns 403 No organization context when orgId is missing', async () => {
    organizationId = undefined as unknown as string;
    const res = await POST(postReq({ feedback: 'not_interested' }), { params: { id: 'u-1' } });
    expect(res.status).toBe(403);
  });

  it('returns 400 Missing update ID when id is absent', async () => {
    const res = await POST(postReq({ feedback: 'not_interested' }), { params: {} });
    expect(res.status).toBe(400);
  });
});
