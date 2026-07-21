// @MX:NOTE [AUTO] Route tests for POST /api/validation/signoff (coverage 402, SPEC-REGULA-VALIDATION-001).
// @MX:SPEC SPEC-REGULA-VALIDATION-001 (M5, REQ-VAL-012, REQ-VAL-013, AC-5, AC-7, AC-8)
// @MX:TODO Deep build-report PDF generation + rerun-gate SQL covered by lib/validation/*.test.ts.
//   These tests exercise the route handler surface: auth passthrough, Zod
//   validation, 409 pre-check (existing signoff), evidence lookup, rerun gate,
//   checklist gate (AC-8), audit-write-failed branch, INSERT returning row,
//   and UNIQUE constraint 409.

import { beforeEach, describe, expect, it, vi } from 'vitest';

// --- Mutable session ---
let sessionUser: { id: string; role: string; organizationId: string | null } = {
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

// --- Mock db: queued select results + insert returning ---
// The route makes 2 distinct select calls in order:
//   1. validationSignoff pre-check: db.select(...).from(...).where(...).limit(1)
//   2. validationEvidence: db.select(...).from(...).where(...)  (no .limit)
// Drizzle's `.where()` returns a builder that is BOTH a Promise (thenable)
// AND has `.limit()`. We replicate this with a thenable that also has `.limit`.
const selectResults: unknown[][] = [];

function makeThenableWithLimit(rows: unknown[]) {
  // A thenable: when awaited, resolves to `rows`. Also has `.limit()` which
  // also resolves to `rows` (for the pre-check path that calls `.limit(1)`).
  const thenable = {
    limit: vi.fn().mockResolvedValue(rows),
    // biome-ignore lint/suspicious/noThenProperty: Drizzle's query builder is a thenable; this mock replicates that dual nature (Promise + .limit chain).
    then: (resolve: (v: unknown[]) => void, reject?: (e: unknown) => void) => {
      Promise.resolve()
        .then(() => resolve(rows))
        .catch(reject);
    },
  };
  return thenable;
}

let selectCallIndex = 0;

const mockDb = {
  select: vi.fn(() => {
    const idx = selectCallIndex++;
    const rows = selectResults[idx] ?? [];
    return {
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue(makeThenableWithLimit(rows)),
      }),
    };
  }),
  insert: vi.fn(() => makeInsertChain()),
};

// Insert chain: insert().values().returning() — values() must return an object
// with `.returning()`. We build a chain where values() returns `this`.
const mockInsertRow = [{ id: 'so-001', signedAt: new Date('2026-07-11T00:00:00Z') }];

function makeInsertChain() {
  const chain: Record<string, unknown> = {};
  chain.values = vi.fn().mockReturnValue(chain);
  chain.returning = vi.fn().mockResolvedValue(mockInsertRow);
  return chain;
}

vi.mock('@/lib/kernel/db/client', () => ({ db: mockDb }));

// --- Mock audit (writeAuditReturningId for signoff) ---
vi.mock('@/lib/kernel/audit', () => ({
  writeAuditReturningId: vi.fn().mockResolvedValue('audit-log-001'),
}));

// --- Mock node:child_process spawn (runBuildReport spawns a subprocess) ---
// The route imports { spawn } from 'node:child_process' and calls it to build
// the validation report. We must intercept it to avoid a real subprocess.
const mockChild = {
  stdout: { on: vi.fn() },
  on: vi.fn((event: string, cb: (code: number | null) => void) => {
    if (event === 'close') {
      // Defer the callback so the Promise resolves asynchronously.
      queueMicrotask(() => cb(0));
    }
  }),
};
vi.mock('node:child_process', () => ({
  spawn: vi.fn(() => mockChild),
}));

// Set stdout data after mock is created: the route reads child.stdout chunks.
// We inject the artifact path via the stdout 'data' handler.
mockChild.stdout.on = vi.fn((event: string, cb: (chunk: Buffer) => void) => {
  if (event === 'data') {
    queueMicrotask(() => cb(Buffer.from('docs/validation/release-report-v1.2.3.md')));
  }
});

// --- Mock validation deps ---
vi.mock('@/lib/validation/checklist', () => ({
  buildChecklist: vi.fn(() => [
    { id: 'iq:pass', title: 'IQ', met: true },
    { id: 'oq:pass', title: 'OQ', met: true },
    { id: 'pq:pass', title: 'PQ', met: true },
    { id: 'changes:resolved', title: 'Changes', met: true },
    { id: 'report:exported', title: 'Report', met: true },
  ]),
  isChecklistSatisfied: vi.fn(() => true),
  unmetItems: vi.fn(() => []),
}));

const evaluateRerunGateMock = vi.fn();
vi.mock('@/lib/validation/rerun-gate', () => ({
  evaluateRerunGate: (...a: unknown[]) => evaluateRerunGateMock(...a),
}));

