// @vitest-environment node
// @MX:NOTE [AUTO] Execution tests for GET /api/standards/[id]/gap (SPEC-REGULA-STANDARDS-001).
// @MX:SPEC SPEC-REGULA-STANDARDS-001 (REQ-STANDARDS-013/014)

import { beforeEach, describe, expect, it, vi } from 'vitest';

let authenticated = true;
let organizationId = 'org-001';

const identifyAffectedProducts = vi.fn();

vi.mock('@/lib/auth/with-permission', () => ({
  withPermission: vi.fn(
    (
      _action: string,
      handler: (req: Request, ctx: unknown, session: unknown) => Promise<Response>,
    ) =>
      (req: Request, ctx: unknown) => {
        if (!authenticated)
          return Promise.resolve(Response.json({ error: 'Unauthorized' }, { status: 401 }));
        return handler(req, ctx, { user: { id: 'user-001', role: 'ra-member', organizationId } });
      },
  ),
}));
vi.mock('@/lib/standards/impact-analyzer', () => ({ identifyAffectedProducts }));

const { GET } = await import('@/app/api/standards/[id]/gap/route');

beforeEach(() => {
  vi.clearAllMocks();
  authenticated = true;
  organizationId = 'org-001';
  identifyAffectedProducts.mockResolvedValue({
    standardId: 'std-1',
    standardNumber: 'ISO 13485',
    affected: [{ id: 'p1' }, { id: 'p2' }],
    pendingReview: [{ id: 'p2' }],
  });
});

describe('GET /api/standards/[id]/gap (REQ-STANDARDS-013/014)', () => {
  it('returns 200 with affected + pendingReview counts + summary', async () => {
    const res = await GET(new Request('http://localhost/api/standards/std-1/gap'), {
      params: { id: 'std-1' },
    });
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body).toMatchObject({ standardId: 'std-1', affectedCount: 2, pendingReviewCount: 1 });
    expect(body.summary).toContain('1 of 2');
    expect(identifyAffectedProducts).toHaveBeenCalledWith('std-1', 'org-001');
  });

  it('returns 400 missing_standard_id when id is absent', async () => {
    const res = await GET(new Request('http://localhost/api/standards//gap'), { params: {} });
    expect(res.status).toBe(400);
  });

  it('returns 403 no_org_context when orgId is missing', async () => {
    organizationId = undefined as unknown as string;
    const res = await GET(new Request('http://localhost/api/standards/std-1/gap'), {
      params: { id: 'std-1' },
    });
    expect(res.status).toBe(403);
  });
});
