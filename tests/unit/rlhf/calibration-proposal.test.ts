// @MX:NOTE [AUTO] Unit tests for calibration-proposal.ts (2 exports).
// @MX:SPEC SPEC-REGULA-RLHF-001 (REQ-RLHF-005/006/015, Issue #402)
// @MX:REASON proposeCalibrationCandidate writes a candidate row + emits an
//   audit in the same tx. withTenantScope + writeAudit + the insert chain
//   are mocked. Tests cover: field mapping (default sourceType='all'),
//   insert-returns-empty error, audit payload shape, and the bulk helper's
//   per-candidate error isolation.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// --- Mock state (hoisted so vi.mock factory can reference them) ---
// biome-ignore lint/suspicious/noExplicitAny: mock tx is intentionally loose
let mockTx: any;
const writeAuditMock = vi.fn().mockResolvedValue(undefined);
// Controls what the insert().returning() chain resolves to.
let nextReturning: unknown[] | null = [{ id: 'cand-1' }];

// Chainable mock tx — insert().values().returning() resolves to nextReturning.
function buildTx(returning: unknown[]) {
  const self = {} as Record<string, ReturnType<typeof vi.fn>>;
  // biome-disable lint/suspicious/noThenProperty: required for thenable DB chain mock
  const chain = {
    insert: vi.fn(() => self),
    values: vi.fn(() => self),
    returning: vi.fn(async () => returning),
    update: vi.fn(() => self),
    set: vi.fn(() => self),
    where: vi.fn(async () => undefined),
  };
  // The chainable methods return self, but returning() is the terminal await.
  Object.assign(self, chain);
  // Make the whole chain awaitable too (withTenantScope cb awaits the result).
  Object.defineProperty(self, 'then', {
    value: (resolve: (v: unknown) => unknown) => Promise.resolve(returning).then(resolve),
    enumerable: false,
    configurable: true,
  });
  return self as unknown as typeof mockTx;
}

vi.mock('@/lib/db/client', () => ({
  withTenantScope: vi.fn(async (_orgId: string, cb: (tx: unknown) => Promise<unknown>) =>
    cb(mockTx),
  ),
}));

vi.mock('@/lib/db/schema', () => ({
  calibrationCandidates: {
    id: 'id',
    orgId: 'orgId',
    confidenceBucket: 'confidenceBucket',
    sourceType: 'sourceType',
    observedUpRatio: 'observedUpRatio',
    sampleSize: 'sampleSize',
    verdict: 'verdict',
    status: 'status',
  },
}));

vi.mock('@/lib/audit', () => ({ writeAudit: writeAuditMock }));

