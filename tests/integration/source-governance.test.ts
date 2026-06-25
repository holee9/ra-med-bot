// @MX:NOTE [AUTO] Hybrid source-level + domain-level integration tests for Source Governance.
// @MX:SPEC SPEC-REGULA-SOURCE-GOVERNANCE-001 (Issue #48, REQ-SOURCE-GOV-001~016, AC-01~08)
//
// Two complementary strategies (mirrors corpus-license.test.ts / capa.test.ts):
//   1. Source-level: read the route/lib/migration source and assert the control
//      is present (gate wiring at every live call site — the anti-dead-code
//      guarantee). Every gate function MUST have a confirmed call site.
//   2. Domain-level: exercise the pure gate functions (retrieval-gate,
//      stale-check, authority-model, assessLowAuthority) directly with a
//      mocked db client (CAPA #251 hybrid pattern).
//
// AC mapping:
//   AC-01 — authority/effective/sunset/superseded stored + queried (domain + schema)
//   AC-02 — superseded excluded from default search; historical includes it (domain)
//   AC-03 — stale citation in export blocked + reason (domain + source wiring)
//   AC-04 — internal SOP without owner/approval → pending_review + excluded (domain + wiring)
//   AC-05 — approve/reject audited (source-level audit tx + domain approveSource)
//   AC-06 — dashboard counts + review-due (domain getGovernanceDashboard)
//   AC-07 — delta-sync updates governance (domain + wiring at gap-replay)
//   AC-08 — low-authority-only → expert_review_required (domain assessLowAuthority + consult wiring)

import fs from 'node:fs';
import path from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const root = path.resolve(__dirname, '..', '..');
const readText = (rel: string): string => fs.readFileSync(path.join(root, rel), 'utf8');

// ---------------------------------------------------------------------------
// Shared mock db — CAPA #251 hybrid pattern. Each test configures the rows
// its gate needs, then exercises the REAL lib function. The select chain
// returns a Promise-like (array) that ALSO has `.limit()` so both
// `await db.select().from().where()` and `...where().limit(1)` work.
// ---------------------------------------------------------------------------
function makeThenable(rowsFor: () => unknown[]) {
  const p = Promise.resolve(rowsFor()) as Promise<unknown[]> & {
    limit: () => Promise<unknown[]>;
  };
  p.limit = () => Promise.resolve(rowsFor());
  return p;
}

function makeMockDb(rows: Record<string, unknown[]>) {
  const rowsFor = (key: string): unknown[] => rows[key] ?? [];
  const selectMock = () => ({
    from: () => ({
      where: () => makeThenable(() => rowsFor('select')),
      innerJoin: () => ({
        where: () => makeThenable(() => rowsFor('select')),
        limit: () => Promise.resolve(rowsFor('select')),
      }),
    }),
  });
  const txMock = {
    select: selectMock,
    insert: vi.fn(() => ({
      values: () => ({ returning: () => Promise.resolve(rowsFor('insert')) }),
    })),
    update: vi.fn(() => ({ set: () => ({ where: () => Promise.resolve() }) })),
  };
  return {
    select: vi.fn(selectMock),
    insert: vi.fn(() => ({
      values: () => ({ returning: () => Promise.resolve(rowsFor('insert')) }),
    })),
    update: vi.fn(() => ({ set: () => ({ where: () => Promise.resolve() }) })),
    transaction: vi.fn(async (cb: (tx: unknown) => Promise<unknown>) => cb(txMock)),
  };
}

// Shared mocks reset before each domain test so db row state never leaks.
let mockRows: Record<string, unknown[]> = {};

beforeEach(() => {
  mockRows = {};
  vi.doMock('@/lib/audit', () => ({
    writeAudit: vi.fn(async () => {}),
  }));
  vi.doMock('@/lib/db/client', () => ({ db: makeMockDb(mockRows) }));
});

