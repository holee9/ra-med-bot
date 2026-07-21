// @MX:NOTE [AUTO] Route tests for POST /api/ra/workflows/cer (coverage 402, SPEC-REGULA-CER-001).
// @MX:SPEC SPEC-REGULA-CER-001 (REQ-CER-036..040) + SPEC-REGULA-PMS-001 (AC-04, REQ-PMS-004)
// @MX:TODO Deep PubMed/appraisal/assembly pipeline covered by lib/cer/*.test.ts.
//   These tests exercise the route handler surface only: auth passthrough, Zod
//   validation, IDOR guard, audit contract, transaction persistence, response shape.

import { beforeEach, describe, expect, it, vi } from 'vitest';

// --- Mutable session: IDOR / org tests flip organizationId/null ---
let sessionUser: { id: string; role: string; organizationId: string | null } = {
  id: 'user-001',
  role: 'ra-lead',
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

// --- Mock db: transaction with insert chain ---
const mockInsertChain = {
  values: vi.fn().mockReturnThis(),
  returning: vi.fn(),
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

// --- Mock CER deps ---
const searchPubMedMock = vi.fn();
vi.mock('@/lib/cer/pubmed-client', () => ({
  searchPubMed: (...a: unknown[]) => searchPubMedMock(...a),
}));

const appraiseEvidenceMock = vi.fn();
vi.mock('@/lib/cer/literature-appraisal', () => ({
  appraiseEvidence: (...a: unknown[]) => appraiseEvidenceMock(...a),
}));

const formatVancouverMock = vi.fn();
vi.mock('@/lib/cer/citation-formatter', () => ({
  formatVancouver: (...a: unknown[]) => formatVancouverMock(...a),
}));

const assembleCerMock = vi.fn();
vi.mock('@/lib/cer/cer-assembler', () => ({
  assembleCer: (...a: unknown[]) => assembleCerMock(...a),
}));

const auditCerCreatedMock = vi.fn();
const auditCerLiteratureSearchMock = vi.fn();
vi.mock('@/lib/cer/audit', () => ({
  auditCerCreated: (...a: unknown[]) => auditCerCreatedMock(...a),
  auditCerLiteratureSearch: (...a: unknown[]) => auditCerLiteratureSearchMock(...a),
}));

// --- Mock project-ownership IDOR guard (mutable: tests flip to denial) ---
const assertPmsProjectAccessMock = vi.fn().mockResolvedValue(null);
vi.mock('@/lib/cer/project-ownership', () => ({
  assertPmsProjectAccess: (...a: unknown[]) => assertPmsProjectAccessMock(...a),
}));

// --- Mock logger (unused by route but imported transitively) ---
vi.mock('@/lib/observability/logger', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

// --- Helpers ---
function makePostRequest(body: unknown): Request {
  return new Request('http://localhost/api/ra/workflows/cer', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

const VALID_BODY = {
  deviceName: 'Acme Pacemaker X1',
  manufacturer: 'Acme Medical Inc.',
  pubmedQuery: 'cardiac pacemaker bradycardia',
};

const ARTICLE_FIXTURE = {
  pmid: '12345678',
  title: 'Dual-chamber pacing in bradycardia',
  abstract: 'A randomized controlled trial of dual-chamber pacing.',
  authors: ['Smith J', 'Doe A'],
  journal: 'NEJM',
  year: 2024,
};

const APPRAISAL_FIXTURE = {
  sign50Level: '1++' as const,
  gradeQuality: 'high' as const,
  riskOfBias: 'low' as const,
};

const CER_DOC_FIXTURE = {
  runId: 'cer-run-fixed',
  stages: [],
  literature: [],
};

describe('POST /api/ra/workflows/cer — handler surface', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionUser = { id: 'user-001', role: 'ra-lead', organizationId: 'org-001' };
    searchPubMedMock.mockResolvedValue([ARTICLE_FIXTURE]);
    appraiseEvidenceMock.mockReturnValue(APPRAISAL_FIXTURE);
    formatVancouverMock.mockReturnValue('Smith J, Doe A. NEJM 2024.');
    assembleCerMock.mockReturnValue(CER_DOC_FIXTURE);
    auditCerCreatedMock.mockResolvedValue(undefined);
    auditCerLiteratureSearchMock.mockResolvedValue(undefined);
    assertPmsProjectAccessMock.mockResolvedValue(null);
    mockInsertChain.returning.mockResolvedValue([{ id: 'wf-run-001' }]);
  });

  it('returns 202 with runId + cerDocument + literature on valid input (no projectId)', async () => {
    const { POST } = await import('@/app/api/ra/workflows/cer/route');
    const res = await POST(makePostRequest(VALID_BODY), {});

    expect(res.status).toBe(202);
    const body = await res.json();
    expect(body).toMatchObject({
      workflowType: 'cer',
      status: 'queued',
      cerDocument: CER_DOC_FIXTURE,
      literatureCount: 1,
    });
    expect(body.runId).toEqual(expect.any(String));
    expect(body.queuedAt).toEqual(expect.any(String));
    // No projectId → no workflow_runs row → no workflowRunId in response.
    expect(body.workflowRunId).toBeUndefined();
    // Without org context, transaction should NOT be called.
    expect(mockDb.transaction).not.toHaveBeenCalled();
  });

  it('calls searchPubMed + appraiseEvidence + assembleCer pipeline', async () => {
    const { POST } = await import('@/app/api/ra/workflows/cer/route');
    await POST(makePostRequest(VALID_BODY), {});

    expect(searchPubMedMock).toHaveBeenCalledWith('cardiac pacemaker bradycardia', 50);
    expect(appraiseEvidenceMock).toHaveBeenCalledWith(ARTICLE_FIXTURE);
    expect(formatVancouverMock).toHaveBeenCalledWith(ARTICLE_FIXTURE);
    expect(assembleCerMock).toHaveBeenCalled();
  });

  it('writes cer_created + cer_literature_search audit rows', async () => {
    const { POST } = await import('@/app/api/ra/workflows/cer/route');
    await POST(makePostRequest(VALID_BODY), {});

    expect(auditCerCreatedMock).toHaveBeenCalledWith('user-001', expect.any(String));
    expect(auditCerLiteratureSearchMock).toHaveBeenCalledWith(
      'user-001',
      expect.any(String),
      'cardiac pacemaker bradycardia',
      1,
    );
  });

  it('persists workflow_runs + cer_persisted audit in transaction when projectId present', async () => {
    const { writeAudit } = await import('@/lib/kernel/audit');
    const { POST } = await import('@/app/api/ra/workflows/cer/route');
    const res = await POST(
      makePostRequest({
        ...VALID_BODY,
        projectId: '550e8400-e29b-41d4-a716-446655440000',
      }),
      {},
    );

    expect(res.status).toBe(202);
    const body = await res.json();
    expect(body.workflowRunId).toBe('wf-run-001');
    expect(mockDb.transaction).toHaveBeenCalled();

    // cer_persisted audit rides the transaction (21 CFR Part 11 atomicity).
    expect(vi.mocked(writeAudit)).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'cer_persisted',
        resource_type: 'cer_run',
        meta_json: expect.objectContaining({
          workflowRunId: 'wf-run-001',
          persisted: true,
        }),
      }),
      expect.anything(),
    );
  });

  it('runs IDOR guard (assertPmsProjectAccess) when projectId + orgId present', async () => {
    const { POST } = await import('@/app/api/ra/workflows/cer/route');
    await POST(
      makePostRequest({
        ...VALID_BODY,
        projectId: '550e8400-e29b-41d4-a716-446655440000',
      }),
      {},
    );

    expect(assertPmsProjectAccessMock).toHaveBeenCalledWith(
      '550e8400-e29b-41d4-a716-446655440000',
      'org-001',
    );
  });

  it('returns 403 Forbidden when projectId present but session lacks orgId', async () => {
    sessionUser = { id: 'user-001', role: 'ra-lead', organizationId: null };

    const { POST } = await import('@/app/api/ra/workflows/cer/route');
    const res = await POST(
      makePostRequest({
        ...VALID_BODY,
        projectId: '550e8400-e29b-41d4-a716-446655440000',
      }),
      {},
    );

    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toBe('Forbidden');
    expect(assertPmsProjectAccessMock).not.toHaveBeenCalled();
  });

  it('returns denied Response when IDOR guard rejects project access', async () => {
    const denied = Response.json({ error: 'project_not_found' }, { status: 404 });
    assertPmsProjectAccessMock.mockResolvedValue(denied);

    const { POST } = await import('@/app/api/ra/workflows/cer/route');
    const res = await POST(
      makePostRequest({
        ...VALID_BODY,
        projectId: '550e8400-e29b-41d4-a716-446655440000',
      }),
      {},
    );

    expect(res.status).toBe(404);
    expect(searchPubMedMock).not.toHaveBeenCalled();
  });

  it('returns 400 on invalid JSON body', async () => {
    const { POST } = await import('@/app/api/ra/workflows/cer/route');
    const res = await POST(makePostRequest('not-json'), {});

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('Invalid input');
  });

  it('returns 400 when deviceName is empty (Zod validation)', async () => {
    const { POST } = await import('@/app/api/ra/workflows/cer/route');
    const res = await POST(makePostRequest({ ...VALID_BODY, deviceName: '' }), {});

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('Invalid input');
  });

  it('returns 400 when pubmedQuery exceeds 500 chars', async () => {
    const { POST } = await import('@/app/api/ra/workflows/cer/route');
    const res = await POST(makePostRequest({ ...VALID_BODY, pubmedQuery: 'x'.repeat(501) }), {});

    expect(res.status).toBe(400);
  });
});
