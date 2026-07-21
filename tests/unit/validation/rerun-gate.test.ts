// @MX:NOTE [AUTO] Unit tests for rerun-gate (SPEC-REGULA-VALIDATION-001 M4, AC-5).
// @MX:SPEC SPEC-REGULA-VALIDATION-001 (M4, AC-5, Issue #49)
// @MX:REASON AC-5: high-impact + rerun 부재 시 차단 로직 동작.
//   PR #359 review: temporal check — stale OQ (collected_at < assessed_at) 거부.

import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock db with controllable select responses.
const selectFromWhere = vi.fn();
vi.mock('@/lib/kernel/db/client', () => ({
  db: {
    select: vi.fn(() => ({ from: vi.fn(() => ({ where: selectFromWhere })) })),
  },
}));

vi.mock('drizzle-orm', () => ({
  and: (...args: unknown[]) => ({ type: 'and', args }),
  eq: (a: unknown, b: unknown) => ({ type: 'eq', a, b }),
  gte: (a: unknown, b: unknown) => ({ type: 'gte', a, b }),
  inArray: (a: unknown, b: unknown[]) => ({ type: 'inArray', a, b }),
}));

vi.mock('@/lib/kernel/db/schema', () => ({
  changeControl: {
    releaseId: 'release_id',
    impactLevel: 'impact_level',
    rerunRequired: 'rerun_required',
    changeAxis: 'change_axis',
    exceptionNote: 'exception_note',
    assessedAt: 'assessed_at',
  },
  validationEvidence: {
    id: 'id',
    releaseId: 'release_id',
    qualificationType: 'qualification_type',
    result: 'result',
    collectedAt: 'collected_at',
  },
}));

import { evaluateRerunGate } from '@/lib/validation/rerun-gate';

describe('rerun-gate (AC-5)', () => {
  beforeEach(() => {
    selectFromWhere.mockReset();
  });

  it('passes when no high-impact blocking axes exist', async () => {
    selectFromWhere.mockResolvedValueOnce([]); // blockingAxes
    const result = await evaluateRerunGate('v0.1.0-rc1');
    expect(result.passed).toBe(true);
    expect(result.failed).toEqual([]);
  });

  it('blocks when high-impact axis exists but no OQ evidence', async () => {
    // assessedAt = 2025-01-01T00:00:00Z (fresh OQ would need collected_at >= that)
    selectFromWhere.mockResolvedValueOnce([
      { axis: 'model', exceptionNote: null, assessedAt: new Date('2025-01-01T00:00:00Z') },
    ]);
    selectFromWhere.mockResolvedValueOnce([]); // oqEvidence
    const result = await evaluateRerunGate('v0.1.0-rc1');
    expect(result.passed).toBe(false);
    expect(result.failed).toHaveLength(1);
    expect(result.failed[0]?.axis).toBe('model');
    expect(result.failed[0]?.reason).toBe('change_control:model:rerun_required');
  });

  it('passes when high-impact axis exists AND fresh OQ evidence present', async () => {
    // assessedAt = 2025-01-01; OQ collectedAt = 2025-01-10 (after) → pass
    selectFromWhere.mockResolvedValueOnce([
      { axis: 'schema', exceptionNote: null, assessedAt: new Date('2025-01-01T00:00:00Z') },
    ]);
    selectFromWhere.mockResolvedValueOnce([
      { id: 'evid-1', collectedAt: new Date('2025-01-10T00:00:00Z') },
    ]);
    const result = await evaluateRerunGate('v0.1.0-rc1');
    expect(result.passed).toBe(true);
    expect(result.failed).toEqual([]);
  });

  it('PR #359: blocks when OQ evidence is STALE (collected_at < assessed_at)', async () => {
    // assessedAt = 2025-01-10; OQ collectedAt = 2025-01-01 (BEFORE) → stale, block
    selectFromWhere.mockResolvedValueOnce([
      { axis: 'model', exceptionNote: null, assessedAt: new Date('2025-01-10T00:00:00Z') },
    ]);
    selectFromWhere.mockResolvedValueOnce([
      { id: 'evid-stale', collectedAt: new Date('2025-01-01T00:00:00Z') },
    ]);
    const result = await evaluateRerunGate('v0.1.0-rc1');
    expect(result.passed).toBe(false);
    expect(result.failed).toHaveLength(1);
    expect(result.failed[0]?.axis).toBe('model');
    expect(result.failed[0]?.reason).toBe('change_control:model:rerun_required');
  });

  it('PR #359: passes when one axis stale but another axis has fresh OQ at its own assessed_at', async () => {
    // Two blocking axes with different assessed_at. OQ collectedAt >= later axis.
    // model assessedAt = 2025-01-01 (OQ at 2025-01-10 is fresh).
    // schema assessedAt = 2025-01-20 (OQ at 2025-01-10 is STALE for schema).
    selectFromWhere.mockResolvedValueOnce([
      { axis: 'model', exceptionNote: null, assessedAt: new Date('2025-01-01T00:00:00Z') },
      { axis: 'schema', exceptionNote: null, assessedAt: new Date('2025-01-20T00:00:00Z') },
    ]);
    // DB query uses earliest (2025-01-01) as lower bound → returns this OQ.
    selectFromWhere.mockResolvedValueOnce([
      { id: 'evid-1', collectedAt: new Date('2025-01-10T00:00:00Z') },
    ]);
    const result = await evaluateRerunGate('v0.1.0-rc1');
    expect(result.passed).toBe(false);
    expect(result.failed).toHaveLength(1);
    expect(result.failed[0]?.axis).toBe('schema'); // model passes, schema stale
  });

  it('reports all blocking axes when each lacks rerun evidence', async () => {
    selectFromWhere.mockResolvedValueOnce([
      { axis: 'model', exceptionNote: null, assessedAt: new Date('2025-01-01T00:00:00Z') },
      { axis: 'prompt', exceptionNote: null, assessedAt: new Date('2025-01-01T00:00:00Z') },
      { axis: 'schema', exceptionNote: null, assessedAt: new Date('2025-01-01T00:00:00Z') },
    ]);
    selectFromWhere.mockResolvedValueOnce([]); // no OQ evidence
    const result = await evaluateRerunGate('v0.1.0-rc1');
    expect(result.passed).toBe(false);
    expect(result.failed).toHaveLength(3);
    const axes = result.failed.map((f) => f.axis);
    expect(axes).toEqual(['model', 'prompt', 'schema']);
  });
});