// --- Helpers ---
function makePostRequest(body: unknown): Request {
  return new Request('http://localhost/api/validation/signoff', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

const VALID_BODY = {
  releaseId: 'v1.2.3',
  checklistState: { items: [] },
};

// Helper to push select results for a full happy-path run.
// Queue order: 1) signoff pre-check, 2) evidence rows.
function queueHappyPathSelects() {
  selectResults.push([]); // 1) no existing signoff
  selectResults.push([
    // 2) evidence rows
    { qualificationType: 'iq', result: 'pass' },
    { qualificationType: 'oq', result: 'pass' },
    { qualificationType: 'pq', result: 'pass' },
  ]);
}

describe('POST /api/validation/signoff — handler surface', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionUser = { id: 'user-001', role: 'admin', organizationId: 'org-001' };
    selectResults.length = 0;
    selectCallIndex = 0;
    evaluateRerunGateMock.mockResolvedValue({ passed: true, blockingAxes: [] });
  });

  it('returns 200 with signoffId on valid sign-off', async () => {
    queueHappyPathSelects();

    const { POST } = await import('@/app/api/validation/signoff/route');
    const res = await POST(makePostRequest(VALID_BODY), {});

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({
      signoffId: 'so-001',
      releaseId: 'v1.2.3',
      approverId: 'user-001',
      auditLogRef: 'audit-log-001',
    });
  });

  it('writes validation.signoff audit row via writeAuditReturningId (AC-7)', async () => {
    const { writeAuditReturningId } = await import('@/lib/kernel/audit');
    vi.mocked(writeAuditReturningId).mockClear();
    queueHappyPathSelects();

    const { POST } = await import('@/app/api/validation/signoff/route');
    await POST(makePostRequest(VALID_BODY), {});

    expect(vi.mocked(writeAuditReturningId)).toHaveBeenCalledWith(
      expect.objectContaining({
        actor_id: 'user-001',
        action: 'validation.signoff',
        resource_type: 'validationSignoff',
        resource_id: 'v1.2.3',
      }),
    );
  });

  it('returns 400 on invalid JSON body', async () => {
    const { POST } = await import('@/app/api/validation/signoff/route');
    const res = await POST(makePostRequest('not-json'), {});

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('Invalid request body');
  });

  it('returns 400 when releaseId format is invalid', async () => {
    const { POST } = await import('@/app/api/validation/signoff/route');
    const res = await POST(makePostRequest({ ...VALID_BODY, releaseId: 'not-a-version' }), {});

    expect(res.status).toBe(400);
  });

  it('returns 400 when checklistState is missing', async () => {
    const { POST } = await import('@/app/api/validation/signoff/route');
    const res = await POST(makePostRequest({ releaseId: 'v1.0.0' }), {});

    expect(res.status).toBe(400);
  });

  it('returns 409 release_already_signed_off when pre-check finds existing row', async () => {
    selectResults.push([{ id: 'so-existing-001' }]); // existing signoff

    const { POST } = await import('@/app/api/validation/signoff/route');
    const res = await POST(makePostRequest(VALID_BODY), {});

    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body).toMatchObject({
      error: 'release_already_signed_off',
      releaseId: 'v1.2.3',
    });
  });

  it('returns 409 signoff_checklist_unmet when checklist gate fails (AC-8)', async () => {
    const { isChecklistSatisfied, unmetItems } = await import('@/lib/validation/checklist');
    vi.mocked(isChecklistSatisfied).mockReturnValueOnce(false);
    vi.mocked(unmetItems).mockReturnValueOnce([
      // biome-ignore lint/suspicious/noExplicitAny: test fixture
      { id: 'iq:pass', title: 'IQ', met: false } as any,
    ]);
    queueHappyPathSelects();

    const { POST } = await import('@/app/api/validation/signoff/route');
    const res = await POST(makePostRequest(VALID_BODY), {});

    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toBe('signoff_checklist_unmet');
    expect(body.failed).toContain('iq:pass');
  });

  it('returns 500 audit_write_failed when writeAuditReturningId throws (21 CFR Part 11 fail closed)', async () => {
    const { writeAuditReturningId } = await import('@/lib/kernel/audit');
    vi.mocked(writeAuditReturningId).mockRejectedValueOnce(new Error('db unavailable'));
    queueHappyPathSelects();

    const { POST } = await import('@/app/api/validation/signoff/route');
    const res = await POST(makePostRequest(VALID_BODY), {});

    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe('audit_write_failed');
  });

  it('returns 500 signoff_insert_failed when insert returns no row', async () => {
    queueHappyPathSelects();
    const emptyChain: Record<string, unknown> = {};
    emptyChain.values = vi.fn().mockReturnValue(emptyChain);
    emptyChain.returning = vi.fn().mockResolvedValue([]);
    mockDb.insert = vi.fn(() => emptyChain);

    const { POST } = await import('@/app/api/validation/signoff/route');
    const res = await POST(makePostRequest(VALID_BODY), {});

    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe('signoff_insert_failed');
  });

  it('returns 409 release_already_signed_off on UNIQUE constraint violation', async () => {
    queueHappyPathSelects();
    const err = new Error(
      'duplicate key value violates unique constraint "validation_signoff_release_id_key"',
    );
    // biome-ignore lint/suspicious/noExplicitAny: simulated Postgres error
    (err as any).code = '23505';
    const rejectChain: Record<string, unknown> = {};
    rejectChain.values = vi.fn().mockReturnValue(rejectChain);
    rejectChain.returning = vi.fn().mockRejectedValue(err);
    mockDb.insert = vi.fn(() => rejectChain);

    const { POST } = await import('@/app/api/validation/signoff/route');
    const res = await POST(makePostRequest(VALID_BODY), {});

    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toBe('release_already_signed_off');
  });
});
