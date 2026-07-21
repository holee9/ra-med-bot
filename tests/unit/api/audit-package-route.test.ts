// @MX:NOTE [AUTO] TDD RED — audit package route (SPEC-REGULA-AUDITOR-VIEW-001).
// @MX:SPEC SPEC-REGULA-AUDITOR-VIEW-001 (AC #4, #5, #6)

import { beforeEach, describe, expect, it, vi } from 'vitest';

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

const writeAuditMock = vi.fn().mockResolvedValue(undefined);
vi.mock('@/lib/kernel/audit', () => ({
  writeAudit: (event: unknown) => writeAuditMock(event),
}));

// Mock DB selects for audit log, signatures, citations, expert reviews, reports.
// Each chain returns a real Promise resolving to the configured rows, so the
// route's `await` yields rows regardless of which terminal method is used.
// `vi.fn` return types vary per method (each returns a different chain shape),
// so we type the chain fields as loosely-typed function mocks. This is test
// infrastructure; the route tests assert on behavior, not on mock types.
type AnyFn = ReturnType<typeof vi.fn>;
interface MockChain {
  rows: AnyFn;
  where: AnyFn;
  from: AnyFn;
  select: AnyFn;
}
const chain = (): MockChain => {
  const c = {} as MockChain;
  c.rows = vi.fn(async () => []) as AnyFn;
  const makePromise = () => Promise.resolve(c.rows());
  // Cast each mock to the loose AnyFn type — the concrete return shapes vary
  // per chain method and tsc cannot unify them automatically.
  c.where = vi.fn(() => makePromise()) as AnyFn;
  c.from = vi.fn(() => ({ where: c.where })) as AnyFn;
  c.select = vi.fn(() => ({ from: c.from })) as AnyFn;
  return c;
};

const auditChain = chain();
const sigChain = chain();
const citChain = chain();
const revChain = chain();
const repChain = chain();

vi.mock('@/lib/kernel/db/client', () => ({
  db: {
    select: vi.fn((args: unknown) => {
      // Route calls select() for different tables; distinguish by the field shape.
      const fields = args as unknown;
      if (fields && typeof fields === 'object' && 'signerName' in (fields as object))
        return sigChain.select();
      if (fields && typeof fields === 'object' && 'sourceUrl' in (fields as object))
        return citChain.select();
      if (fields && typeof fields === 'object' && 'reviewerId' in (fields as object))
        return revChain.select();
      if (fields && typeof fields === 'object' && 'reportType' in (fields as object))
        return repChain.select();
      return auditChain.select();
    }),
  },
}));

vi.mock('@/lib/kernel/db/schema', () => ({
  auditLogs: { id: 'id', createdAt: 'createdAt', action: 'action', actorId: 'actorId' },
  answerSignatures: { id: 'id', messageId: 'messageId', signerName: 'signerName' },
  citations: { id: 'id', sourceUrl: 'sourceUrl' },
  expertReviews: { id: 'id', reviewerId: 'reviewerId' },
  complianceReports: { id: 'id', reportType: 'reportType' },
}));

import { POST } from '@/app/api/ra/audit-package/route';

function makeReq(body: unknown): Request {
  return new Request('https://x/api/ra/audit-package', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('SPEC-REGULA-AUDITOR-VIEW-001 — POST /api/ra/audit-package (AC #4, #5, #6)', () => {
  beforeEach(() => {
    writeAuditMock.mockClear();
    auditChain.rows.mockResolvedValue([]);
    sigChain.rows.mockResolvedValue([]);
    citChain.rows.mockResolvedValue([]);
    revChain.rows.mockResolvedValue([]);
    repChain.rows.mockResolvedValue([]);
  });

  it('returns 200 with a ZIP blob (application/zip)', async () => {
    const res = await POST(makeReq({ dateRange: { start: '2025-06-21', end: '2026-06-21' } }), {});
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toContain('application/zip');
    const disposition = res.headers.get('Content-Disposition') ?? '';
    expect(disposition).toContain('attachment');
    expect(disposition).toMatch(/\.zip/);
  });

  it('response body is non-empty ZIP binary (PK magic)', async () => {
    const res = await POST(makeReq({ dateRange: { start: '2025-06-21', end: '2026-06-21' } }), {});
    const buf = Buffer.from(await res.arrayBuffer());
    expect(buf.length).toBeGreaterThan(100);
    expect(buf.subarray(0, 2).toString('ascii')).toBe('PK');
  });

  it('logs audit.package.generated after successful generation', async () => {
    await POST(makeReq({ dateRange: { start: '2025-06-21', end: '2026-06-21' } }), {});
    expect(writeAuditMock).toHaveBeenCalled();
    const call = writeAuditMock.mock.calls[0];
    const event = call?.[0] as {
      action: string;
      actor_id: string;
      meta_json: Record<string, unknown>;
    };
    expect(event.action).toBe('audit.package.generated');
    expect(event.actor_id).toBe('user-auditor-1');
    expect(event.meta_json).toMatchObject({
      dateRange: { start: '2025-06-21', end: '2026-06-21' },
    });
  });

  it('rejects missing dateRange with 400', async () => {
    const res = await POST(makeReq({}), {});
    expect(res.status).toBe(400);
  });

  it('rejects reversed date range (start > end) with 400', async () => {
    const res = await POST(makeReq({ dateRange: { start: '2026-06-21', end: '2025-06-21' } }), {});
    expect(res.status).toBe(400);
  });

  it('rejects date range spanning more than 24 months with 400 (sane ceiling)', async () => {
    const res = await POST(makeReq({ dateRange: { start: '2020-01-01', end: '2026-06-21' } }), {});
    expect(res.status).toBe(400);
  });
});
