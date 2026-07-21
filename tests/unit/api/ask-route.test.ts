// @MX:NOTE [AUTO] Route tests for POST /api/ask — inbox ticket + TRIAGE RAG hook (coverage 402).
// @MX:SPEC SPEC-V3-INBOX-001 (REQ-V3-INBOX-001), SPEC-V3-TRIAGE-001 (REQ-TRI-001..008)
// @MX:TODO Deep RAG pipeline (retrieval/rerank/generation/citation enforcement) covered by
//   lib/domains/triage/__tests__. These tests exercise the route handler surface:
//   auth passthrough, org-context guard, rate limit, Zod validation, ticket
//   insert + audit (tx1), TRIAGE RAG hook (runTriage), AC-06 no_citations
//   branch, timeout/runtime_error fallback, normal auto→needs-review transition.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// --- Mutable session ---
let sessionUser: {
  id: string;
  role: string;
  organizationId: string | null;
} = {
  id: 'user-001',
  role: 'viewer',
  organizationId: 'org-001',
};

vi.mock('@/lib/kernel/auth/with-permission', () => ({
  withPermission: vi.fn(
    (
      _action: string,
      handler: (req: Request, ctx: unknown, session: unknown) => Promise<Response>,
    ) =>
      (req: Request, ctx: unknown) =>
        handler(req, ctx, { user: sessionUser }),
  ),
}));

// --- Mock db: transaction with insert/update chain ---
const mockInsertChain = {
  values: vi.fn().mockReturnThis(),
};

const mockUpdateChain = {
  set: vi.fn().mockReturnThis(),
  where: vi.fn().mockResolvedValue(undefined),
};

const mockDb = {
  transaction: vi.fn(async (cb: (tx: unknown) => Promise<unknown>) =>
    cb({
      insert: vi.fn(() => mockInsertChain),
      update: vi.fn(() => mockUpdateChain),
      execute: vi.fn(),
    }),
  ),
};

vi.mock('@/lib/kernel/db/client', () => ({ db: mockDb }));

// --- Mock audit ---
vi.mock('@/lib/kernel/audit', () => ({
  writeAudit: vi.fn().mockResolvedValue(undefined),
}));

// --- Mock runTriage (RAG pipeline) — mutable per test ---
const runTriageMock = vi.fn();
vi.mock('@/lib/domains/triage', () => ({
  runTriage: (...a: unknown[]) => runTriageMock(...a),
}));

// --- Mock state machine (pure function, real impl is fine but stub for isolation) ---
vi.mock('@/lib/domains/inbox/state-machine', () => ({
  assertValidTransition: vi.fn(),
}));

