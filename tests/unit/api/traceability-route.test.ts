// @MX:NOTE [AUTO] Contract tests for Traceability BFF routes — MSW fixture-based response schema validation.
// @MX:SPEC SPEC-INTEGRATION-001, Issue #169 (AC: Contract test with MSW fixture verifying response schema)

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

vi.mock('@/lib/env', () => ({
  getEnv: vi.fn(),
}));

import { getEnv } from '@/lib/env';

// Top-level imports (required — await inside describe() is not supported by esbuild)
const { POST: postScan } = await import('@/app/api/ra/traceability/scan/route');
const { GET: getGraph } = await import('@/app/api/ra/traceability/graph/route');
const { POST: postImpact } = await import('@/app/api/ra/traceability/impact/route');

// ---------------------------------------------------------------------------
// MSW-style fixtures matching integration-contract.md schema
// ---------------------------------------------------------------------------

const CONFIGURED_ENV = {
  HYBRID_RA_API_BASE_URL: 'https://hybrid.example.com',
  HYBRID_RA_API_TOKEN: 'test-bearer-token',
  HYBRID_RA_TENANT_ID: 'tenant-abc',
};

const SCAN_RESULT_FIXTURE = {
  scan_id: 'scan-001',
  nodes_scanned: 42,
  status: 'completed',
  timestamp: '2026-06-20T00:00:00Z',
};

const TRACE_GRAPH_FIXTURE = {
  nodes: [
    { id: 'node-1', type: 'requirement', label: 'REQ-001' },
    { id: 'node-2', type: 'test', label: 'TC-001' },
  ],
  edges: [
    { source: 'node-1', target: 'node-2', relationship: 'verified_by' },
  ],
  metadata: {
    total_nodes: 2,
    total_edges: 1,
    scan_id: 'scan-001',
  },
};

const IMPACT_RESULT_FIXTURE = {
  affected_nodes: [
    { id: 'node-2', type: 'test', label: 'TC-001', impact_level: 'high' },
  ],
  total_affected: 1,
  analysis_id: 'analysis-001',
  timestamp: '2026-06-20T00:00:00Z',
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

describe('POST /api/ra/traceability/scan — contract test', () => {
  it('returns ScanResult schema with nodes_scanned and scan_id', async () => {
    mockHybridFetchOk(SCAN_RESULT_FIXTURE);

    const req = new Request('http://localhost/api/ra/traceability/scan', {
      method: 'POST',
      body: JSON.stringify({ filters: {} }),
    });

    const res = await postScan(req, { params: Promise.resolve({}) });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toHaveProperty('scan_id');
    expect(body).toHaveProperty('nodes_scanned');
    expect(body).toHaveProperty('status');
    expect(body).toHaveProperty('timestamp');
    expect(typeof body.scan_id).toBe('string');
    expect(typeof body.nodes_scanned).toBe('number');
    expect(['completed', 'in_progress', 'failed']).toContain(body.status);
  });

  it('injects Bearer and X-Tenant-Id headers to upstream', async () => {
    mockHybridFetchOk(SCAN_RESULT_FIXTURE);

    const req = new Request('http://localhost/api/ra/traceability/scan', {
      method: 'POST',
      body: JSON.stringify({}),
    });
    await postScan(req, { params: Promise.resolve({}) });

    const [url, init] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/api/v1/traceability/scan');
    expect((init.headers as Record<string, string>)['Authorization']).toBe('Bearer test-bearer-token');
    expect((init.headers as Record<string, string>)['X-Tenant-Id']).toBe('tenant-abc');
  });

  it('returns 401 body on upstream auth failure', async () => {
    mockHybridFetchError(401);

    const req = new Request('http://localhost/api/ra/traceability/scan', {
      method: 'POST',
      body: JSON.stringify({}),
    });
    const res = await postScan(req, { params: Promise.resolve({}) });
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body).toHaveProperty('error');
  });
});

describe('GET /api/ra/traceability/graph — contract test', () => {
  it('returns TraceGraph schema with nodes and edges', async () => {
    mockHybridFetchOk(TRACE_GRAPH_FIXTURE);

    const req = new Request('http://localhost/api/ra/traceability/graph');
    const res = await getGraph(req, { params: Promise.resolve({}) });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toHaveProperty('nodes');
    expect(body).toHaveProperty('edges');
    expect(body).toHaveProperty('metadata');
    expect(Array.isArray(body.nodes)).toBe(true);
    expect(Array.isArray(body.edges)).toBe(true);
    const node = body.nodes[0] as Record<string, unknown>;
    expect(node).toHaveProperty('id');
    expect(node).toHaveProperty('type');
    expect(node).toHaveProperty('label');
  });

  it('forwards scan_id query parameter to upstream', async () => {
    mockHybridFetchOk(TRACE_GRAPH_FIXTURE);

    const req = new Request('http://localhost/api/ra/traceability/graph?scan_id=scan-001');
    await getGraph(req, { params: Promise.resolve({}) });

    const [url] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0] as [string];
    expect(url).toContain('scan_id=scan-001');
  });
});

describe('POST /api/ra/traceability/impact — contract test', () => {
  it('returns ImpactResult schema with affected_nodes', async () => {
    mockHybridFetchOk(IMPACT_RESULT_FIXTURE);

    const req = new Request('http://localhost/api/ra/traceability/impact', {
      method: 'POST',
      body: JSON.stringify({ node_id: 'node-1', change_type: 'modification' }),
    });

    const res = await postImpact(req, { params: Promise.resolve({}) });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toHaveProperty('affected_nodes');
    expect(body).toHaveProperty('total_affected');
    expect(body).toHaveProperty('analysis_id');
    expect(Array.isArray(body.affected_nodes)).toBe(true);
    expect(typeof body.total_affected).toBe('number');
  });
});
