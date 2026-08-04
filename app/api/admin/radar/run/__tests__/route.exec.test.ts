// @vitest-environment node
// @MX:NOTE [AUTO] Execution tests for POST /api/admin/radar/run (SPEC-REGULA-RADAR-001).
// @MX:SPEC SPEC-REGULA-RADAR-001
//
// No prior test existed (0% coverage). Admin-only manual crawler trigger.
// runCrawler + the three crawler fns + db are mocked. Covers: success + audit,
// non-admin 403, invalid crawler 422, crawler-error 500.

import { beforeEach, describe, expect, it, vi } from 'vitest';

let authenticated = true;
let organizationId = 'org-001';
type Role = 'viewer' | 'ra-member' | 'ra-lead' | 'admin';
let userRole: Role = 'admin';

type AuditInput = {
  actor_id: string | null;
  action: string;
  resource_type: string;
  resource_id: string;
  meta_json?: Record<string, unknown>;
};

const writeAudit = vi.fn(async (_input: AuditInput) => {});
const runCrawler = vi.fn();

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
          user: { id: 'user-001', role: userRole, organizationId },
        });
      },
  ),
}));

vi.mock('@/lib/db/client', () => ({ db: {} }));
vi.mock('@/lib/radar/crawlers/_base', () => ({ runCrawler }));
vi.mock('@/lib/radar/crawlers/eu-oj', () => ({ crawlEuOj: vi.fn() }));
vi.mock('@/lib/radar/crawlers/fda-federal-register', () => ({ crawlFdaFederalRegister: vi.fn() }));
vi.mock('@/lib/radar/crawlers/mfds-notice', () => ({ crawlMfdsNotice: vi.fn() }));

const { POST } = await import('@/app/api/admin/radar/run/route');

function postReq(body: unknown): Request {
  return new Request('http://localhost/api/admin/radar/run', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

/** Extract audit inputs recorded by writeAudit, filtered by predicate. */
function auditCalls(predicate: (input: AuditInput) => boolean): AuditInput[] {
  return writeAudit.mock.calls
    .map((call) => (call as unknown[])[0] as AuditInput)
    .filter(predicate);
}

beforeEach(() => {
  vi.clearAllMocks();
  authenticated = true;
  organizationId = 'org-001';
  userRole = 'admin';
  runCrawler.mockResolvedValue({ records: [{ id: 'r1' }, { id: 'r2' }], errors: [] });
});

describe('POST /api/admin/radar/run (SPEC-REGULA-RADAR-001)', () => {
  it('returns 200 + radar.crawler_run audit on success', async () => {
    const res = await POST(postReq({ crawler: 'fda-federal-register' }), {});
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body).toMatchObject({ crawler: 'fda-federal-register', records_added: 2, errors: [] });
    const audits = auditCalls((i) => i.action === 'radar.crawler_run');
    expect(audits).toHaveLength(1);
    expect(audits[0]?.meta_json).toMatchObject({ records_added: 2, errors: 0 });
  });

  it('returns 403 Admin access required for non-admin roles', async () => {
    userRole = 'ra-lead';
    const res = await POST(postReq({ crawler: 'eu-oj' }), {});
    expect(res.status).toBe(403);
    expect(runCrawler).not.toHaveBeenCalled();
  });

  it('returns 422 Invalid crawler name on a bad enum', async () => {
    const res = await POST(postReq({ crawler: 'not-a-crawler' }), {});
    expect(res.status).toBe(422);
  });

  it('returns 500 when runCrawler throws', async () => {
    runCrawler.mockRejectedValueOnce(new Error('crawler crashed'));
    const res = await POST(postReq({ crawler: 'mfds-notice' }), {});
    expect(res.status).toBe(500);
  });
});
