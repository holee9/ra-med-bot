// @vitest-environment node
// @MX:NOTE [AUTO] TDD unit tests — predicate comparison export Route Handler.
// @MX:SPEC SPEC-REGULA-PREDICATE-001 (REQ-PRE-014, REQ-PRE-015)
//
// Covers: POST export (PDF + DOCX generation, REQ-PRE-014 disclaimer on the
// first page, department RBAC RA/Dev allow / External deny, ownership gate,
// format/id/workflow_type validation). A real render is performed so the file
// signature bytes (%PDF- / PK\x03\x04) and the disclaimer text are verified
// against the actual generated buffers.

import { inflateRawSync, inflateSync } from 'node:zlib';
import type { ComparisonDimension, PredicateComparison } from '@/lib/predicate/types';
import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Extract a single entry from a ZIP buffer by scanning local file headers.
 * Supports stored (method 0) and raw-DEFLATE (method 8) entries, which covers
 * the OOXML archives produced by the `docx` package. Returns the entry text.
 */
function extractZipEntry(zip: Buffer, name: string): string {
  let offset = 0;
  while (offset + 30 <= zip.length) {
    // Local file header signature: PK\x03\x04 (0x04034b50, little-endian).
    if (zip.readUInt32LE(offset) !== 0x04034b50) break;
    const method = zip.readUInt16LE(offset + 8);
    const compSize = zip.readUInt32LE(offset + 18);
    const nameLen = zip.readUInt16LE(offset + 26);
    const extraLen = zip.readUInt16LE(offset + 28);
    const entryName = zip.subarray(offset + 30, offset + 30 + nameLen).toString('latin1');
    const dataStart = offset + 30 + nameLen + extraLen;
    const data = zip.subarray(dataStart, dataStart + compSize);
    if (entryName === name) {
      return method === 0 ? data.toString('utf8') : inflateRawSync(data).toString('utf8');
    }
    offset = dataStart + compSize;
  }
  throw new Error(`ZIP entry not found: ${name}`);
}

/**
 * Recover readable text from a PDF. @react-pdf compresses content streams with
 * FlateDecode and emits glyph runs as hex strings inside TJ/Tj operands
 * (e.g. `<546869>` → "Thi"), interspersed with kerning numbers. This inflates
 * every stream, then decodes the `<hex>` tokens and concatenates them so phrase
 * searches work across the kerning splits.
 */
function decodePdfStreams(pdf: Buffer): string {
  const text = pdf.toString('latin1');
  const inflated: string[] = [];
  for (const match of text.matchAll(/stream\r?\n/g)) {
    const start = (match.index ?? 0) + match[0].length;
    const end = text.indexOf('endstream', start);
    if (end === -1) continue;
    const raw = pdf.subarray(start, end);
    try {
      inflated.push(inflateSync(raw).toString('latin1'));
    } catch {
      try {
        inflated.push(inflateRawSync(raw).toString('latin1'));
      } catch {
        inflated.push(raw.toString('latin1'));
      }
    }
  }
  // Within each TJ array, decode the <hex> glyph runs and drop the kerning
  // numbers/brackets that separate them, so adjacent runs concatenate into the
  // original words (e.g. `<53> 0 <75627374...>` → "Substantial").
  return inflated.join('\n').replace(/\[([^\]]*)\]\s*TJ/g, (_full, arr: string) => {
    const runs = arr.match(/<([0-9a-fA-F]+)>/g) ?? [];
    return runs
      .map((tok) => {
        const hex = tok.slice(1, -1);
        const even = hex.length % 2 === 0 ? hex : `${hex}0`;
        return Buffer.from(even, 'hex').toString('latin1');
      })
      .join('');
  });
}

// --- Mock withPermission: pass-through with an injectable session ---
// Department lives on users.department, NOT on the session — the route fetches
// it from the DB. A mutable holder lets each test set the returned department.
let currentDepartment: 'RA' | 'Dev' | 'Exec' | 'External' | null = 'RA';

