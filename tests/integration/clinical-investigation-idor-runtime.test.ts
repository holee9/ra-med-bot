// @MX:NOTE [AUTO] Runtime IDOR + audit-tx + authoritative-citation tests for CI routes.
// @MX:SPEC SPEC-REGULA-CLINICAL-INVESTIGATION-001 (Issue #69, REQ-009/010/012)
//
// CRITICAL: This is the RUNTIME counterpart to tests/integration/clinical-investigation.test.ts.
// The source-level tests (fs.readFileSync + toContain pattern matching) verify
// STRUCTURE but NOT BEHAVIOR (L-006 recurrence). This file exercises the REAL
// route handlers + REAL lib functions against an in-memory DB mock so the five
// confirmed security defects (C-1, H-1, H-2, H-3, H-4) are covered at runtime.
//
// Strategy (MIRRORS tests/integration/capa-idor-runtime.test.ts):
//   1. Mock @/lib/auth/with-permission — bypass auth, inject a session per org.
//   2. Mock @/lib/db/client — in-memory store; the IDOR lookups
//      (assertInvestigationAccess, canCloseInvestigation, verifyLinkTargetExists)
//      run against their REAL lib code, which queries the mocked db.
//   3. Mock @/lib/audit — record writeAudit calls, simulate failure on demand.
//   4. Call the REAL route handlers with cross-org / missing-target payloads.
//
// Asserts:
//   - C-1: close with a foreign-org expertSignoffId → 403 + denial audited
//     with expert_signoff_not_org_bound.
//   - H-1: pathway outputs (assess/ide-decision) carry confidence !=
//     'unverified' (authoritative) and include real regulatory citations.
//   - H-2: links conflict path (onConflictDoNothing) returns existing row id,
//     no throw, no 500.
//   - H-3: close denial audit persists; if the audit write fails the route
//     returns 500 (fail-closed), never a clean 403.
//   - H-4: links with a targetId belonging to another org / nonexistent → 404,
//     no ci_links row persisted.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// In-memory stores + control flags
// ---------------------------------------------------------------------------

type Row = Record<string, unknown>;

interface InsertRecord {
  table: string;
  values: Row | Row[];
}
const insertRecords: InsertRecord[] = [];

interface UpdateRecord {
  table: string;
}
const updateRecords: UpdateRecord[] = [];

const auditRecords: { action: string; resource_id?: string; meta?: Row }[] = [];
const ciLinksStore: Row[] = [];

let auditShouldFail = false;
let transactionShouldFail = false;

// Seeded "database" tables the REAL lib queries run against.
const investigationsStore: Row[] = [];
const expertReviewsStore: Row[] = [];
const conversationsStore: Row[] = [];
const projectsStore: Row[] = [];
const workflowRunsStore: Row[] = [];
const pmsInputsStore: Row[] = [];
const dhfStore: Row[] = [];

// ---------------------------------------------------------------------------
// DB mock — records inserts/updates and answers select queries against the
// in-memory stores. The select chain is a thenable so awaiting works.
// ---------------------------------------------------------------------------

interface InsertChain {
  values: (v: Row | Row[]) => InsertChain;
  onConflictDoNothing: () => InsertChain;
  returning: (f?: unknown) => Promise<Row[]>;
}

// Drizzle stores the SQL table name at Symbol.for('drizzle:Name'), NOT on
// `.name`. This helper reads either so the mock can key its in-memory store.
function tableName(table: unknown): string {
  if (typeof table !== 'object' || table === null) return 'unknown';
  // biome-ignore lint/suspicious/noExplicitAny: symbol index access
  const t = table as any;
  return t?.[Symbol.for('drizzle:Name')] ?? t?.name ?? 'unknown';
}

