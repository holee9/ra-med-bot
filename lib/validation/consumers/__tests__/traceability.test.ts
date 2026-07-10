// @MX:NOTE [AUTO] Unit tests for traceability consumer (SPEC-REGULA-VALIDATION-002 M0).
// @MX:SPEC SPEC-REGULA-VALIDATION-002 (M0)

import { beforeEach, describe, expect, it, vi } from 'vitest';

// snapshotTraceability orchestrates listStaleNodeIds + buildMatrix over a
// dynamically-imported db. We mock all three so the org/project scoping and
// summary extraction control flow runs without a real DB (coverage coverage 402 —
// previously only the export was smoke-tested).
vi.mock('@/lib/db/client', () => ({ db: {} }));
vi.mock('@/lib/traceability/matrix', () => ({ buildMatrix: vi.fn() }));
vi.mock('@/lib/traceability/stale-propagation', () => ({ listStaleNodeIds: vi.fn() }));

import { buildMatrix } from '@/lib/traceability/matrix';
import { listStaleNodeIds } from '@/lib/traceability/stale-propagation';
import { snapshotTraceability } from '../traceability';

describe('snapshotTraceability (export smoke)', () => {
  it('should be exported as a function', () => {
    expect(typeof snapshotTraceability).toBe('function');
  });
});

describe('snapshotTraceability (execution, coverage 402)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns the matrix summary (totalRows/withGaps/stale) and threads staleNodeIds', async () => {
    vi.mocked(listStaleNodeIds).mockResolvedValue(new Set(['n-stale']));
    vi.mocked(buildMatrix).mockResolvedValue({
      summary: { totalRows: 5, withGaps: 1, stale: 1 },
    } as never);
    const r = await snapshotTraceability({ orgId: 'o1' });
    expect(r).toEqual({ totalRows: 5, withGaps: 1, stale: 1 });
    expect(listStaleNodeIds).toHaveBeenCalledWith(expect.anything(), 'o1');
    expect(buildMatrix).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ orgId: 'o1' }),
      expect.objectContaining({ staleNodeIds: expect.any(Set) }),
    );
  });

  it('passes the projectId filter through to buildMatrix when provided', async () => {
    vi.mocked(listStaleNodeIds).mockResolvedValue(new Set());
    vi.mocked(buildMatrix).mockResolvedValue({
      summary: { totalRows: 0, withGaps: 0, stale: 0 },
    } as never);
    const r = await snapshotTraceability({ orgId: 'o1', projectId: 'p1' });
    expect(r).toEqual({ totalRows: 0, withGaps: 0, stale: 0 });
    expect(buildMatrix).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ orgId: 'o1', projectId: 'p1' }),
      expect.anything(),
    );
  });
});