beforeEach(() => {
  writeAuditMock.mockClear();
  nextReturning = [{ id: 'cand-1' }];
  mockTx = buildTx(nextReturning);
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// proposeCalibrationCandidate
// ---------------------------------------------------------------------------

describe('proposeCalibrationCandidate', () => {
  it('inserts a candidate with status=pending and returns the row', async () => {
    const { proposeCalibrationCandidate } = await import('@/lib/rlhf/calibration-proposal');
    const row = await proposeCalibrationCandidate({
      orgId: 'org-1',
      confidenceBucket: '0.6-0.8',
      bucketMidpoint: 0.7,
      observedUpRatio: 0.3,
      sampleSize: 10,
      verdict: 'overconfident',
      proposedBy: 'user-1',
    });

    expect(row).toEqual({ id: 'cand-1' });
    // insert was called with status=pending explicitly.
    expect(mockTx.insert).toHaveBeenCalledWith(expect.anything());
    expect(mockTx.values).toHaveBeenCalledWith(
      expect.objectContaining({
        orgId: 'org-1',
        confidenceBucket: '0.6-0.8',
        sourceType: 'all',
        observedUpRatio: '0.3',
        sampleSize: 10,
        verdict: 'overconfident',
        status: 'pending',
        proposedBy: 'user-1',
      }),
    );
  });

  it('uses explicit sourceType when provided (overrides default)', async () => {
    const { proposeCalibrationCandidate } = await import('@/lib/rlhf/calibration-proposal');
    await proposeCalibrationCandidate({
      orgId: 'org-1',
      confidenceBucket: '0.8-1.0',
      bucketMidpoint: 0.9,
      observedUpRatio: 0.95,
      sampleSize: 20,
      verdict: 'underconfident',
      proposedBy: null,
      sourceType: 'digest',
    });

    expect(mockTx.values).toHaveBeenCalledWith(expect.objectContaining({ sourceType: 'digest' }));
  });

  it('defaults sourceType to "all" when not provided', async () => {
    const { proposeCalibrationCandidate } = await import('@/lib/rlhf/calibration-proposal');
    await proposeCalibrationCandidate({
      orgId: 'org-1',
      confidenceBucket: 'b',
      bucketMidpoint: 0.5,
      observedUpRatio: 0.5,
      sampleSize: 5,
      verdict: 'overconfident',
      proposedBy: null,
    });
    expect(mockTx.values).toHaveBeenCalledWith(expect.objectContaining({ sourceType: 'all' }));
  });

  it('writes rlhf.calibration_proposed audit with PII-free meta', async () => {
    const { proposeCalibrationCandidate } = await import('@/lib/rlhf/calibration-proposal');
    await proposeCalibrationCandidate({
      orgId: 'org-1',
      confidenceBucket: '0.6-0.8',
      bucketMidpoint: 0.7,
      observedUpRatio: 0.3,
      sampleSize: 10,
      verdict: 'overconfident',
      proposedBy: 'user-1',
    });

    expect(writeAuditMock).toHaveBeenCalledTimes(1);
    expect(writeAuditMock).toHaveBeenCalledWith(
      {
        actor_id: 'user-1',
        action: 'rlhf.calibration_proposed',
        resource_type: 'calibration_candidate',
        resource_id: 'cand-1',
        meta_json: {
          org_id: 'org-1',
          confidence_bucket: '0.6-0.8',
          source_type: 'all',
          observed_up_ratio: 0.3,
          sample_size: 10,
          verdict: 'overconfident',
          bucket_midpoint: 0.7,
        },
      },
      mockTx,
    );
  });

  it('passes null proposedBy as actor_id in audit', async () => {
    const { proposeCalibrationCandidate } = await import('@/lib/rlhf/calibration-proposal');
    await proposeCalibrationCandidate({
      orgId: 'org-1',
      confidenceBucket: 'b',
      bucketMidpoint: 0.5,
      observedUpRatio: 0.5,
      sampleSize: 5,
      verdict: 'underconfident',
      proposedBy: null,
    });
    expect(writeAuditMock).toHaveBeenCalledWith(
      expect.objectContaining({ actor_id: null }),
      mockTx,
    );
  });

  it('throws when insert returns no rows', async () => {
    // Rebuild tx with empty returning array.
    mockTx = buildTx([]);
    const { proposeCalibrationCandidate } = await import('@/lib/rlhf/calibration-proposal');
    await expect(
      proposeCalibrationCandidate({
        orgId: 'org-1',
        confidenceBucket: 'b',
        bucketMidpoint: 0.5,
        observedUpRatio: 0.5,
        sampleSize: 5,
        verdict: 'overconfident',
        proposedBy: 'user-1',
      }),
    ).rejects.toThrow('calibration_candidates insert returned no rows');
  });
});

// ---------------------------------------------------------------------------
// proposeCalibrationCandidates (bulk helper)
// ---------------------------------------------------------------------------

describe('proposeCalibrationCandidates', () => {
  it('persists all candidates and returns the successful rows', async () => {
    const { proposeCalibrationCandidates } = await import('@/lib/rlhf/calibration-proposal');
    const results = await proposeCalibrationCandidates(
      'org-1',
      'user-1',
      [
        {
          confidenceBucket: 'b1',
          bucketMidpoint: 0.5,
          observedUpRatio: 0.2,
          sampleSize: 10,
          verdict: 'overconfident',
        },
        {
          confidenceBucket: 'b2',
          bucketMidpoint: 0.7,
          observedUpRatio: 0.9,
          sampleSize: 15,
          verdict: 'underconfident',
        },
      ],
      'digest',
    );

    expect(results).toHaveLength(2);
    // Both candidates get sourceType='digest' (passed to bulk helper).
    expect(mockTx.values).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ sourceType: 'digest', confidenceBucket: 'b1' }),
    );
    expect(mockTx.values).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ sourceType: 'digest', confidenceBucket: 'b2' }),
    );
  });

  it('isolates per-candidate failures: one candidate fails, others still persist', async () => {
    const { proposeCalibrationCandidates } = await import('@/lib/rlhf/calibration-proposal');

    // The first candidate's insert resolves to empty (throws); the second succeeds.
    // We achieve this by swapping mockTx between calls via withTenantScope.
    const { withTenantScope } = await import('@/lib/db/client');
    let callCount = 0;
    vi.mocked(withTenantScope).mockImplementation(
      // biome-ignore lint/suspicious/noExplicitAny: mock impl intentionally loose
      async (_orgId: string, cb: any) => {
        callCount++;
        const tx = callCount === 1 ? buildTx([]) : buildTx([{ id: 'cand-2' }]);
        return cb(tx);
      },
    );

    const results = await proposeCalibrationCandidates('org-1', null, [
      {
        confidenceBucket: 'fail',
        bucketMidpoint: 0.5,
        observedUpRatio: 0.5,
        sampleSize: 5,
        verdict: 'overconfident',
      },
      {
        confidenceBucket: 'ok',
        bucketMidpoint: 0.5,
        observedUpRatio: 0.5,
        sampleSize: 5,
        verdict: 'overconfident',
      },
    ]);

    // Only the second candidate succeeds; the first is dropped silently.
    expect(results).toHaveLength(1);
    expect(results[0]?.id).toBe('cand-2');
  });

  it('returns empty array when candidates list is empty', async () => {
    const { proposeCalibrationCandidates } = await import('@/lib/rlhf/calibration-proposal');
    const results = await proposeCalibrationCandidates('org-1', 'user-1', []);
    expect(results).toEqual([]);
  });

  it('passes sourceType=undefined when not provided (defaults to "all" per candidate)', async () => {
    const { proposeCalibrationCandidates } = await import('@/lib/rlhf/calibration-proposal');
    await proposeCalibrationCandidates(
      'org-1',
      null,
      [
        {
          confidenceBucket: 'b',
          bucketMidpoint: 0.5,
          observedUpRatio: 0.5,
          sampleSize: 5,
          verdict: 'overconfident',
        },
      ],
      // sourceType not provided
    );
    expect(mockTx.values).toHaveBeenCalledWith(expect.objectContaining({ sourceType: 'all' }));
  });
});
