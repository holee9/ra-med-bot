// @MX:NOTE [AUTO] Route tests for POST /api/ra/predicate/export (coverage 402, SPEC-REGULA-PREDICATE-001).
// @MX:SPEC SPEC-REGULA-PREDICATE-001 (REQ-PRE-014, REQ-PRE-015, REQ-PRE-029)
// @MX:TODO Deep PDF/DOCX rendering (@react-pdf/renderer tree, docx builders) is
//   mocked here. Format-specific rendering correctness is validated by visual
//   inspection of exported artifacts. These tests exercise the route handler
//   surface: auth passthrough, Zod validation, department RBAC, ownership
//   check, 404 for unknown/wrong-type runs, audit contract, and response shape.

import { beforeEach, describe, expect, it, vi } from 'vitest';

// --- Mutable session ---
let sessionUser: { id: string; role: string; organizationId: string | null } = {
  id: 'user-001',
  role: 'ra-lead',
  organizationId: 'org-001',
};

vi.mock('@/lib/auth/with-permission', () => ({
  withPermission: vi.fn(
    (
      _action: string,
      handler: (req: Request, ctx: unknown, session: unknown) => Promise<Response>,
    ) =>
      (req: Request, ctx: unknown) =>
        handler(req, ctx, { user: sessionUser }),
  ),
}));

// --- Mock db: queued select results (department lookup + workflowRuns lookup) ---
// Each db.select() call pops the next array from selectResults.
const selectResults: unknown[][] = [];

function makeSelectChain(rows: unknown[]) {
  return {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue(rows),
  };
}

const mockDb = {
  select: vi.fn(() => makeSelectChain(selectResults.shift() ?? [])),
};

vi.mock('@/lib/db/client', () => ({ db: mockDb }));

// --- Mock audit ---
vi.mock('@/lib/audit', () => ({
  writeAudit: vi.fn().mockResolvedValue(undefined),
}));

// --- Mock predicate-permissions (mutable: tests flip for 403 department branch) ---
const canExportComparisonsMock = vi.fn();
vi.mock('@/lib/auth/predicate-permissions', () => ({
  canExportComparisons: (...a: unknown[]) => canExportComparisonsMock(...a),
}));

// --- Mock @react-pdf/renderer (avoid real PDF rendering in unit tests) ---
vi.mock('@react-pdf/renderer', () => ({
  Document: function Document() {},
  Page: function Page() {},
  StyleSheet: { create: (s: unknown) => s },
  Text: function Text() {},
  View: function View() {},
  renderToBuffer: vi.fn().mockResolvedValue(Buffer.from('fake-pdf-content')),
}));

// --- Mock docx (avoid real DOCX rendering in unit tests) ---
vi.mock('docx', () => {
  class Stub {
    [k: string]: unknown;
  }
  return {
    AlignmentType: { CENTER: 'center' },
    Document: Stub,
    HeadingLevel: { HEADING_1: 'heading1' },
    Packer: { toBuffer: vi.fn().mockResolvedValue(Buffer.from('fake-docx-content')) },
    Paragraph: Stub,
    Table: Stub,
    TableCell: Stub,
    TableRow: Stub,
    TextRun: Stub,
    WidthType: { PERCENTAGE: 'pct' },
  };
});

