// @vitest-environment node
// @MX:NOTE [AUTO] Execution tests for POST /api/ra/workflows/cer/export (SPEC-REGULA-CER-001).
// @MX:SPEC SPEC-REGULA-CER-001 (REQ-CER-039, REQ-SOURCE-GOV-007/AC-03)
//
// No prior test existed (0% coverage). Invokes POST with cer lib fns + exporters
// mocked. Covers: docx/pdf export, toStageId filtering (out-of-range keys dropped),
// the governance freshness gate (stale_citation_blocked 403), invalid input 400,
// and invalid json 400.

import { beforeEach, describe, expect, it, vi } from 'vitest';

let authenticated = true;
let organizationId = 'org-001';

const auditCerExported = vi.fn(async () => {});
const assembleCer = vi.fn();
const exportToDOCX = vi.fn();
const exportToPDF = vi.fn();
const safeParse = vi.fn();
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
          user: { id: 'user-001', role: 'ra-lead', organizationId },
        });
      },
  ),
}));

vi.mock('@/lib/cer/audit', () => ({ auditCerExported }));
vi.mock('@/lib/cer/cer-assembler', () => ({ assembleCer }));
vi.mock('@/lib/cer/exporters/docx', () => ({ exportToDOCX }));
vi.mock('@/lib/cer/exporters/pdf', () => ({ exportToPDF }));
vi.mock('@/lib/workflows/types', () => ({ CerExportSchema: { safeParse } }));
vi.mock('@/lib/source-governance/stale-check', () => ({
  verifyGovernanceFreshness,
  auditStaleBlockedBatch,
}));

const { POST } = await import('@/app/api/ra/workflows/cer/export/route');

function postReq(body: unknown): Request {
  return new Request('http://localhost/api/ra/workflows/cer/export', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

const validData = {
  cerRunId: 'cer-1',
  deviceName: 'My Device 1',
  manufacturer: 'Acme',
  stageContent: { '1': 'stage one', '99': 'should be filtered' },
  format: 'docx',
  citedSourceIds: [],
};

const BUF = new Uint8Array([1, 2, 3]);

beforeEach(() => {
  vi.clearAllMocks();
  authenticated = true;
  organizationId = 'org-001';
  safeParse.mockReturnValue({ success: true, data: validData });
  assembleCer.mockReturnValue({ deviceName: validData.deviceName });
  exportToDOCX.mockResolvedValue(BUF);
  exportToPDF.mockResolvedValue(BUF);
});

describe('POST /api/ra/workflows/cer/export (REQ-CER-039)', () => {
  it('returns 200 docx + audits; out-of-range stage keys are filtered', async () => {
    const res = await POST(postReq(validData), {});
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toContain('wordprocessingml');
    expect(res.headers.get('Content-Disposition')).toContain('CER_My_Device_1_cer-1.docx');
    expect(exportToDOCX).toHaveBeenCalled();
    expect(auditCerExported).toHaveBeenCalledWith('user-001', 'cer-1', 'docx');
    // toStageId filter: stage 1 kept, 99 dropped.
    const arg = assembleCer.mock.calls[0]?.[0] as { stageContent: Map<number, string> };
    expect(arg.stageContent.get(1)).toBe('stage one');
    expect(arg.stageContent.has(99)).toBe(false);
  });

  it('returns 200 pdf when format=pdf', async () => {
    safeParse.mockReturnValueOnce({
      success: true,
      data: { ...validData, format: 'pdf' },
    });
    const res = await POST(postReq({ ...validData, format: 'pdf' }), {});
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('application/pdf');
    expect(exportToPDF).toHaveBeenCalled();
    expect(exportToDOCX).not.toHaveBeenCalled();
  });

  it('returns 403 stale_citation_blocked when the governance gate fails', async () => {
    verifyGovernanceFreshness.mockResolvedValueOnce({
      allowed: false,
      blockedSources: [{ sourceId: 'src-x' }],
    });
    safeParse.mockReturnValueOnce({
      success: true,
      data: { ...validData, citedSourceIds: ['src-x'] },
    });
    const res = await POST(postReq({ ...validData, citedSourceIds: ['src-x'] }), {});
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toBe('stale_citation_blocked');
    expect(auditStaleBlockedBatch).toHaveBeenCalled();
  });

  it('returns 400 Invalid input when the schema rejects', async () => {
    safeParse.mockReturnValueOnce({ success: false, error: { format: () => ({}) } });
    const res = await POST(postReq(validData), {});
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('Invalid input');
  });

  it('returns 400 Invalid input when the body is not JSON', async () => {
    const res = await POST(
      new Request('http://localhost/api/ra/workflows/cer/export', {
        method: 'POST',
        body: '{bad',
      }),
      {},
    );
    expect(res.status).toBe(400);
  });
});
