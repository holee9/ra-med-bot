// @MX:NOTE [AUTO] CER persist end-to-end roundtrip test.
// @MX:SPEC SPEC-REGULA-CER-001
// @MX:REASON [AUTO] Load-bearing test: exercises the REAL postCer route handler
//           against a shared in-memory store. Proves the route persists
//           workflow_runs (workflowType='cer') with correct org/project scoping
//           and PII-safe inputJson. NOT a false-pass: the in-memory store
//           actually receives the insert and assertions inspect it directly.
//
// SPEC-REGULA-PHI-REMOVAL-001 (Issue #319): the PMS auto-linkage assertions
// (resolveCerLinkage) were removed; the CER persistence assertions remain.
//
// Strategy (mirrors the prior pms-idor-runtime pattern):
//   1. Mock @/lib/db/client — in-memory store recording inserts + serving selects.
//   2. Mock @/lib/audit — record writeAudit calls.
//   3. Mock @/lib/auth/with-permission — bypass RBAC, inject session per org.
//   4. Mock @/lib/cer/pubmed-client — deterministic literature results.
//   5. Mock @/lib/pms/project-ownership — assertPmsProjectAccess via in-memory projects.
//   6. Call REAL POST handler, then inspect the in-memory store.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Constants (declared early so module-scope mock initializers can reference them)
// ---------------------------------------------------------------------------

const PROJECT_ID = '00000000-0000-0000-0000-000000000001';
const ORG_A = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const USER_A = '11111111-1111-1111-1111-111111111111';

// ---------------------------------------------------------------------------
// In-memory workflow_runs store — the single shared source of truth for both
// the route INSERT and the resolver SELECT.
// ---------------------------------------------------------------------------

type Row = Record<string, unknown>;

interface WorkflowRunRow {
  id: string;
  user_id: string;
  organization_id: string;
  project_id: string;
  workflow_type: string;
  status: string;
  input_json: Row;
  result_json: Row | null;
  created_at: Date;
}

const workflowRunsStore: WorkflowRunRow[] = [];
const projectsStore: Set<string> = new Set(); // projectIds belonging to ORG_A
const auditRecords: Array<{ action: string; resource_id: string; tx?: unknown; failed?: boolean }> =
  [];

let activeTransactionWorkflowRunsStore: WorkflowRunRow[] | null = null;
let transactionShouldFail = false;
let auditShouldFailInTransaction = false;

// ---------------------------------------------------------------------------
// DB mock — the route inserts via db.transaction(tx => tx.insert(...).returning());
// the resolver selects via db.select(...).from().where().orderBy().limit().
// Both must hit the SAME workflowRunsStore.
// ---------------------------------------------------------------------------

interface InsertChain {
  values: (v: Row) => InsertChain;
  returning: (fields?: unknown) => Promise<Row[]>;
}

interface SelectChain {
  from: (table: unknown) => SelectChain;
  where: (condition: unknown) => SelectChain;
  orderBy: (...cols: unknown[]) => SelectChain;
  limit: (n: number) => Promise<Row[]>;
}

// Minimal condition representation: we capture the where() args and interpret
// the (projectId, orgId, workflowType='cer') triple to filter the store.
// The real Drizzle condition object is opaque to us; we rely on the resolver
// always filtering by these three columns, so we filter the store by the
// test-known PROJECT_ID + ORG_A + 'cer' whenever a select reaches .limit().
interface WhereCapture {
  projectId?: string;
  orgId?: string;
  workflowType?: string;
}

function makeSelectChain(captured: WhereCapture): SelectChain {
  const chain: SelectChain = {
    from: vi.fn(() => chain),
    where: vi.fn((condition: unknown) => {
      // The resolver builds an `and(eq(projectId), eq(orgId), eq(workflowType))`.
      // Drizzle encodes these as {table, column} references — we can't decode
      // reliably, so we fall back to filtering by the test's known constants.
      // Since this mock only serves the resolver (which always queries the
      // PROJECT_ID/ORG_A/'cer' triple), filtering the whole store is safe.
      void condition;
      return chain;
    }),
    orderBy: vi.fn(() => chain),
    limit: vi.fn(async () => {
      const rows = workflowRunsStore
        .filter(
          (r) =>
            r.workflow_type === 'cer' &&
            r.project_id === captured.projectId &&
            r.organization_id === captured.orgId,
        )
        .sort((a, b) => b.created_at.getTime() - a.created_at.getTime())
        .slice(0, 1)
        .map((r) => ({ id: r.id, resultJson: r.result_json }));
      return rows;
    }),
  };
  return chain;
}

