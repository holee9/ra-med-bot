// @MX:NOTE [AUTO] Integration test: admin document upload pipeline.
// @MX:SPEC SPEC-REGULA-QUALITY-001 (REQ-QUAL-015..019)
//
// Exercises the synchronous ingest route end-to-end with mocked external
// dependencies (auth session, OpenAI embeddings, audit log, db inserts).
// We assert the *contract* of the route — RBAC, validation, and pipeline
// ordering — without requiring a live Postgres or OpenAI key.

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks. Hoisted via vi.mock so the route module sees them on import.
// ---------------------------------------------------------------------------

const authMock = vi.fn();
vi.mock('@/lib/kernel/auth', () => ({ auth: () => authMock() }));

vi.mock('@/lib/kernel/auth/acl', () => ({
  isOrgMember: vi.fn(async () => true),
  isProjectMember: vi.fn(async () => true),
}));

const writeAuditMock = vi.fn(async () => {});
vi.mock('@/lib/kernel/audit', () => ({ writeAudit: writeAuditMock }));

// C-1: upload route now requires a pre-registered licensed sourceId. Mock the
// license gate to allow ingestion so the e2e suite exercises the post-gate
// extract/chunk/embed/persist path (the gate's domain logic is covered in
// tests/integration/corpus-license.test.ts).
vi.mock('@/lib/corpus-license/license-gate', () => ({
  assertIngestionLicensed: vi.fn(async () => ({ allowed: true, licenseType: 'internal_sop' })),
}));

const insertedSources: unknown[] = [];
const insertedSections: unknown[] = [];

vi.mock('@/lib/kernel/db/client', () => {
  // Drizzle's `await db.insert(t).values(rows)` resolves directly, while
  // `db.insert(t).values(rows).returning(...)` resolves to the inserted rows.
  // We extend a Promise instance with a `returning` method so both shapes work
  // without exposing a literal `then` property on a plain object (biome
  // noThenProperty).
  type InsertResult = Promise<undefined> & {
    returning: () => Promise<Array<{ id: string }>>;
  };
  type MockDbClient = {
    transaction: <T>(fn: (tx: MockDbClient) => Promise<T>) => Promise<T>;
    insert: (_table: unknown) => { values: (rows: unknown) => InsertResult };
  };
  const client: MockDbClient = {
    transaction: async <T>(fn: (tx: MockDbClient) => Promise<T>): Promise<T> => fn(client),
    insert: (_table: unknown) => ({
      values(rows: unknown) {
        const promise = Promise.resolve().then(() => {
          insertedSections.push(rows);
          return undefined;
        });
        const withReturning = promise as InsertResult;
        withReturning.returning = () => {
          insertedSources.push(rows);
          return Promise.resolve([{ id: `src-${insertedSources.length}` }]);
        };
        return withReturning;
      },
    }),
  };
  return { db: client };
});

const embedChunksMock = vi.fn(async (texts: string[]) => texts.map(() => Array(1536).fill(0.01)));
vi.mock('@/lib/ingest/embed', () => ({ embedChunks: embedChunksMock }));

// Stub out the extractor so the test doesn't pull in pdf-parse / mammoth /
// xlsx — we only ever exercise text/plain in this suite.
vi.mock('@/lib/ingest/extract', () => ({
  SUPPORTED_MIME_TYPES: [
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/zip',
  ],
  extractText: vi.fn(async (buf: Buffer) => buf.toString('utf8')),
}));

// ---------------------------------------------------------------------------
// Helpers.
// ---------------------------------------------------------------------------

const FIXTURE_PATH = path.join(__dirname, '..', 'fixtures', 'sample-regulatory.txt');

function buildFormData(opts: {
  bytes?: Buffer;
  mime?: string;
  docClass?: string;
  filename?: string;
  sourceId?: string;
}): FormData {
  const fd = new FormData();
  const bytes = opts.bytes ?? readFileSync(FIXTURE_PATH);
  const mime = opts.mime ?? 'text/plain';
  fd.append(
    'file',
    new File([new Uint8Array(bytes)], opts.filename ?? 'sample-regulatory.txt', { type: mime }),
  );
  fd.append('docClass', opts.docClass ?? 'internal_sop');
  // C-1: a pre-registered licensed sourceId is required to pass the ingestion gate.
  fd.append('sourceId', opts.sourceId ?? '00000000-0000-4000-8000-000000000001');
  return fd;
}

async function callPost(form: FormData) {
  const mod = await import('@/app/api/ra/admin/documents/upload/route');
  const req = new Request('http://localhost/api/ra/admin/documents/upload', {
    method: 'POST',
    body: form,
  });
  return mod.POST(req, {});
}

