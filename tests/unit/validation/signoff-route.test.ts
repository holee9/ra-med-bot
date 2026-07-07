// @MX:NOTE [AUTO] Integration tests for /api/validation/signoff (SPEC-REGULA-VALIDATION-001 M5).
// @MX:SPEC SPEC-REGULA-VALIDATION-001 (M5, REQ-VAL-012, REQ-VAL-013, AC-7, AC-8, Issue #49)
// @MX:REASON AC-7 (audit_logs row on success) + AC-8 (HTTP 409 on checklist unmet)
//   are the two release-gate invariants. These tests prove the route enforces
//   both via mocked writeAudit + db.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// --- Mocks ---------------------------------------------------------------

// RBAC: bypass permission check, hand back a fixed admin session.
vi.mock('@/lib/auth/with-permission', () => ({
  withPermission: vi.fn(
    (
      _action: string,
      handler: (req: Request, ctx: unknown, session: unknown) => Promise<Response>,
    ) =>
      (req: Request, ctx: unknown) =>
        handler(req, ctx, {
          user: { id: 'admin-001', role: 'admin', organizationId: 'org-001' },
        }),
  ),
}));

// writeAuditReturningId — captures call + returns a deterministic UUID.
const writeAuditReturningIdMock = vi.fn();
vi.mock('@/lib/audit', () => ({
  writeAuditReturningId: writeAuditReturningIdMock,
}));

// db.select / db.insert mocks
const selectFromWhereMock = vi.fn();
const insertValuesReturningMock = vi.fn();
const insertValuesMock = vi.fn(() => ({ returning: insertValuesReturningMock }));

vi.mock('@/lib/db/client', () => ({
  db: {
    select: vi.fn(() => ({ from: vi.fn(() => ({ where: selectFromWhereMock })) })),
    insert: vi.fn(() => ({ values: insertValuesMock })),
  },
}));

vi.mock('drizzle-orm', () => ({
  eq: (a: unknown, b: unknown) => ({ type: 'eq', a, b }),
}));

vi.mock('@/lib/db/schema', () => ({
  validationEvidence: {
    releaseId: 'release_id',
    qualificationType: 'qualification_type',
    result: 'result',
  },
  validationSignoff: {
    id: 'id',
    releaseId: 'release_id',
    signedAt: 'signed_at',
  },
}));

// rerun-gate — controllable
const evaluateRerunGateMock = vi.fn();
vi.mock('@/lib/validation/rerun-gate', () => ({
  evaluateRerunGate: evaluateRerunGateMock,
}));

// child_process spawn — report builder auto-succeeds and prints a fake path
vi.mock('node:child_process', () => ({
  spawn: vi.fn(() => ({
    stdout: {
      on: (_event: string, cb: (chunk: Buffer) => void) =>
        cb(Buffer.from('/abs/path/release-report-v0.1.0-rc1.md\n')),
    },
    on: (event: string, cb: (code: number) => void) => {
      if (event === 'close') cb(0);
    },
  })),
}));

// --- Import after mocks --------------------------------------------------

const { POST } = await import('@/app/api/validation/signoff/route');