// Drizzle pgTable objects store their name at Symbol(drizzle:Name), not .name.
function getDrizzleTableName(table: unknown): string | undefined {
  if (!table || typeof table !== 'object') return undefined;
  for (const symbol of Object.getOwnPropertySymbols(table)) {
    if (String(symbol) === 'Symbol(drizzle:Name)') {
      return (table as Record<symbol, unknown>)[symbol] as string | undefined;
    }
  }
  return undefined;
}

function getWorkflowRunsWriteStore(): WorkflowRunRow[] {
  return activeTransactionWorkflowRunsStore ?? workflowRunsStore;
}

// Explicit interface breaks the self-referential type cycle (dbMock.transaction
// references dbMock via closure in its own initializer) without resorting to `any`.
interface DbMock {
  insert: (table: unknown) => InsertChain;
  select: (fields?: unknown) => SelectChain;
  transaction: (fn: (tx: unknown) => Promise<unknown>) => Promise<unknown>;
}

const dbMock: DbMock = {
  insert: vi.fn((table: unknown) => {
    const chain: InsertChain = {
      values: vi.fn((v: Row) => {
        if (getDrizzleTableName(table) === 'workflow_runs') {
          // Route passes camelCase keys (Drizzle column names). Accept both.
          const input = v as Record<string, unknown>;
          const row: WorkflowRunRow = {
            id: (input.id as string) ?? crypto.randomUUID(),
            user_id: (input.userId ?? input.user_id) as string,
            organization_id: (input.organizationId ?? input.organization_id) as string,
            project_id: (input.projectId ?? input.project_id) as string,
            workflow_type: ((input.workflowType ?? input.workflow_type) as string) ?? 'cer',
            status: (input.status as string) ?? 'approved',
            input_json: ((input.inputJson ?? input.input_json) as Row) ?? {},
            result_json: ((input.resultJson ?? input.result_json) as Row | null) ?? null,
            created_at: new Date(),
          };
          getWorkflowRunsWriteStore().push(row);
        }
        return chain;
      }),
      returning: vi.fn(async () => {
        const writeStore = getWorkflowRunsWriteStore();
        const last = writeStore[writeStore.length - 1];
        return [{ id: last?.id ?? crypto.randomUUID() }];
      }),
    };
    return chain;
  }),
  select: vi.fn((fields?: unknown) => {
    void fields;
    // The resolver passes { id, resultJson } — we return row objects with
    // those keys from the store. projectId/orgId are the test constants.
    return makeSelectChain({ projectId: PROJECT_ID, orgId: ORG_A });
  }),
  transaction: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) => {
    if (transactionShouldFail) throw new Error('simulated transaction failure');
    const previousTransactionStore = activeTransactionWorkflowRunsStore;
    const stagedWorkflowRuns = [...workflowRunsStore];
    activeTransactionWorkflowRunsStore = stagedWorkflowRuns;
    try {
      const result = await fn(dbMock as unknown);
      workflowRunsStore.splice(0, workflowRunsStore.length, ...stagedWorkflowRuns);
      return result;
    } finally {
      activeTransactionWorkflowRunsStore = previousTransactionStore;
    }
  }),
};

vi.mock('@/lib/db/client', () => ({ db: dbMock }));

// ---------------------------------------------------------------------------
// Audit mock — records writeAudit, simulates failure on demand.
// ---------------------------------------------------------------------------

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
// project-ownership mock — assertPmsProjectAccess via in-memory projectsStore.
// Mirrors the real return contract: null = allowed, Response = denied.
// ---------------------------------------------------------------------------

