// @MX:NOTE [AUTO] TDD RED — audit log route pagination + filtering (SPEC-REGULA-AUDITOR-VIEW-001).
// @MX:SPEC SPEC-REGULA-AUDITOR-VIEW-001 (AC #7)

import { beforeEach, describe, expect, it, vi } from 'vitest';

// vi.hoisted ensures the mock variables exist before vi.mock factories run.
// Each chainable returns a real Promise resolving to rowsReturn()'s result,
// so `await db.select().from().leftJoin().where().orderBy().limit().offset()`
// yields the configured rows no matter which method the route terminates on.
const hoisted = vi.hoisted(() => {
  const rowsReturn = vi.fn();
  const promise = () => Promise.resolve(rowsReturn());
  const offsetMock = vi.fn(() => promise());
  const limitMock = vi.fn(() => ({ offset: offsetMock }));
  const orderByMock = vi.fn(() => ({ limit: limitMock }));
  const whereMock = vi.fn(() => ({ orderBy: orderByMock }));
  const leftJoinMock = vi.fn(() => ({ where: whereMock }));
  const fromMock = vi.fn(() => ({ leftJoin: leftJoinMock }));
  const selectMock = vi.fn(() => ({ from: fromMock }));
  return { rowsReturn, selectMock, whereMock };
});

// Mock withPermission to inject auditor session and bypass RBAC plumbing.
vi.mock('@/lib/kernel/auth/with-permission', () => ({
  withPermission: vi.fn(
    (
      _action: string,
      handler: (req: Request, ctx: unknown, session: unknown) => Promise<Response>,
    ) =>
      (req: Request, ctx: unknown) =>
        handler(req, ctx, {
          user: {
            id: 'user-auditor-1',
            role: 'auditor',
            organizationId: 'org-1',
            email: 'inspector@fda.gov',
          },
        }),
  ),
}));

vi.mock('@/lib/kernel/audit', () => ({
  writeAudit: vi.fn().mockResolvedValue(undefined),
}));

// Mock the DB query builder chain used by the route.
// The route chain is select().from().leftJoin().where().orderBy().limit().offset().
// `where(undefined)` is the no-filter branch — so where must accept undefined.
const { rowsReturn, selectMock, whereMock } = hoisted;

vi.mock('@/lib/kernel/db/client', () => ({
  db: {
    select: hoisted.selectMock,
  },
}));

vi.mock('@/lib/kernel/db/schema', () => ({
  auditLogs: {
    id: 'id',
    createdAt: 'createdAt',
    action: 'action',
    actorId: 'actorId',
    resourceType: 'resourceType',
    resourceId: 'resourceId',
    metaJson: 'metaJson',
  },
  users: { id: 'id', email: 'email' },
}));

import { GET } from '@/app/api/ra/audit-log/route';

function makeReq(url: string): Request {
  return new Request(url);
}

describe('SPEC-REGULA-AUDITOR-VIEW-001 — GET /api/ra/audit-log (AC #7)', () => {
  beforeEach(() => {
    selectMock.mockClear();
    rowsReturn.mockClear();
    rowsReturn.mockResolvedValue([]);
  });

  it('returns 200 with paginated rows', async () => {
    rowsReturn.mockResolvedValueOnce([
      {
        id: 'log-1',
        createdAt: new Date('2026-01-01'),
        action: 'signature.applied',
        actorId: 'u-1',
        resourceType: 'signature',
        resourceId: 'sig-1',
        metaJson: {},
      },
    ]);

    const res = await GET(makeReq('https://x/api/ra/audit-log?page=1'), {});
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.rows).toHaveLength(1);
    expect(body.page).toBe(1);
    expect(body.pageSize).toBe(50);
  });

  it('defaults to page 1, pageSize 50 when no query params', async () => {
    rowsReturn.mockResolvedValueOnce([]);
    const res = await GET(makeReq('https://x/api/ra/audit-log'), {});
    const body = await res.json();
    expect(body.page).toBe(1);
    expect(body.pageSize).toBe(50);
  });

  it('caps pageSize at 50 (auditor cannot request larger pages)', async () => {
    rowsReturn.mockResolvedValueOnce([]);
    const res = await GET(makeReq('https://x/api/ra/audit-log?page=1&pageSize=500'), {});
    const body = await res.json();
    expect(body.pageSize).toBe(50);
  });

  it('accepts fromDate / toDate filters', async () => {
    rowsReturn.mockResolvedValueOnce([]);
    const res = await GET(
      makeReq('https://x/api/ra/audit-log?fromDate=2025-01-01&toDate=2025-12-31'),
      {},
    );
    expect(res.status).toBe(200);
    // whereMock should have been invoked (filtering applied)
    expect(whereMock).toHaveBeenCalled();
  });

  it('accepts action filter (event type)', async () => {
    rowsReturn.mockResolvedValueOnce([]);
    const res = await GET(makeReq('https://x/api/ra/audit-log?action=signature.applied'), {});
    expect(res.status).toBe(200);
    expect(whereMock).toHaveBeenCalled();
  });

  it('accepts actorId filter', async () => {
    rowsReturn.mockResolvedValueOnce([]);
    const res = await GET(makeReq('https://x/api/ra/audit-log?actorId=user-1'), {});
    expect(res.status).toBe(200);
    expect(whereMock).toHaveBeenCalled();
  });

  it('row shape includes timestamp, action, actor, recordId, outcome', async () => {
    rowsReturn.mockResolvedValueOnce([
      {
        id: 'log-1',
        createdAt: new Date('2026-01-01T00:00:00Z'),
        action: 'signature.applied',
        actorId: 'u-1',
        resourceType: 'signature',
        resourceId: 'sig-1',
        metaJson: { outcome: 'success' },
      },
    ]);
    const res = await GET(makeReq('https://x/api/ra/audit-log'), {});
    const body = await res.json();
    const row = body.rows[0];
    expect(row).toHaveProperty('timestamp');
    expect(row).toHaveProperty('action');
    expect(row).toHaveProperty('actorId');
    expect(row).toHaveProperty('resourceId');
    expect(row).toHaveProperty('outcome');
  });

  it('rejects negative or zero page with 400', async () => {
    const res = await GET(makeReq('https://x/api/ra/audit-log?page=0'), {});
    expect(res.status).toBe(400);
  });
});
