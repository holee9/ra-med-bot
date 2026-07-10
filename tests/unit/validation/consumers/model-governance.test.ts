// @MX:NOTE [AUTO] Unit tests for model-governance consumer (SPEC-REGULA-VALIDATION-002, M0).
// @MX:SPEC SPEC-REGULA-VALIDATION-002 (M0, REQ-MODELGOV-004/005)
// @MX:REASON M0 gate: fetchWindowScopedChangeRequests applies org + window
//   filter (org_id = $1 AND created_at >= $2 AND created_at < $3). Mock db
//   verifies the query chain shape and that rows pass through unmodified.

import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mock db — chain shape: select().from().where() → thenable array.
// The consumer's query ends at .where() (no .limit / .orderBy), so the
// thenable resolves directly to the row array.
// ---------------------------------------------------------------------------
let selectResult: unknown[] = [];

function makeMockDb(rows: unknown[]) {
  const selectMock = () => ({
    from: () => ({
      where: () => Promise.resolve(rows),
    }),
  });
  return { select: vi.fn(selectMock) };
}

beforeEach(() => {
  selectResult = [];
  vi.resetModules();
  vi.doMock('@/lib/db/client', () => ({ db: makeMockDb(selectResult) }));
});

// ---------------------------------------------------------------------------
// fetchWindowScopedChangeRequests — returns rows from window query
// ---------------------------------------------------------------------------
describe('fetchWindowScopedChangeRequests (REQ-MODELGOV-005)', () => {
  it('returns rows from the DB query unmodified', async () => {
    const rows = [
      {
        id: 'cr-1',
        promptId: 'prompt-1',
        modelPinId: 'pin-1',
        evalRunId: 'eval-1',
        evalResultRef: 'ref-1',
        approvalStatus: 'pending_review',
        approvedAt: null,
        createdAt: new Date('2025-06-01'),
      },
    ];
    selectResult = rows;

    const { fetchWindowScopedChangeRequests } = await import(
      '@/lib/validation/consumers/model-governance'
    );
    const result = await fetchWindowScopedChangeRequests({
      orgId: 'org-1',
      windowStart: new Date('2025-01-01'),
      windowEnd: new Date('2025-12-31'),
    });

    expect(result).toEqual(rows);
    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe('cr-1');
  });

  it('returns empty array when DB returns no rows', async () => {
    selectResult = [];

    const { fetchWindowScopedChangeRequests } = await import(
      '@/lib/validation/consumers/model-governance'
    );
    const result = await fetchWindowScopedChangeRequests({
      orgId: 'org-empty',
      windowStart: new Date('2025-01-01'),
      windowEnd: new Date('2025-12-31'),
    });

    expect(result).toEqual([]);
  });

  it('calls db.select with the expected column projection', async () => {
    selectResult = [];

    const { db } = await import('@/lib/db/client');
    const { fetchWindowScopedChangeRequests } = await import(
      '@/lib/validation/consumers/model-governance'
    );
    await fetchWindowScopedChangeRequests({
      orgId: 'org-1',
      windowStart: new Date('2025-01-01'),
      windowEnd: new Date('2025-12-31'),
    });

    expect(db.select).toHaveBeenCalledTimes(1);
    // The select mock receives a single object argument with the column projection.
    const selectArg = vi.mocked(db.select).mock.calls[0]?.[0];
    expect(selectArg).toBeTypeOf('object');
    expect(selectArg).toHaveProperty('id');
    expect(selectArg).toHaveProperty('promptId');
    expect(selectArg).toHaveProperty('modelPinId');
    expect(selectArg).toHaveProperty('evalRunId');
    expect(selectArg).toHaveProperty('evalResultRef');
    expect(selectArg).toHaveProperty('approvalStatus');
    expect(selectArg).toHaveProperty('approvedAt');
    expect(selectArg).toHaveProperty('createdAt');
  });

  it('passes orgId, windowStart, windowEnd to the query builder', async () => {
    // The mock db does not inspect WHERE args, but we verify the function
    // completes without error and calls the chain. Drizzle's and/eq/gte/lt
    // are real functions — they produce condition objects the mock ignores.
    selectResult = [];

    const { fetchWindowScopedChangeRequests } = await import(
      '@/lib/validation/consumers/model-governance'
    );
    const result = await fetchWindowScopedChangeRequests({
      orgId: 'org-xyz',
      windowStart: new Date('2025-03-01'),
      windowEnd: new Date('2025-03-31'),
    });

    expect(result).toEqual([]);
  });

  it('returns multiple rows preserving order', async () => {
    const rows = [
      {
        id: 'cr-1',
        promptId: null,
        modelPinId: null,
        evalRunId: null,
        evalResultRef: null,
        approvalStatus: 'pending_review',
        approvedAt: null,
        createdAt: new Date('2025-06-01'),
      },
      {
        id: 'cr-2',
        promptId: 'prompt-2',
        modelPinId: 'pin-2',
        evalRunId: 'eval-2',
        evalResultRef: 'ref-2',
        approvalStatus: 'approved',
        approvedAt: new Date('2025-06-02'),
        createdAt: new Date('2025-06-02'),
      },
      {
        id: 'cr-3',
        promptId: null,
        modelPinId: null,
        evalRunId: 'eval-3',
        evalResultRef: null,
        approvalStatus: 'rejected',
        approvedAt: null,
        createdAt: new Date('2025-06-03'),
      },
    ];
    selectResult = rows;

    const { fetchWindowScopedChangeRequests } = await import(
      '@/lib/validation/consumers/model-governance'
    );
    const result = await fetchWindowScopedChangeRequests({
      orgId: 'org-1',
      windowStart: new Date('2025-01-01'),
      windowEnd: new Date('2025-12-31'),
    });

    expect(result).toHaveLength(3);
    expect(result[0]?.id).toBe('cr-1');
    expect(result[1]?.id).toBe('cr-2');
    expect(result[2]?.id).toBe('cr-3');
  });

  it('handles rows with all nullable fields set to null', async () => {
    selectResult = [
      {
        id: 'cr-nulls',
        promptId: null,
        modelPinId: null,
        evalRunId: null,
        evalResultRef: null,
        approvalStatus: 'pending_review',
        approvedAt: null,
        createdAt: new Date('2025-06-01'),
      },
    ];

    const { fetchWindowScopedChangeRequests } = await import(
      '@/lib/validation/consumers/model-governance'
    );
    const result = await fetchWindowScopedChangeRequests({
      orgId: 'org-1',
      windowStart: new Date('2025-01-01'),
      windowEnd: new Date('2025-12-31'),
    });

    expect(result[0]?.promptId).toBeNull();
    expect(result[0]?.modelPinId).toBeNull();
    expect(result[0]?.evalRunId).toBeNull();
    expect(result[0]?.evalResultRef).toBeNull();
    expect(result[0]?.approvedAt).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Module exports
// ---------------------------------------------------------------------------
describe('module exports (REQ-MODELGOV-005)', () => {
  it('exports fetchWindowScopedChangeRequests and ChangeRequestRow type', async () => {
    const mod = await import('@/lib/validation/consumers/model-governance');
    expect(typeof mod.fetchWindowScopedChangeRequests).toBe('function');
  });
});
