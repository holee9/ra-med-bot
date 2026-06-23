// @MX:NOTE [AUTO] AC-07 / REQ-PMS-009 server-side expert-review gating tests.
// @MX:SPEC SPEC-REGULA-PMS-001 (REQ-PMS-009, REQ-PMS-010, AC-07)
//
// Validates that the close route enforces expert-review gating server-side,
// preventing API-direct bypass of the UI gate. Documents in draft or
// pending_review status MUST be rejected with 403. Reviewed documents are
// allowed to close.
//
// Strategy (same as pms-idor-runtime.test.ts):
//   1. Mock @/lib/auth/with-permission — bypass auth, inject session.
//   2. Mock @/lib/db/client — in-memory store with controllable review_status.
//   3. Mock @/lib/audit — record writeAudit calls.
//   4. Call the REAL close route handler with various review statuses.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type Row = Record<string, unknown>;

// ---------------------------------------------------------------------------
// In-memory DB mock — controllable pms_documents rows.
// ---------------------------------------------------------------------------

let mockDocumentRow: Row | null = null;
const updateCalls: Array<{ documentId: string; set: Row }> = [];

interface SelectChain extends Promise<Row[]> {
  from: ReturnType<typeof vi.fn<[], SelectChain>>;
  where: ReturnType<typeof vi.fn<[], SelectChain>>;
  limit: ReturnType<typeof vi.fn<[number?], Promise<Row[]>>>;
}

const makeSelectChain = (rows: Row[]): SelectChain => {
  const promise = Promise.resolve(rows) as unknown as SelectChain;
  promise.from = vi.fn(() => makeSelectChain(rows));
  promise.where = vi.fn(() => makeSelectChain(rows));
  promise.limit = vi.fn(async () => rows);
  return promise;
};

// Explicit DbMock type breaks the `fn(dbMock)` self-reference that otherwise
// triggers TS7022/TS7024 (implicit any on dbMock and the transaction callback).
interface DbMock {
  select: () => SelectChain;
  transaction: (fn: (tx: DbMock) => Promise<unknown>) => Promise<unknown>;
  update: () => {
    set: (setValues: Row) => {
      where: () => { returning: () => Promise<unknown[]> };
    };
  };
}

const dbMock: DbMock = {
  select: vi.fn(() => makeSelectChain(mockDocumentRow ? [mockDocumentRow] : [])),
  transaction: vi.fn(async (fn: (tx: DbMock) => Promise<unknown>) => fn(dbMock)),
  update: vi.fn(() => ({
    set: vi.fn((setValues: Row) => ({
      where: vi.fn(() => {
        updateCalls.push({ documentId: 'doc-1', set: setValues });
        return { returning: vi.fn(async () => []) };
      }),
    })),
  })),
};

vi.mock('@/lib/db/client', () => ({ db: dbMock }));

// ---------------------------------------------------------------------------
// Audit mock.
// ---------------------------------------------------------------------------

interface AuditRecord {
  action: string;
  resource_id?: string;
}

const auditRecords: AuditRecord[] = [];

vi.mock('@/lib/audit', () => ({
  writeAudit: vi.fn(async (params: AuditRecord) => {
    auditRecords.push({ action: params.action, resource_id: params.resource_id });
  }),
}));

// ---------------------------------------------------------------------------
// withPermission mock — bypass RBAC.
// ---------------------------------------------------------------------------

vi.mock('@/lib/auth/with-permission', () => ({
  withPermission:
    (
      _action: string,
      handler: (req: Request, ctx: unknown, session: unknown) => Promise<Response>,
    ) =>
    async (req: Request, ctx: unknown): Promise<Response> => {
      const session = {
        user: {
          id: 'user-1',
          role: 'ra_lead',
          organizationId: 'org-A',
        },
      };
      return handler(req, ctx, session);
    },
}));

// ---------------------------------------------------------------------------
// Tests.
// ---------------------------------------------------------------------------