// --- Helpers ---
function makePostRequest(body: unknown): Request {
  return new Request('http://localhost/api/ask', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

const VALID_BODY = { question: 'What are the FDA 510(k) submission requirements?' };

const TRIAGE_SUCCESS = {
  autoAnswer: {
    answer: '<p>The requirements are...</p>',
    citations: [{ source: 'src-001', quote: 'FDA guidance' }],
  },
  autoConfidence: 0.85,
};

describe('POST /api/ask — handler surface', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionUser = { id: 'user-001', role: 'viewer', organizationId: 'org-001' };
    runTriageMock.mockResolvedValue(TRIAGE_SUCCESS);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('returns 201 with ticketId + needs-review state on successful TRIAGE', async () => {
    const { POST } = await import('@/app/api/ask/route');
    const res = await POST(makePostRequest(VALID_BODY), {});

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.ticketId).toMatch(/^it_/);
    expect(body.triageState).toBe('needs-review');
    expect(body.autoConfidence).toBe(0.85);
    expect(body.autoAnswer).toEqual(TRIAGE_SUCCESS.autoAnswer);
  });

  it('inserts ticket with triageState=auto and writes inbox.created audit (tx1)', async () => {
    const { writeAudit } = await import('@/lib/kernel/audit');
    vi.mocked(writeAudit).mockClear();

    const { POST } = await import('@/app/api/ask/route');
    await POST(makePostRequest(VALID_BODY), {});

    // tx1: ticket insert happened
    expect(mockDb.transaction).toHaveBeenCalled();
    // inbox.created audit row
    expect(vi.mocked(writeAudit)).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'inbox.created',
        actor_id: 'user-001',
        resource_type: 'inbox_ticket',
      }),
      expect.anything(),
    );
  });

  it('writes inbox.triaged audit with auto_triage=true on normal transition', async () => {
    const { writeAudit } = await import('@/lib/kernel/audit');
    vi.mocked(writeAudit).mockClear();

    const { POST } = await import('@/app/api/ask/route');
    await POST(makePostRequest(VALID_BODY), {});

    expect(vi.mocked(writeAudit)).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'inbox.triaged',
        meta_json: expect.objectContaining({
          from: 'auto',
          to: 'needs-review',
          auto_triage: true,
          confidence_score: 0.85,
        }),
      }),
      expect.anything(),
    );
  });

  it('returns 403 when session has no organizationId', async () => {
    sessionUser = { id: 'user-001', role: 'viewer', organizationId: null };

    const { POST } = await import('@/app/api/ask/route');
    const res = await POST(makePostRequest(VALID_BODY), {});

    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toBe('Organization context required');
  });

  it('throws on invalid JSON body (route does not catch parse errors)', async () => {
    // NOTE: unlike /api/rlhf/feedback and /api/validation/signoff which catch
    // JSON parse errors, /api/ask calls `await req.json()` without .catch().
    // A malformed body surfaces as an unhandled SyntaxError. This is a known
    // route-level gap (not a test bug) — documenting the actual behavior.
    const { POST } = await import('@/app/api/ask/route');

    await expect(POST(makePostRequest('not-json'), {})).rejects.toThrow(SyntaxError);
  });

  it('returns 400 when question is empty', async () => {
    const { POST } = await import('@/app/api/ask/route');
    const res = await POST(makePostRequest({ question: '' }), {});

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('Invalid input');
  });

  it('returns 400 when question exceeds 5000 chars', async () => {
    const { POST } = await import('@/app/api/ask/route');
    const res = await POST(makePostRequest({ question: 'x'.repeat(5001) }), {});

    expect(res.status).toBe(400);
  });

  it('returns 400 no_citations when TRIAGE rejects with no_citations (AC-06)', async () => {
    runTriageMock.mockResolvedValue({
      autoAnswer: null,
      autoConfidence: null,
      error: 'no_citations',
    });

    const { POST } = await import('@/app/api/ask/route');
    const res = await POST(makePostRequest(VALID_BODY), {});

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('no_citations');
    // The route audits the rejection (21 CFR Part 11).
    const { writeAudit } = await import('@/lib/kernel/audit');
    expect(vi.mocked(writeAudit)).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'inbox.triaged',
        meta_json: expect.objectContaining({
          auto_triage_rejected: true,
          reason: 'no_citations',
        }),
      }),
      expect.anything(),
    );
  });

  it('returns 201 fallback when TRIAGE times out (REQ-TRI-005)', async () => {
    runTriageMock.mockResolvedValue({
      autoAnswer: null,
      autoConfidence: null,
      error: 'timeout',
    });

    const { POST } = await import('@/app/api/ask/route');
    const res = await POST(makePostRequest(VALID_BODY), {});

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body).toMatchObject({
      triageState: 'auto',
      autoAnswer: null,
      autoConfidence: null,
    });
  });

  it('returns 201 fallback when TRIAGE hits runtime_error (REQ-TRI-005)', async () => {
    runTriageMock.mockResolvedValue({
      autoAnswer: null,
      autoConfidence: null,
      error: 'runtime_error',
    });

    const { POST } = await import('@/app/api/ask/route');
    const res = await POST(makePostRequest(VALID_BODY), {});

    expect(res.status).toBe(201);
    expect((await res.json()).triageState).toBe('auto');
  });

  it('calls runTriage with question, orgId, and actorId', async () => {
    const { POST } = await import('@/app/api/ask/route');
    await POST(makePostRequest(VALID_BODY), {});

    expect(runTriageMock).toHaveBeenCalledWith({
      question: VALID_BODY.question,
      orgId: 'org-001',
      actorId: 'user-001',
    });
  });

  it('transitions ticket to needs-review with autoAnswer injected (tx2)', async () => {
    const { writeAudit } = await import('@/lib/kernel/audit');
    vi.mocked(writeAudit).mockClear();

    const { POST } = await import('@/app/api/ask/route');
    await POST(makePostRequest(VALID_BODY), {});

    // Two transactions: tx1 (insert) + tx2 (update + audit)
    expect(mockDb.transaction).toHaveBeenCalledTimes(2);
  });

  it('handles null autoConfidence from TRIAGE (stored as null, not NaN)', async () => {
    runTriageMock.mockResolvedValue({
      autoAnswer: {
        answer: '<p>answer</p>',
        citations: [{ source: 'src-001' }],
      },
      autoConfidence: null,
    });

    const { POST } = await import('@/app/api/ask/route');
    const res = await POST(makePostRequest(VALID_BODY), {});

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.autoConfidence).toBeNull();
  });

  it('returns 429 when rate limit (30 req/60s) is exceeded (H-4)', async () => {
    // Use a dedicated userId so prior test calls don't pollute the bucket.
    sessionUser = { id: 'ratelimit-ask-user', role: 'viewer', organizationId: 'org-001' };

    const { POST } = await import('@/app/api/ask/route');

    let lastStatus = 201;
    for (let i = 0; i < 31; i++) {
      const res = await POST(makePostRequest(VALID_BODY), {});
      lastStatus = res.status;
    }

    expect(lastStatus).toBe(429);
  });
});
