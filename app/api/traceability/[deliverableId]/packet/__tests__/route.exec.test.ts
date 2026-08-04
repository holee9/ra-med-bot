// @vitest-environment node
// @MX:NOTE [AUTO] Execution tests for GET /api/traceability/[deliverableId]/packet (SPEC-REGULA-TRACEABILITY-001).
// @MX:SPEC SPEC-REGULA-TRACEABILITY-001 (REQ-TRACEABILITY-006/007)

import { beforeEach, describe, expect, it, vi } from 'vitest';

let authenticated = true;
let organizationId = 'org-001';

const listStaleNodeIds = vi.fn(async () => []);
const getEvidencePacket = vi.fn();
const verifyGovernanceFreshness = vi.fn();
const auditStaleBlockedBatch = vi.fn(async () => {});

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
vi.mock('@/lib/traceability/evidence-packet', () => ({ getEvidencePacket }));
vi.mock('@/lib/source-governance/stale-check', () => ({
  verifyGovernanceFreshness,
  auditStaleBlockedBatch,
}));

const { GET } = await import('@/app/api/traceability/[deliverableId]/packet/route');

const UUID = '00000000-0000-4000-8000-000000000000';

beforeEach(() => {
  vi.clearAllMocks();
  authenticated = true;
  organizationId = 'org-001';
  getEvidencePacket.mockResolvedValue({ issues: [{ detail: 'CER-001' }], nodes: [] });
});

describe('GET /api/traceability/[deliverableId]/packet (REQ-TRACEABILITY-006/007)', () => {
  it('returns 200 with the packet when found (non-UUID issues skip the gate)', async () => {
    const res = await GET(new Request('http://localhost/api/traceability/d-1/packet'), {
      params: { deliverableId: 'd-1' },
    });
    expect(res.status).toBe(200);
    expect((await res.json()).issues).toHaveLength(1);
  });

  it('returns 404 not_found when the packet is missing', async () => {
    getEvidencePacket.mockResolvedValueOnce(null);
    const res = await GET(new Request('http://localhost/api/traceability/dx/packet'), {
      params: { deliverableId: 'dx' },
    });
    expect(res.status).toBe(404);
  });

  it('returns 403 stale_citation_blocked when a cited UUID source is stale', async () => {
    getEvidencePacket.mockResolvedValueOnce({ issues: [{ detail: UUID }] });
    verifyGovernanceFreshness.mockResolvedValueOnce({
      allowed: false,
      blockedSources: [{ sourceId: UUID }],
    });
    const res = await GET(new Request('http://localhost/api/traceability/d-1/packet'), {
      params: { deliverableId: 'd-1' },
    });
    expect(res.status).toBe(403);
    expect((await res.json()).error).toBe('stale_citation_blocked');
    expect(auditStaleBlockedBatch).toHaveBeenCalled();
  });

  it('returns 400 deliverableId required when id is absent', async () => {
    const res = await GET(new Request('http://localhost/api/traceability//packet'), {
      params: {},
    });
    expect(res.status).toBe(400);
  });

  it('returns 403 when organizationId is missing', async () => {
    organizationId = undefined as unknown as string;
    const res = await GET(new Request('http://localhost/api/traceability/d-1/packet'), {
      params: { deliverableId: 'd-1' },
    });
    expect(res.status).toBe(403);
  });
});