// --- Helpers ---
function makePostRequest(body: unknown): Request {
  return new Request('http://localhost/api/ra/predicate/export', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

const VALID_BODY = { workflow_run_id: 'run-001', format: 'pdf' as const };

// A saved comparison fixture matching PredicateComparison shape.
const COMPARISON_FIXTURE = {
  subject_device_name: 'CardioFlow X1',
  selected_predicates: [
    { k_number: 'K123456', device_name: 'PredDevice A', applicant_name: 'Acme' },
  ],
  cells: [
    {
      dimension: 'intended_use',
      subject_text: 'Subject intended use text',
      predicate_texts: ['Predicate intended use text'],
      approved: [true],
    },
  ],
  created_at: new Date('2026-01-01'),
};

// A workflow run row matching the select shape in the route.
const WORKFLOW_RUN_ROW = {
  id: 'run-001',
  userId: 'user-001',
  workflowType: 'predicate_comparison',
  resultJson: COMPARISON_FIXTURE,
};

describe('POST /api/ra/predicate/export — handler surface', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionUser = { id: 'user-001', role: 'ra-lead', organizationId: 'org-001' };
    selectResults.length = 0;
    canExportComparisonsMock.mockReturnValue(true);
  });

  it('returns 200 with PDF content-type and attachment disposition', async () => {
    selectResults.push([{ department: 'RA' }]); // getDepartment
    selectResults.push([WORKFLOW_RUN_ROW]); // workflowRuns select

    const { POST } = await import('@/app/api/ra/predicate/export/route');
    const res = await POST(makePostRequest(VALID_BODY), {});

    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('application/pdf');
    expect(res.headers.get('Content-Disposition')).toBe(
      'attachment; filename="predicate-comparison-run-001.pdf"',
    );
    const buf = await res.arrayBuffer();
    expect(new Uint8Array(buf)).toEqual(new Uint8Array(Buffer.from('fake-pdf-content')));
  });

  it('returns 200 with DOCX content-type when format=docx', async () => {
    selectResults.push([{ department: 'Dev' }]);
    selectResults.push([WORKFLOW_RUN_ROW]);

    const { POST } = await import('@/app/api/ra/predicate/export/route');
    const res = await POST(makePostRequest({ workflow_run_id: 'run-001', format: 'docx' }), {});

    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe(
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    );
    expect(res.headers.get('Content-Disposition')).toContain('.docx');
  });

  it('writes predicate_comparison_exported audit row', async () => {
    selectResults.push([{ department: 'RA' }]);
    selectResults.push([WORKFLOW_RUN_ROW]);
    const { writeAudit } = await import('@/lib/audit');
    vi.mocked(writeAudit).mockClear();

    const { POST } = await import('@/app/api/ra/predicate/export/route');
    await POST(makePostRequest(VALID_BODY), {});

    expect(vi.mocked(writeAudit)).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'predicate_comparison_exported',
        actor_id: 'user-001',
        resource_type: 'predicate_comparison',
        resource_id: 'run-001',
        meta_json: { format: 'pdf' },
      }),
    );
  });

  it('returns 400 on invalid JSON body', async () => {
    const { POST } = await import('@/app/api/ra/predicate/export/route');
    const res = await POST(makePostRequest('not-json'), {});

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('Invalid JSON');
  });

  it('returns 400 when workflow_run_id is missing', async () => {
    const { POST } = await import('@/app/api/ra/predicate/export/route');
    const res = await POST(makePostRequest({ format: 'pdf' }), {});

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('Validation failed');
  });

  it('returns 400 when format is not pdf or docx', async () => {
    const { POST } = await import('@/app/api/ra/predicate/export/route');
    const res = await POST(makePostRequest({ workflow_run_id: 'run-001', format: 'html' }), {});

    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('Validation failed');
  });

  it('returns 403 permission_denied when department is not RA/Dev (REQ-PRE-029)', async () => {
    canExportComparisonsMock.mockReturnValue(false);
    selectResults.push([{ department: 'QA' }]); // getDepartment still called

    const { POST } = await import('@/app/api/ra/predicate/export/route');
    const res = await POST(makePostRequest(VALID_BODY), {});

    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body).toMatchObject({ error: 'permission_denied', reason: 'department' });
  });

  it('returns 404 when workflow run does not exist', async () => {
    selectResults.push([{ department: 'RA' }]);
    selectResults.push([]); // no workflow run found

    const { POST } = await import('@/app/api/ra/predicate/export/route');
    const res = await POST(makePostRequest(VALID_BODY), {});

    expect(res.status).toBe(404);
    expect((await res.json()).error).toBe('Not Found');
  });

  it('returns 404 when workflowType is not predicate_comparison', async () => {
    selectResults.push([{ department: 'RA' }]);
    selectResults.push([{ ...WORKFLOW_RUN_ROW, workflowType: 'device_classification' }]);

    const { POST } = await import('@/app/api/ra/predicate/export/route');
    const res = await POST(makePostRequest(VALID_BODY), {});

    expect(res.status).toBe(404);
  });

  it('returns 404 when resultJson is null', async () => {
    selectResults.push([{ department: 'RA' }]);
    selectResults.push([{ ...WORKFLOW_RUN_ROW, resultJson: null }]);

    const { POST } = await import('@/app/api/ra/predicate/export/route');
    const res = await POST(makePostRequest(VALID_BODY), {});

    expect(res.status).toBe(404);
  });

  it('returns 403 permission_denied ownership when run belongs to another user (REQ-PRE-014)', async () => {
    selectResults.push([{ department: 'RA' }]);
    selectResults.push([{ ...WORKFLOW_RUN_ROW, userId: 'other-user-002' }]);

    const { POST } = await import('@/app/api/ra/predicate/export/route');
    const res = await POST(makePostRequest(VALID_BODY), {});

    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body).toMatchObject({ error: 'permission_denied', reason: 'ownership' });
  });

  it('handles null department from missing user row (getDepartment returns null)', async () => {
    // User row exists but department is null → canExportComparisons(null) returns false → 403
    canExportComparisonsMock.mockReturnValue(false);
    selectResults.push([{ department: null }]);

    const { POST } = await import('@/app/api/ra/predicate/export/route');
    const res = await POST(makePostRequest(VALID_BODY), {});

    expect(res.status).toBe(403);
    expect(canExportComparisonsMock).toHaveBeenCalledWith(null);
  });
});