vi.mock('@/lib/pms/project-ownership', () => ({
  assertPmsProjectAccess: vi.fn(
    async (projectId: string, organizationId: string): Promise<Response | null> => {
      // PROJECT_ID belongs to ORG_A (projectsStore). Deny when the project is
      // unknown OR the caller's org is not the owning org (mirrors the real
      // projects.organization_id === organizationId check).
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
// Import the REAL route handler + REAL resolver AFTER mocks are registered.
// ---------------------------------------------------------------------------

const { POST: postCer } = await import('@/app/api/ra/workflows/cer/route');
// SPEC-REGULA-PHI-REMOVAL-001 (Issue #319): resolveCerLinkage import removed —
// the PMS auto-linkage resolver was deleted with the PMS domain. The CER
// persistence assertions below remain valid; the resolveCerLinkage check is
// dropped.

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function setSession(orgId: string, userId = USER_A) {
  currentSession = { user: { id: userId, role: 'ra-lead', organizationId: orgId } };
}

function resetStores() {
  workflowRunsStore.length = 0;
  projectsStore.clear();
  auditRecords.length = 0;
  activeTransactionWorkflowRunsStore = null;
  transactionShouldFail = false;
  auditShouldFailInTransaction = false;
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

beforeEach(() => {
  resetStores();
  projectsStore.add(PROJECT_ID);
  setSession(ORG_A, USER_A);
});

afterEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// The load-bearing roundtrip: route → persist → (PMS linkage removed, Issue #319)
// ---------------------------------------------------------------------------

describe('CER persist roundtrip (SPEC-REGULA-CER-001)', () => {
  it('persists a workflow_runs row end-to-end', async () => {
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

    // 2. Assert the workflow_runs row was inserted with correct scoping.
    expect(workflowRunsStore).toHaveLength(1);
    const row = workflowRunsStore[0];
    expect(row?.workflow_type).toBe('cer');
    expect(row?.project_id).toBe(PROJECT_ID);
    expect(row?.organization_id).toBe(ORG_A);
    expect(row?.user_id).toBe(USER_A);
    expect(row?.status).toBe('approved');

    // 3. PII-safe inputJson: NO raw PubMed query text — only the length.
    const inputJson = row?.input_json ?? {};
    expect(inputJson.pubmedQueryLength).toBe('cardiac stent biocompatibility'.length);
    expect(inputJson.pubmedQuery).toBeUndefined();
    expect(JSON.stringify(inputJson)).not.toContain('cardiac stent biocompatibility');

    // 4. resultJson carries the device/intendedUse the resolver extracts.
    const resultJson = row?.result_json ?? {};
    expect(resultJson.deviceName).toBe('CardioStent-X');
    expect(resultJson.intendedUse).toBe('coronary artery stenting');

    // 5. The cer_persisted audit rode the same transaction (H2 atomicity).
    expect(auditRecords.some((a) => a.action === 'cer_persisted' && a.tx)).toBe(true);
  });

  it('returns 404 when projectId belongs to another org (IDOR denial)', async () => {
    // PROJECT_ID is in projectsStore for ORG_A. Attacker in ORG_B references it.
    setSession('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', USER_A);
    const req = new Request('http://localhost/api/ra/workflows/cer', {
      method: 'POST',
      body: buildCerBody({ projectId: PROJECT_ID }),
    });
    const res = await postCer(req, {});

    expect(res.status).toBe(404);
    // No workflow_runs row persisted on denial.
    expect(workflowRunsStore).toHaveLength(0);
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
    expect(workflowRunsStore).toHaveLength(0);
  });

  it('rolls back the workflow_runs insert when the audit write fails (H2 atomicity)', async () => {
    auditShouldFailInTransaction = true;
    const req = new Request('http://localhost/api/ra/workflows/cer', {
      method: 'POST',
      body: buildCerBody({ projectId: PROJECT_ID }),
    });

    await expect(postCer(req, {})).rejects.toBeDefined();
    expect(dbMock.transaction).toHaveBeenCalledTimes(1);
    expect(auditRecords.some((a) => a.action === 'cer_created' && !a.tx)).toBe(true);
    expect(auditRecords.some((a) => a.action === 'cer_literature_search' && !a.tx)).toBe(true);
    expect(auditRecords.some((a) => a.action === 'cer_persisted' && a.tx && a.failed)).toBe(true);
    // The in-transaction insert was staged, then rolled back after writeAudit failed.
    expect(workflowRunsStore).toHaveLength(0);
  });
});
