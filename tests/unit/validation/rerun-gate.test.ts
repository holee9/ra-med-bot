// @MX:NOTE [AUTO] Unit tests for rerun-gate (SPEC-REGULA-VALIDATION-001 M4, AC-5).
// @MX:SPEC SPEC-REGULA-VALIDATION-001 (M4, AC-5, Issue #49)
// @MX:REASON AC-5: high-impact + rerun 부재 시 차단 로직 동작.

import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock db with controllable select responses.
const selectFromWhere = vi.fn();
vi.mock('@/lib/db/client', () => ({
  db: {
    select: vi.fn(() => ({ from: vi.fn(() => ({ where: selectFromWhere })) })),
  },
}));

vi.mock('drizzle-orm', () => ({
  and: (...args: unknown[]) => ({ type: 'and', args }),
  eq: (a: unknown, b: unknown) => ({ type: 'eq', a, b }),
  inArray: (a: unknown, b: unknown[]) => ({ type: 'inArray', a, b }),
}));

vi.mock('@/lib/db/schema', () => ({
  changeControl: {
    releaseId: 'release_id',
    impactLevel: 'impact_level',
    rerunRequired: 'rerun_required',
    changeAxis: 'change_axis',
    exceptionNote: 'exception_note',
  },
  validationEvidence: {
    id: 'id',
    releaseId: 'release_id',
    qualificationType: 'qualification_type',
    result: 'result',
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
    selectFromWhere.mockResolvedValueOnce([{ axis: 'model', exceptionNote: null }]); // blockingAxes
    selectFromWhere.mockResolvedValueOnce([]); // oqEvidence
    const result = await evaluateRerunGate('v0.1.0-rc1');
    expect(result.passed).toBe(false);
    expect(result.failed).toHaveLength(1);
    expect(result.failed[0]?.axis).toBe('model');
    expect(result.failed[0]?.reason).toBe('change_control:model:rerun_required');
  });

  it('passes when high-impact axis exists AND OQ evidence present', async () => {
    selectFromWhere.mockResolvedValueOnce([{ axis: 'schema', exceptionNote: null }]); // blockingAxes
    selectFromWhere.mockResolvedValueOnce([{ id: 'evid-1' }]); // oqEvidence
    const result = await evaluateRerunGate('v0.1.0-rc1');
    expect(result.passed).toBe(true);
    expect(result.failed).toEqual([]);
  });

  it('reports all blocking axes when each lacks rerun evidence', async () => {
    selectFromWhere.mockResolvedValueOnce([
      { axis: 'model', exceptionNote: null },
      { axis: 'prompt', exceptionNote: null },
      { axis: 'schema', exceptionNote: null },
    ]);
    selectFromWhere.mockResolvedValueOnce([]); // no OQ evidence
    const result = await evaluateRerunGate('v0.1.0-rc1');
    expect(result.passed).toBe(false);
    expect(result.failed).toHaveLength(3);
    const axes = result.failed.map((f) => f.axis);
    expect(axes).toEqual(['model', 'prompt', 'schema']);
  });
});