const PROJECT_ID = '00000000-0000-0000-0000-000000000001';
const DOCUMENT_ID = '11111111-1111-1111-1111-111111111111';

function setDocumentStatus(reviewStatus: string): void {
  mockDocumentRow = {
    id: DOCUMENT_ID,
    reviewStatus,
    workflowType: 'pms_report',
    orgId: 'org-A',
    projectId: PROJECT_ID,
  };
}

function makeCloseRequest(): Request {
  return new Request(`http://localhost/api/pms/${PROJECT_ID}/documents/${DOCUMENT_ID}/close`, {
    method: 'POST',
  });
}

beforeEach(() => {
  mockDocumentRow = null;
  updateCalls.length = 0;
  auditRecords.length = 0;
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('AC-07 / REQ-PMS-009 server-side expert-review gating', () => {
  it('rejects close with 403 when review_status=draft (REQ-PMS-009 HIGH)', async () => {
    setDocumentStatus('draft');
    const { POST } = await import('@/app/api/pms/[projectId]/documents/[documentId]/close/route');

    const ctx = { params: Promise.resolve({ projectId: PROJECT_ID, documentId: DOCUMENT_ID }) };
    const res = await POST(makeCloseRequest(), ctx);

    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.code).toBe('review_required');
    expect(body.reviewStatus).toBe('draft');
    // No update should have been attempted.
    expect(updateCalls.length).toBe(0);
  });

  it('rejects close with 403 when review_status=pending_review', async () => {
    setDocumentStatus('pending_review');
    const { POST } = await import('@/app/api/pms/[projectId]/documents/[documentId]/close/route');

    const ctx = { params: Promise.resolve({ projectId: PROJECT_ID, documentId: DOCUMENT_ID }) };
    const res = await POST(makeCloseRequest(), ctx);

    expect(res.status).toBe(403);
    expect((await res.json()).code).toBe('review_required');
    expect(updateCalls.length).toBe(0);
  });

  it('writes pms.report_export_denied audit when gating blocks close', async () => {
    setDocumentStatus('draft');
    const { POST } = await import('@/app/api/pms/[projectId]/documents/[documentId]/close/route');

    const ctx = { params: Promise.resolve({ projectId: PROJECT_ID, documentId: DOCUMENT_ID }) };
    await POST(makeCloseRequest(), ctx);

    expect(auditRecords.some((a) => a.action === 'pms.report_export_denied')).toBe(true);
  });

  it('allows close when review_status=approved (reviewed document)', async () => {
    setDocumentStatus('approved');
    const { POST } = await import('@/app/api/pms/[projectId]/documents/[documentId]/close/route');

    const ctx = { params: Promise.resolve({ projectId: PROJECT_ID, documentId: DOCUMENT_ID }) };
    const res = await POST(makeCloseRequest(), ctx);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.reviewStatus).toBe('closed');
    // The update should have set reviewStatus='closed'.
    expect(updateCalls.length).toBe(1);
    expect(updateCalls[0]?.set.reviewStatus).toBe('closed');
  });

  it('writes pms.report_closed audit when close succeeds', async () => {
    setDocumentStatus('approved');
    const { POST } = await import('@/app/api/pms/[projectId]/documents/[documentId]/close/route');

    const ctx = { params: Promise.resolve({ projectId: PROJECT_ID, documentId: DOCUMENT_ID }) };
    await POST(makeCloseRequest(), ctx);

    expect(auditRecords.some((a) => a.action === 'pms.report_closed')).toBe(true);
  });

  it('returns 404 when document does not exist (no cross-org leak)', async () => {
    mockDocumentRow = null; // Document not found.
    const { POST } = await import('@/app/api/pms/[projectId]/documents/[documentId]/close/route');

    const ctx = { params: Promise.resolve({ projectId: PROJECT_ID, documentId: DOCUMENT_ID }) };
    const res = await POST(makeCloseRequest(), ctx);

    expect(res.status).toBe(404);
  });
});
