// @MX:NOTE [AUTO] Route tests for POST /api/ra/consult — SSE handler surface (coverage 402, SPEC-REGULA-CHAT-001).
// @MX:SPEC SPEC-REGULA-CHAT-001 (REQ-CHAT-001, REQ-CHAT-003, REQ-CHAT-004, REQ-CHAT-007, REQ-CHAT-009)
// @MX:TODO Deep RAG pipeline (8-stage consult generator, citation enforcement, confidence calc) is
//   covered by lib/ai/consult.test.ts. These tests exercise the route handler surface only:
//   auth/RBAC bypass, rate-limit, Zod validation, SSE framing, audit contract, and GET 405.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// --- Mutable session: rate-limit test uses a fresh userId to avoid cross-test bucket pollution ---
let sessionUser: { id: string; role: string; organizationId: string } = {
  id: 'user-001',
  role: 'ra-lead',
  organizationId: 'org-001',
};

vi.mock('@/lib/auth/with-permission', () => ({
  withPermission: vi.fn(
    (
      _action: string,
      handler: (req: Request, ctx: unknown, session: unknown) => Promise<Response>,
    ) =>
      (req: Request, ctx: unknown) =>
        handler(req, ctx, { user: sessionUser }),
  ),
}));

// --- Mock db: messages insert (E2E mode writes one row up front) ---
const mockMessagesInsertChain = {
  values: vi.fn().mockReturnThis(),
  onConflictDoNothing: vi.fn().mockReturnThis(),
};

const mockDb = {
  insert: vi.fn(() => mockMessagesInsertChain),
};

vi.mock('@/lib/db/client', () => ({ db: mockDb }));

// --- Mock audit ---
vi.mock('@/lib/audit', () => ({
  writeAudit: vi.fn().mockResolvedValue(undefined),
}));

// --- Mock ensureConversation (real impl hits db.insert on conversations) ---
const ensureConversationMock = vi.fn().mockResolvedValue('conv-001');
vi.mock('@/lib/ai/consult', () => ({
  ensureConversation: (...a: unknown[]) => ensureConversationMock(...a),
  // consult() is not invoked under E2E_TEST_MODE; stub anyway to be safe.
  consult: vi.fn(),
}));

