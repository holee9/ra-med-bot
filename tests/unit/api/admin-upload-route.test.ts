// @MX:NOTE [AUTO] Route tests for POST /api/ra/admin/documents/upload (coverage 402, SPEC-REGULA-QUALITY-001).
// @MX:SPEC SPEC-REGULA-QUALITY-001 (REQ-QUAL-015..019)
// @MX:TODO Deep ingest pipeline (chunk/embed/extract edge cases) covered by lib/ingest/*.test.ts.
//   These tests exercise the route handler surface: auth passthrough, multipart
//   parsing, RBAC license gate, size/MIME validation, audit-in-transaction,
//   201 response shape, and the license-gate denial branch.

import { beforeEach, describe, expect, it, vi } from 'vitest';

// --- Mutable session ---
let sessionUser: {
  id: string;
  role: string;
  organizationId: string | null;
} = {
  id: 'user-001',
  role: 'admin',
  organizationId: 'org-001',
};

vi.mock('@/lib/kernel/auth/with-permission', () => ({
  withPermission: vi.fn(
    (
      _action: string,
      handler: (req: Request, ctx: unknown, session: unknown) => Promise<Response>,
    ) =>
      (req: Request, ctx: unknown) =>
        handler(req, ctx, { user: sessionUser }),
  ),
}));

// --- Mock db: transaction with insert chain (sourceSections INSERT) ---
const mockInsertChain = {
  values: vi.fn().mockReturnThis(),
};

const mockDb = {
  transaction: vi.fn(async (cb: (tx: unknown) => Promise<unknown>) =>
    cb({ insert: vi.fn(() => mockInsertChain) }),
  ),
};

vi.mock('@/lib/kernel/db/client', () => ({ db: mockDb }));

// --- Mock audit ---
vi.mock('@/lib/kernel/audit', () => ({
  writeAudit: vi.fn().mockResolvedValue(undefined),
}));

// --- Mock ingest deps ---
const chunkMock = vi.fn();
vi.mock('@/lib/ingest/chunkers', () => ({
  chunk: (...a: unknown[]) => chunkMock(...a),
}));

const embedChunksMock = vi.fn();
vi.mock('@/lib/ingest/embed', () => ({
  embedChunks: (...a: unknown[]) => embedChunksMock(...a),
}));

const extractTextMock = vi.fn();
vi.mock('@/lib/ingest/extract', () => ({
  SUPPORTED_MIME_TYPES: ['application/pdf'],
  extractText: (...a: unknown[]) => extractTextMock(...a),
}));

// --- Mock dynamic-import deps (license-gate + review-workflow) ---
// These are loaded via `await import(...)` inside the route, so they must also
// be registered via vi.mock for the module system to intercept.
const assertIngestionLicensedMock = vi.fn();
vi.mock('@/lib/corpus-license/license-gate', () => ({
  assertIngestionLicensed: (...a: unknown[]) => assertIngestionLicensedMock(...a),
}));

const setPendingReviewOnIngestMock = vi.fn();
vi.mock('@/lib/source-governance/review-workflow', () => ({
  setPendingReviewOnIngest: (...a: unknown[]) => setPendingReviewOnIngestMock(...a),
}));

// --- Helpers ---
function makeUploadRequest(
  opts: {
    fileContent?: string;
    fileName?: string;
    mimeType?: string;
    docClass?: string;
    sourceId?: string | null;
  } = {},
): Request {
  const {
    fileContent = 'This is a test document with sufficient content for chunking.',
    fileName = 'test.pdf',
    mimeType = 'application/pdf',
    docClass = 'clinical_report',
    sourceId = 'src-001',
  } = opts;

  const form = new FormData();
  const file = new File([fileContent], fileName, { type: mimeType });
  form.append('file', file);
  form.append('docClass', docClass);
  if (sourceId !== null) {
    form.append('sourceId', sourceId);
  }
  return new Request('http://localhost/api/ra/admin/documents/upload', {
    method: 'POST',
    body: form,
  });
}