function makeRequest(body: unknown): Request {
  return new Request('http://localhost/api/validation/signoff', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

const VALID_BODY = {
  releaseId: 'v0.1.0-rc1',
  checklistState: {
    items: [
      { id: 'iq:pass', title: 'IQ', met: true },
      { id: 'oq:pass', title: 'OQ', met: true },
      { id: 'pq:pass', title: 'PQ', met: true },
      { id: 'changes:resolved', title: 'Changes', met: true },
      { id: 'report:exported', title: 'Report', met: true },
    ],
  },
};

describe('POST /api/validation/signoff (M5, AC-7, AC-8)', () => {
  beforeEach(() => {
    writeAuditReturningIdMock.mockReset();
    selectFromWhereMock.mockReset();
    insertValuesReturningMock.mockReset();
    evaluateRerunGateMock.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('returns 400 on malformed body', async () => {
    const res = await POST(makeRequest({ wrong: 'shape' }), {});
    expect(res.status).toBe(400);
  });

  it('AC-8: returns 409 when IQ/OQ/PQ evidence is missing', async () => {
    // evidence select returns empty (no IQ/OQ/PQ pass)
    selectFromWhereMock.mockResolvedValueOnce([]);
    evaluateRerunGateMock.mockResolvedValueOnce({ passed: true, failed: [] });

    const res = await POST(makeRequest(VALID_BODY), {});
    expect(res.status).toBe(409);
    const json = await res.json();
    expect(json.error).toBe('signoff_checklist_unmet');
    expect(json.failed).toEqual(expect.arrayContaining(['iq:pass', 'oq:pass', 'pq:pass']));
    // AC-7 invariant: no audit row written when blocked.
    expect(writeAuditReturningIdMock).not.toHaveBeenCalled();
  });

  it('AC-5/AC-8: returns 409 when rerun gate blocks (changes:resolved unmet)', async () => {
    // evidence has IQ/OQ/PQ pass
    selectFromWhereMock.mockResolvedValueOnce([
      { qualificationType: 'iq', result: 'pass' },
      { qualificationType: 'oq', result: 'pass' },
      { qualificationType: 'pq', result: 'pass' },
    ]);
    evaluateRerunGateMock.mockResolvedValueOnce({
      passed: false,
      failed: [{ axis: 'model', reason: 'change_control:model:rerun_required' }],
    });

    const res = await POST(makeRequest(VALID_BODY), {});
    expect(res.status).toBe(409);
    const json = await res.json();
    expect(json.error).toBe('signoff_checklist_unmet');
    expect(json.failed).toContain('changes:resolved');
    expect(writeAuditReturningIdMock).not.toHaveBeenCalled();
  });

  it('AC-7: on success writes one audit row and returns 200 with audit_log_ref', async () => {
    // Evidence all pass + rerun gate passes
    selectFromWhereMock.mockResolvedValueOnce([
      { qualificationType: 'iq', result: 'pass' },
      { qualificationType: 'oq', result: 'pass' },
      { qualificationType: 'pq', result: 'pass' },
    ]);
    evaluateRerunGateMock.mockResolvedValueOnce({ passed: true, failed: [] });

    writeAuditReturningIdMock.mockResolvedValueOnce('audit-row-uuid-001');
    insertValuesReturningMock.mockResolvedValueOnce([
      { id: 'signoff-001', signedAt: new Date('2026-07-07T12:00:00Z') },
    ]);

    const res = await POST(makeRequest(VALID_BODY), {});
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.signoffId).toBe('signoff-001');
    expect(json.auditLogRef).toBe('audit-row-uuid-001');
    expect(json.approverId).toBe('admin-001');
    expect(json.releaseId).toBe('v0.1.0-rc1');
    expect(json.reportArtifactPath).toContain('release-report-v0.1.0-rc1.md');

    // AC-7 invariant: exactly one audit row written with action='validation.signoff'.
    expect(writeAuditReturningIdMock).toHaveBeenCalledTimes(1);
    const auditCall = writeAuditReturningIdMock.mock.calls[0]?.[0];
    expect(auditCall).toBeDefined();
    expect(auditCall.action).toBe('validation.signoff');
    expect(auditCall.resource_type).toBe('validationSignoff');
    expect(auditCall.resource_id).toBe('v0.1.0-rc1');
    expect(auditCall.actor_id).toBe('admin-001');
    expect(auditCall.meta_json.releaseId).toBe('v0.1.0-rc1');
    expect(auditCall.meta_json.reportArtifactPath).toContain('release-report');
  });

  it('AC-7: audit failure propagates as 500 (fail-closed)', async () => {
    selectFromWhereMock.mockResolvedValueOnce([
      { qualificationType: 'iq', result: 'pass' },
      { qualificationType: 'oq', result: 'pass' },
      { qualificationType: 'pq', result: 'pass' },
    ]);
    evaluateRerunGateMock.mockResolvedValueOnce({ passed: true, failed: [] });
    writeAuditReturningIdMock.mockRejectedValueOnce(new Error('advisory lock timeout'));

    const res = await POST(makeRequest(VALID_BODY), {});
    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json.error).toBe('audit_write_failed');
  });

  it('returns 409 when release already signed off (UNIQUE constraint)', async () => {
    selectFromWhereMock.mockResolvedValueOnce([
      { qualificationType: 'iq', result: 'pass' },
      { qualificationType: 'oq', result: 'pass' },
      { qualificationType: 'pq', result: 'pass' },
    ]);
    evaluateRerunGateMock.mockResolvedValueOnce({ passed: true, failed: [] });
    writeAuditReturningIdMock.mockResolvedValueOnce('audit-row-uuid-002');
    // Simulate Postgres unique-violation error message
    insertValuesReturningMock.mockRejectedValueOnce(
      new Error(
        'duplicate key value violates unique constraint "validation_signoff_release_id_key"',
      ),
    );

    const res = await POST(makeRequest(VALID_BODY), {});
    expect(res.status).toBe(409);
    const json = await res.json();
    expect(json.error).toBe('release_already_signed_off');
  });
});
