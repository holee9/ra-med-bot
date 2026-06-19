import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/env', () => ({
  getEnv: vi.fn(),
}));

import {
  HybridRaClientError,
  createHybridRaClient,
  createHybridRaFetch,
} from '@/lib/api/hybrid-ra-client';
import { getEnv } from '@/lib/env';

// ---------------------------------------------------------------------------
// Env mock helpers
// ---------------------------------------------------------------------------

const CONFIGURED_ENV = {
  HYBRID_RA_API_BASE_URL: 'https://hybrid.example.com',
  HYBRID_RA_API_TOKEN: 'test-token',
  HYBRID_RA_TENANT_ID: 'tenant-abc',
};

const UNCONFIGURED_ENV = {
  HYBRID_RA_API_BASE_URL: undefined as string | undefined,
  HYBRID_RA_API_TOKEN: undefined as string | undefined,
  HYBRID_RA_TENANT_ID: undefined as string | undefined,
};

function setConfiguredEnv() {
  vi.mocked(getEnv).mockReturnValue(CONFIGURED_ENV as ReturnType<typeof getEnv>);
}

function setUnconfiguredEnv() {
  vi.mocked(getEnv).mockReturnValue(UNCONFIGURED_ENV as ReturnType<typeof getEnv>);
}

// ---------------------------------------------------------------------------
// Fetch mock helpers
// ---------------------------------------------------------------------------

function mockFetchOk(body: unknown) {
  global.fetch = vi.fn().mockResolvedValueOnce(
    new Response(JSON.stringify(body), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }),
  );
}

function mockFetchError(status: number, body = '') {
  global.fetch = vi.fn().mockResolvedValueOnce(new Response(body, { status, statusText: 'Error' }));
}

function lastFetchCall(): [string, RequestInit] {
  return (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit];
}

afterEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Unconfigured env
// ---------------------------------------------------------------------------

describe('createHybridRaFetch — unconfigured env', () => {
  it('throws kind=unconfigured when HYBRID_RA_API_BASE_URL is missing', async () => {
    setUnconfiguredEnv();
    await expect(createHybridRaFetch()('/health')).rejects.toMatchObject({
      name: 'HybridRaClientError',
      statusCode: 503,
      kind: 'unconfigured',
    });
  });
});

// ---------------------------------------------------------------------------
// Configured env — header injection + error classification
// ---------------------------------------------------------------------------

describe('createHybridRaFetch — configured env', () => {
  it('injects Authorization and X-Tenant-Id headers', async () => {
    setConfiguredEnv();
    mockFetchOk({ status: 'ok', version: '1.0.0' });
    await createHybridRaFetch()('/health');

    const [, init] = lastFetchCall();
    const headers = init.headers as Record<string, string>;
    expect(headers.Authorization).toBe('Bearer test-token');
    expect(headers['X-Tenant-Id']).toBe('tenant-abc');
  });

  it('throws kind=auth on 401', async () => {
    setConfiguredEnv();
    mockFetchError(401, 'Unauthorized');
    await expect(createHybridRaFetch()('/health')).rejects.toMatchObject({
      statusCode: 401,
      kind: 'auth',
    });
  });

  it('throws kind=auth on 403', async () => {
    setConfiguredEnv();
    mockFetchError(403);
    await expect(createHybridRaFetch()('/health')).rejects.toMatchObject({
      statusCode: 403,
      kind: 'auth',
    });
  });

  it('throws kind=schema_mismatch on 422', async () => {
    setConfiguredEnv();
    mockFetchError(422, 'Unprocessable Entity');
    await expect(createHybridRaFetch()('/rag/query')).rejects.toMatchObject({
      statusCode: 422,
      kind: 'schema_mismatch',
    });
  });

  it('throws kind=server_error on 500', async () => {
    setConfiguredEnv();
    mockFetchError(500, 'Internal Server Error');
    await expect(createHybridRaFetch()('/health')).rejects.toMatchObject({
      statusCode: 500,
      kind: 'server_error',
    });
  });

  it('throws kind=timeout when AbortError fires', async () => {
    setConfiguredEnv();
    global.fetch = vi
      .fn()
      .mockRejectedValueOnce(
        Object.assign(new Error('The operation was aborted'), { name: 'AbortError' }),
      );
    await expect(createHybridRaFetch(100)('/health')).rejects.toMatchObject({
      statusCode: 504,
      kind: 'timeout',
    });
  });

  it('throws kind=network on unexpected TypeError', async () => {
    setConfiguredEnv();
    global.fetch = vi.fn().mockRejectedValueOnce(new TypeError('Failed to fetch'));
    await expect(createHybridRaFetch()('/health')).rejects.toMatchObject({
      kind: 'network',
      statusCode: 0,
    });
  });
});

