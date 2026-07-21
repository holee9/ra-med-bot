// @MX:NOTE [AUTO] Unit tests for traceability consumer (SPEC-REGULA-VALIDATION-002, M0).
// @MX:SPEC SPEC-REGULA-VALIDATION-002 (M0, REQ-TRACEABILITY-004/005/006)
// @MX:REASON M0 gate: snapshotTraceability orchestrates listStaleNodeIds +
//   buildMatrix and extracts summary stats. Mock both dependencies to verify
//   the filter wiring (orgId + optional projectId) and summary pass-through.

import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mock dependencies: db client (dynamic import), listStaleNodeIds, buildMatrix.
// The consumer does `await import('@/lib/kernel/db/client')` then passes db to both
// listStaleNodeIds and buildMatrix. We mock all three so no real DB is hit.
// ---------------------------------------------------------------------------
const listStaleNodeIdsMock = vi.fn();
const buildMatrixMock = vi.fn();

function makeMockDb() {
  return { select: vi.fn() };
}

beforeEach(() => {
  vi.resetModules();
  listStaleNodeIdsMock.mockReset();
  buildMatrixMock.mockReset();
  vi.doMock('@/lib/kernel/db/client', () => ({ db: makeMockDb() }));
  vi.doMock('@/lib/traceability/stale-propagation', () => ({
    listStaleNodeIds: listStaleNodeIdsMock,
  }));
  vi.doMock('@/lib/traceability/matrix', () => ({
    buildMatrix: buildMatrixMock,
  }));
});

// ---------------------------------------------------------------------------
// snapshotTraceability — happy path (org-only, no projectId)
// ---------------------------------------------------------------------------
describe('snapshotTraceability — org-scoped (REQ-TRACEABILITY-004)', () => {
  it('returns summary from buildMatrix result', async () => {
    const staleSet = new Set<string>(['node-1', 'node-2']);
    listStaleNodeIdsMock.mockResolvedValue(staleSet);
    buildMatrixMock.mockResolvedValue({
      rows: [],
      summary: { totalRows: 10, withGaps: 3, stale: 2 },
    });

    const { snapshotTraceability } = await import('@/lib/validation/consumers/traceability');
    const result = await snapshotTraceability({ orgId: 'org-1' });

    expect(result).toEqual({ totalRows: 10, withGaps: 3, stale: 2 });
  });

  it('passes orgId to listStaleNodeIds', async () => {
    const staleSet = new Set<string>();
    listStaleNodeIdsMock.mockResolvedValue(staleSet);
    buildMatrixMock.mockResolvedValue({
      rows: [],
      summary: { totalRows: 0, withGaps: 0, stale: 0 },
    });

    const { snapshotTraceability } = await import('@/lib/validation/consumers/traceability');
    await snapshotTraceability({ orgId: 'org-abc' });

    expect(listStaleNodeIdsMock).toHaveBeenCalledTimes(1);
    const [dbArg, orgIdArg] = listStaleNodeIdsMock.mock.calls[0] ?? [];
    expect(orgIdArg).toBe('org-abc');
    // db is passed as first argument (the dynamically imported mock db object).
    expect(dbArg).toBeTypeOf('object');
    expect(dbArg).toHaveProperty('select');
  });

  it('passes orgId and staleNodeIds to buildMatrix', async () => {
    const staleSet = new Set<string>(['stale-1']);
    listStaleNodeIdsMock.mockResolvedValue(staleSet);
    buildMatrixMock.mockResolvedValue({
      rows: [],
      summary: { totalRows: 5, withGaps: 1, stale: 1 },
    });

    const { snapshotTraceability } = await import('@/lib/validation/consumers/traceability');
    await snapshotTraceability({ orgId: 'org-1' });

    expect(buildMatrixMock).toHaveBeenCalledTimes(1);
    const [, filters, deps] = buildMatrixMock.mock.calls[0] ?? [];
    expect(filters).toEqual({ orgId: 'org-1', projectId: undefined });
    expect(deps).toEqual({ staleNodeIds: staleSet });
  });
});

