// @MX:NOTE [AUTO] CER persist end-to-end roundtrip — REAL-DB (Issue #364 / L-013).
// @MX:SPEC SPEC-REGULA-CER-001
// @MX:REASON [AUTO] Load-bearing test: exercises the REAL postCer route handler
//           against a LIVE PostgreSQL (DATABASE_URL) — not an in-memory store.
//           This is the L-013 guarantee: the route's db.transaction INSERT into
//           workflow_runs hits the real schema, so FK type mismatches (the
//           0086 text-vs-uuid class), missing columns, or RLS drift surface here
//           instead of 500'ing in production.
//
// Strategy (Issue #364 Class B conversion — data/schema-dependent):
//   1. NO @/lib/db/client mock — the route's db.transaction uses the real DB.
//   2. beforeAll: seed FK prerequisites (user / org / project) via fixtures.
//   3. beforeEach: TRUNCATE workflow_runs for per-test isolation.
//   4. Mocks kept are route-level and orthogonal to schema:
//        - @/lib/audit        — records writeAudit + simulates the H2 failure
//                                (audit_logs is immutable — REQ-FND-044 — so it
//                                cannot be truncated; the mock keeps the table clean).
//        - @/lib/auth/with-permission — bypass real SSO, inject the session.
//        - @/lib/cer/project-ownership — deterministic IDOR access decision.
//        - @/lib/cer/pubmed-client — no real PubMed network calls.
//   5. Assertions SELECT the persisted row back from the real DB.
//
// Skipped when DATABASE_URL is unset (mirrors migrations-real-db.test.ts).

import { workflowRuns } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { HAS_DATABASE_URL, seedCoreActors, truncateTables } from '../../tests/fixtures/database';

// ---------------------------------------------------------------------------
// Constants (declared early so module-scope mock initializers can reference them)
// ---------------------------------------------------------------------------

const PROJECT_ID = '00000000-0000-0000-0000-000000000001';
const ORG_A = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const USER_A = '11111111-1111-1111-1111-111111111111';

// ---------------------------------------------------------------------------
// Audit mock — records writeAudit calls, simulates the in-transaction failure
// that the H2 atomicity case injects. Real audit_logs is immutable (REQ-FND-044)
// so we never persist here; the mock is the single source of audit truth.
// ---------------------------------------------------------------------------

type AuditRecord = { action: string; resource_id: string; tx?: unknown; failed?: boolean };
const auditRecords: AuditRecord[] = [];
let auditShouldFailInTransaction = false;

vi.mock('@/lib/audit', () => ({
  writeAudit: vi.fn(async (params: { action: string; resource_id: string }, tx?: unknown) => {
    const shouldFail = auditShouldFailInTransaction && Boolean(tx);
    auditRecords.push({
      action: params.action,
      resource_id: params.resource_id,
      tx,
      ...(shouldFail ? { failed: true } : {}),
    });
    if (shouldFail) throw new Error('simulated audit failure');
  }),
}));

// ---------------------------------------------------------------------------
// withPermission mock — bypass RBAC, inject session we control.
// ---------------------------------------------------------------------------

interface MockSession {
  user: { id: string; role: string; organizationId?: string };
}

let currentSession: MockSession = {
  user: { id: 'user-orgA', role: 'ra-lead', organizationId: ORG_A },
};

vi.mock('@/lib/auth/with-permission', () => ({
  withPermission: vi.fn(
    (
      _action: string,
      handler: (req: Request, ctx: unknown, session: MockSession) => Promise<Response>,
    ) =>
      (req: Request, ctx: unknown) =>
        handler(req, ctx, currentSession),
  ),
}));

// ---------------------------------------------------------------------------
// project-ownership mock — deterministic IDOR decision. PROJECT_ID belongs to
// ORG_A; any other org is denied. (Orthogonal to the real schema row, which
// seedCoreActors also inserts so the workflow_runs FK resolves.)
// ---------------------------------------------------------------------------

const projectsStore: Set<string> = new Set();

