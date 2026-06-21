// @MX:SPEC Issue #199 (Hybrid RA sync status BFF route tests)

import { describe, expect, it, vi, beforeEach } from 'vitest';

// Mock must be declared before imports that use the module
vi.mock('@/lib/api/hybrid-ra-client', () => {
  const HybridRaClientError = class extends Error {
    constructor(
      message: string,
      public statusCode: number,
      public endpoint: string,
      public kind: string,
    ) {
      super(message);
      this.name = 'HybridRaClientError';
    }
  };
  return { HybridRaClientError, createHybridRaClient: vi.fn() };
});

import { HybridRaClientError, createHybridRaClient } from '@/lib/api/hybrid-ra-client';
import { GET } from '@/app/api/ra/hybrid/sync-status/route';

const mockSyncManifest = vi.fn();

beforeEach(() => {
  vi.mocked(createHybridRaClient).mockReturnValue({
    health: vi.fn(),
    syncManifest: mockSyncManifest,
    ragQuery: vi.fn(),
    uploadDocument: vi.fn(),
    createParseJob: vi.fn(),
    runGuardrail: vi.fn(),
    exportAudit: vi.fn(),
  });
});

describe('GET /api/ra/hybrid/sync-status', () => {
  it('returns unconfigured when env vars are missing', async () => {
    mockSyncManifest.mockRejectedValue(
      new HybridRaClientError('not configured', 503, '/sync/manifest', 'unconfigured'),
    );
    const res = await GET();
    const body = await res.json();
    expect(body).toEqual({ status: 'unconfigured' });
    expect(res.status).toBe(200);
  });

  it('returns ok with sync data on success', async () => {
    const syncData = {
      last_sync: '2026-06-22T10:00:00Z',
      total_documents: 42,
      sync_status: 'synced',
      tenant_id: 'tenant-001',
    };
    mockSyncManifest.mockResolvedValue(syncData);
    const res = await GET();
    const body = await res.json();
    expect(body).toEqual({ status: 'ok', sync: syncData });
  });

  it('returns error with kind for non-unconfigured HybridRaClientError', async () => {
    mockSyncManifest.mockRejectedValue(
      new HybridRaClientError('Request timed out', 504, '/sync/manifest', 'timeout'),
    );
    const res = await GET();
    const body = await res.json();
    expect(body.status).toBe('error');
    expect(body.kind).toBe('timeout');
  });

  it('returns error for unexpected exceptions', async () => {
    mockSyncManifest.mockRejectedValue(new Error('Network failure'));
    const res = await GET();
    const body = await res.json();
    expect(body.status).toBe('error');
    expect(body.kind).toBe('server_error');
  });
});