// biome-ignore lint/suspicious/noExplicitAny: Drizzle query builder chain is deeply nested; test only needs callables
const dbMock: any = {
  insert: vi.fn((table: unknown) => {
    let pendingValues: Row | Row[] = {};
    const tn = tableName(table);
    let conflicted = false;
    const chain: InsertChain = {
      values: (values: Row | Row[]) => {
        pendingValues = values;
        return chain;
      },
      onConflictDoNothing: () => {
        conflicted = true;
        return chain;
      },
      returning: vi.fn(async () => {
        const arr = Array.isArray(pendingValues) ? pendingValues : [pendingValues];
        const first = (arr[0] as Row) ?? {};

        // ci_links UNIQUE(investigationId, targetType, targetId) — simulate
        // onConflictDoNothing: if a row with the same tuple already exists,
        // return [] (no new row) so the helper falls back to the SELECT path.
        if (tn === 'ci_links' && conflicted) {
          const dup = ciLinksStore.find(
            (r) =>
              r.investigationId === first.investigationId &&
              r.targetType === first.targetType &&
              r.targetId === first.targetId,
          );
          if (dup) return [];
        }

        insertRecords.push({ table: tn, values: pendingValues });
        if (tn === 'ci_links') {
          for (const v of arr) ciLinksStore.push({ ...v, id: v.id ?? crypto.randomUUID() });
        }
        const id = first.id ?? crypto.randomUUID();
        return [{ id }];
      }),
    };
    return chain;
  }),
  select: vi.fn(() => makeSelectChain()),
  update: vi.fn((table: unknown) => {
    const tn = tableName(table);
    return {
      set: vi.fn(() => {
        updateRecords.push({ table: tn });
        return {
          where: vi.fn(() => ({
            returning: vi.fn(async () => [{ id: 'updated-id' }]),
          })),
        };
      }),
    };
  }),
  transaction: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) => {
    if (transactionShouldFail) throw new Error('simulated transaction failure');
    return fn(dbMock);
  }),
};

// Select chain — a Promise subclass instance carrying the Drizzle query-builder
// methods (.from/.where/.innerJoin/.limit). Awaiting the chain (with or without
// a terminal .limit()) resolves to the rows from the in-memory store keyed by
// the table passed to `.from(...)`. Mirrors the capa-idor-runtime makeChain.
// biome-ignore lint/suspicious/noExplicitAny: Drizzle query builder chain is deeply nested; test only needs callables
function makeSelectChain(): any {
  let fromTable = 'unknown';
  class SelectChain extends Promise<Row[]> {
    from = vi.fn((table: unknown) => {
      fromTable = tableName(table);
      return this;
    });
    where = vi.fn(() => this);
    innerJoin = vi.fn(() => this);
    orderBy = vi.fn(() => this);
    groupBy = vi.fn(() => this);
    limit = vi.fn(async () => resolveRows(fromTable));
  }
  return SelectChain.resolve([]);
}

function resolveRows(fromTable: string): Row[] {
  // The mock does not parse Drizzle SQL predicates. To simulate the org-scope
  // WHERE clauses the REAL lib emits (eq(...orgId, orgId) etc.), we filter
  // rows by the caller's org derived from currentSession. This mirrors the
  // production RLS + gate-level org scoping under test.
  const callerOrg = currentSession.user.organizationId;
  const inOrg = (r: Row) => r.orgId === callerOrg || r.organizationId === callerOrg;
  switch (fromTable) {
    case 'clinical_investigations':
      return investigationsStore.filter(inOrg);
    case 'expert_reviews':
      // C-1 org-binding: expert_reviews has no org_id — the gate joins through
      // conversations → projects.organizationId. Simulate the join by keeping
      // only reviews whose conversation→project chain belongs to the caller
      // org. This mirrors the production gate semantics under test.
      return expertReviewsStore.filter((review) => {
        const conv = conversationsStore.find((c) => c.id === review.conversationId);
        if (!conv) return false;
        const proj = projectsStore.find((p) => p.id === conv.projectId);
        return proj?.organizationId === callerOrg;
      });
    case 'ci_links':
      return ciLinksStore.filter(inOrg);
    case 'workflow_runs':
      return workflowRunsStore.filter(inOrg);
    case 'pms_inputs':
      return pmsInputsStore.filter(inOrg);
    case 'design_history_files':
      return dhfStore.filter(inOrg);
    default:
      return [];
  }
}

vi.mock('@/lib/db/client', () => ({ db: dbMock }));

// ---------------------------------------------------------------------------
// Audit mock — records every writeAudit call. Can simulate failure.
// ---------------------------------------------------------------------------

vi.mock('@/lib/audit', () => ({
  writeAudit: vi.fn(
    async (params: { action: string; resource_id?: string; meta_json?: Row }, _tx?: unknown) => {
      if (auditShouldFail) throw new Error('simulated audit failure');
      auditRecords.push({
        action: params.action,
        resource_id: params.resource_id,
        meta: params.meta_json,
      });
      return undefined;
    },
  ),
}));

// ---------------------------------------------------------------------------
// withPermission mock — bypass RBAC, inject the session we control.
// ---------------------------------------------------------------------------

