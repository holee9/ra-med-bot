// @MX:SPEC Issue #199 (Hybrid RA sync status BFF route tests)

import { beforeEach, describe, expect, it, vi } from 'vitest';

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

const { withPermissionMock } = vi.hoisted(() => ({
  withPermissionMock: vi.fn(
    (
      _action: string,
      handler: (req: Request, ctx: unknown, session: unknown) => Promise<Response>,
    ) =>
      (req: Request, ctx: unknown) =>
        handler(req, ctx, {
          user: {
            id: 'user-ra-1',
            role: 'ra-member',
            organizationId: 'org-1',
          },
        }),
  ),
}));

vi.mock('@/lib/kernel/auth/with-permission', () => ({
  withPermission: withPermissionMock,
}));

// Issue #156 AC4 — recorder is best-effort; mock so route tests don't pull env validation.
vi.mock('@/lib/knowledge-gap/integration-gap', () => ({
  recordIntegrationGap: vi.fn().mockResolvedValue(undefined),
}));

import { GET } from '@/app/api/ra/hybrid/sync-status/route';
import { HybridRaClientError, createHybridRaClient } from '@/lib/api/hybrid-ra-client';

const mockSyncManifest = vi.fn();

function makeReq(): Request {
  return new Request('https://example.com/api/ra/hybrid/sync-status');
}

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
  it('is gated by dashboard read RBAC before proxying', () => {
    expect(withPermissionMock).toHaveBeenCalledWith('dashboard.view', expect.any(Function));
  });

  it('returns unconfigured when env vars are missing', async () => {
    mockSyncManifest.mockRejectedValue(
      new HybridRaClientError('not configured', 503, '/sync/manifest', 'unconfigured'),
    );
    const res = await GET(makeReq(), {});
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
    const res = await GET(makeReq(), {});
    const body = await res.json();
    expect(body).toEqual({ status: 'ok', sync: syncData });
  });

  it('returns error with kind for non-unconfigured HybridRaClientError', async () => {
    mockSyncManifest.mockRejectedValue(
      new HybridRaClientError('Request timed out', 504, '/sync/manifest', 'timeout'),
    );
    const res = await GET(makeReq(), {});
    const body = await res.json();
    expect(body.status).toBe('error');
    expect(body.kind).toBe('timeout');
  });

  it('returns error for unexpected exceptions', async () => {
    mockSyncManifest.mockRejectedValue(new Error('Network failure'));
    const res = await GET(makeReq(), {});
    const body = await res.json();
    expect(body.status).toBe('error');
    expect(body.kind).toBe('server_error');
  });
});