vi.mock('@/lib/cer/project-ownership', () => ({
  assertPmsProjectAccess: vi.fn(
    async (projectId: string, organizationId: string): Promise<Response | null> => {
      if (projectsStore.has(projectId) && organizationId === ORG_A) return null;
      return Response.json({ error: 'Project not found' }, { status: 404 });
    },
  ),
  pmsProjectBelongsToOrg: vi.fn(
    async (projectId: string, organizationId: string) =>
      projectsStore.has(projectId) && organizationId === ORG_A,
  ),
}));

// ---------------------------------------------------------------------------
// PubMed mock — deterministic articles so assembleCer gets stable input.
// ---------------------------------------------------------------------------

vi.mock('@/lib/cer/pubmed-client', () => ({
  searchPubMed: vi.fn(async () => [
    {
      pmid: '1',
      title: 'Biocompatibility of cardiac stent',
      authors: ['Doe J'],
      journal: 'J Med Devices',
      year: '2024',
      abstract: 'A study of stent biocompatibility.',
    },
  ]),
}));

// ---------------------------------------------------------------------------
// Import the REAL route handler AFTER mocks are registered. Loaded lazily in
// beforeAll (NOT at module top) so that when DATABASE_URL is unset the describe
// is skipped entirely and the route — which imports the real db/client → env
// validation — never loads. This keeps the file importable in a no-DB run.
// ---------------------------------------------------------------------------

let postCer: typeof import('@/app/api/ra/workflows/cer/route').POST;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function setSession(orgId: string, userId = USER_A) {
  currentSession = { user: { id: userId, role: 'ra-lead', organizationId: orgId } };
}

function buildCerBody(overrides: Partial<Record<string, unknown>> = {}): string {
  return JSON.stringify({
    deviceName: 'CardioStent-X',
    manufacturer: 'MedCorp',
    pubmedQuery: 'cardiac stent biocompatibility',
    intendedUse: 'coronary artery stenting',
    ...overrides,
  });
}

beforeAll(async () => {
  // Only runs when HAS_DATABASE_URL (the describe is skipIf'd otherwise).
  // 1. Seed the FK prerequisites a real workflow_runs INSERT needs. Idempotent.
  await seedCoreActors({
    userId: USER_A,
    userEmail: 'cer-real-db-test@regula.test',
    userName: 'CER Real-DB Test User',
    orgId: ORG_A,
    orgName: 'CER Real-DB Test Org',
    projectId: PROJECT_ID,
    projectName: 'CER Real-DB Test Project',
  });
  // 2. Load the real route. The route's `import { db } from '@/lib/db/client'`
  //    now resolves to the REAL client (no db mock registered).
  const route = await import('@/app/api/ra/workflows/cer/route');
  postCer = route.POST;
});

beforeEach(async () => {
  auditRecords.length = 0;
  auditShouldFailInTransaction = false;
  projectsStore.clear();
  projectsStore.add(PROJECT_ID);
  setSession(ORG_A, USER_A);
  // Isolation: reset the workflow_runs domain. workflow_runs is the FK parent of
  // 7 workflow-domain child tables (cer_literature, literature_searches, ...),
  // so plain TRUNCATE is rejected — CASCADE resets the whole subtree. audit_logs
  // is excluded (immutable, REQ-FND-044); users/orgs/projects are stable
  // fixtures seeded once in beforeAll.
  if (HAS_DATABASE_URL) {
    await truncateTables(['workflow_runs'], { cascade: true });
  }
});

afterEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// The load-bearing roundtrip: route → real-db persist → SELECT back.
// ---------------------------------------------------------------------------

