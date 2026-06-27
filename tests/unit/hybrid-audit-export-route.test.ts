import { beforeEach, describe, expect, it, vi } from 'vitest';

class HybridRaClientError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public endpoint: string,
    public kind: string,
  ) {
    super(message);
    this.name = 'HybridRaClientError';
  }
}

const mockExportAudit = vi.fn();
vi.mock('@/lib/api/hybrid-ra-client', () => ({
  HybridRaClientError,
  createHybridRaClient: () => ({ exportAudit: mockExportAudit }),
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

// Issue #156 AC4 — recorder is best-effort; mock so route tests don't pull env validation.
vi.mock('@/lib/knowledge-gap/integration-gap', () => ({
  recordIntegrationGap: vi.fn().mockResolvedValue(undefined),
}));

const { POST } = await import('@/app/api/ra/hybrid/audit-export/route');

function makeReq(body: unknown): Request {
  return new Request('https://example.com/api/ra/hybrid/audit-export', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/ra/hybrid/audit-export', () => {
  beforeEach(() => {
    mockExportAudit.mockReset();
  });

  it('is gated by audit package RBAC before proxying', () => {
    expect(withPermissionMock).toHaveBeenCalledWith('audit.package.generate', expect.any(Function));
  });

  it('returns ok with export URL on success', async () => {
    mockExportAudit.mockResolvedValueOnce({
      export_id: 'exp-123',
      download_url: 'https://storage.example.com/audit.csv',
      expires_at: '2026-06-23T00:00:00Z',
      record_count: 25,
    });

    const res = await POST(makeReq({ from: '2026-06-01', to: '2026-06-22', format: 'csv' }), {});
    const data = (await res.json()) as { status: string; export: { download_url: string } };

    expect(res.status).toBe(200);
    expect(data.status).toBe('ok');
    expect(data.export.download_url).toContain('audit.csv');
    expect(mockExportAudit).toHaveBeenCalledWith({
      from: '2026-06-01',
      to: '2026-06-22',
      format: 'csv',
    });
  });
});
