// @MX:NOTE [AUTO] AC-05 supersession write-path tests — SPEC-REGULA-TRACEABILITY-001.
// @MX:SPEC SPEC-REGULA-TRACEABILITY-001 (AC-05, REQ-TRACEABILITY-009)
//           SPEC-REGULA-DELTA-SYNC-001 (REQ-DELTA-005, REQ-DELTA-006)
//
// Verifies the #238 deliverables:
//   1. applyOutdateOperations UPDATEs superseded_by + updated_at in an org-scoped tx.
//   2. Hook fires once per newly-superseded section (non-blocking).
//   3. Idempotent — re-running over already-superseded sections is a no-op.
//   4. Hook failure does NOT roll back the supersession (non-blocking proof).
//   5. Empty input short-circuits.
//
// The db client is mocked at the module boundary so the test never touches a real
// connection. withTenantScope is stubbed to invoke the callback with a mock tx
// that records update calls + returns a rowCount the test controls.

import { beforeEach, describe, expect, it, vi } from 'vitest';

// --- Mocks ---------------------------------------------------------------

// M-2 (Issue #300): applyOutdateOperations now calls writeAudit inside the tx
// for EACH newly-superseded section (traceability.section_superseded). Mocked
// at the module boundary so the test never touches a real connection. Uses
// vi.hoisted because vi.mock factories are hoisted above const declarations.
const { onSourceSectionSupersededMock, writeAuditMock } = vi.hoisted(() => ({
  onSourceSectionSupersededMock: vi.fn(),
  writeAuditMock: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib/traceability/hooks', () => ({
  onSourceSectionSuperseded: onSourceSectionSupersededMock,
}));

vi.mock('@/lib/audit', () => ({ writeAudit: writeAuditMock }));

// Capture the tx callback so each test can invoke it with a controlled mock tx.
let capturedTxCallback: ((tx: unknown) => Promise<unknown>) | null = null;
const updateChain = {
  set: vi.fn().mockReturnThis(),
  where: vi.fn().mockImplementation(() => Promise.resolve({ rowCount: 1 })),
};
// M-2 (Issue #300): writeAudit now rides the supersession tx for each newly-
// superseded section. The mock tx must expose an insert-shaped handle so the
// in-tx audit row write resolves without a real connection.
const mockTx = {
  update: vi.fn().mockReturnValue(updateChain),
  insert: vi.fn().mockReturnValue({
    values: vi.fn().mockResolvedValue(undefined),
  }),
};

vi.mock('@/lib/db/client', () => ({
  db: {},
  // withTenantScope sets the org GUC then calls fn(tx). In the test we skip the
  // GUC (no real connection) and just invoke the callback with the mock tx.
  withTenantScope: vi
    .fn()
    .mockImplementation(async (_orgId: string, fn: (tx: unknown) => Promise<unknown>) => {
      capturedTxCallback = fn;
      return fn(mockTx);
    }),
}));

// sourceSections schema symbol — only needs to be a stable object reference for
// the eq()/isNull() builders; the mock tx.update ignores it.
vi.mock('@/lib/db/schema', () => ({
  sourceSections: { id: 'id', superseded_by: 'superseded_by', updated_at: 'updated_at' },
}));

// drizzle-orm operators — return sentinel objects the test never inspects. The
// real query is built via the mock chain; we only assert the call shapes.
vi.mock('drizzle-orm', () => ({
  and: vi.fn((..._args: unknown[]) => ({ op: 'and' })),
  eq: vi.fn((_a: unknown, _b: unknown) => ({ op: 'eq' })),
  isNull: vi.fn((_a: unknown) => ({ op: 'isNull' })),
}));

// Import AFTER mocks are registered.
import { applyOutdateOperations } from '../../lib/radar/delta-sync/ingest';