describe.skipIf(!HAS_DATABASE_URL)('CER persist roundtrip — REAL DB (SPEC-REGULA-CER-001)', () => {
  it('persists a workflow_runs row end-to-end against the live schema', async () => {
    // 1. Call the REAL route with a projectId.
    const req = new Request('http://localhost/api/ra/workflows/cer', {
      method: 'POST',
      body: buildCerBody({ projectId: PROJECT_ID }),
    });
    const res = await postCer(req, {});

    expect(res.status).toBe(202);
    const payload = (await res.json()) as { runId: string; workflowRunId?: string };
    expect(payload.runId).toBeTruthy();
    expect(payload.workflowRunId).toBeTruthy();

    // 2. SELECT the row back from the REAL DB and assert schema-correct scoping.
    const { getDb } = await import('../../tests/fixtures/database');
    const db = await getDb();
    const rows = await db
      .select()
      .from(workflowRuns)
      .where(eq(workflowRuns.id, payload.workflowRunId as string));
    expect(rows, 'workflow_runs row must be persisted in the live DB').toHaveLength(1);
    const row = rows[0];
    expect(row?.workflowType).toBe('cer');
    expect(row?.projectId).toBe(PROJECT_ID);
    expect(row?.organizationId).toBe(ORG_A);
    expect(row?.userId).toBe(USER_A);
    expect(row?.status).toBe('approved');

    // 3. PII-safe inputJson: NO raw PubMed query text — only the length.
    const inputJson = (row?.inputJson ?? {}) as Record<string, unknown>;
    expect(inputJson.pubmedQueryLength).toBe('cardiac stent biocompatibility'.length);
    expect(inputJson.pubmedQuery).toBeUndefined();
    expect(JSON.stringify(inputJson)).not.toContain('cardiac stent biocompatibility');

    // 4. resultJson carries the device/intendedUse the route assembles.
    const resultJson = (row?.resultJson ?? {}) as Record<string, unknown>;
    expect(resultJson.deviceName).toBe('CardioStent-X');
    expect(resultJson.intendedUse).toBe('coronary artery stenting');

    // 5. The cer_persisted audit rode the same transaction (H2 atomicity).
    expect(auditRecords.some((a) => a.action === 'cer_persisted' && a.tx)).toBe(true);
  });

  it('returns 404 when projectId belongs to another org (IDOR denial)', async () => {
    // PROJECT_ID is owned by ORG_A (projectsStore). Attacker in ORG_B references it.
    setSession('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', USER_A);
    const req = new Request('http://localhost/api/ra/workflows/cer', {
      method: 'POST',
      body: buildCerBody({ projectId: PROJECT_ID }),
    });
    const res = await postCer(req, {});

    expect(res.status).toBe(404);

    // No workflow_runs row persisted on denial (real DB stays clean).
    const { getDb } = await import('../../tests/fixtures/database');
    const db = await getDb();
    const rows = await db.select().from(workflowRuns);
    expect(rows).toHaveLength(0);
  });

  it('does NOT persist when projectId is absent (backward-compat ephemeral run)', async () => {
    const req = new Request('http://localhost/api/ra/workflows/cer', {
      method: 'POST',
      body: buildCerBody({}), // no projectId
    });
    const res = await postCer(req, {});

    expect(res.status).toBe(202);
    const payload = (await res.json()) as { workflowRunId?: string };
    expect(payload.workflowRunId).toBeUndefined();

    const { getDb } = await import('../../tests/fixtures/database');
    const db = await getDb();
    const rows = await db.select().from(workflowRuns);
    expect(rows).toHaveLength(0);
  });

  it('rolls back the real workflow_runs insert when the audit write fails (H2 atomicity)', async () => {
    auditShouldFailInTransaction = true;
    const req = new Request('http://localhost/api/ra/workflows/cer', {
      method: 'POST',
      body: buildCerBody({ projectId: PROJECT_ID }),
    });

    // The in-transaction writeAudit throws → the REAL db.transaction rolls back.
    await expect(postCer(req, {})).rejects.toBeDefined();
    expect(auditRecords.some((a) => a.action === 'cer_created' && !a.tx)).toBe(true);
    expect(auditRecords.some((a) => a.action === 'cer_literature_search' && !a.tx)).toBe(true);
    expect(auditRecords.some((a) => a.action === 'cer_persisted' && a.tx && a.failed)).toBe(true);

    // The real INSERT was staged then rolled back — the live DB stays empty.
    const { getDb } = await import('../../tests/fixtures/database');
    const db = await getDb();
    const rows = await db.select().from(workflowRuns);
    expect(rows).toHaveLength(0);
  });
});
