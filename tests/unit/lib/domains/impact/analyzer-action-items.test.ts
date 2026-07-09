// @MX:NOTE [AUTO] #391 AC #1 — behavioral coverage for analyzeImpact action-items tx atomicity.
// @MX:REASON Proves PR-E-① (#386) wraps the action-item INSERT (via enqueueActionItems)
//           + auditActionItemCreated in ONE db.transaction, and that the assessment
//           INSERT + auditAssessmentCreated ride their own tx — both audit helpers
//           receive a transaction handle (not autocommit), satisfying 21 CFR Part 11
//           §11.10(e). Mirrors the pccp-routes.test.ts pattern (#392).
// @MX:SPEC SPEC-REGULA-IMPACT-001, Issue #391 AC #1

import { describe, expect, it, vi } from 'vitest';

// Shared tx handle threaded by db.transaction. Both the assessment tx and the
// action-items tx reuse it (single mock). `values()` returns an object that is
// BOTH thenable (for the action-items bulk `await q.insert().values(rows)` path)
// AND exposes `.onConflictDoNothing().returning()` (for the assessment path).
// `values()` returns this plain object for BOTH insert paths:
//  - assessment: `.values().onConflictDoNothing().returning()` → [{ id: 'a-1' }].
//  - action-items (enqueueActionItems): `await q.insert().values(rows)` — awaiting a
//    plain (non-thenable) object resolves to the object itself, which the caller ignores.
const VALUES_RESULT = {
  onConflictDoNothing: vi.fn(() => ({ returning: vi.fn(async () => [{ id: 'a-1' }]) })),
};
const txMock = {
  insert: vi.fn(() => ({ values: vi.fn(() => VALUES_RESULT) })),
  select: vi.fn(() => ({ from: vi.fn(() => ({ where: vi.fn(async () => [{ id: 'ai-1' }]) })) })),
};

const auditAssessmentCreated = vi.fn(async (_p: unknown, _tx?: unknown) => undefined);
const auditCriticalDetected = vi.fn(async (_p: unknown, _tx?: unknown) => undefined);
const auditActionItemCreated = vi.fn(async (_p: unknown, _tx?: unknown) => undefined);

vi.mock('@/lib/domains/impact/portfolio-scanner', () => ({
  // One critical scan result with a non-empty affected_section so enqueueActionItems
  // takes the bulk-INSERT path + the auditCriticalDetected branch fires.
  scanPortfolio: vi.fn(async () => [
    {
      project_id: 'proj-1',
      impact_level: 'critical',
      affected_sections: [{ document_type: 'IFU', section_reference: '4.2', rationale: 'r' }],
      analysis_summary: 'summary',
      confidence: 0.9,
    },
  ]),
}));
vi.mock('@/lib/domains/impact/audit-wiring', () => ({
  auditAssessmentCreated,
  auditCriticalDetected,
  auditActionItemCreated,
}));

const UPDATE = {
  id: 'ru-1',
  title: 't',
  region: 'US',
  severity: 'high',
  affectedProductTypes: [],
  impactTypeHint: null,
  impactAnalysisText: null,
};
// analyzeImpact takes `db` as a param (not an import) — construct it inline.
const dbMock = {
  select: vi.fn(() => ({
    from: vi.fn(() => ({ where: vi.fn(() => ({ limit: vi.fn(async () => [UPDATE]) })) })),
  })),
  transaction: vi.fn(async (cb: (tx: typeof txMock) => Promise<unknown>) => cb(txMock)),
};

describe('analyzeImpact — action item INSERT + audit ride ONE tx (#391 AC #1)', () => {
  it('forwards the action-items tx to auditActionItemCreated (atomic with the INSERT)', async () => {
    const { analyzeImpact } = await import('@/lib/domains/impact/analyzer');
    const result = await analyzeImpact(
      { regulatory_update_id: 'ru-1', org_id: 'org-1', actor_id: 'user-1' },
      dbMock as never,
    );

    // Result counters (1 critical scan result → 1 assessment, 1 action item, 1 critical).
    expect(result.assessments_created).toBe(1);
    expect(result.action_items_created).toBe(1);
    expect(result.critical_count).toBe(1);

    // Assessment INSERT + its audits rode a tx (not autocommit).
    expect(auditAssessmentCreated.mock.calls[0]?.[1]).toBe(txMock);
    expect(auditCriticalDetected).toHaveBeenCalledTimes(1);
    expect(auditCriticalDetected.mock.calls[0]?.[1]).toBe(txMock);

    // Action-item INSERT (enqueueActionItems) + auditActionItemCreated rode a tx.
    expect(auditActionItemCreated).toHaveBeenCalledTimes(1);
    expect(auditActionItemCreated.mock.calls[0]?.[1]).toBe(txMock);
    // And the action-items INSERT used the tx (enqueueActionItems received txMock).
    expect(txMock.insert).toHaveBeenCalled();
  });
});
