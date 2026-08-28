// @vitest-environment node
// @MX:NOTE [AUTO] Execution tests for /api/corpus-license/source-license (SPEC-REGULA-CORPUS-LICENSE-001).
// @MX:SPEC SPEC-REGULA-CORPUS-LICENSE-001 (REQ-CORPUSLIC-001, REQ-CORPUSLIC-010, REQ-CORPUSLIC-012)
//
// No prior test existed (0% coverage). Invokes GET/POST/PUT with corpus-license
// lib fns + db mocked. db.select() chains vary (GET: where-thenable; PUT:
// where.limit) so the chainable thenable + selectQueue pattern is reused. Covers
// IDOR guards (assertSourceInOrg + cross-org PUT → 404 + denial audit), zod
// validation, and the create/update audit rides.

import { beforeEach, describe, expect, it, vi } from 'vitest';

// --- Mock state toggles ---
let authenticated = true;
let organizationId = 'org-001';
let selectQueue: unknown[][] = [];

const assertSourceInOrg = vi.fn(async () => true);
const auditLicenseSet = vi.fn(async () => {});
const auditCorpusAccessDenied = vi.fn(async () => {});
const safeParse = vi.fn();
const txInsertReturning = vi.fn().mockResolvedValue([{ id: 'lic-1' }]);
const txUpdateWhere = vi.fn().mockResolvedValue(undefined);

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
          user: { id: 'user-001', role: 'ra-lead', organizationId },
        });
      },
  ),
}));

vi.mock('@/lib/corpus-license/access', () => ({ assertSourceInOrg }));
vi.mock('@/lib/corpus-license/audit', () => ({ auditLicenseSet, auditCorpusAccessDenied }));
vi.mock('@/lib/corpus-license/types', () => ({ sourceLicenseInputSchema: { safeParse } }));

// chainable thenable: `await` pops the next queued select result.
vi.mock('@/lib/db/client', () => {
  const chain: Record<string, unknown> = {};
  chain.from = () => chain;
  chain.where = () => chain;
  chain.limit = () => chain;
  // Intentional thenable: `await` on the chain pops the next queued select result.
  // biome-ignore lint/suspicious/noThenProperty: deliberate chainable thenable for the db mock
  chain.then = (resolve: (v: unknown) => void) => resolve(selectQueue.shift() ?? []);
  return {
    db: {
      select: () => chain,
      transaction: vi.fn(async (fn: (tx: unknown) => Promise<Response>) =>
        fn({
          insert: () => ({ values: () => ({ returning: txInsertReturning }) }),
          update: () => ({ set: () => ({ where: txUpdateWhere }) }),
        }),
      ),
    },
  };
});

const { GET, POST, PUT } = await import('@/app/api/corpus-license/source-license/route');

function reqWithBody(method: string, body: unknown): Request {
  return new Request('http://localhost/api/corpus-license/source-license', {
    method,
    body: JSON.stringify(body),
  });
}

const validBody = {
  sourceId: 'src-1',
  licenseType: 'subscription',
  entitlementRef: null,
  permittedUse: 'internal',
  fullTextAllowed: true,
  abstractOnly: false,
  confidentialityLevel: 'public',
  expiryDate: null,
};

beforeEach(() => {
  vi.clearAllMocks();
  authenticated = true;
  organizationId = 'org-001';
  selectQueue = [];
  assertSourceInOrg.mockResolvedValue(true);
  txInsertReturning.mockResolvedValue([{ id: 'lic-1' }]);
  safeParse.mockReturnValue({ success: true, data: validBody });
});

describe('GET /api/corpus-license/source-license (REQ-CORPUSLIC-001)', () => {
  it('returns 200 with the org-scoped licenses', async () => {
    selectQueue = [[{ id: 'lic-1' }, { id: 'lic-2' }]];
    const res = await GET(new Request('http://localhost/api/corpus-license/source-license'), {});
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.licenses).toHaveLength(2);
  });

  it('returns 403 when organizationId is missing', async () => {
    organizationId = undefined as unknown as string;
    const res = await GET(new Request('http://localhost/api/corpus-license/source-license'), {});
    expect(res.status).toBe(403);
  });
});

describe('POST /api/corpus-license/source-license (REQ-CORPUSLIC-001/010, REQ-CORPUSLIC-012)', () => {
  it('returns 201 + auditLicenseSet on success', async () => {
    const res = await POST(reqWithBody('POST', validBody), {});
    expect(res.status).toBe(201);
    expect((await res.json()).id).toBe('lic-1');
    expect(auditLicenseSet).toHaveBeenCalled();
  });

  it('returns 400 validation_failed when the schema rejects', async () => {
    safeParse.mockReturnValueOnce({ success: false, error: { issues: [] } });
    const res = await POST(reqWithBody('POST', validBody), {});
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('validation_failed');
  });

  it('returns 404 source_not_found when assertSourceInOrg denies (IDOR)', async () => {
    assertSourceInOrg.mockResolvedValueOnce(false);
    const res = await POST(reqWithBody('POST', validBody), {});
    expect(res.status).toBe(404);
    expect((await res.json()).error).toBe('source_not_found');
  });

  it('returns 403 when organizationId is missing', async () => {
    organizationId = undefined as unknown as string;
    const res = await POST(reqWithBody('POST', validBody), {});
    expect(res.status).toBe(403);
  });
});

describe('PUT /api/corpus-license/source-license (REQ-CORPUSLIC-010, IDOR)', () => {
  it('returns 200 + auditLicenseSet when the license is in-org', async () => {
    selectQueue = [[{ id: 'lic-1', orgId: 'org-001', sourceId: 'src-1' }]];
    const res = await PUT(reqWithBody('PUT', validBody), {});
    expect(res.status).toBe(200);
    expect((await res.json()).id).toBe('lic-1');
    expect(auditLicenseSet).toHaveBeenCalled();
  });

  it('returns 404 when no license matches the sourceId', async () => {
    selectQueue = [[]];
    const res = await PUT(reqWithBody('PUT', validBody), {});
    expect(res.status).toBe(404);
    expect((await res.json()).error).toBe('source_license_not_found');
    expect(auditCorpusAccessDenied).not.toHaveBeenCalled();
  });

  it('returns 404 + auditCorpusAccessDenied when the license is cross-org', async () => {
    selectQueue = [[{ id: 'lic-9', orgId: 'other-org', sourceId: 'src-1' }]];
    const res = await PUT(reqWithBody('PUT', validBody), {});
    expect(res.status).toBe(404);
    expect(auditCorpusAccessDenied).toHaveBeenCalledWith(
      expect.objectContaining({ reason: 'source_license_cross_org' }),
    );
  });

  it('returns 400 validation_failed when the schema rejects', async () => {
    safeParse.mockReturnValueOnce({ success: false, error: { issues: [] } });
    const res = await PUT(reqWithBody('PUT', validBody), {});
    expect(res.status).toBe(400);
  });
});