vi.mock('@/lib/auth/with-permission', () => ({
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

// --- Mock db: department lookup + workflow_runs row fetch ---
// `db.select(...)` runs twice in the export handler: first the department
// lookup ([{ department }]), then the workflow_runs row fetch. A per-handler
// call counter disambiguates, mirroring the comparison route test harness.
let storedRow: Record<string, unknown> | null = null;

vi.mock('@/lib/db/client', () => {
  const departmentChain = () => ({
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn(async () => [{ department: currentDepartment }]),
  });

  // workflow_runs row fetch: .select().from().where().limit() → [row] | []
  const rowChain = () => ({
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn(async () => (storedRow ? [storedRow] : [])),
  });

  let selectCall = 0;
  return {
    __resetSelect: () => {
      selectCall = 0;
    },
    db: {
      select: vi.fn(() => {
        const call = selectCall;
        selectCall += 1;
        // First select() in the handler is the department lookup.
        return call === 0 ? departmentChain() : rowChain();
      }),
    },
  };
});

// --- Mock audit (export is auditable but the assertion focus is the file) ---
interface AuditEventArg {
  action: string;
  actor_id: string | null;
  resource_type: string;
  resource_id: string;
  meta_json: Record<string, unknown>;
}
const writeAuditMock = vi.fn<[AuditEventArg], Promise<void>>(async () => {});
vi.mock('@/lib/audit', () => ({
  writeAudit: (arg: AuditEventArg) => writeAuditMock(arg),
}));

function fakeComparison(): PredicateComparison {
  return {
    subject_device_name: 'Infusion Pump',
    selected_predicates: [
      {
        k_number: 'K123456',
        applicant_name: 'Acme Medical',
        device_name: 'Acme Pump 2000',
        decision_date: '2020-01-01',
        decision: 'SESE',
        product_code: 'FRN',
        statement_or_summary: '',
        device_description: '',
      },
    ],
    cells: (
      [
        'intended_use',
        'indications',
        'tech_characteristics',
        'materials',
        'performance',
      ] as ComparisonDimension[]
    ).map((dimension) => ({
      dimension,
      subject_text: `subject ${dimension}`,
      predicate_texts: [`predicate ${dimension}`],
      approved: [true],
    })),
    created_at: new Date('2026-01-01T00:00:00Z'),
  };
}

function storedWorkflowRun(over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'wfr-001',
    userId: 'user-001',
    workflowType: 'predicate_comparison',
    resultJson: { ...fakeComparison(), selected_predicate_knumbers: ['K123456'] },
    ...over,
  };
}

const dbModule = (await import('@/lib/db/client')) as unknown as {
  __resetSelect: () => void;
};
const { POST } = await import('@/app/api/ra/predicate/export/route');

function postReq(body: unknown): Request {
  return new Request('http://localhost/api/ra/predicate/export', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

const DISCLAIMER_PHRASE = 'Substantial equivalence';

beforeEach(() => {
  vi.clearAllMocks();
  currentDepartment = 'RA';
  storedRow = storedWorkflowRun();
  dbModule.__resetSelect();
});

describe('POST /api/ra/predicate/export — PDF (REQ-PRE-015)', () => {
  it('returns 200 with a valid PDF for an RA user', async () => {
    const res = await POST(postReq({ workflow_run_id: 'wfr-001', format: 'pdf' }), {});
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('application/pdf');
    expect(res.headers.get('Content-Disposition')).toContain(
      'attachment; filename="predicate-comparison-wfr-001.pdf"',
    );

    const buf = Buffer.from(await res.arrayBuffer());
    // Valid PDF files begin with the %PDF- signature.
    expect(buf.subarray(0, 5).toString('latin1')).toBe('%PDF-');
  });

  it('embeds the REQ-PRE-014 disclaimer text in the PDF', async () => {
    const res = await POST(postReq({ workflow_run_id: 'wfr-001', format: 'pdf' }), {});
    const buf = Buffer.from(await res.arrayBuffer());
    // @react-pdf compresses content streams with FlateDecode, so the disclaimer
    // is not in the raw bytes. Inflate every stream and search the decoded text
    // (the phrase appears as Tj operands, one glyph run per word).
    const decoded = decodePdfStreams(buf);
    expect(decoded).toContain(DISCLAIMER_PHRASE);
  });
});

describe('POST /api/ra/predicate/export — DOCX (REQ-PRE-015)', () => {
  it('returns 200 with a valid DOCX for an RA user', async () => {
    const res = await POST(postReq({ workflow_run_id: 'wfr-001', format: 'docx' }), {});
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe(
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    );
    expect(res.headers.get('Content-Disposition')).toContain(
      'attachment; filename="predicate-comparison-wfr-001.docx"',
    );

    const buf = Buffer.from(await res.arrayBuffer());
    // DOCX is a ZIP (OOXML); valid archives begin with the PK\x03\x04 signature.
    expect(buf[0]).toBe(0x50);
    expect(buf[1]).toBe(0x4b);
    expect(buf[2]).toBe(0x03);
    expect(buf[3]).toBe(0x04);
  });

  it('embeds the REQ-PRE-014 disclaimer text in the DOCX', async () => {
    const res = await POST(postReq({ workflow_run_id: 'wfr-001', format: 'docx' }), {});
    const buf = Buffer.from(await res.arrayBuffer());
    // The DOCX zip stores word/document.xml with raw DEFLATE. Extract it via a
    // minimal local-file-header scan + zlib.inflateRawSync (Node stdlib only).
    const docXml = extractZipEntry(buf, 'word/document.xml');
    expect(docXml).toContain(DISCLAIMER_PHRASE);
  });
});

describe('POST /api/ra/predicate/export — authorization', () => {
  it('denies an External-department user with 403', async () => {
    currentDepartment = 'External';
    const res = await POST(postReq({ workflow_run_id: 'wfr-001', format: 'pdf' }), {});
    expect(res.status).toBe(403);
  });

  it('denies an Exec-department user with 403 (read-only)', async () => {
    currentDepartment = 'Exec';
    const res = await POST(postReq({ workflow_run_id: 'wfr-001', format: 'pdf' }), {});
    expect(res.status).toBe(403);
  });

  it("denies exporting another user's comparison with 403 (REQ-PRE-014 ownership)", async () => {
    storedRow = storedWorkflowRun({ userId: 'user-999' });
    const res = await POST(postReq({ workflow_run_id: 'wfr-001', format: 'pdf' }), {});
    expect(res.status).toBe(403);
  });
});

describe('POST /api/ra/predicate/export — validation', () => {
  it('rejects an invalid format with 400', async () => {
    const res = await POST(postReq({ workflow_run_id: 'wfr-001', format: 'xlsx' }), {});
    expect(res.status).toBe(400);
  });

  it('rejects a missing workflow_run_id with 400', async () => {
    const res = await POST(postReq({ format: 'pdf' }), {});
    expect(res.status).toBe(400);
  });

  it('returns 404 for an unknown workflow_run_id', async () => {
    storedRow = null;
    const res = await POST(postReq({ workflow_run_id: 'missing', format: 'pdf' }), {});
    expect(res.status).toBe(404);
  });

  it('returns 404 when the run is not a predicate_comparison', async () => {
    storedRow = storedWorkflowRun({ workflowType: 'something_else' });
    const res = await POST(postReq({ workflow_run_id: 'wfr-001', format: 'pdf' }), {});
    expect(res.status).toBe(404);
  });
});
