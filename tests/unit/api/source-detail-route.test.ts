// @MX:NOTE [AUTO] Source detail RBAC tests — source organization scope guard.
// @MX:SPEC SPEC-REGULA-QUALITY-001 (REQ-QUAL-024, REQ-QUAL-025)

import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/kernel/auth/with-permission', () => ({
  withPermission: vi.fn(
    (
      _action: string,
      handler: (req: Request, ctx: unknown, session: unknown) => Promise<Response>,
    ) =>
      (req: Request, ctx: unknown) =>
        handler(req, ctx, {
          user: { id: 'user-001', role: 'ra-member', organizationId: 'org-001' },
        }),
  ),
}));

const writeAuditMock = vi.fn().mockResolvedValue(undefined);
vi.mock('@/lib/kernel/audit', () => ({
  writeAudit: writeAuditMock,
}));

const sourceRows: Array<{
  id: string;
  organizationId: string | null;
  orgLabel: string;
  title: string;
  year: number | null;
  type: string;
  url: string | null;
}> = [];

const sectionRows: Array<{ id: string; anchor: string; heading: string | null; text: string }> = [];

const sourceChain = {
  from: vi.fn().mockReturnThis(),
  where: vi.fn().mockReturnThis(),
  limit: vi.fn(() => Promise.resolve(sourceRows)),
};

const sectionsChain = {
  from: vi.fn().mockReturnThis(),
  where: vi.fn().mockReturnThis(),
  orderBy: vi.fn(() => Promise.resolve(sectionRows)),
};

const selectMock = vi.fn((selection?: unknown) => (selection ? sectionsChain : sourceChain));

vi.mock('@/lib/kernel/db/client', () => ({
  db: {
    select: selectMock,
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
  sourceRows.length = 0;
  sectionRows.length = 0;
  sourceChain.from.mockReturnThis();
  sourceChain.where.mockReturnThis();
  sourceChain.limit.mockImplementation(() => Promise.resolve(sourceRows));
  sectionsChain.from.mockReturnThis();
  sectionsChain.where.mockReturnThis();
  sectionsChain.orderBy.mockImplementation(() => Promise.resolve(sectionRows));
});

const { GET } = await import('@/app/api/ra/sources/[id]/route');

describe('GET /api/ra/sources/[id]', () => {
  it('returns a same-organization source', async () => {
    sourceRows.push({
      id: 'src-001',
      organizationId: 'org-001',
      orgLabel: 'Internal',
      title: 'Internal SOP',
      year: null,
      type: 'Internal',
      url: null,
    });
    sectionRows.push({ id: 'sec-1', anchor: 'A1', heading: null, text: 'redacted text' });

    const res = await GET(new Request('http://localhost/api/ra/sources/src-001'), {
      params: { id: 'src-001' },
    });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.id).toBe('src-001');
    expect(body.sections).toHaveLength(1);
  });

  it('returns a global source with no organization owner', async () => {
    sourceRows.push({
      id: 'src-global',
      organizationId: null,
      orgLabel: 'FDA',
      title: '21 CFR Part 820',
      year: 2024,
      type: 'Regulation',
      url: null,
    });

    const res = await GET(new Request('http://localhost/api/ra/sources/src-global'), {
      params: { id: 'src-global' },
    });

    expect(res.status).toBe(200);
    expect(writeAuditMock).not.toHaveBeenCalled();
  });

  it('blocks a source owned by a different organization and audits the denial', async () => {
    sourceRows.push({
      id: 'src-other',
      organizationId: 'org-999',
      orgLabel: 'Internal',
      title: 'Other org SOP',
      year: null,
      type: 'Internal',
      url: null,
    });

    const res = await GET(new Request('http://localhost/api/ra/sources/src-other'), {
      params: { id: 'src-other' },
    });
    const body = await res.json();

    expect(res.status).toBe(403);
    expect(body).toMatchObject({ error: 'not_a_member', resource_type: 'source' });
    expect(sectionsChain.orderBy).not.toHaveBeenCalled();
    expect(writeAuditMock).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'rbac.permission_deny',
        resource_type: 'source',
        resource_id: 'src-other',
        meta_json: expect.objectContaining({ reason: 'source_org_mismatch' }),
      }),
    );
  });
});