// ---------------------------------------------------------------------------
// Typed client contract tests
// ---------------------------------------------------------------------------

describe('createHybridRaClient — endpoint contracts', () => {
  it('health() GETs /health and returns HealthResponse', async () => {
    setConfiguredEnv();
    const payload = { status: 'ok', version: '2.1.0', uptime_seconds: 3600 };
    mockFetchOk(payload);
    const result = await createHybridRaClient().health();
    expect(result).toMatchObject({ status: 'ok', version: '2.1.0' });

    const [url] = lastFetchCall();
    expect(url).toBe('https://hybrid.example.com/health');
  });

  it('syncManifest() GETs /sync/manifest and returns SyncManifestResponse', async () => {
    setConfiguredEnv();
    mockFetchOk({
      last_sync: '2026-06-19T10:00:00Z',
      total_documents: 42,
      sync_status: 'synced',
      tenant_id: 'tenant-abc',
    });
    const result = await createHybridRaClient().syncManifest();
    expect(result.sync_status).toBe('synced');
    expect(result.total_documents).toBe(42);
  });

  it('ragQuery() POSTs to /rag/query with request body', async () => {
    setConfiguredEnv();
    mockFetchOk({
      answer: '30일',
      citations: [{ source_id: 'src-1', title: 'CFR', excerpt: '...', score: 0.9 }],
      confidence: 0.9,
    });
    const result = await createHybridRaClient().ragQuery({ query: 'FDA deadline?' });
    expect(result.confidence).toBe(0.9);

    const [url, init] = lastFetchCall();
    expect(url).toBe('https://hybrid.example.com/rag/query');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body as string)).toMatchObject({ query: 'FDA deadline?' });
  });

  it('uploadDocument() POSTs to /documents/upload', async () => {
    setConfiguredEnv();
    mockFetchOk({ document_id: 'doc-123', status: 'uploaded', created_at: '2026-06-19T00:00:00Z' });
    const result = await createHybridRaClient().uploadDocument({
      filename: 'ifu.pdf',
      content_base64: 'base64==',
    });
    expect(result.document_id).toBe('doc-123');
    expect(result.status).toBe('uploaded');
  });

  it('createParseJob() POSTs to /parse/jobs', async () => {
    setConfiguredEnv();
    mockFetchOk({ job_id: 'job-456', status: 'queued', created_at: '2026-06-19T00:00:00Z' });
    const result = await createHybridRaClient().createParseJob({
      document_id: 'doc-123',
      parser_type: 'ifu',
    });
    expect(result.job_id).toBe('job-456');
    expect(result.status).toBe('queued');
  });

  it('runGuardrail() POSTs to /guardrail/run', async () => {
    setConfiguredEnv();
    mockFetchOk({
      safe: false,
      flags: [{ rule: 'pii_detected', severity: 'high', message: 'PII found' }],
      processed_at: '2026-06-19T00:00:00Z',
    });
    const result = await createHybridRaClient().runGuardrail({ content: 'PII content' });
    expect(result.safe).toBe(false);
    expect(result.flags[0]).toMatchObject({ severity: 'high' });
  });

  it('exportAudit() POSTs to /audit/export', async () => {
    setConfiguredEnv();
    mockFetchOk({
      export_id: 'exp-789',
      download_url: 'https://storage.example.com/audit.csv',
      expires_at: '2026-06-20T00:00:00Z',
      record_count: 120,
    });
    const result = await createHybridRaClient().exportAudit({
      from: '2026-06-01',
      to: '2026-06-19',
    });
    expect(result.record_count).toBe(120);
    expect(result.download_url).toContain('audit.csv');
  });
});
