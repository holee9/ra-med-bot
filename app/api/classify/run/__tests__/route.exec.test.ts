// @vitest-environment node
// @MX:NOTE [AUTO] Execution tests for POST /api/classify/run (SPEC-REGULA-CLASSIFY-001).
// @MX:SPEC SPEC-REGULA-CLASSIFY-001 (REQ-CLASSIFY-001~004, REQ-CLASSIFY-019, REQ-CLASSIFY-020)
//
// The sibling route.test.ts guards the H1/M1 source STRUCTURE via regex; these
// tests actually INVOKE the POST handler (import + call) so the route body earns
// real execution + branch coverage. Covers: 201 happy path, 403 org-missing,
// 400 invalid input, 500 empty insert, H1 fail-closed (502 + failed-status +
// failure audit carrying error message but never deviceDescription).

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

const classifyResult = {
  fda: { class: 'II', path: '510(k)' },
  euMdr: { class: 'IIa', ruleNumbers: ['6'] },
  mfds: { class: '4' },
  nmpa: { class: 'III' },
  pmda: { class: 'II' },
  samdFlag: false,
};
const classifyDevice = vi.fn(async () => structuredClone(classifyResult));

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
          user: { id: 'user-001', role: 'ra-lead', organizationId },
        });
      },
  ),
}));

// db mock:
//   - top-level db.insert(workflowRuns).values({...}).returning({id}) -> [{id}]
//   - db.transaction(async tx => { tx.insert(...).values(...); tx.update(...).set(...).where(...); writeAudit(...,tx) })
const insertReturning = vi.fn().mockResolvedValue([{ id: 'run-1' }]);
const txInsertValues = vi.fn().mockResolvedValue(undefined);
const txUpdateWhere = vi.fn().mockResolvedValue(undefined);

vi.mock('@/lib/db/client', () => ({
  db: {
    insert: vi.fn(() => ({
      values: vi.fn(() => ({ returning: insertReturning })),
    })),
    transaction: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) =>
      fn({
        insert: vi.fn(() => ({ values: txInsertValues })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: txUpdateWhere })) })),
      }),
    ),
  },
}));

vi.mock('@/lib/classify/engine', () => ({ classifyDevice }));

vi.mock('@/lib/api/hybrid-ra-client', () => ({
  // createHybridRaFetch returns a fetch fn; unused because classifyDevice is mocked.
  createHybridRaFetch: vi.fn(() => vi.fn()),
}));

vi.mock('@/lib/ai/retrievers/internal-docs', () => ({
  // retrieveFn passed into classifyDevice; unused because the engine is mocked.
  internalDocsRetrieve: vi.fn(),
}));

const { POST } = await import('@/app/api/classify/run/route');

function postReq(body: Record<string, unknown>): Request {
  return new Request('http://localhost/api/classify/run', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

const validBody = {
  deviceDescription: 'A battery-powered wearable ECG monitor.',
  deviceType: 'active',
  contactType: 'external',
  hasSoftware: true,
  hasAiMl: true,
  isSterile: false,
};

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
  insertReturning.mockResolvedValue([{ id: 'run-1' }]);
  classifyDevice.mockResolvedValue(structuredClone(classifyResult));
});

describe('POST /api/classify/run — characterization (SPEC-REGULA-CLASSIFY-001)', () => {
  it('returns 201 with workflowRunId + result on success', async () => {
    const res = await POST(postReq(validBody), {});
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.workflowRunId).toBe('run-1');
    expect(body.result.fda.class).toBe('II');
  });

  it('writes a device_classified audit with resource_type deviceClassification (no PII)', async () => {
    await POST(postReq(validBody), {});
    const audits = auditCalls(
      (input) =>
        input.action === 'device_classified' && input.resource_type === 'deviceClassification',
    );
    expect(audits).toHaveLength(1);
    expect(audits[0]?.meta_json).toMatchObject({
      deviceType: 'active',
      fdaClass: 'II',
      euClass: 'IIa',
    });
    // 21 CFR Part 11 / H1: deviceDescription (free text, potential PII) must NOT be audited.
    expect(JSON.stringify(audits[0]?.meta_json)).not.toMatch(/deviceDescription/);
  });

  it('returns 403 when organizationId is missing', async () => {
    organizationId = undefined as unknown as string;
    const res = await POST(postReq(validBody), {});
    expect(res.status).toBe(403);
  });

  it('returns 400 on invalid input (missing deviceDescription)', async () => {
    const res = await POST(postReq({ ...validBody, deviceDescription: '' }), {});
    const body = await res.json();
    expect(res.status).toBe(400);
    expect(body.error).toBe('Invalid input');
  });

  it('returns 400 on invalid deviceType enum', async () => {
    const res = await POST(postReq({ ...validBody, deviceType: 'not-a-real-type' }), {});
    expect(res.status).toBe(400);
  });

  it('returns 500 when the workflow_runs insert yields no row', async () => {
    insertReturning.mockResolvedValue([]);
    const res = await POST(postReq(validBody), {});
    const body = await res.json();
    expect(res.status).toBe(500);
    expect(body.error).toBe('Failed to create workflow run');
  });
});

describe('POST /api/classify/run — H1 fail-closed (REQ-CLASSIFY-019)', () => {
  it('returns 502 and marks the run failed + failure audit (error only, no PII) when the engine throws', async () => {
    classifyDevice.mockRejectedValueOnce(new Error('llm_timeout'));

    const res = await POST(postReq(validBody), {});
    const body = await res.json();

    expect(res.status).toBe(502);
    expect(body.error).toBe('classification_failed');

    // The failed-status update rides the failure tx (txUpdateWhere invoked).
    expect(txUpdateWhere).toHaveBeenCalled();

    // Failure audit carries the error message but NEVER deviceDescription.
    const audits = auditCalls((input) => input.action === 'device_classified');
    expect(audits).toHaveLength(1);
    expect(audits[0]?.resource_type).toBe('deviceClassification');
    expect(audits[0]?.meta_json?.error).toBe('llm_timeout');
    expect(JSON.stringify(audits[0]?.meta_json)).not.toMatch(/deviceDescription/);
  });
});
