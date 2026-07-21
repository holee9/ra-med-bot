// @MX:NOTE [AUTO] Route tests for /api/ra/deadlines GET (coverage 402, SPEC-REGULA-CALENDAR-001).
// @MX:SPEC SPEC-REGULA-CALENDAR-001 (REQ-CAL-001..005)

import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/kernel/db/client', () => ({
  db: {
    select: vi.fn(() => ({
      from: () => ({
        where: () => ({ orderBy: () => [] }),
      }),
    })),
  },
}));
vi.mock('@/lib/kernel/audit', () => ({ writeAudit: vi.fn().mockResolvedValue(undefined) }));
vi.mock('@/lib/kernel/auth/with-permission', () => ({
  withPermission: vi.fn(
    (_perm: string, handler: (req: Request, ctx: unknown, session: unknown) => Promise<Response>) =>
      async (req: Request, ctx: unknown) =>
        handler(req, ctx, {
          user: { id: 'user-001', role: 'ra-member', organizationId: 'org-001' },
        }),
  ),
}));
const isProjectMemberMock = vi.fn().mockResolvedValue(true);
vi.mock('@/lib/kernel/auth/acl', () => ({
  isProjectMember: (...a: unknown[]) => isProjectMemberMock(...a),
}));

import { GET } from '@/app/api/ra/deadlines/route';

beforeEach(() => {
  vi.clearAllMocks();
  isProjectMemberMock.mockResolvedValue(true);
});

function req(url: string) {
  return new Request(url) as unknown as Parameters<typeof GET>[0];
}

describe('GET /api/ra/deadlines', () => {
  it('returns 400 when projectId is missing', async () => {
    const res = await GET(req('http://localhost/api/ra/deadlines'), {} as never);
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual(expect.objectContaining({ error: 'projectId required' }));
  });

  it('returns 403 when the user is not a project member', async () => {
    isProjectMemberMock.mockResolvedValue(false);
    const res = await GET(req('http://localhost/api/ra/deadlines?projectId=p-1'), {} as never);
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual(expect.objectContaining({ error: 'not_a_member' }));
  });

  it('returns the deadline rows (200) for a member', async () => {
    const res = await GET(req('http://localhost/api/ra/deadlines?projectId=p-1'), {} as never);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ deadlines: [], count: 0 });
  });

  it('threads optional jurisdiction/type/status filters through', async () => {
    const res = await GET(
      req(
        'http://localhost/api/ra/deadlines?projectId=p-1&jurisdiction=FDA&type=fda_510k_clock&status=upcoming',
      ),
      {} as never,
    );
    expect(res.status).toBe(200);
  });
});