// ---------------------------------------------------------------------------
// Tests.
// ---------------------------------------------------------------------------

describe('Document Ingestion E2E (REQ-QUAL-015..019)', () => {
  beforeEach(() => {
    insertedSources.length = 0;
    insertedSections.length = 0;
    writeAuditMock.mockClear();
    embedChunksMock.mockClear();
  });

  afterEach(() => {
    // resetModules clears the cached route module so the next test re-evaluates
    // vi.mock/vi.doUnmock bindings (e.g. workers-ai). Without this, tests after
    // AC5 inherit its doUnmock'd module and the stub stays bound, masking
    // redaction regressions behind RBAC-passing assertions.
    vi.resetModules();
    vi.unstubAllEnvs();
  });

  it('uploads a document and creates source_sections (REQ-QUAL-015)', async () => {
    authMock.mockResolvedValue({
      user: { id: 'user-1', role: 'admin', organizationId: 'org-1' },
    });

    const res = await callPost(buildFormData({}));
    expect(res.status).toBe(201);
    const body = (await res.json()) as { sourceId: string; sectionCount: number };
    // C-1: upload attaches sections to the pre-registered licensed sourceId.
    expect(body.sourceId).toBe('00000000-0000-4000-8000-000000000001');
    expect(body.sectionCount).toBeGreaterThanOrEqual(1);

    expect(embedChunksMock).toHaveBeenCalledOnce();
    // Issue #378: writeAudit now receives the tx handle as its 2nd arg.
    expect(writeAuditMock).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'document.upload' }),
      expect.anything(),
    );
    expect(writeAuditMock).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'document.chunk' }),
      expect.anything(),
    );
  });

  it('returns 403 for non-admin role (REQ-QUAL-018)', async () => {
    authMock.mockResolvedValue({
      user: { id: 'user-2', role: 'ra-member', organizationId: 'org-1' },
    });

    const res = await callPost(buildFormData({}));
    expect(res.status).toBe(403);

    // RBAC denial must be audited (rbac.permission_deny via withPermission).
    expect(writeAuditMock).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'rbac.permission_deny' }),
    );
    // No ingest side-effects on rejection.
    expect(insertedSources).toHaveLength(0);
    expect(embedChunksMock).not.toHaveBeenCalled();
  });

  it('returns 401 when unauthenticated', async () => {
    authMock.mockResolvedValue(null);
    const res = await callPost(buildFormData({}));
    expect(res.status).toBe(401);
  });

  it('rejects oversized file with 413 (REQ-QUAL-019)', async () => {
    vi.stubEnv('UPDATE_MAX_BYTES', undefined as unknown as string);
    vi.stubEnv('UPLOAD_MAX_BYTES', '1024'); // 1KB cap for this case
    authMock.mockResolvedValue({
      user: { id: 'user-1', role: 'admin', organizationId: 'org-1' },
    });

    // Re-import after env stub so the cap re-evaluates.
    vi.resetModules();
    const big = Buffer.alloc(2048, 0x41);
    const res = await callPost(buildFormData({ bytes: big }));
    expect(res.status).toBe(413);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe('file_too_large');
    expect(insertedSources).toHaveLength(0);
  });

  it('rejects unsupported MIME with 415 (REQ-QUAL-019)', async () => {
    authMock.mockResolvedValue({
      user: { id: 'user-1', role: 'admin', organizationId: 'org-1' },
    });
    vi.resetModules();
    const res = await callPost(
      buildFormData({ mime: 'application/x-msdownload', filename: 'malware.exe' }),
    );
    expect(res.status).toBe(415);
    expect(insertedSources).toHaveLength(0);
  });

  it('rejects invalid docClass with 400', async () => {
    authMock.mockResolvedValue({
      user: { id: 'user-1', role: 'admin', organizationId: 'org-1' },
    });
    vi.resetModules();
    const res = await callPost(buildFormData({ docClass: 'not_a_real_class' }));
    expect(res.status).toBe(400);
  });

  it('returns 422 when PII guard triggers in embedding stage', async () => {
    authMock.mockResolvedValue({
      user: { id: 'user-1', role: 'admin', organizationId: 'org-1' },
    });
    embedChunksMock.mockRejectedValueOnce(new Error('PII guard triggered: SSN pattern detected'));
    vi.resetModules();
    const res = await callPost(buildFormData({}));
    expect(res.status).toBe(422);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe('pii_detected');
    // No partial inserts — transaction never reached.
    expect(insertedSources).toHaveLength(0);
  });
});