const CHUNK_FIXTURE = [{ text: 'chunk-one content', metadata: { sectionPath: 'intro' } }];

const EMBEDDING_FIXTURE = [[0.1, 0.2, 0.3]];

describe('POST /api/ra/admin/documents/upload — handler surface', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionUser = { id: 'user-001', role: 'admin', organizationId: 'org-001' };
    chunkMock.mockReturnValue(CHUNK_FIXTURE);
    embedChunksMock.mockResolvedValue(EMBEDDING_FIXTURE);
    extractTextMock.mockResolvedValue('Extracted PDF text content with enough length.');
    assertIngestionLicensedMock.mockResolvedValue({ allowed: true });
    setPendingReviewOnIngestMock.mockResolvedValue(undefined);
  });

  it('returns 201 with sourceId + sectionCount on valid upload', async () => {
    const { POST } = await import('@/app/api/ra/admin/documents/upload/route');
    const res = await POST(makeUploadRequest(), {});

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body).toMatchObject({
      sourceId: 'src-001',
      sectionCount: 1,
    });
    expect(mockDb.transaction).toHaveBeenCalled();
    expect(chunkMock).toHaveBeenCalled();
    expect(embedChunksMock).toHaveBeenCalled();
  });

  it('writes document.upload + document.chunk audit inside transaction', async () => {
    const { writeAudit } = await import('@/lib/kernel/audit');
    const { POST } = await import('@/app/api/ra/admin/documents/upload/route');
    await POST(makeUploadRequest(), {});

    const auditCalls = vi.mocked(writeAudit).mock.calls;
    const actions = auditCalls.map((c) => (c[0] as { action: string }).action);
    expect(actions).toContain('document.upload');
    expect(actions).toContain('document.chunk');
    // Both audit rows must ride the transaction (tx arg present).
    for (const call of auditCalls) {
      expect(call[1]).toBeDefined();
    }
  });

  it('returns 400 file_missing when no file in multipart payload', async () => {
    const form = new FormData();
    form.append('docClass', 'clinical_report');
    form.append('sourceId', 'src-001');
    const req = new Request('http://localhost/api/ra/admin/documents/upload', {
      method: 'POST',
      body: form,
    });

    const { POST } = await import('@/app/api/ra/admin/documents/upload/route');
    const res = await POST(req, {});

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('file_missing');
  });

  it('returns 400 docClass_invalid when docClass is not a valid enum value', async () => {
    const { POST } = await import('@/app/api/ra/admin/documents/upload/route');
    const res = await POST(makeUploadRequest({ docClass: 'not-a-real-class' }), {});

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('docClass_invalid');
  });

  it('returns 400 no_licensed_source when sourceId is absent', async () => {
    const { writeAudit } = await import('@/lib/kernel/audit');
    const { POST } = await import('@/app/api/ra/admin/documents/upload/route');
    const res = await POST(makeUploadRequest({ sourceId: null }), {});

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('no_licensed_source');
    // Ingestion-blocked audit should fire (REQ-003 corpus gate).
    const auditCalls = vi.mocked(writeAudit).mock.calls;
    const actions = auditCalls.map((c) => (c[0] as { action: string }).action);
    expect(actions).toContain('corpus.ingestion_blocked');
    // Should short-circuit BEFORE chunking/embedding.
    expect(chunkMock).not.toHaveBeenCalled();
  });

  it('returns 403 ingestion_license_blocked when license gate denies', async () => {
    assertIngestionLicensedMock.mockResolvedValue({
      allowed: false,
      reason: 'license expired',
      licenseType: 'paid_standard',
    });

    const { POST } = await import('@/app/api/ra/admin/documents/upload/route');
    const res = await POST(makeUploadRequest(), {});

    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body).toMatchObject({
      error: 'ingestion_license_blocked',
      reason: 'license expired',
      licenseType: 'paid_standard',
    });
    expect(chunkMock).not.toHaveBeenCalled();
  });

  it('returns 415 unsupported_mime when MIME type is not allowed', async () => {
    const { POST } = await import('@/app/api/ra/admin/documents/upload/route');
    const res = await POST(
      makeUploadRequest({ mimeType: 'application/x-gzip', fileName: 'bad.gz' }),
      {},
    );

    expect(res.status).toBe(415);
    const body = await res.json();
    expect(body.error).toBe('unsupported_mime');
  });

  it('returns 413 file_too_large when file exceeds UPLOAD_MAX_BYTES (10MB default)', async () => {
    // MAX_UPLOAD_BYTES is evaluated at module load (IIFE) from process.env, so
    // stubbing env post-import won't re-evaluate. Instead, build a file just
    // over the 10MB (10 * 1024 * 1024 = 10485760) default cap.
    const oversized = 'x'.repeat(10 * 1024 * 1024 + 1);

    const { POST } = await import('@/app/api/ra/admin/documents/upload/route');
    const res = await POST(makeUploadRequest({ fileContent: oversized }), {});

    expect(res.status).toBe(413);
    const body = await res.json();
    expect(body.error).toBe('file_too_large');
    expect(body.max_bytes).toBe(10 * 1024 * 1024);
    expect(body.actual_bytes).toBe(10 * 1024 * 1024 + 1);
  });

  it('returns 422 empty_document when extracted text is blank', async () => {
    chunkMock.mockReturnValue([]); // empty chunks → chunking_produced_empty
    // Actually test the empty-text path: chunk returns empty when text is blank.
    // The route checks rawText.trim().length === 0 BEFORE chunking, so an
    // all-whitespace text/plain file triggers 422 empty_document.

    const { POST } = await import('@/app/api/ra/admin/documents/upload/route');
    const res = await POST(
      makeUploadRequest({
        fileContent: '   \n\n  ',
        mimeType: 'text/plain',
        fileName: 'blank.txt',
      }),
      {},
    );

    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error).toBe('empty_document');
  });

  it('returns 422 chunking_produced_empty when chunker yields zero chunks', async () => {
    chunkMock.mockReturnValue([]);

    const { POST } = await import('@/app/api/ra/admin/documents/upload/route');
    const res = await POST(makeUploadRequest(), {});

    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error).toBe('chunking_produced_empty');
  });

  it('returns 502 embedding_failed when embedChunks throws non-PII error', async () => {
    embedChunksMock.mockRejectedValue(new Error('embedding service unavailable'));

    const { POST } = await import('@/app/api/ra/admin/documents/upload/route');
    const res = await POST(makeUploadRequest(), {});

    expect(res.status).toBe(502);
    const body = await res.json();
    expect(body.error).toBe('embedding_failed');
  });

  it('returns 422 pii_detected when embedChunks throws PII guard error', async () => {
    embedChunksMock.mockRejectedValue(new Error('PII guard triggered: SSN detected'));

    const { POST } = await import('@/app/api/ra/admin/documents/upload/route');
    const res = await POST(makeUploadRequest(), {});

    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error).toBe('pii_detected');
  });

  it('accepts text/plain without calling extractText (inline path)', async () => {
    const { POST } = await import('@/app/api/ra/admin/documents/upload/route');
    const res = await POST(
      makeUploadRequest({
        mimeType: 'text/plain',
        fileName: 'notes.txt',
        fileContent: 'Inline text/plain content for the inline extraction path.',
      }),
      {},
    );

    expect(res.status).toBe(201);
    expect(extractTextMock).not.toHaveBeenCalled();
  });

  it('skips license gate when session has no organizationId (no-op branch)', async () => {
    sessionUser = { id: 'user-001', role: 'admin', organizationId: null };

    const { POST } = await import('@/app/api/ra/admin/documents/upload/route');
    const res = await POST(makeUploadRequest(), {});

    // License gate import is conditional on organizationId being set; with null
    // the gate is skipped, pipeline proceeds to 201.
    expect(res.status).toBe(201);
    expect(assertIngestionLicensedMock).not.toHaveBeenCalled();
  });
});