// --- Mock logger (route calls logger.error on pipeline failure) ---
vi.mock('@/lib/observability/logger', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

// encodeSSE is a pure function — use real implementation (imported transitively by route).

// --- Helpers ---
function makePostRequest(body: unknown): Request {
  return new Request('http://localhost/api/ra/consult', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

function makeInvalidJsonRequest(): Request {
  return new Request('http://localhost/api/ra/consult', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: 'not-json',
  });
}

const VALID_BODY = { question: 'What are the FDA requirements for a Class II infusion pump?' };

/** Read SSE Response text (consumes the stream). */
async function readSseText(res: Response): Promise<string> {
  return res.text();
}

/** Parse SSE text into a list of decoded event objects. */
function parseSseEvents(text: string): Array<Record<string, unknown>> {
  const events: Array<Record<string, unknown>> = [];
  for (const block of text.split('\n\n')) {
    const line = block.trim();
    if (line.startsWith('data: ')) {
      events.push(JSON.parse(line.slice(6)));
    }
  }
  return events;
}

describe('POST /api/ra/consult — handler surface', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionUser = { id: 'user-001', role: 'ra-lead', organizationId: 'org-001' };
    ensureConversationMock.mockResolvedValue('conv-001');
    // E2E mode selects the deterministic e2eTestEvents generator (no LLM calls).
    vi.stubEnv('E2E_TEST_MODE', 'true');
    vi.stubEnv('NODE_ENV', 'test');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('returns SSE response with correct headers (200)', async () => {
    const { POST } = await import('@/app/api/ra/consult/route');
    const res = await POST(makePostRequest(VALID_BODY), {});

    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('text/event-stream');
    expect(res.headers.get('Cache-Control')).toBe('no-cache, no-transform');
    expect(res.headers.get('Connection')).toBe('keep-alive');
  });

  it('streams meta → prose_delta → confidence → sources → done events in E2E mode', async () => {
    const { POST } = await import('@/app/api/ra/consult/route');
    const res = await POST(makePostRequest(VALID_BODY), {});

    const text = await readSseText(res);
    const events = parseSseEvents(text);
    const types = events.map((e) => e.type);

    expect(types[0]).toBe('meta');
    expect(types).toContain('prose_delta');
    expect(types).toContain('confidence');
    expect(types).toContain('sources');
    expect(types[types.length - 1]).toBe('done');

    const meta = events.find((e) => e.type === 'meta');
    expect(meta).toMatchObject({
      type: 'meta',
      conversationId: 'conv-001',
      messageId: expect.any(String),
    });

    const conf = events.find((e) => e.type === 'confidence');
    expect(conf).toMatchObject({ type: 'confidence', level: 'high' });
  });

  it('ensures conversation is created via ensureConversation', async () => {
    const { POST } = await import('@/app/api/ra/consult/route');
    await POST(makePostRequest(VALID_BODY), {});

    expect(ensureConversationMock).toHaveBeenCalledWith(
      undefined, // input.conversationId (not provided in body)
      'user-001',
      undefined, // projectId
    );
  });

  it('writes chat.query audit row in E2E mode', async () => {
    const { writeAudit } = await import('@/lib/audit');
    vi.mocked(writeAudit).mockClear();

    const { POST } = await import('@/app/api/ra/consult/route');
    await POST(makePostRequest(VALID_BODY), {});

    expect(vi.mocked(writeAudit)).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'chat.query',
        actor_id: 'user-001',
        resource_type: 'message',
        conversation_id: 'conv-001',
      }),
    );
  });

  it('returns 400 on invalid JSON body', async () => {
    const { POST } = await import('@/app/api/ra/consult/route');
    const res = await POST(makeInvalidJsonRequest(), {});

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('Invalid JSON');
  });

  it('returns 400 when question is empty', async () => {
    const { POST } = await import('@/app/api/ra/consult/route');
    const res = await POST(makePostRequest({ question: '' }), {});

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('Validation failed');
  });

  it('returns 400 when question exceeds 4000 chars', async () => {
    const { POST } = await import('@/app/api/ra/consult/route');
    const res = await POST(makePostRequest({ question: 'x'.repeat(4001) }), {});

    expect(res.status).toBe(400);
  });

  it('returns 429 when rate limit (30 req/60s) is exceeded', async () => {
    // Use a dedicated userId so prior test calls don't pollute the bucket.
    sessionUser = { id: 'ratelimit-user', role: 'ra-lead', organizationId: 'org-001' };

    const { POST } = await import('@/app/api/ra/consult/route');

    // Fire RATE_LIMIT_MAX (30) requests to fill the bucket. Each passes rate-limit
    // (then proceeds to body parse → 200 SSE in E2E mode). The 31st must return 429.
    let lastStatus = 200;
    for (let i = 0; i < 31; i++) {
      const res = await POST(makePostRequest(VALID_BODY), {});
      lastStatus = res.status;
      // Drain the SSE stream so the underlying readable is fully consumed.
      if (res.status === 200) {
        await res.text();
      }
    }

    expect(lastStatus).toBe(429);
  });

  it('passes through validation when valid conversationId (uuid) is provided', async () => {
    const { POST } = await import('@/app/api/ra/consult/route');
    const res = await POST(
      makePostRequest({
        question: 'valid question',
        conversationId: '550e8400-e29b-41d4-a716-446655440000',
      }),
      {},
    );

    expect(res.status).toBe(200);
    expect(ensureConversationMock).toHaveBeenCalledWith(
      '550e8400-e29b-41d4-a716-446655440000',
      'user-001',
      undefined,
    );
  });
});

describe('GET /api/ra/consult — method not allowed', () => {
  it('returns 405 for GET requests', async () => {
    const { GET } = await import('@/app/api/ra/consult/route');
    const res = await GET();

    expect(res.status).toBe(405);
  });
});
