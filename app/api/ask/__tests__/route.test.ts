// @vitest-environment node
// @MX:NOTE [AUTO] TDD unit tests — POST /api/ask (SPEC-V3-INBOX-001 + SPEC-V3-TRIAGE-001).
// @MX:SPEC SPEC-V3-INBOX-001 (REQ-V3-INBOX-001, Issue 320)
// @MX:SPEC SPEC-V3-TRIAGE-001 (REQ-TRI-001..008, Issue 339)
//
// Covers: RBAC (ask.create), validation (question min/max), audit (inbox.created +
// inbox.triaged), ticket creation with triageState='auto', TRIAGE RAG hook,
// AC-06 citation-less rejection, timeout/runtime fallback, response body contract.

import { beforeEach, describe, expect, it, vi } from 'vitest';

// --- Mock state toggles ---
let authenticated = true;
let userRole: 'viewer' | 'ra-member' | 'ra-lead' | 'admin' = 'ra-member';
let organizationId = 'org-001';

type AuditInput = {
  actor_id: string | null;
  action: string;
  resource_type: string;
  resource_id: string;
  meta_json?: Record<string, unknown>;
};

const writeAudit = vi.fn(async () => {});
const runTriage = vi.fn();

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

// db mock supports both tx1 (insert) and tx2 (update.where) chains.
vi.mock('@/lib/db/client', () => ({
  db: {
    transaction: vi.fn((fn: (tx: unknown) => Promise<unknown>) =>
      fn({
        insert: vi.fn().mockReturnValue({
          values: vi.fn().mockReturnValue({}),
        }),
        update: vi.fn().mockReturnValue({
          set: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({}),
          }),
        }),
      }),
    ),
  },
}));

vi.mock('@/lib/domains/triage', () => ({ runTriage }));

vi.mock('@/lib/env', () => ({
  getEnv: vi.fn(() => ({
    DATABASE_URL: 'postgres://test',
    AUTH_SECRET: 'test-secret',
    NEXTAUTH_URL: 'http://localhost',
    AUTH_MICROSOFT_ID: 'test',
    AUTH_MICROSOFT_SECRET: 'test',
    AUTH_GOOGLE_ID: 'test',
    AUTH_GOOGLE_SECRET: 'test',
  })),
}));

const { POST } = await import('@/app/api/ask/route');