// ---------------------------------------------------------------------------
// snapshotTraceability — with projectId filter
// ---------------------------------------------------------------------------
describe('snapshotTraceability — project-scoped (REQ-TRACEABILITY-005)', () => {
  it('passes projectId to buildMatrix filters', async () => {
    listStaleNodeIdsMock.mockResolvedValue(new Set<string>());
    buildMatrixMock.mockResolvedValue({
      rows: [],
      summary: { totalRows: 2, withGaps: 0, stale: 0 },
    });

    const { snapshotTraceability } = await import('@/lib/validation/consumers/traceability');
    await snapshotTraceability({ orgId: 'org-1', projectId: 'proj-42' });

    const [, filters] = buildMatrixMock.mock.calls[0] ?? [];
    expect(filters).toEqual({ orgId: 'org-1', projectId: 'proj-42' });
  });

  it('returns project-scoped summary correctly', async () => {
    listStaleNodeIdsMock.mockResolvedValue(new Set<string>());
    buildMatrixMock.mockResolvedValue({
      rows: [],
      summary: { totalRows: 42, withGaps: 7, stale: 3 },
    });

    const { snapshotTraceability } = await import('@/lib/validation/consumers/traceability');
    const result = await snapshotTraceability({ orgId: 'org-1', projectId: 'proj-x' });

    expect(result.totalRows).toBe(42);
    expect(result.withGaps).toBe(7);
    expect(result.stale).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// snapshotTraceability — edge cases
// ---------------------------------------------------------------------------
describe('snapshotTraceability — edge cases', () => {
  it('returns zero-summary when matrix has no rows', async () => {
    listStaleNodeIdsMock.mockResolvedValue(new Set<string>());
    buildMatrixMock.mockResolvedValue({
      rows: [],
      summary: { totalRows: 0, withGaps: 0, stale: 0 },
    });

    const { snapshotTraceability } = await import('@/lib/validation/consumers/traceability');
    const result = await snapshotTraceability({ orgId: 'org-empty' });

    expect(result).toEqual({ totalRows: 0, withGaps: 0, stale: 0 });
  });

  it('propagates error from listStaleNodeIds', async () => {
    listStaleNodeIdsMock.mockRejectedValue(new Error('stale query failed'));
    buildMatrixMock.mockResolvedValue({
      rows: [],
      summary: { totalRows: 0, withGaps: 0, stale: 0 },
    });

    const { snapshotTraceability } = await import('@/lib/validation/consumers/traceability');
    await expect(snapshotTraceability({ orgId: 'org-1' })).rejects.toThrow('stale query failed');
  });

  it('propagates error from buildMatrix', async () => {
    listStaleNodeIdsMock.mockResolvedValue(new Set<string>());
    buildMatrixMock.mockRejectedValue(new Error('matrix build failed'));

    const { snapshotTraceability } = await import('@/lib/validation/consumers/traceability');
    await expect(snapshotTraceability({ orgId: 'org-1' })).rejects.toThrow('matrix build failed');
  });

  it('returns only summary fields (not rows or other matrix fields)', async () => {
    listStaleNodeIdsMock.mockResolvedValue(new Set<string>(['s1', 's2', 's3']));
    buildMatrixMock.mockResolvedValue({
      rows: [{ nodeType: 'message', refId: 'r1' }],
      summary: { totalRows: 1, withGaps: 0, stale: 3 },
      // Extra fields that should NOT leak into the return value.
      extraField: 'should-not-leak',
    });

    const { snapshotTraceability } = await import('@/lib/validation/consumers/traceability');
    const result = await snapshotTraceability({ orgId: 'org-1' });

    expect(result).not.toHaveProperty('rows');
    expect(result).not.toHaveProperty('extraField');
    expect(Object.keys(result).sort()).toEqual(['stale', 'totalRows', 'withGaps']);
  });
});

// ---------------------------------------------------------------------------
// Module exports
// ---------------------------------------------------------------------------
describe('module exports (REQ-TRACEABILITY-004)', () => {
  it('exports snapshotTraceability and MatrixSummary type', async () => {
    const mod = await import('@/lib/validation/consumers/traceability');
    expect(typeof mod.snapshotTraceability).toBe('function');
  });
});
