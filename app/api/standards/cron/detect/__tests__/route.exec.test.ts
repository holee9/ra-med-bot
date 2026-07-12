// @vitest-environment node
// @MX:NOTE [AUTO] Execution tests for POST /api/standards/cron/detect (SPEC-REGULA-STANDARDS-001).
// @MX:SPEC SPEC-REGULA-STANDARDS-001 (REQ-STANDARDS-009/020)

import { beforeEach, describe, expect, it, vi } from 'vitest';

let authenticated = true;
let organizationId = 'org-001';

type AuditInput = {
  actor_id: string | null;
  action: string;
  resource_type: string;
  resource_id: string;
  meta_json?: Record<string, unknown>;
};

const writeAudit = vi.fn(async (_input: AuditInput) => {});
const detectRevisions = vi.fn();
const resolveDetectionContext = vi.fn();

vi.mock('@/lib/audit', () => ({ writeAudit }));
vi.mock('@/lib/auth/with-permission', () => ({
  withPermission: vi.fn(
    (
      _action: string,
      handler: (req: Request, ctx: unknown, session: unknown) => Promise<Response>,
    ) =>
      (req: Request, ctx: unknown) => {
        if (!authenticated)
          return Promise.resolve(Response.json({ error: 'Unauthorized' }, { status: 401 }));
        return handler(req, ctx, { user: { id: 'user-001', role: 'ra-lead', organizationId } });
      },
  ),
}));
vi.mock('@/lib/db/client', () => ({
  withTenantScope: vi.fn(async (_orgId: string, fn: (tx: unknown) => unknown) => fn({})),
}));
vi.mock('@/lib/standards/revision-detector', () => ({ detectRevisions, resolveDetectionContext }));

const { POST } = await import('@/app/api/standards/cron/detect/route');

beforeEach(() => {
  vi.clearAllMocks();
  authenticated = true;
  organizationId = 'org-001';
  resolveDetectionContext.mockReturnValue({ hasActiveSource: true });
  detectRevisions.mockResolvedValue([{ id: 'r1' }, { id: 'r2' }]);
});

describe('POST /api/standards/cron/detect (REQ-STANDARDS-009/020)', () => {
  it('returns 200 + standards.revision.detected audit (source live) when a source is configured', async () => {
    const res = await POST(
      new Request('http://localhost/api/standards/cron/detect', { method: 'POST' }),
      {},
    );
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body).toMatchObject({ detectedCount: 2, hasActiveSource: true, degraded: false });
    const audits = writeAudit.mock.calls.map((c) => (c as unknown[])[0] as AuditInput);
    expect(audits).toHaveLength(1);
    expect(audits[0]?.meta_json).toMatchObject({
      source: 'live',
      detectedCount: 2,
      triggeredBy: 'manual',
    });
  });

  it('reports degraded no-op when no live source is configured', async () => {
    resolveDetectionContext.mockReturnValueOnce({ hasActiveSource: false });
    detectRevisions.mockResolvedValueOnce([]);
    const res = await POST(
      new Request('http://localhost/api/standards/cron/detect', { method: 'POST' }),
      {},
    );
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body).toMatchObject({ detectedCount: 0, degraded: true });
    const audits = writeAudit.mock.calls.map((c) => (c as unknown[])[0] as AuditInput);
    expect(audits[0]?.meta_json?.source).toBe('noop');
  });

  it('returns 403 no_org_context when orgId is missing', async () => {
    organizationId = undefined as unknown as string;
    const res = await POST(
      new Request('http://localhost/api/standards/cron/detect', { method: 'POST' }),
      {},
    );
    expect(res.status).toBe(403);
  });
});
