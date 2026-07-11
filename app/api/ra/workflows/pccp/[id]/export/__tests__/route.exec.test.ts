// @vitest-environment node
// @MX:NOTE [AUTO] Execution tests for POST /api/ra/workflows/pccp/[id]/export (SPEC-REGULA-PCCP-001).
// @MX:SPEC SPEC-REGULA-PCCP-001 (REQ-PCCP-018/019, REQ-SOURCE-GOV-007/AC-03)
//
// No prior test existed (0% coverage). Invokes POST with db (version + components
// selects) + pccp exporters + governance gate mocked. db.select() chains vary
// (version: where.limit; components: where) so the chainable thenable + queue is
// reused. Covers: docx/pdf export + audit, 404, governance 403, invalid 400.

import { beforeEach, describe, expect, it, vi } from 'vitest';

let authenticated = true;
let organizationId = 'org-001';
let selectQueue: unknown[][] = [];

type AuditInput = {
  actor_id: string | null;
  action: string;
  resource_type: string;
  resource_id: string;
  meta_json?: Record<string, unknown>;
};

const writeAudit = vi.fn(async (_input: AuditInput) => {});
const exportPccpToDocx = vi.fn();
const getDocxFilename = vi.fn(() => 'PCCP_v1.docx');
const exportPccpToPdf = vi.fn();
const getPdfFilename = vi.fn(() => 'PCCP_v1.pdf');
const verifyGovernanceFreshness = vi.fn();
const auditStaleBlockedBatch = vi.fn(async () => {});

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
          user: { id: 'user-001', role: 'ra-lead', organizationId },
        });
      },
  ),
}));

vi.mock('@/lib/pccp/exporters/docx', () => ({
  exportPccpToDocx,
  getDocxFilename,
}));
vi.mock('@/lib/pccp/exporters/pdf', () => ({
  exportPccpToPdf,
  getPdfFilename,
}));
vi.mock('@/lib/source-governance/stale-check', () => ({
  verifyGovernanceFreshness,
  auditStaleBlockedBatch,
}));

vi.mock('@/lib/db/client', () => {
  const chain: Record<string, unknown> = {};
  chain.from = () => chain;
  chain.where = () => chain;
  chain.limit = () => chain;
  // Intentional thenable: `await` on the chain pops the next queued select result.
  // biome-ignore lint/suspicious/noThenProperty: deliberate chainable thenable for the db mock
  chain.then = (resolve: (v: unknown) => void) => resolve(selectQueue.shift() ?? []);
  return { db: { select: () => chain } };
});

const { POST } = await import('@/app/api/ra/workflows/pccp/[id]/export/route');

function postReq(body: unknown): Request {
  return new Request('http://localhost/api/ra/workflows/pccp/pv-1/export', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

const VERSION = { id: 'pv-1', versionLabel: 'v1' };
const COMPONENTS = [{ componentType: 'summary', contentJsonb: { x: 1 }, completedAt: null }];

const BUF = new Uint8Array([9, 8, 7]);

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
  selectQueue = [];
  exportPccpToDocx.mockResolvedValue(BUF);
  exportPccpToPdf.mockResolvedValue(BUF);
});

describe('POST /api/ra/workflows/pccp/[id]/export (REQ-PCCP-018/019)', () => {
  it('returns 200 docx + workflow.download audit', async () => {
    selectQueue = [[VERSION], COMPONENTS];
    const res = await POST(postReq({ format: 'docx' }), { params: { id: 'pv-1' } });
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toContain('wordprocessingml');
    expect(getDocxFilename).toHaveBeenCalled();
    expect(exportPccpToDocx).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      expect.objectContaining({ includeDraftWatermark: true }),
    );
    const audits = auditCalls((i) => i.action === 'workflow.download');
    expect(audits).toHaveLength(1);
    expect(audits[0]?.meta_json).toMatchObject({ format: 'docx', includeDraftWatermark: true });
  });

  it('returns 200 pdf when format=pdf', async () => {
    selectQueue = [[VERSION], COMPONENTS];
    const res = await POST(postReq({ format: 'pdf', include_draft_watermark: false }), {
      params: { id: 'pv-1' },
    });
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('application/pdf');
    expect(exportPccpToPdf).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      expect.objectContaining({ includeDraftWatermark: false }),
    );
  });

  it('returns 404 Not found when the version does not exist', async () => {
    selectQueue = [[]];
    const res = await POST(postReq({ format: 'docx' }), { params: { id: 'px' } });
    expect(res.status).toBe(404);
  });

  it('returns 403 stale_citation_blocked when the governance gate fails', async () => {
    verifyGovernanceFreshness.mockResolvedValueOnce({
      allowed: false,
      blockedSources: [{ sourceId: 's-x' }],
    });
    selectQueue = [[VERSION], COMPONENTS];
    const res = await POST(
      postReq({ format: 'docx', citedSourceIds: ['00000000-0000-4000-8000-000000000000'] }),
      { params: { id: 'pv-1' } },
    );
    expect(res.status).toBe(403);
    expect((await res.json()).error).toBe('stale_citation_blocked');
    expect(auditStaleBlockedBatch).toHaveBeenCalled();
  });

  it('returns 400 Invalid input on a bad format enum', async () => {
    selectQueue = [[VERSION], COMPONENTS];
    const res = await POST(postReq({ format: 'html' }), { params: { id: 'pv-1' } });
    expect(res.status).toBe(400);
  });
});
