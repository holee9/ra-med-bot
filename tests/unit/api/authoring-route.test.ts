// @MX:NOTE [AUTO] Contract tests for Authoring BFF routes — MSW fixture-based response schema validation.
// @MX:SPEC Issue #171 (AC: Contract test with MSW fixture verifying response schema)

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/auth/with-permission', () => ({
  withPermission: vi.fn(
    (
      _action: string,
      handler: (req: Request, ctx: unknown, session: unknown) => Promise<Response>,
    ) =>
      (req: Request, ctx: unknown) =>
        handler(req, ctx, {
          user: { id: 'user-001', role: 'ra-lead', organizationId: 'org-001' },
        }),
  ),
}));

vi.mock('@/lib/audit', () => ({
  writeAudit: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib/env', () => ({
  getEnv: vi.fn(),
}));

import { getEnv } from '@/lib/env';

// Top-level imports (required — await inside describe() is not supported by esbuild)
const { POST: postSession } = await import('@/app/api/ra/authoring/sessions/route');
const { GET: getSession } = await import('@/app/api/ra/authoring/sessions/[sessionId]/route');
const { POST: approveSession } = await import(
  '@/app/api/ra/authoring/sessions/[sessionId]/approve/route'
);
const { POST: rejectSession } = await import(
  '@/app/api/ra/authoring/sessions/[sessionId]/reject/route'
);

// ---------------------------------------------------------------------------
// MSW-style fixtures matching integration-contract.md schema
// ---------------------------------------------------------------------------

const CONFIGURED_ENV = {
  HYBRID_RA_API_BASE_URL: 'https://hybrid.example.com',
  HYBRID_RA_API_TOKEN: 'test-bearer-token',
  HYBRID_RA_TENANT_ID: 'tenant-abc',
};

const SESSION_RESPONSE_FIXTURE = {
  session_id: 'sess-001',
  status: 'created',
  created_at: '2026-06-20T00:00:00Z',
  current_draft: '',
};

const SESSION_STATE_FIXTURE = {
  session_id: 'sess-001',
  section_id: 'sec-001',
  status: 'in_progress',
  current_draft: '## Section draft content',
  created_at: '2026-06-20T00:00:00Z',
  updated_at: '2026-06-20T01:00:00Z',
};

const APPROVAL_RESULT_FIXTURE = {
  session_id: 'sess-001',
  status: 'approved',
  decided_at: '2026-06-20T02:00:00Z',
  approver_comments: 'Looks good',
};

const REJECTION_RESULT_FIXTURE = {
  session_id: 'sess-001',
  status: 'rejected',
  decided_at: '2026-06-20T02:00:00Z',
  approver_comments: 'Needs revision',
};

function mockHybridFetchOk(body: unknown) {
  global.fetch = vi.fn().mockResolvedValueOnce(
    new Response(JSON.stringify(body), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }),
  );
}

function mockHybridFetchError(status: number) {
  global.fetch = vi.fn().mockResolvedValueOnce(
    new Response(JSON.stringify({ error: 'upstream error' }), {
      status,
      statusText: 'Error',
      headers: { 'Content-Type': 'application/json' },
    }),
  );
}

beforeEach(() => {
  vi.mocked(getEnv).mockReturnValue(CONFIGURED_ENV as ReturnType<typeof getEnv>);
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('POST /api/ra/authoring/sessions — contract test', () => {
  it('returns SessionResponse schema with session_id and status', async () => {
    mockHybridFetchOk(SESSION_RESPONSE_FIXTURE);

    const req = new Request('http://localhost/api/ra/authoring/sessions', {
      method: 'POST',
      body: JSON.stringify({ section_id: 'sec-001', device_id: 'device-001' }),
    });

    const res = await postSession(req, { params: Promise.resolve({}) });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toHaveProperty('session_id');
    expect(body).toHaveProperty('status');
    expect(body).toHaveProperty('created_at');
    expect(typeof body.session_id).toBe('string');
    expect(['created', 'in_progress', 'approved', 'rejected']).toContain(body.status);
  });

  it('injects Bearer and X-Tenant-Id headers to upstream', async () => {
    mockHybridFetchOk(SESSION_RESPONSE_FIXTURE);

    const req = new Request('http://localhost/api/ra/authoring/sessions', {
      method: 'POST',
      body: JSON.stringify({ section_id: 'sec-001', device_id: 'device-001' }),
    });
    await postSession(req, { params: Promise.resolve({}) });

    const [url, init] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0] as [
      string,
      RequestInit,
    ];
    expect(url).toContain('/api/v1/authoring/sessions');
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer test-bearer-token');
    expect((init.headers as Record<string, string>)['X-Tenant-Id']).toBe('tenant-abc');
  });

  it('returns 401 body on upstream auth failure', async () => {
    mockHybridFetchError(401);

    const req = new Request('http://localhost/api/ra/authoring/sessions', {
      method: 'POST',
      body: JSON.stringify({ section_id: 'sec-001', device_id: 'device-001' }),
    });
    const res = await postSession(req, { params: Promise.resolve({}) });
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body).toHaveProperty('error');
  });
});

describe('GET /api/ra/authoring/sessions/[sessionId] — contract test', () => {
  it('returns SessionState schema with current_draft', async () => {
    mockHybridFetchOk(SESSION_STATE_FIXTURE);

    const req = new Request('http://localhost/api/ra/authoring/sessions/sess-001');
    const res = await getSession(req, { params: Promise.resolve({ sessionId: 'sess-001' }) });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toHaveProperty('session_id');
    expect(body).toHaveProperty('section_id');
    expect(body).toHaveProperty('status');
    expect(body).toHaveProperty('current_draft');
    expect(body).toHaveProperty('created_at');
    expect(typeof body.current_draft).toBe('string');
  });

  it('calls upstream with correct sessionId path', async () => {
    mockHybridFetchOk(SESSION_STATE_FIXTURE);

    const req = new Request('http://localhost/api/ra/authoring/sessions/sess-abc');
    await getSession(req, { params: Promise.resolve({ sessionId: 'sess-abc' }) });

    const [url] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0] as [string];
    expect(url).toContain('/api/v1/authoring/sessions/sess-abc');
  });
});

describe('POST /api/ra/authoring/sessions/[sessionId]/approve — contract test', () => {
  it('returns approval result with status approved', async () => {
    mockHybridFetchOk(APPROVAL_RESULT_FIXTURE);

    const req = new Request('http://localhost/api/ra/authoring/sessions/sess-001/approve', {
      method: 'POST',
      body: JSON.stringify({ decision: 'approve', comments: 'Looks good' }),
    });

    const res = await approveSession(req, { params: Promise.resolve({ sessionId: 'sess-001' }) });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toHaveProperty('session_id');
    expect(body).toHaveProperty('status');
    expect(body.status).toBe('approved');
  });
});

describe('POST /api/ra/authoring/sessions/[sessionId]/reject — contract test', () => {
  it('returns rejection result with status rejected', async () => {
    mockHybridFetchOk(REJECTION_RESULT_FIXTURE);

    const req = new Request('http://localhost/api/ra/authoring/sessions/sess-001/reject', {
      method: 'POST',
      body: JSON.stringify({ decision: 'reject', comments: 'Needs revision' }),
    });

    const res = await rejectSession(req, { params: Promise.resolve({ sessionId: 'sess-001' }) });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toHaveProperty('session_id');
    expect(body).toHaveProperty('status');
    expect(body.status).toBe('rejected');
  });
});
