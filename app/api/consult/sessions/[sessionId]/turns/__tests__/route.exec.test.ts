// @vitest-environment node
// @MX:NOTE [AUTO] Execution tests for POST /api/consult/sessions/[sessionId]/turns (SPEC-V3-CONSULT-001).
// @MX:SPEC SPEC-V3-CONSULT-001 (REQ-CONS-004/005/008/010, AC-CONS-03..07, Issue 341)
//
// No prior test existed (0% coverage). The most complex CONSULT handler: RAG
// (runConsult, mocked) + tx (turnNumber MAX+1 + INSERT + audit) + error branching.
// db is mocked as a chainable thenable over a per-test select queue (session
// lookup + max select) plus a tx insert. Covers: 201 success, 400 result.error,
// IDOR 404, missing-session 404, invalid question 400, missing sessionId 400,
// no org 403.

import { beforeEach, describe, expect, it, vi } from 'vitest';

let authenticated = true;
let organizationId = 'org-001';
type Role = 'viewer' | 'ra-member' | 'ra-lead' | 'admin';
let userRole: Role = 'ra-lead';
let selectQueue: unknown[][] = [];

type AuditInput = {
  actor_id: string | null;
  action: string;
  resource_type: string;
  resource_id: string;
  meta_json?: Record<string, unknown>;
};

const writeAudit = vi.fn(async (_input: AuditInput) => {});
const runConsult = vi.fn();
const txInsertReturning = vi.fn().mockResolvedValue([{ id: 't-1', turnNumber: 3 }]);

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
          user: { id: 'user-001', role: userRole, organizationId },
        });
      },
  ),
}));

vi.mock('@/lib/domains/consult', () => ({ runConsult }));

// db: top-level select (session lookup) + transaction(tx max select + tx insert).
// Both selects share the chainable thenable over selectQueue (popped in call order).
vi.mock('@/lib/db/client', () => {
  const chain: Record<string, unknown> = {};
  chain.from = () => chain;
  chain.where = () => chain;
  chain.limit = () => chain;
  chain.orderBy = () => chain;
  // Intentional thenable: `await` on the chain pops the next queued select result.
  // biome-ignore lint/suspicious/noThenProperty: deliberate chainable thenable for the db mock
  chain.then = (resolve: (v: unknown) => void) => resolve(selectQueue.shift() ?? []);
  return {
    db: {
      select: () => chain,
      transaction: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) =>
        fn({
          select: () => chain,
          insert: () => ({ values: () => ({ returning: txInsertReturning }) }),
        }),
      ),
    },
  };
});

const { POST } = await import('@/app/api/consult/sessions/[sessionId]/turns/route');

function postReq(body: unknown): Request {
  return new Request('http://localhost/api/consult/sessions/s-1/turns', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

function sessionRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return { id: 's-1', orgId: 'org-001', userId: 'user-001', ...overrides };
}

const successResult = {
  answer: '<p>answer</p>',
  citations: [{ source: 'src-1' }],
  sources: [{ id: 'src-1' }],
  confidence: 0.82,
  error: null,
};

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
  userRole = 'ra-lead';
  selectQueue = [];
  runConsult.mockResolvedValue(successResult);
  txInsertReturning.mockResolvedValue([{ id: 't-1', turnNumber: 3 }]);
});

describe('POST /api/consult/sessions/[sessionId]/turns — success + audit (AC-CONS-03)', () => {
  it('returns 201 + consult.turn.create audit with questionHash (no raw question)', async () => {
    selectQueue = [[sessionRow()], [{ m: 2 }]];
    const res = await POST(postReq({ question: 'What is 510(k)?' }), {
      params: { sessionId: 's-1' },
    });
    const body = await res.json();
    expect(res.status).toBe(201);
    expect(body.turn.id).toBe('t-1');
    const audits = auditCalls((i) => i.action === 'consult.turn.create');
    expect(audits).toHaveLength(1);
    expect(audits[0]?.meta_json).toMatchObject({ turnNumber: 3, citationCount: 1 });
    // Raw question must never appear in the audit meta (only the hash).
    expect(JSON.stringify(audits[0]?.meta_json)).not.toMatch(/What is 510/);
    expect(audits[0]?.meta_json?.questionHash).toMatch(/^[0-9a-f]{16}$/);
  });
});

describe('POST /api/consult/sessions/[sessionId]/turns — error result (AC-CONS-05)', () => {
  it('returns 400 with the error kind + turn, and audits consult.turn.failed', async () => {
    runConsult.mockResolvedValueOnce({ ...successResult, answer: null, error: 'timeout' });
    selectQueue = [[sessionRow()], [{ m: 0 }]];
    const res = await POST(postReq({ question: 'slow question' }), {
      params: { sessionId: 's-1' },
    });
    const body = await res.json();
    expect(res.status).toBe(400);
    expect(body.error).toBe('timeout');
    expect(body.turn.id).toBe('t-1');
    expect(auditCalls((i) => i.action === 'consult.turn.failed')).toHaveLength(1);
  });
});

describe('POST /api/consult/sessions/[sessionId]/turns — access control', () => {
  it('returns 404 when the session does not exist', async () => {
    selectQueue = [[]];
    const res = await POST(postReq({ question: 'q' }), { params: { sessionId: 'sx' } });
    expect(res.status).toBe(404);
  });

  it('returns 404 (not 403) when an ra-member accesses another user session — IDOR', async () => {
    userRole = 'ra-member';
    selectQueue = [[sessionRow({ userId: 'someone-else' })]];
    const res = await POST(postReq({ question: 'q' }), { params: { sessionId: 's-1' } });
    expect(res.status).toBe(404);
  });

  it('returns 400 Missing sessionId when sessionId is absent', async () => {
    const res = await POST(postReq({ question: 'q' }), { params: {} });
    expect(res.status).toBe(400);
  });

  it('returns 400 Invalid input on an empty question', async () => {
    selectQueue = [[sessionRow()]];
    const res = await POST(postReq({ question: '' }), { params: { sessionId: 's-1' } });
    expect(res.status).toBe(400);
  });

  it('returns 403 when organizationId is missing', async () => {
    organizationId = undefined as unknown as string;
    const res = await POST(postReq({ question: 'q' }), { params: { sessionId: 's-1' } });
    expect(res.status).toBe(403);
  });
});