function postReq(body: Record<string, unknown>): Request {
  return new Request('http://localhost/api/ask', {
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

const triageSuccess = {
  autoAnswer: { answer: '<p>answer</p>', citations: [{ source: 'src-1' }] },
  autoConfidence: 0.82,
};

beforeEach(() => {
  vi.clearAllMocks();
  authenticated = true;
  userRole = 'ra-member';
  organizationId = 'org-001';
  runTriage.mockResolvedValue(triageSuccess);
});

describe('POST /api/ask — characterization (SPEC-V3-INBOX-001)', () => {
  it('creates a ticket and returns 201 with ticketId', async () => {
    const res = await POST(postReq({ question: 'What is the 510(k) pathway?' }), {});
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.ticketId).toMatch(/^it_/);
  });

  it('allows viewer role with ask.create permission (H-4 fix)', async () => {
    userRole = 'viewer';
    const res = await POST(postReq({ question: 'What is the 510(k) pathway?' }), {});
    expect(res.status).toBe(201);
  });

  it('denies unauthenticated request with 401 and skips TRIAGE', async () => {
    authenticated = false;
    const res = await POST(postReq({ question: 'Test question' }), {});
    expect(res.status).toBe(401);
    expect(runTriage).not.toHaveBeenCalled();
  });

  it('rejects empty question with 400', async () => {
    const res = await POST(postReq({ question: '' }), {});
    const body = await res.json();
    expect(res.status).toBe(400);
    expect(body.error).toBe('Invalid input');
  });

  it('rejects question exceeding 5000 characters with 400', async () => {
    const res = await POST(postReq({ question: 'x'.repeat(5001) }), {});
    expect(res.status).toBe(400);
  });

  it('returns 403 when organizationId is missing', async () => {
    organizationId = undefined as unknown as string;
    const res = await POST(postReq({ question: 'Test question' }), {});
    expect(res.status).toBe(403);
  });

  it('writes inbox.created audit row', async () => {
    await POST(postReq({ question: 'Test question' }), {});
    const created = auditCalls((input) => input.action === 'inbox.created');
    expect(created.length).toBeGreaterThan(0);
  });
});

describe('POST /api/ask TRIAGE hook (SPEC-V3-TRIAGE-001)', () => {
  /**
   * T-009 + T-012: normal path — TRIAGE success injects auto_answer, transitions
   * auto → needs-review, returns the full response body contract (AC-TRI-01/05).
   */
  it('T-009 injects auto_answer and transitions to needs-review on TRIAGE success', async () => {
    const res = await POST(postReq({ question: '510(k) predicate?' }), {});
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.triageState).toBe('needs-review');
    expect(body.ticketId).toMatch(/^it_/);
    expect(body.autoAnswer).toEqual(triageSuccess.autoAnswer);
    expect(body.autoConfidence).toBe(0.82);
    expect(runTriage).toHaveBeenCalledWith({
      question: '510(k) predicate?',
      orgId: 'org-001',
      actorId: 'user-001',
    });
  });

  /**
   * T-010 (AC-06): citation-less TRIAGE → 400, ticket stays in 'auto', audit
   * records auto_triage_rejected (REQ-TRI-002, AC-TRI-02).
   */
  it('T-010 returns 400 no_citations when TRIAGE yields no citations', async () => {
    runTriage.mockResolvedValue({ autoAnswer: null, autoConfidence: null, error: 'no_citations' });

    const res = await POST(postReq({ question: 'unknown topic' }), {});
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe('no_citations');
    const rejected = auditCalls(
      (input) => input.action === 'inbox.triaged' && input.meta_json?.auto_triage_rejected === true,
    );
    expect(rejected.length).toBeGreaterThan(0);
    expect(rejected[0]?.meta_json?.reason).toBe('no_citations');
  });

  /**
   * T-011 (REQ-TRI-005): timeout fallback — 201 kept, autoAnswer null, ticket
   * remains in 'auto' state (AC-TRI-04).
   */
  it('T-011 returns 201 with auto Answer null on TRIAGE timeout', async () => {
    runTriage.mockResolvedValue({ autoAnswer: null, autoConfidence: null, error: 'timeout' });

    const res = await POST(postReq({ question: 'slow rag' }), {});
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.triageState).toBe('auto');
    expect(body.autoAnswer).toBeNull();
    expect(body.autoConfidence).toBeNull();
    // No 'inbox.triaged' audit on fallback (only inbox.created from tx1).
    const triaged = auditCalls((input) => input.action === 'inbox.triaged');
    expect(triaged).toHaveLength(0);
  });

  it('T-011b returns 201 fallback on TRIAGE runtime_error', async () => {
    runTriage.mockResolvedValue({
      autoAnswer: null,
      autoConfidence: null,
      error: 'runtime_error',
    });

    const res = await POST(postReq({ question: 'broken rag' }), {});
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.triageState).toBe('auto');
    expect(body.autoAnswer).toBeNull();
  });

  /**
   * T-013 (AC-TRI-06): success transition audit carries auto_triage meta +
   * confidence_score + citations_count (21 CFR Part 11 §11.10(e)).
   */
  it('T-013 writes inbox.triaged audit with auto_triage meta on success', async () => {
    await POST(postReq({ question: 'cite this' }), {});

    const success = auditCalls(
      (input) =>
        input.action === 'inbox.triaged' &&
        input.meta_json?.auto_triage === true &&
        input.meta_json?.from === 'auto' &&
        input.meta_json?.to === 'needs-review',
    );
    expect(success.length).toBeGreaterThan(0);
    expect(success[0]?.meta_json?.confidence_score).toBe(0.82);
    expect(success[0]?.meta_json?.citations_count).toBe(1);
  });

  /**
   * T-016 (REQ-TRI-008): TRIAGE runs only behind ask.create gate. Unauthenticated
   * requests never invoke runTriage (covered above) — here we confirm the gate
   * still passes authenticated viewer/ra-member/ra-lead/admin roles through.
   */
  it.each(['viewer', 'ra-member', 'ra-lead', 'admin'] as const)(
    'T-016 permits %s role to trigger TRIAGE (ask.create gate)',
    async (role) => {
      userRole = role;
      await POST(postReq({ question: 'q' }), {});
      expect(runTriage).toHaveBeenCalled();
    },
  );
});
