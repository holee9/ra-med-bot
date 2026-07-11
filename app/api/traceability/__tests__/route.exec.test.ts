// @vitest-environment node
// @MX:NOTE [AUTO] Execution tests for GET /api/traceability (SPEC-REGULA-TRACEABILITY-001).
// @MX:SPEC SPEC-REGULA-TRACEABILITY-001 (REQ-TRACEABILITY-004/005/006/012)

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
const listStaleNodeIds = vi.fn(async () => []);
const buildMatrix = vi.fn();

vi.mock('@/lib/audit', () => ({ writeAudit }));

vi.mock('@/lib/auth/with-permission', () => ({
  withPermission: vi.fn(
    (
      _action: string,
      handler: (req: Request, ctx: unknown, session: unknown) => Promise<Response>,
    ) =>
      (req: Request, ctx: unknown) => {
        if (!authenticated) {
          return Promise.resolve(Response.json({ error: 'Unauthorized' }, { status: 401 }));
        }
        return handler(req, ctx, {
          user: { id: 'user-001', role: 'ra-member', organizationId },
        });
      },
  ),
}));

vi.mock('@/lib/db/client', () => ({
  withTenantScope: vi.fn(async (_orgId: string, fn: (dbs: unknown) => unknown) => fn({})),
}));
vi.mock('@/lib/traceability/stale-propagation', () => ({ listStaleNodeIds }));
vi.mock('@/lib/traceability/matrix', () => ({ buildMatrix }));

const { GET } = await import('@/app/api/traceability/route');

function getReq(query: string): Request {
  return new Request(`http://localhost/api/traceability?${query}`);
}

beforeEach(() => {
  vi.clearAllMocks();
  authenticated = true;
  organizationId = 'org-001';
  buildMatrix.mockResolvedValue({
    summary: { totalRows: 5, withGaps: 1, stale: 0 },
    rows: [],
  });
});

describe('GET /api/traceability (REQ-TRACEABILITY-004/005/006)', () => {
  it('returns 200 with the matrix + matrix_viewed audit', async () => {
    const res = await GET(getReq(''), {});
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.summary.totalRows).toBe(5);
    const audits = writeAudit.mock.calls.map((c) => (c as unknown[])[0] as AuditInput);
    expect(audits).toHaveLength(1);
    expect(audits[0]?.action).toBe('traceability.matrix_viewed');
    expect(audits[0]?.meta_json).toMatchObject({ totalRows: 5, withGaps: 1 });
  });

  it('accepts projectId + riskLevel filters', async () => {
    const res = await GET(
      getReq('projectId=00000000-0000-4000-8000-000000000000&riskLevel=alarp'),
      {},
    );
    expect(res.status).toBe(200);
    expect(buildMatrix).toHaveBeenCalled();
  });

  it('returns 400 Invalid query on a bad riskLevel enum', async () => {
    const res = await GET(getReq('riskLevel=bad'), {});
    expect(res.status).toBe(400);
  });

  it('returns 403 when organizationId is missing', async () => {
    organizationId = undefined as unknown as string;
    const res = await GET(getReq(''), {});
    expect(res.status).toBe(403);
  });
});
