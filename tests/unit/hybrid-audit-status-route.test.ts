import { describe, expect, it, vi } from 'vitest';

class HybridRaClientError extends Error {
  constructor(
    public kind: string,
    message: string,
  ) {
    super(message);
    this.name = 'HybridRaClientError';
  }
}

const mockHealth = vi.fn();
vi.mock('@/lib/api/hybrid-ra-client', () => ({
  HybridRaClientError,
  createHybridRaClient: () => ({ health: mockHealth }),
}));

const withPermissionMock = vi.fn(
  (_action: string, handler: (req: Request, ctx: unknown, session: unknown) => Promise<Response>) =>
    (req: Request, ctx: unknown) =>
      handler(req, ctx, {
        user: {
          id: 'user-auditor-1',
          role: 'auditor',
          organizationId: 'org-1',
        },
      }),
);

vi.mock('@/lib/auth/with-permission', () => ({
  withPermission: withPermissionMock,
}));

const { GET } = await import('@/app/api/ra/hybrid/audit-status/route');

describe('GET /api/ra/hybrid/audit-status', () => {
  it('is gated by audit read RBAC before proxying', () => {
    expect(withPermissionMock).toHaveBeenCalledWith('audit.read', expect.any(Function));
  });

  it('returns unconfigured when hybrid-ra is not set up', async () => {
    mockHealth.mockRejectedValueOnce(new HybridRaClientError('unconfigured', 'not configured'));
    const res = await GET(new Request('https://example.com/api/ra/hybrid/audit-status'), {});
    const data = (await res.json()) as { status: string };
    expect(data.status).toBe('unconfigured');
    expect(res.status).toBe(200);
  });

  it('returns ok with health data on success', async () => {
    mockHealth.mockResolvedValueOnce({ status: 'ok', version: '1.2.3' });
    const res = await GET(new Request('https://example.com/api/ra/hybrid/audit-status'), {});
    const data = (await res.json()) as {
      status: string;
      health: { status: string; version: string };
    };
    expect(data.status).toBe('ok');
    expect(data.health.version).toBe('1.2.3');
  });

  it('returns error with 502 on server_error kind', async () => {
    mockHealth.mockRejectedValueOnce(new HybridRaClientError('server_error', 'internal error'));
    const res = await GET(new Request('https://example.com/api/ra/hybrid/audit-status'), {});
    const data = (await res.json()) as { status: string; kind: string };
    expect(data.status).toBe('error');
    expect(data.kind).toBe('server_error');
    expect(res.status).toBe(502);
  });

  it('returns error with kind server_error on unexpected exception', async () => {
    mockHealth.mockRejectedValueOnce(new Error('unexpected'));
    const res = await GET(new Request('https://example.com/api/ra/hybrid/audit-status'), {});
    const data = (await res.json()) as { status: string; kind: string };
    expect(data.status).toBe('error');
    expect(data.kind).toBe('server_error');
  });
});
