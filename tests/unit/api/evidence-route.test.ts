// @MX:NOTE [AUTO] Contract tests for Evidence BFF routes — MSW fixture-based response schema validation.
// @MX:SPEC Issue #168 (AC: Contract test with MSW fixture verifying response schema)

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/auth/with-permission', () => ({
  withPermission: vi.fn(
    (
      _action: string,
      handler: (req: Request, ctx: unknown, session: unknown) => Promise<Response>,
    ) =>
      (req: Request, ctx: unknown) =>
        handler(req, ctx, {
          user: { id: 'user-001', role: 'ra-member', organizationId: 'org-001' },
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
const { POST: postLink } = await import('@/app/api/ra/evidence/link/route');
const { GET: getLinks } = await import('@/app/api/ra/evidence/links/[reqId]/route');
const { POST: postBinder } = await import('@/app/api/ra/evidence/binder/route');

// ---------------------------------------------------------------------------
// MSW-style fixtures (static response bodies matching integration-contract.md)
// ---------------------------------------------------------------------------

const CONFIGURED_ENV = {
  HYBRID_RA_API_BASE_URL: 'https://hybrid.example.com',
  HYBRID_RA_API_TOKEN: 'test-bearer-token',
  HYBRID_RA_TENANT_ID: 'tenant-abc',
};

const LINK_RESPONSE_FIXTURE = {
  req_id: 'req-001',
  status: 'pending',
  created_at: '2026-06-20T00:00:00Z',
  message: 'Link created',
};

const EVIDENCE_LINKS_FIXTURE = [
  {
    req_id: 'req-001',
    requirement_id: 'REQ-001',
    evidence_type: 'clinical',
    description: 'Clinical study data',
    status: 'pending',
    created_at: '2026-06-20T00:00:00Z',
  },
];

const BINDER_RESPONSE_FIXTURE = {
  binder_id: 'binder-001',
  name: 'Clinical Evidence Pack',
  status: 'created',
  created_at: '2026-06-20T00:00:00Z',
  link_count: 1,
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

describe('POST /api/ra/evidence/link — contract test', () => {
  it('proxies request and returns LinkResponse schema', async () => {
    mockHybridFetchOk(LINK_RESPONSE_FIXTURE);

    const req = new Request('http://localhost/api/ra/evidence/link', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        requirement_id: 'REQ-001',
        evidence_type: 'clinical',
        description: 'Clinical study data',
      }),
    });

    const res = await postLink(req, { params: Promise.resolve({}) });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toHaveProperty('req_id');
    expect(body).toHaveProperty('status');
    expect(body).toHaveProperty('created_at');
    expect(typeof body.req_id).toBe('string');
    expect(['pending', 'completed', 'failed']).toContain(body.status);
  });

  it('injects Bearer and X-Tenant-Id headers to upstream', async () => {
    mockHybridFetchOk(LINK_RESPONSE_FIXTURE);

    const req = new Request('http://localhost/api/ra/evidence/link', {
      method: 'POST',
      body: JSON.stringify({
        requirement_id: 'REQ-001',
        evidence_type: 'clinical',
        description: 'x',
      }),
    });

    await postLink(req, { params: Promise.resolve({}) });

    const [url, init] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0] as [
      string,
      RequestInit,
    ];
    expect(url).toContain('/api/v1/evidence/link');
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer test-bearer-token');
    expect((init.headers as Record<string, string>)['X-Tenant-Id']).toBe('tenant-abc');
  });

  it('returns 401 error body on upstream auth failure', async () => {
    mockHybridFetchError(401);

    const req = new Request('http://localhost/api/ra/evidence/link', {
      method: 'POST',
      body: JSON.stringify({
        requirement_id: 'REQ-001',
        evidence_type: 'clinical',
        description: 'x',
      }),
    });

    const res = await postLink(req, { params: Promise.resolve({}) });
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body).toHaveProperty('error');
  });
});

describe('GET /api/ra/evidence/links/[reqId] — contract test', () => {
  it('returns EvidenceLink[] schema', async () => {
    mockHybridFetchOk(EVIDENCE_LINKS_FIXTURE);

    const req = new Request('http://localhost/api/ra/evidence/links/req-001');
    const res = await getLinks(req, { params: Promise.resolve({ reqId: 'req-001' }) });
    const body = (await res.json()) as unknown[];

    expect(res.status).toBe(200);
    expect(Array.isArray(body)).toBe(true);
    const link = body[0] as Record<string, unknown>;
    expect(link).toHaveProperty('req_id');
    expect(link).toHaveProperty('requirement_id');
    expect(link).toHaveProperty('evidence_type');
    expect(link).toHaveProperty('status');
    expect(link).toHaveProperty('created_at');
  });

  it('calls upstream with correct reqId path', async () => {
    mockHybridFetchOk(EVIDENCE_LINKS_FIXTURE);

    const req = new Request('http://localhost/api/ra/evidence/links/req-abc');
    await getLinks(req, { params: Promise.resolve({ reqId: 'req-abc' }) });

    const [url] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0] as [string];
    expect(url).toContain('/api/v1/evidence/links/req-abc');
  });
});

describe('POST /api/ra/evidence/binder — contract test', () => {
  it('returns BinderResponse schema', async () => {
    mockHybridFetchOk(BINDER_RESPONSE_FIXTURE);

    const req = new Request('http://localhost/api/ra/evidence/binder', {
      method: 'POST',
      body: JSON.stringify({ name: 'Clinical Evidence Pack', link_ids: ['req-001'] }),
    });

    const res = await postBinder(req, { params: Promise.resolve({}) });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toHaveProperty('binder_id');
    expect(body).toHaveProperty('name');
    expect(body).toHaveProperty('status');
    expect(body).toHaveProperty('link_count');
    expect(['created', 'failed']).toContain(body.status);
  });

  it('returns 503 error when hybrid-ra is unconfigured', async () => {
    vi.mocked(getEnv).mockReturnValueOnce({
      HYBRID_RA_API_BASE_URL: undefined,
      HYBRID_RA_API_TOKEN: undefined,
      HYBRID_RA_TENANT_ID: undefined,
    } as ReturnType<typeof getEnv>);

    const req = new Request('http://localhost/api/ra/evidence/binder', {
      method: 'POST',
      body: JSON.stringify({ name: 'pack', link_ids: [] }),
    });

    const res = await postBinder(req, { params: Promise.resolve({}) });
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body).toHaveProperty('error');
  });
});