describe('delta-sync supersession write path — E. applyOutdateOperations (AC-05)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    capturedTxCallback = null;
    // Default: each update matches exactly 1 row (the "newly superseded" path).
    updateChain.where.mockImplementation(() => Promise.resolve({ rowCount: 1 }));
    onSourceSectionSupersededMock.mockResolvedValue({ propagated: true, affectedCount: 2 });
    writeAuditMock.mockResolvedValue(undefined);
  });

  it('empty existingChunkIds short-circuits with zero db calls', async () => {
    const result = await applyOutdateOperations({
      orgId: 'org-1',
      existingChunkIds: [],
      newIngestionRunId: 'run-1',
      actorId: null,
    });

    expect(result.applied).toBe(0);
    expect(result.results).toEqual([]);
    expect(mockTx.update).not.toHaveBeenCalled();
  });

  it('UPDATEs each section + fires the hook once per section', async () => {
    const result = await applyOutdateOperations({
      orgId: 'org-1',
      existingChunkIds: ['sec-a', 'sec-b', 'sec-c'],
      newIngestionRunId: 'run-42',
      actorId: 'user-1',
    });

    // 3 update calls (one per section).
    expect(mockTx.update).toHaveBeenCalledTimes(3);
    // Hook fires once per newly-superseded section.
    expect(onSourceSectionSupersededMock).toHaveBeenCalledTimes(3);
    expect(onSourceSectionSupersededMock).toHaveBeenCalledWith({
      orgId: 'org-1',
      refId: 'sec-a',
      actorId: 'user-1',
    });

    expect(result.applied).toBe(3);
    expect(result.results).toHaveLength(3);
    expect(result.results[0]).toEqual({
      sectionId: 'sec-a',
      applied: true,
      propagation: { propagated: true, affectedCount: 2 },
    });
  });

  it('idempotent — sections already superseded (rowCount=0) skip the hook', async () => {
    // Simulate the DB finding the row already superseded_by-set.
    updateChain.where.mockImplementation(() => Promise.resolve({ rowCount: 0 }));

    const result = await applyOutdateOperations({
      orgId: 'org-1',
      existingChunkIds: ['sec-already'],
      newIngestionRunId: 'run-43',
      actorId: null,
    });

    expect(result.applied).toBe(0);
    // Hook MUST NOT fire for a section that was already superseded (no-op).
    expect(onSourceSectionSupersededMock).not.toHaveBeenCalled();
    expect(result.results[0]?.applied).toBe(false);
  });

  it('hook failure does NOT roll back the supersession (non-blocking proof)', async () => {
    // The real hook swallows internally, but if the dynamic-import boundary
    // throws, applyOutdateOperations must still return applied=1 for this section.
    onSourceSectionSupersededMock.mockRejectedValue(new Error('hook explosion'));

    const result = await applyOutdateOperations({
      orgId: 'org-1',
      existingChunkIds: ['sec-x'],
      newIngestionRunId: 'run-44',
      actorId: 'user-2',
    });

    // The supersession itself committed — applied=1 despite hook failure.
    expect(result.applied).toBe(1);
    expect(result.results[0]?.applied).toBe(true);
    // propagation reflects the swallowed failure, not a thrown error.
    expect(result.results[0]?.propagation).toEqual({ propagated: false, affectedCount: 0 });
  });

  it('runs inside withTenantScope with the provided orgId (RLS scoping)', async () => {
    const { withTenantScope } = await import('@/lib/db/client');
    await applyOutdateOperations({
      orgId: 'org-eu',
      existingChunkIds: ['sec-eu'],
      newIngestionRunId: 'run-eu',
      actorId: 'user-eu',
    });

    expect(withTenantScope).toHaveBeenCalledWith('org-eu', expect.any(Function));
    expect(capturedTxCallback).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// M-2 (Issue #300): traceability.section_superseded — Part 11 audit per section,
// independent of evidence_node existence. Closes the gap where
// onSourceSectionSuperseded early-returns when no deliverable cited the section.
// ---------------------------------------------------------------------------
describe('M-2 audit — traceability.section_superseded per newly-superseded section', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    updateChain.where.mockImplementation(() => Promise.resolve({ rowCount: 1 }));
    onSourceSectionSupersededMock.mockResolvedValue({ propagated: true, affectedCount: 0 });
  });

  it('emits one traceability.section_superseded audit row per newly-superseded section (in-tx)', async () => {
    await applyOutdateOperations({
      orgId: 'org-1',
      existingChunkIds: ['sec-a', 'sec-b', 'sec-c'],
      newIngestionRunId: 'run-99',
      actorId: 'user-1',
    });

    const sectionAuditCalls = writeAuditMock.mock.calls.filter(
      (c) => (c[0] as { action: string }).action === 'traceability.section_superseded',
    );
    expect(sectionAuditCalls).toHaveLength(3);
    // Each call passes the tx (atomicity — rides the supersession tx).
    expect(sectionAuditCalls[0]?.[1]).toBe(mockTx);
    expect(sectionAuditCalls[0]?.[0]).toMatchObject({
      action: 'traceability.section_superseded',
      resource_type: 'source_section',
      resource_id: 'sec-a',
    });
  });

  it('does NOT emit section_superseded for already-superseded sections (rowCount=0 idempotent)', async () => {
    updateChain.where.mockImplementation(() => Promise.resolve({ rowCount: 0 }));

    await applyOutdateOperations({
      orgId: 'org-1',
      existingChunkIds: ['sec-already'],
      newIngestionRunId: 'run-100',
      actorId: null,
    });

    const sectionAuditCalls = writeAuditMock.mock.calls.filter(
      (c) => (c[0] as { action: string }).action === 'traceability.section_superseded',
    );
    expect(sectionAuditCalls).toHaveLength(0);
  });

  it('audit fires even when the post-commit hook finds no evidence_node (the M-2 gap)', async () => {
    // Hook returns propagated:false — simulating the no-evidence_node early-return.
    onSourceSectionSupersededMock.mockResolvedValue({ propagated: false, affectedCount: 0 });

    await applyOutdateOperations({
      orgId: 'org-1',
      existingChunkIds: ['sec-orphan'],
      newIngestionRunId: 'run-101',
      actorId: 'user-2',
    });

    // The supersession is STILL auditable via traceability.section_superseded,
    // even though the stale-propagation hook did nothing.
    const sectionAuditCalls = writeAuditMock.mock.calls.filter(
      (c) => (c[0] as { action: string }).action === 'traceability.section_superseded',
    );
    expect(sectionAuditCalls).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// F. Retriever superseded-section guard ([지양-2] — stale chunks must not surface)
// ---------------------------------------------------------------------------
// Source-level governance (filterGovernanceEligible) excludes superseded SOURCES,
// but section-level supersession happens WITHIN an active source (delta-sync
// refreshes the same source; old chunks get superseded_by set). This guard verifies
// the SQL in every source_sections retriever excludes superseded sections.
describe('retriever superseded-section guard — F. [지양-2] no stale chunks', () => {
  it('hybrid-search.ts excludes ss.superseded_by IS NULL in every SQL branch', async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const src = fs.readFileSync(
      path.resolve(process.cwd(), 'lib/ai/retrievers/hybrid-search.ts'),
      'utf8',
    );
    // The constant is declared once and interpolated at every WHERE site. Verify
    // the filter exists (definition) AND is wired at all 4 sites via the
    // supersededFilter interpolation marker.
    expect(src).toContain('superseded_by IS NULL');
    const interpolations = src.match(/\$\{supersededFilter\}/g) ?? [];
    // 4 WHERE sites: vec CTE, fts CTE, combined, fts-only.
    expect(interpolations.length).toBe(4);
  });

  it('internal-sops.ts excludes ss.superseded_by IS NULL in every SQL branch', async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const src = fs.readFileSync(
      path.resolve(process.cwd(), 'lib/ai/retrievers/internal-sops.ts'),
      'utf8',
    );
    // internal-sops uses inline SQL (no constant), so each WHERE site must
    // contain the literal filter. 4 sites: vec CTE, fts CTE, combined, fts-only.
    const matches = src.match(/superseded_by IS NULL/g) ?? [];
    expect(matches.length).toBe(4);
  });
});
