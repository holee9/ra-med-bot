// @vitest-environment node
// @MX:NOTE [AUTO] Execution tests for GET /api/knowledge-promo/search (SPEC-REGULA-KNOWLEDGE-PROMO-001).
// @MX:SPEC SPEC-REGULA-KNOWLEDGE-PROMO-001 (REQ-001/002/003, AC-01)

import { beforeEach, describe, expect, it, vi } from 'vitest';

let authenticated = true;
let organizationId = 'org-001';

const searchOrgConversations = vi.fn();
const searchPromotedSemantic = vi.fn();

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
vi.mock('@/lib/knowledge-promo/semantic-search', () => ({
  searchOrgConversations,
  searchPromotedSemantic,
}));

const { GET } = await import('@/app/api/knowledge-promo/search/route');

function getReq(query: string): Request {
  return new Request(`http://localhost/api/knowledge-promo/search?${query}`);
}

beforeEach(() => {
  vi.clearAllMocks();
  authenticated = true;
  organizationId = 'org-001';
  searchOrgConversations.mockResolvedValue([{ id: 'c1' }]);
  searchPromotedSemantic.mockResolvedValue([{ id: 'p1' }]);
});

describe('GET /api/knowledge-promo/search (REQ-001/002/003, AC-01)', () => {
  it('returns 200 fulltext mode (default) via searchOrgConversations', async () => {
    const res = await GET(getReq('q=510k'), {});
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body).toMatchObject({ mode: 'fulltext' });
    expect(body.conversations).toHaveLength(1);
    expect(body.promoted).toEqual([]);
    expect(searchOrgConversations).toHaveBeenCalledWith(
      expect.objectContaining({ orgId: 'org-001', query: '510k' }),
    );
  });

  it('returns 200 semantic mode via searchPromotedSemantic', async () => {
    const res = await GET(getReq('q=510k&mode=semantic'), {});
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body).toMatchObject({ mode: 'semantic' });
    expect(body.promoted).toHaveLength(1);
    expect(body.conversations).toEqual([]);
    expect(searchPromotedSemantic).toHaveBeenCalled();
  });

  it('returns 400 invalid_mode for an unknown mode', async () => {
    const res = await GET(getReq('q=x&mode=hybrid'), {});
    expect(res.status).toBe(400);
  });

  it('clamps limit to the 1–50 range', async () => {
    await GET(getReq('q=x&limit=999'), {});
    expect(searchOrgConversations).toHaveBeenCalledWith(expect.objectContaining({ limit: 50 }));
  });

  it('returns 403 no_org_context when orgId is missing', async () => {
    organizationId = undefined as unknown as string;
    const res = await GET(getReq('q=x'), {});
    expect(res.status).toBe(403);
  });
});
