// @vitest-environment node
// @MX:NOTE [AUTO] Execution tests for POST /api/knowledge-gap/classify (SPEC-REGULA-KNOWLEDGE-GAP-001).
// @MX:SPEC SPEC-REGULA-KNOWLEDGE-GAP-001 (REQ-008/009, AC-04/07/08, Issue #35)
//
// No prior test existed (0% coverage). Invokes POST with withTenantScope mocked
// over a tx handle (select chainable thenable + update chain). Covers: success
// + knowledge_gap_classified audit, not_found (IDOR 404), invalid_body 400,
// tx-error 500, no_org_context 403.

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
const txUpdateWhere = vi.fn().mockResolvedValue(undefined);

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
          user: { id: 'user-001', role: 'ra-lead', organizationId },
        });
      },
  ),
}));

// withTenantScope invokes the callback with a tx handle: select() is a chainable
// thenable over selectQueue; update().set().where() resolves via txUpdateWhere.
vi.mock('@/lib/db/client', () => {
  const chain: Record<string, unknown> = {};
  chain.from = () => chain;
  chain.where = () => chain;
  // Intentional thenable: `await` on the select chain pops the next queued result.
  // biome-ignore lint/suspicious/noThenProperty: deliberate chainable thenable for the db mock
  chain.then = (resolve: (v: unknown) => void) => resolve(selectQueue.shift() ?? []);
  const tx = {
    select: () => chain,
    update: () => ({ set: () => ({ where: txUpdateWhere }) }),
  };
  return {
    withTenantScope: vi.fn(async (_orgId: string, fn: (tx: unknown) => unknown) => fn(tx)),
  };
});

const { POST } = await import('@/app/api/knowledge-gap/classify/route');

function postReq(body: unknown): Request {
  return new Request('http://localhost/api/knowledge-gap/classify', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

const QUEUE_UUID = '00000000-0000-4000-8000-000000000000';

const validBody = (overrides: Record<string, unknown> = {}) => ({
  queueId: QUEUE_UUID,
  classification: 'ra_project_gap',
  ...overrides,
});

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
  selectQueue = [];
  txUpdateWhere.mockResolvedValue(undefined);
});

describe('POST /api/knowledge-gap/classify (REQ-KNOWLEDGE-GAP-008/009)', () => {
  it('returns 200 + knowledge_gap_classified audit on success', async () => {
    selectQueue = [[{ id: QUEUE_UUID }]];
    const res = await POST(postReq(validBody({ note: 'SOP gap' })), {});
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body).toEqual({
      queueId: QUEUE_UUID,
      classification: 'ra_project_gap',
      status: 'classified',
    });
    const audits = auditCalls((i) => i.action === 'knowledge_gap_classified');
    expect(audits).toHaveLength(1);
    expect(audits[0]?.meta_json).toMatchObject({
      classification: 'ra_project_gap',
      note: 'SOP gap',
    });
  });

  it('returns 404 not_found when the queue row is missing (IDOR — 404 not 403)', async () => {
    selectQueue = [[]];
    const res = await POST(postReq(validBody()), {});
    expect(res.status).toBe(404);
    expect((await res.json()).queueId).toBe(QUEUE_UUID);
    expect(auditCalls((i) => i.action === 'knowledge_gap_classified')).toHaveLength(0);
  });

  it('returns 400 invalid_body on a bad classification enum', async () => {
    const res = await POST(postReq({ classification: 'not-a-category' }), {});
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('invalid_body');
  });

  it('returns 500 classification_failed when the tx update rejects', async () => {
    selectQueue = [[{ id: QUEUE_UUID }]];
    txUpdateWhere.mockRejectedValueOnce(new Error('db down'));
    const res = await POST(postReq(validBody()), {});
    expect(res.status).toBe(500);
    expect((await res.json()).error).toBe('classification_failed');
  });

  it('returns 403 no_org_context when organizationId is missing', async () => {
    organizationId = undefined as unknown as string;
    const res = await POST(postReq(validBody()), {});
    expect(res.status).toBe(403);
  });
});