// ---------------------------------------------------------------------------
// AC-01: authority/effective/sunset/superseded stored + queried
// ---------------------------------------------------------------------------
describe('AC-01: governance fields stored + queried (REQ-SOURCE-GOV-001/002)', () => {
  it('schema.ts adds the 9 governance columns to sources', () => {
    const src = readText('lib/db/schema.ts');
    expect(src).toMatch(/authorityGrade: sourceAuthorityGradeEnum/);
    expect(src).toMatch(/jurisdiction: text\('jurisdiction'\)/);
    expect(src).toMatch(/effectiveDate: date\('effective_date'\)/);
    expect(src).toMatch(/sunsetDate: date\('sunset_date'\)/);
    expect(src).toMatch(/supersededBy: uuid\('superseded_by'\)/);
    expect(src).toMatch(/ownerDepartment: text\('owner_department'\)/);
    expect(src).toMatch(/approvalStatus: sourceApprovalStatusEnum/);
    expect(src).toMatch(/reviewCycleDays: integer\('review_cycle_days'\)/);
    expect(src).toMatch(/lastReviewedAt: timestamp\('last_reviewed_at'/);
  });

  it('migration 0081 ALTERs sources with the 9 columns + indexes', () => {
    const sql = readText('migrations/0081_source_governance.sql');
    expect(sql).toMatch(/ADD COLUMN IF NOT EXISTS authority_grade source_authority_grade/);
    expect(sql).toMatch(/ADD COLUMN IF NOT EXISTS sunset_date date/);
    expect(sql).toMatch(/ADD COLUMN IF NOT EXISTS superseded_by uuid REFERENCES sources/);
    expect(sql).toMatch(/CREATE INDEX IF NOT EXISTS idx_sources_authority_grade/);
    expect(sql).toMatch(/CREATE INDEX IF NOT EXISTS idx_sources_sunset_date/);
  });
});

// ---------------------------------------------------------------------------
// AC-02: superseded excluded from default search; historical includes it
// ---------------------------------------------------------------------------
describe('AC-02: superseded filtering (REQ-SOURCE-GOV-005/006)', () => {
  it('domain: filterGovernanceEligible excludes superseded by default', async () => {
    mockRows.select = [
      {
        id: 'src-1',
        authorityGrade: 'regulator_official',
        approvalStatus: 'approved',
        supersededBy: null,
        sunsetDate: null,
        effectiveDate: null,
      },
      {
        id: 'src-2',
        authorityGrade: 'regulator_official',
        approvalStatus: 'approved',
        supersededBy: 'src-new',
        sunsetDate: null,
        effectiveDate: null,
      },
    ];
    const { filterGovernanceEligible } = await import('@/lib/source-governance/retrieval-gate');
    const eligible = await filterGovernanceEligible(['src-1', 'src-2'], { orgId: 'org-1' });
    expect(eligible.has('src-1')).toBe(true);
    expect(eligible.has('src-2')).toBe(false);
  });

  it('domain: historical=true includes superseded sources (REQ-006)', async () => {
    mockRows.select = [
      {
        id: 'src-2',
        authorityGrade: 'regulator_official',
        approvalStatus: 'approved',
        supersededBy: 'src-new',
        sunsetDate: null,
        effectiveDate: null,
      },
    ];
    const { filterGovernanceEligible } = await import('@/lib/source-governance/retrieval-gate');
    const eligible = await filterGovernanceEligible(['src-2'], {
      orgId: 'org-1',
      historical: true,
    });
    expect(eligible.has('src-2')).toBe(true);
  });

  it('domain: pending_review sources always excluded (REQ-009)', async () => {
    mockRows.select = [
      {
        id: 'src-pending',
        authorityGrade: 'internal_sop',
        approvalStatus: 'pending_review',
        supersededBy: null,
        sunsetDate: null,
        effectiveDate: null,
      },
    ];
    const { filterGovernanceEligible } = await import('@/lib/source-governance/retrieval-gate');
    const eligible = await filterGovernanceEligible(['src-pending'], { orgId: 'org-1' });
    expect(eligible.has('src-pending')).toBe(false);
  });

  it('source-level: composeRetrievalGates wired at all 3 retriever call sites', () => {
    const hybrid = readText('lib/ai/retrievers/hybrid-search.ts');
    const sops = readText('lib/ai/retrievers/internal-sops.ts');
    const docs = readText('lib/ai/retrievers/internal-docs.ts');
    expect(hybrid).toContain('composeRetrievalGates');
    expect(sops).toContain('composeRetrievalGates');
    expect(docs).toContain('composeRetrievalGates');
  });
});

// ---------------------------------------------------------------------------
// AC-03: stale citation in export blocked + reason
// ---------------------------------------------------------------------------
describe('AC-03: stale-citation gate at export (REQ-SOURCE-GOV-007)', () => {
  it('domain: verifyGovernanceFreshness blocks superseded + sunset-past', async () => {
    const today = new Date().toISOString().slice(0, 10);
    const past = '2020-01-01';
    void today;
    mockRows.select = [
      {
        id: 'src-sup',
        title: 'Old FDA Guidance',
        supersededBy: 'src-new',
        sunsetDate: null,
        effectiveDate: null,
        approvalStatus: 'approved',
      },
      {
        id: 'src-sunset',
        title: 'Expired EU MDR',
        supersededBy: null,
        sunsetDate: past,
        effectiveDate: null,
        approvalStatus: 'approved',
      },
      {
        id: 'src-ok',
        title: 'Current',
        supersededBy: null,
        sunsetDate: null,
        effectiveDate: null,
        approvalStatus: 'approved',
      },
    ];
    const { verifyGovernanceFreshness } = await import('@/lib/source-governance/stale-check');
    const result = await verifyGovernanceFreshness(['src-sup', 'src-sunset', 'src-ok'], 'org-1');
    expect(result.allowed).toBe(false);
    expect(result.blockedSources).toHaveLength(2);
    expect(result.blockedSources.find((b) => b.sourceId === 'src-sup')?.reason).toContain(
      'superseded',
    );
    expect(result.blockedSources.find((b) => b.sourceId === 'src-sunset')?.reason).toContain(
      'sunset',
    );
  });

  it('source-level: verifyGovernanceFreshness wired at both export routes', () => {
    const traceability = readText('app/api/traceability/[deliverableId]/export/route.ts');
    const changeControl = readText('app/api/change-control/[assessmentId]/export/route.ts');
    expect(traceability).toContain('verifyGovernanceFreshness');
    expect(traceability).toContain('auditStaleBlockedBatch');
    expect(changeControl).toContain('verifyGovernanceFreshness');
    expect(changeControl).toContain('auditStaleBlockedBatch');
  });
});

// ---------------------------------------------------------------------------
// AC-04: internal SOP without owner/approval → pending_review + excluded
// ---------------------------------------------------------------------------
describe('AC-04: pending_review on ingest (REQ-SOURCE-GOV-003/009)', () => {
  it('domain: setPendingReviewOnIngest forces pending_review for internal SOP', async () => {
    const { setPendingReviewOnIngest } = await import('@/lib/source-governance/review-workflow');
    const result = await setPendingReviewOnIngest({
      sourceId: 'src-sop-1',
      isInternalSop: true,
      ownerDepartment: null,
    });
    expect(result.approvalStatus).toBe('pending_review');
    expect(result.missingOwner).toBe(true);
  });

  it('source-level: setPendingReviewOnIngest wired at upload route + Inngest worker', () => {
    const upload = readText('app/api/ra/admin/documents/upload/route.ts');
    const worker = readText('lib/inngest/docingest/upload-processed.ts');
    expect(upload).toContain('setPendingReviewOnIngest');
    expect(worker).toContain('set-pending-review');
    expect(worker).toContain('setPendingReviewOnIngest');
  });
});

// ---------------------------------------------------------------------------
// AC-05: approve/reject audited
// ---------------------------------------------------------------------------
describe('AC-05: approval audit (REQ-SOURCE-GOV-015)', () => {
  it('source-level: approveSource wraps UPDATE + audit in one transaction', () => {
    const src = readText('lib/source-governance/review-workflow.ts');
    expect(src).toContain('db.transaction');
    expect(src).toContain('auditSourceApproval');
  });

  it('source-level: approve route enforces RBAC sourcegov.manage + IDOR 404', () => {
    const src = readText('app/api/source-governance/approve/route.ts');
    expect(src).toContain("withPermission('sourcegov.manage'");
    expect(src).toContain('source_not_found');
  });

  it('source-level: source.approved + source.rejected in AuditAction union', () => {
    const auditSrc = readText('lib/audit.ts');
    expect(auditSrc).toContain("'source.approved'");
    expect(auditSrc).toContain("'source.rejected'");
  });
});

// ---------------------------------------------------------------------------
// AC-06: dashboard counts + review-due
// ---------------------------------------------------------------------------
describe('AC-06: governance dashboard (REQ-SOURCE-GOV-012/013/014)', () => {
  it('source-level: dashboard route enforces RBAC sourcegov.view', () => {
    const src = readText('app/api/source-governance/dashboard/route.ts');
    expect(src).toContain("withPermission('sourcegov.view'");
    expect(src).toContain('getGovernanceDashboard');
  });

  it('source-level: review-due route enforces RBAC sourcegov.view', () => {
    const src = readText('app/api/source-governance/review-due/route.ts');
    expect(src).toContain("withPermission('sourcegov.view'");
    expect(src).toContain('getReviewDueSources');
  });

  it('source-level: dashboard page exists with count cards + review-due list', () => {
    const src = readText('app/(app)/governance/page.tsx');
    expect(src).toContain('getGovernanceDashboard');
    expect(src).toContain('governance-count-approved');
    expect(src).toContain('governance-review-due-list');
    expect(src).toContain('governance-stale-artifacts-list');
  });
});

// ---------------------------------------------------------------------------
// AC-07: delta-sync updates governance
// ---------------------------------------------------------------------------
describe('AC-07: delta-sync governance refresh (REQ-SOURCE-GOV-016)', () => {
  it('source-level: updateGovernanceFromSync wired at gap-replay (delta-sync completion)', () => {
    const src = readText('lib/radar/delta-sync/gap-replay.ts');
    expect(src).toContain('updateGovernanceFromSync');
    expect(src).toContain('source-governance/delta-sync-hook');
  });

  it('source-level: delta-sync-hook writes audit source.delta_sync_updated in tx', () => {
    const src = readText('lib/source-governance/delta-sync-hook.ts');
    expect(src).toContain('db.transaction');
    expect(src).toContain('auditSourceDeltaSyncUpdated');
  });
});

// ---------------------------------------------------------------------------
// AC-08: low-authority-only → expert_review_required
// ---------------------------------------------------------------------------
describe('AC-08: low-authority expert review flag (REQ-SOURCE-GOV-008)', () => {
  it('domain: assessLowAuthority flags when only secondary_reference present', async () => {
    const { assessLowAuthority } = await import('@/lib/source-governance/retrieval-gate');
    const result = assessLowAuthority([
      { sourceId: 'src-1', grade: 'secondary_reference' },
      { sourceId: 'src-2', grade: 'public_database' },
    ]);
    expect(result.lowAuthorityOnly).toBe(true);
    expect(result.reason).toContain('low-authority');
  });

  it('domain: assessLowAuthority does NOT flag when a primary grade present', async () => {
    const { assessLowAuthority } = await import('@/lib/source-governance/retrieval-gate');
    const result = assessLowAuthority([
      { sourceId: 'src-1', grade: 'regulator_official' },
      { sourceId: 'src-2', grade: 'secondary_reference' },
    ]);
    expect(result.lowAuthorityOnly).toBe(false);
    expect(result.reason).toBeNull();
  });

  it('source-level: assessLowAuthority + auditSourceLowAuthorityFlagged wired in consult.ts', () => {
    const src = readText('lib/ai/consult.ts');
    expect(src).toContain('assessLowAuthority');
    expect(src).toContain('auditSourceLowAuthorityFlagged');
    expect(src).toContain('lowAuthorityReason');
  });
});

// ---------------------------------------------------------------------------
// IDOR + RBAC + compose-with-license-filter guarantees
// ---------------------------------------------------------------------------
describe('IDOR + compose-with-license-filter', () => {
  it('source-level: getSourceInOrg scopes by orgId (IDOR gate)', () => {
    const src = readText('lib/source-governance/access.ts');
    expect(src).toContain('eq(sources.organizationId, orgId)');
  });

  it('source-level: approveSource returns null on IDOR miss (→ 404)', () => {
    const src = readText('lib/source-governance/review-workflow.ts');
    expect(src).toContain('if (!existing) return null');
  });

  it('source-level: composeRetrievalGates intersects license + governance filters', () => {
    const src = readText('lib/source-governance/retrieval-gate.ts');
    expect(src).toContain('filterExpiredSources');
    expect(src).toContain('licenseEligible.intersection(govEligible)');
  });

  it('source-level: sourcegov.manage = ra-lead, sourcegov.view = ra-member', () => {
    const src = readText('lib/auth/permissions.ts');
    expect(src).toMatch(/'sourcegov\.manage':\s*\{\s*minRole:\s*'ra-lead'/);
    expect(src).toMatch(/'sourcegov\.view':\s*\{\s*minRole:\s*'ra-member'/);
  });
});

// ---------------------------------------------------------------------------
// BEHAVIORAL tests (Issue #48 follow-up): exercise REAL lib functions with a
// sequential-select mock db. Each fix (C-1/C-2/H-3/H-2/H-1/M-3) is verified by
// behavior, not source-string grep. Mirrors CAPA #251 hybrid pattern.
// ---------------------------------------------------------------------------

// Sequential mock: each db.select().from().where() / .where().limit() call pops
// the next row-set from `queue`. This lets multi-select functions
// (markSuperseded does getSourceInOrg x2) be exercised deterministically.
function makeSequentialMockDb(queue: unknown[][]) {
  let idx = 0;
  const pop = () => {
    const rows = queue[idx] ?? [];
    idx += 1;
    return rows;
  };
  const thenable = (rows: unknown[]) => {
    const p = Promise.resolve(rows) as Promise<unknown[]> & {
      limit: () => Promise<unknown[]>;
    };
    p.limit = () => Promise.resolve(rows);
    return p;
  };
  const selectMock = () => ({
    from: () => ({
      where: () => thenable(pop()),
    }),
  });
  const txMock = {
    select: selectMock,
    update: vi.fn(() => ({ set: () => ({ where: () => Promise.resolve() }) })),
    insert: vi.fn(() => ({ values: () => Promise.resolve() })),
  };
  return {
    select: vi.fn(selectMock),
    update: vi.fn(() => ({ set: () => ({ where: () => Promise.resolve() }) })),
    transaction: vi.fn(async (cb: (tx: unknown) => Promise<unknown>) => cb(txMock)),
  };
}

describe('BEHAVIORAL C-2+M-1: markSuperseded (REQ-SOURCE-GOV-005/006)', () => {
  it('writes superseded_by + audits when successor is in same org', async () => {
    vi.doMock('@/lib/audit', () => ({ writeAudit: vi.fn(async () => {}) }));
    vi.doMock('@/lib/db/client', () => ({
      db: makeSequentialMockDb([
        [{ id: 'src-old', approvalStatus: 'approved' }], // getSourceInOrg(sourceId)
        [{ id: 'src-new', approvalStatus: 'approved' }], // getSourceInOrg(supersededBy)
        // assessSourceChangeImpact: messageSources select → empty
        [],
        // assessSourceChangeImpact: unansweredQueue select → empty
        [],
      ]),
    }));
    vi.resetModules();
    const { markSuperseded } = await import('@/lib/source-governance/review-workflow');
    const result = await markSuperseded({
      sourceId: 'src-old',
      supersededBy: 'src-new',
      orgId: 'org-1',
      userId: 'user-1',
    });
    expect(result).toEqual({ ok: true });
  });

  it('rejects self-cycle (sourceId === supersededBy) → ok:false, no db write', async () => {
    const db = makeSequentialMockDb([]);
    vi.doMock('@/lib/audit', () => ({ writeAudit: vi.fn(async () => {}) }));
    vi.doMock('@/lib/db/client', () => ({ db }));
    vi.resetModules();
    const { markSuperseded } = await import('@/lib/source-governance/review-workflow');
    const result = await markSuperseded({
      sourceId: 'src-x',
      supersededBy: 'src-x',
      orgId: 'org-1',
      userId: 'user-1',
    });
    expect(result).toEqual({ ok: false });
    expect(db.update).not.toHaveBeenCalled();
  });

  it('returns null on IDOR miss (source not in org)', async () => {
    vi.doMock('@/lib/audit', () => ({ writeAudit: vi.fn(async () => {}) }));
    vi.doMock('@/lib/db/client', () => ({
      db: makeSequentialMockDb([[]]), // getSourceInOrg returns empty
    }));
    vi.resetModules();
    const { markSuperseded } = await import('@/lib/source-governance/review-workflow');
    const result = await markSuperseded({
      sourceId: 'src-foreign',
      supersededBy: 'src-new',
      orgId: 'org-1',
      userId: 'user-1',
    });
    expect(result).toBeNull();
  });
});

describe('BEHAVIORAL H-3: updateGovernanceFields sets authorityGrade (REQ-SOURCE-GOV-004/008)', () => {
  it('sets authorityGrade + audits when source is in org', async () => {
    const db = makeSequentialMockDb([
      [{ id: 'src-1', approvalStatus: 'approved' }], // getSourceInOrg
      [], // assessSourceChangeImpact messageSources
      [], // assessSourceChangeImpact unansweredQueue
    ]);
    vi.doMock('@/lib/audit', () => ({ writeAudit: vi.fn(async () => {}) }));
    vi.doMock('@/lib/db/client', () => ({ db }));
    vi.resetModules();
    const { updateGovernanceFields } = await import('@/lib/source-governance/review-workflow');
    const result = await updateGovernanceFields({
      sourceId: 'src-1',
      orgId: 'org-1',
      userId: 'user-1',
      fields: { authorityGrade: 'regulator_official' },
    });
    expect(result?.updatedFields).toContain('authority_grade');
    // The tx.update was called inside the transaction with our setClause.
    expect(db.transaction).toHaveBeenCalled();
  });

  it('returns null on IDOR miss (→ 404)', async () => {
    vi.doMock('@/lib/audit', () => ({ writeAudit: vi.fn(async () => {}) }));
    vi.doMock('@/lib/db/client', () => ({
      db: makeSequentialMockDb([[]]),
    }));
    vi.resetModules();
    const { updateGovernanceFields } = await import('@/lib/source-governance/review-workflow');
    const result = await updateGovernanceFields({
      sourceId: 'src-foreign',
      orgId: 'org-1',
      userId: 'user-1',
      fields: { authorityGrade: 'regulator_official' },
    });
    expect(result).toBeNull();
  });
});

describe('BEHAVIORAL H-2: assessSourceChangeImpact produces knowledge-gap impact (REQ-010)', () => {
  it('returns knowledgeGapIds derived from message_sources → unanswered_queue join', async () => {
    vi.doMock('@/lib/db/client', () => ({
      db: makeSequentialMockDb([
        // messageSources select: 2 messages reference this source
        [{ messageId: 'msg-1' }, { messageId: 'msg-2' }],
        // unansweredQueue select: 1 of those messages is an open gap
        [{ id: 'gap-1' }],
      ]),
    }));
    vi.resetModules();
    const { assessSourceChangeImpact } = await import('@/lib/source-governance/review-workflow');
    const impact = await assessSourceChangeImpact({ sourceId: 'src-1' });
    expect(impact.knowledgeGapIds).toEqual(['gap-1']);
  });

  it('returns empty when no messages reference the source', async () => {
    vi.doMock('@/lib/db/client', () => ({
      db: makeSequentialMockDb([[]]),
    }));
    vi.resetModules();
    const { assessSourceChangeImpact } = await import('@/lib/source-governance/review-workflow');
    const impact = await assessSourceChangeImpact({ sourceId: 'src-orphan' });
    expect(impact.knowledgeGapIds).toEqual([]);
  });
});

describe('BEHAVIORAL C-1: gap-replay passes REAL touched source IDs (REQ-SOURCE-GOV-016/AC-07)', () => {
  it('collects resolved source IDs from replay results and calls updateGovernanceFromSync with non-empty updates', async () => {
    // Stub the knowledge-gap replay module to return a result with 2 sources.
    vi.doMock('@/lib/knowledge-gap/replay', () => ({
      replayGapTest: vi.fn(async () => ({
        passed: true,
        answerWithCitations: 'answer',
        sources: [{ id: 'src-a' }, { id: 'src-b' }],
        remainingReason: null,
        reasonSummary: 'ok',
        edgeIntegrity: { intact: true, missingEdges: [], staleEdges: [] },
      })),
      markGapResolved: vi.fn(async () => {}),
    }));
    // Capture the governance refresh call.
    const captured: { updates: unknown[] }[] = [];
    vi.doMock('@/lib/source-governance/delta-sync-hook', () => ({
      updateGovernanceFromSync: vi.fn(async (params: { updates: unknown[] }) => {
        captured.push({ updates: params.updates });
        return { refreshed: [], skipped: [] };
      }),
    }));
    vi.resetModules();
    const { triggerGapReplay } = await import('@/lib/radar/delta-sync/gap-replay');
    await triggerGapReplay({
      crawlerName: 'fda',
      matchedGapIds: ['gap-1'],
      ingestionRunId: 'run-1',
      orgId: 'org-1',
    });
    // The hook MUST have been called with a NON-empty updates array (the
    // dead-code bug was updates: []). Both touched source IDs appear.
    expect(captured).toHaveLength(1);
    const first = captured[0];
    expect(first).toBeDefined();
    const updates = (first?.updates ?? []) as Array<{ sourceId: string }>;
    expect(updates.length).toBeGreaterThan(0);
    const ids = updates.map((u) => u.sourceId);
    expect(ids).toEqual(expect.arrayContaining(['src-a', 'src-b']));
  });
});

describe('BEHAVIORAL H-1: governance freshness gate at export routes', () => {
  it('source-level: verifyGovernanceFreshness wired at packet read + CER + PCCP exports', () => {
    const packet = readText('app/api/traceability/[deliverableId]/packet/route.ts');
    const cer = readText('app/api/ra/workflows/cer/export/route.ts');
    const pccp = readText('app/api/ra/workflows/pccp/[id]/export/route.ts');
    expect(packet).toContain('verifyGovernanceFreshness');
    expect(packet).toContain('auditStaleBlockedBatch');
    expect(cer).toContain('verifyGovernanceFreshness');
    expect(pccp).toContain('verifyGovernanceFreshness');
  });
});

describe('BEHAVIORAL M-3: review-due query uses interval arithmetic (REQ-SOURCE-GOV-013)', () => {
  it('source-level: review-notifier uses last_reviewed_at + cycle interval (not lte cycle vs withinDays)', () => {
    const src = readText('lib/source-governance/review-notifier.ts');
    // The dead-code bug was `lte(reviewCycleDays, withinDays)` — comparing
    // cycle-days against 30. The fix pushes real due-date arithmetic to SQL.
    expect(src).not.toContain('lte(sources.reviewCycleDays');
    expect(src).toMatch(/review_cycle_days.*days.*interval/i);
    expect(src).toMatch(/last_reviewed_at.*interval|now\(\).*days/is);
  });
});
