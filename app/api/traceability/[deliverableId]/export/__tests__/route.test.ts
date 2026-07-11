// @vitest-environment node
// @MX:NOTE [AUTO] Execution tests for GET /api/traceability/[deliverableId]/export (SPEC-REGULA-TRACEABILITY-001).
// @MX:SPEC SPEC-REGULA-TRACEABILITY-001 (REQ-TRACEABILITY-008)
//
// Invokes the real GET handler (import + call) to earn execution + branch
// coverage. Covers: 200 md/pdf happy path, both ctx.params shapes (Promise +
// plain), 404 not_found, 400 missing deliverableId, 400 invalid format, 403
// org-missing, 502 export_failed, and the corpus-license export-rights block
// (403 export_license_blocked). The happy-path packet uses non-UUID issue
// details so the license/governance gates are correctly skipped.

import { beforeEach, describe, expect, it, vi } from 'vitest';

// --- Mock state toggles ---
let authenticated = true;
let organizationId = 'org-001';

type AuditInput = {
  actor_id: string | null;
  action: string;
  resource_type: string;
  resource_id: string;
  meta_json?: Record<string, unknown>;
};

const writeAudit = vi.fn(async () => {});
const listStaleNodeIds = vi.fn(async () => []);
const getEvidencePacket = vi.fn();
const exportPacket = vi.fn();
const sanitizeFilename = vi.fn((s: string) => s);
const withTenantScope = vi.fn(
  async (_orgId: string, fn: (dbs: unknown) => Promise<unknown>): Promise<unknown> => fn({}),
);

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
          user: { id: 'user-001', role: 'ra-member', organizationId },
        });
      },
  ),
}));

vi.mock('@/lib/db/client', () => ({ withTenantScope }));

vi.mock('@/lib/traceability/stale-propagation', () => ({ listStaleNodeIds }));

vi.mock('@/lib/traceability/evidence-packet', () => ({ getEvidencePacket }));

vi.mock('@/lib/traceability/export-packet', () => ({
  exportPacket,
  sanitizeFilename,
}));

vi.mock('@/lib/corpus-license/export-gate', () => ({
  verifyExportRights: vi.fn(async () => ({
    allowed: false,
    blockedSources: [{ sourceId: '00000000-0000-4000-8000-000000000000' }],
  })),
  auditExportBlockedBatch: vi.fn(async () => {}),
}));

const { GET } = await import('@/app/api/traceability/[deliverableId]/export/route');

const DELIVERABLE = 'del-1';

function getReq(format?: 'md' | 'pdf'): Request {
  const qs = format ? `?format=${format}` : '';
  return new Request(`http://localhost/api/traceability/${DELIVERABLE}/export${qs}`);
}

/** A packet whose issue details are NOT corpus-source UUIDs (gates skipped). */
function plainPacket() {
  return { issues: [{ detail: 'CER-001 missing traceability' }, { detail: 'DHF-7' }] };
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
  getEvidencePacket.mockResolvedValue(plainPacket());
  exportPacket.mockResolvedValue({
    success: true,
    content: '# Evidence Packet',
    size: 16,
    filename: `evidence-packet-${DELIVERABLE}.md`,
  });
});

describe('GET /api/traceability/[id]/export — happy path (SPEC-REGULA-TRACEABILITY-001)', () => {
  it('returns 200 text/markdown by default and audits the export', async () => {
    const res = await GET(getReq(), { params: { deliverableId: DELIVERABLE } });

    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('text/markdown; charset=utf-8');
    expect(res.headers.get('Content-Disposition')).toContain('attachment');
    expect(await res.text()).toBe('# Evidence Packet');

    const audits = auditCalls((i) => i.action === 'traceability.packet_exported');
    expect(audits).toHaveLength(1);
    expect(audits[0]?.resource_type).toBe('evidence_packet');
    expect(audits[0]?.meta_json).toMatchObject({ format: 'md', issueCount: 2 });
  });

  it('returns 200 application/pdf when format=pdf', async () => {
    const res = await GET(getReq('pdf'), { params: { deliverableId: DELIVERABLE } });
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('application/pdf');
    // Exporter invoked with the pdf format.
    expect(exportPacket).toHaveBeenCalledWith(expect.anything(), 'pdf', expect.any(Array));
  });

  it('reads deliverableId from a Promise-shaped ctx.params (Next.js 15 async params)', async () => {
    const res = await GET(getReq(), {
      params: Promise.resolve({ deliverableId: DELIVERABLE }),
    });
    expect(res.status).toBe(200);
  });

  it('wraps reads in withTenantScope (RLS GUC wiring, #239 Phase 2)', async () => {
    await GET(getReq(), { params: { deliverableId: DELIVERABLE } });
    expect(withTenantScope).toHaveBeenCalledTimes(1);
    expect(withTenantScope.mock.calls[0]?.[0]).toBe('org-001');
  });
});

describe('GET /api/traceability/[id]/export — error paths', () => {
  it('returns 404 when the evidence packet is not found', async () => {
    getEvidencePacket.mockResolvedValue(null);
    const res = await GET(getReq(), { params: { deliverableId: DELIVERABLE } });
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'not_found' });
  });

  it('returns 400 when deliverableId is missing', async () => {
    const res = await GET(getReq(), { params: {} });
    expect(res.status).toBe(400);
  });

  it('returns 400 when format is not pdf|md', async () => {
    const res = await GET(
      new Request(`http://localhost/api/traceability/${DELIVERABLE}/export?format=docx`),
      { params: { deliverableId: DELIVERABLE } },
    );
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('Invalid query');
  });

  it('returns 403 when organizationId is missing', async () => {
    organizationId = undefined as unknown as string;
    const res = await GET(getReq(), { params: { deliverableId: DELIVERABLE } });
    expect(res.status).toBe(403);
  });

  it('returns 502 export_failed when the exporter fails (no internals leaked)', async () => {
    exportPacket.mockResolvedValue({
      success: false,
      content: null,
      error: new Error('boom\n\r-injection'),
    });
    const res = await GET(getReq(), { params: { deliverableId: DELIVERABLE } });
    expect(res.status).toBe(502);
    expect((await res.json()).error).toBe('export_failed');
  });
});

describe('GET /api/traceability/[id]/export — corpus-license export-rights gate', () => {
  const UUID = '00000000-0000-4000-8000-000000000000';

  beforeEach(() => {
    // Packet cites a corpus source UUID → export-rights gate runs.
    getEvidencePacket.mockResolvedValue({ issues: [{ detail: UUID }] });
  });

  it('returns 403 export_license_blocked when a cited source is not export-entitled', async () => {
    const res = await GET(getReq(), { params: { deliverableId: DELIVERABLE } });
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toBe('export_license_blocked');
    expect(body.blockedCount).toBe(1);
    // No successful-export audit when blocked.
    expect(auditCalls((i) => i.action === 'traceability.packet_exported')).toHaveLength(0);
  });
});