interface MockSession {
  user: { id: string; role: string; organizationId?: string };
}

let currentSession: MockSession = {
  user: { id: 'user-orgA', role: 'ra-lead', organizationId: 'org-A' },
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
// Import route handlers + linkage helper + citation libs AFTER mocks.
// ---------------------------------------------------------------------------

const { POST: postClose } = await import('@/app/api/clinical-investigation/[id]/close/route');
const { POST: postLinks } = await import('@/app/api/clinical-investigation/[id]/links/route');
const { linkInvestigationResults, verifyLinkTargetExists } = await import(
  '@/lib/clinical-investigation/linkage'
);
const { assessNecessity } = await import('@/lib/clinical-investigation/gap-assessment');
const { decideIdePathway } = await import('@/lib/clinical-investigation/ide-decision-tree');
const { canCloseInvestigation } = await import('@/lib/clinical-investigation/close-gate');

// ---------------------------------------------------------------------------
// Seed helpers
// ---------------------------------------------------------------------------

function seedInvestigation(args: {
  id: string;
  orgId: string;
  approvalStatus?: string;
}): void {
  investigationsStore.push({
    id: args.id,
    orgId: args.orgId,
    projectId: `${args.id}-proj`,
    pathway: null,
    necessityStatus: 'required',
    necessityRationale: null,
    approvalStatus: args.approvalStatus ?? 'open',
  });
}

function seedExpertReviewChain(args: {
  reviewId: string;
  status: string;
  conversationId: string;
  projectId: string;
  orgId: string;
}): void {
  expertReviewsStore.push({
    id: args.reviewId,
    conversationId: args.conversationId,
    messageId: `${args.reviewId}-msg`,
    requestedBy: 'user-1',
    assignedTo: null,
    status: args.status,
    notes: null,
  });
  conversationsStore.push({ id: args.conversationId, projectId: args.projectId });
  projectsStore.push({ id: args.projectId, organizationId: args.orgId });
}

function setSession(orgId: string, userId = 'user-1') {
  currentSession = { user: { id: userId, role: 'ra-lead', organizationId: orgId } };
}

function resetStores() {
  insertRecords.length = 0;
  updateRecords.length = 0;
  auditRecords.length = 0;
  ciLinksStore.length = 0;
  investigationsStore.length = 0;
  expertReviewsStore.length = 0;
  conversationsStore.length = 0;
  projectsStore.length = 0;
  workflowRunsStore.length = 0;
  pmsInputsStore.length = 0;
  dhfStore.length = 0;
  auditShouldFail = false;
  transactionShouldFail = false;
}

beforeEach(() => {
  resetStores();
  setSession('org-A', 'user-orgA');
});

afterEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// C-1 — close with foreign-org expertSignoffId → 403 + denial audited
// ---------------------------------------------------------------------------

describe('C-1: close gate org-binds the expert signoff (REQ-012)', () => {
  it('denies close when expertSignoffId is a resolved review belonging to ANOTHER org', async () => {
    const investigationId = '11111111-0000-0000-0000-000000000001';
    const reviewB = '22222222-0000-0000-0000-000000000001';
    seedInvestigation({ id: investigationId, orgId: 'org-A' });
    // Resolved review, but its project belongs to org-B.
    seedExpertReviewChain({
      reviewId: reviewB,
      status: 'resolved',
      conversationId: '33333333-0000-0000-0000-000000000001',
      projectId: '44444444-0000-0000-0000-000000000001',
      orgId: 'org-B',
    });
    setSession('org-A', 'user-orgA');

    const result = await canCloseInvestigation(investigationId, 'org-A', reviewB);

    // C-1 fix: the signoff is NOT org-bound → deny with expert_signoff_not_org_bound.
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('expert_signoff_not_org_bound');
  });

  it("allows close when the resolved review belongs to the caller's org", async () => {
    const investigationId = '11111111-0000-0000-0000-000000000002';
    const reviewA = '22222222-0000-0000-0000-000000000002';
    seedInvestigation({ id: investigationId, orgId: 'org-A' });
    seedExpertReviewChain({
      reviewId: reviewA,
      status: 'resolved',
      conversationId: '33333333-0000-0000-0000-000000000002',
      projectId: '44444444-0000-0000-0000-000000000002',
      orgId: 'org-A',
    });

    const result = await canCloseInvestigation(investigationId, 'org-A', reviewA);
    expect(result.allowed).toBe(true);
    expect(result.reason).toBe('ok');
  });

  it('route returns 403 + audits ci.close_blocked_signoff_missing for cross-org signoff', async () => {
    const investigationId = '11111111-0000-0000-0000-000000000003';
    const reviewB = '22222222-0000-0000-0000-000000000003';
    seedInvestigation({ id: investigationId, orgId: 'org-A' });
    seedExpertReviewChain({
      reviewId: reviewB,
      status: 'resolved',
      conversationId: '33333333-0000-0000-0000-000000000003',
      projectId: '44444444-0000-0000-0000-000000000003',
      orgId: 'org-B',
    });
    setSession('org-A', 'user-orgA');

    const req = new Request(
      `http://localhost/api/clinical-investigation/${investigationId}/close`,
      {
        method: 'POST',
        body: JSON.stringify({ expertSignoffId: reviewB }),
      },
    );

    const res = await postClose(req, { params: Promise.resolve({ id: investigationId }) });

    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.reason).toBe('expert_signoff_not_org_bound');

    // H-3: the denial audit MUST be durably recorded.
    const denial = auditRecords.find((a) => a.action === 'ci.close_blocked_signoff_missing');
    expect(denial).toBeTruthy();
    expect(denial?.meta?.reason).toBe('expert_signoff_not_org_bound');

    // The success-path UPDATE must NEVER have run.
    expect(updateRecords.filter((u) => u.table === 'clinical_investigations')).toHaveLength(0);
    expect(auditRecords.some((a) => a.action === 'ci.closed')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// H-3 — denial audit atomicity: failure → 500 (fail-closed), never clean 403
// ---------------------------------------------------------------------------

describe('H-3: close-route denial audit is transactional and fail-closed', () => {
  it('returns 500 (not 403) when the denial audit write fails', async () => {
    const investigationId = '11111111-0000-0000-0000-000000000004';
    // A UUID that does NOT resolve to any seeded review → gate denies.
    const unboundSignoff = '55555555-0000-0000-0000-000000000004';
    seedInvestigation({ id: investigationId, orgId: 'org-A' });
    setSession('org-A', 'user-orgA');
    auditShouldFail = true;

    const req = new Request(
      `http://localhost/api/clinical-investigation/${investigationId}/close`,
      {
        method: 'POST',
        body: JSON.stringify({ expertSignoffId: unboundSignoff }),
      },
    );

    const res = await postClose(req, { params: Promise.resolve({ id: investigationId }) });

    // H-3 fix: the denial audit is wrapped in db.transaction; a failure
    // propagates and the route returns 500 (fail-closed). The previous code
    // swallowed the failure and returned a clean 403.
    expect(res.status).toBe(500);
    // No success-path audit, no UPDATE.
    expect(auditRecords.some((a) => a.action === 'ci.closed')).toBe(false);
    expect(updateRecords.filter((u) => u.table === 'clinical_investigations')).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// H-2 — links conflict path (onConflictDoNothing) returns existing row id
// ---------------------------------------------------------------------------

describe('H-2: linkage onConflictDoNothing fallback uses tx handle (no throw)', () => {
  it('returns the existing ci_links row id on a duplicate insert (no 500)', async () => {
    // Seed an existing ci_links row with the SAME tuple the helper will insert.
    const existingId = '66666666-0000-0000-0000-000000000005';
    const investigationId = '11111111-0000-0000-0000-000000000005';
    const targetId = '77777777-0000-0000-0000-000000000005';
    ciLinksStore.push({
      id: existingId,
      orgId: 'org-A',
      investigationId,
      targetType: 'dhf',
      targetId,
    });

    const result = await linkInvestigationResults(
      {
        investigationId,
        orgId: 'org-A',
        targetType: 'dhf',
        targetId,
      },
      dbMock,
    );

    // H-2 fix: the fallback SELECT uses `client` (the tx handle), finds the
    // existing row, and returns its id. No throw, no 500.
    expect(result.id).toBe(existingId);
    expect(result.investigationId).toBe(investigationId);
    expect(result.targetType).toBe('dhf');
    expect(result.targetId).toBe(targetId);
  });

  it('creates a new ci_links row on first insert and returns its id', async () => {
    const investigationId = '11111111-0000-0000-0000-000000000006';
    const result = await linkInvestigationResults(
      {
        investigationId,
        orgId: 'org-A',
        targetType: 'pms',
        targetId: '77777777-0000-0000-0000-000000000006',
      },
      dbMock,
    );

    expect(result.id).toBeTruthy();
    expect(result.investigationId).toBe(investigationId);
  });
});

// ---------------------------------------------------------------------------
// H-4 — ci_links target referent validation (cross-org / phantom → 404)
// ---------------------------------------------------------------------------

describe('H-4: links route validates the referent exists in caller org (REQ-009)', () => {
  it('returns 404 when targetType=dhf and the dhf belongs to another org', async () => {
    const investigationId = '11111111-0000-0000-0000-000000000007';
    const dhfB = '88888888-0000-0000-0000-000000000007';
    seedInvestigation({ id: investigationId, orgId: 'org-A' });
    // DHF row exists but belongs to org-B.
    dhfStore.push({ id: dhfB, orgId: 'org-B' });
    setSession('org-A', 'user-orgA');

    const req = new Request(
      `http://localhost/api/clinical-investigation/${investigationId}/links`,
      {
        method: 'POST',
        body: JSON.stringify({ targetType: 'dhf', targetId: dhfB }),
      },
    );

    const res = await postLinks(req, { params: Promise.resolve({ id: investigationId }) });
    expect(res.status).toBe(404);

    // H-4: no ci_links row persisted.
    expect(ciLinksStore.filter((l) => l.investigationId === investigationId)).toHaveLength(0);
    expect(auditRecords.some((a) => a.action === 'ci.results_linked')).toBe(false);
  });

  it('returns 404 when the targetId does not exist at all (phantom)', async () => {
    const investigationId = '11111111-0000-0000-0000-000000000008';
    seedInvestigation({ id: investigationId, orgId: 'org-A' });
    setSession('org-A', 'user-orgA');

    const req = new Request(
      `http://localhost/api/clinical-investigation/${investigationId}/links`,
      {
        method: 'POST',
        body: JSON.stringify({
          targetType: 'cer',
          targetId: '99999999-0000-0000-0000-000000000008',
        }),
      },
    );

    const res = await postLinks(req, { params: Promise.resolve({ id: investigationId }) });
    expect(res.status).toBe(404);
    expect(ciLinksStore).toHaveLength(0);
  });

  it('verifyLinkTargetExists returns true for a same-org CER workflow_runs row', async () => {
    const wfId = '10101010-0000-0000-0000-000000000009';
    workflowRunsStore.push({ id: wfId, organizationId: 'org-A', workflowType: 'cer' });
    const ok = await verifyLinkTargetExists('org-A', 'cer', wfId);
    expect(ok).toBe(true);
  });

  it('verifyLinkTargetExists returns false for a cross-org PMS input', async () => {
    const pmsB = '12121212-0000-0000-0000-000000000010';
    pmsInputsStore.push({ id: pmsB, orgId: 'org-B' });
    const ok = await verifyLinkTargetExists('org-A', 'pms', pmsB);
    expect(ok).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// H-1 — pathway outputs carry authoritative citations (REQ-010)
// ---------------------------------------------------------------------------

describe('H-1: deterministic pathway citations are authoritative (REQ-010)', () => {
  it('assessNecessity returns confidence != "unverified" and real regulatory citations', () => {
    const result = assessNecessity(
      {
        cerGapSummary: 'The existing CER identifies an INSUFFICIENT evidence base.',
        literatureGapSummary: 'No clinical studies found for this indication.',
        deviceClass: 'Class III implantable',
      },
      // Deliberately pass NO retrieved sources — tier1 citations are
      // authoritative-by-construction and must NOT become 'unverified'.
      [],
    );

    expect(result.confidence).not.toBe('unverified');
    expect(result.confidence).toBe('authoritative');
    expect(result.citations.length).toBeGreaterThan(0);
    // Real regulatory basis: EU MDR Annex XIV / ISO 14155 / 21 CFR 812.
    const ids = result.citations.map((c) => `${c.source} ${c.id}`.toLowerCase());
    expect(ids.some((s) => /annex xiv/.test(s))).toBe(true);
  });

  it('decideIdePathway returns authoritative confidence with 21 CFR 812 citations', () => {
    const result = decideIdePathway({ riskLevel: 'significant', isExemptDevice: false }, []);

    expect(result.confidence).not.toBe('unverified');
    expect(result.confidence).toBe('authoritative');
    expect(result.citations.some((c) => c.id.includes('812.20'))).toBe(true);
    expect(result.citations.some((c) => c.source === '21 CFR')).toBe(true);
  });
});
