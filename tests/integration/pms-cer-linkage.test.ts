// @MX:NOTE [AUTO] AC-04 / REQ-PMS-004 CER linkage integration tests.
// @MX:SPEC SPEC-REGULA-PMS-001 (REQ-PMS-004, AC-04)
// @MX:REASON [AUTO] Honest coverage: auto-linkage is DEFERRED (CER not persisted
//           locally). Tests verify (a) manual override, (b) graceful null on absent
//           CER run (current production reality), (c) graceful null on DB error,
//           (d) forward-compat extraction when a CER workflow_run exists.
//
// IMPORTANT: These tests do NOT claim "auto-linkage works in production". CER
// results currently run through the hybrid-ra-saas BFF and are not persisted to
// the local workflow_runs table. Auto-discovery returns null in production until
// CER local persistence lands (cross-SPEC follow-up). The forward-compatibility
// case verifies the extraction shape for when persistence is added.

import { resolveCerLinkage } from '@/lib/pms/cer-linkage';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type Row = Record<string, unknown>;

// ---------------------------------------------------------------------------
// Injectable DB client mock — controllable rows per test.
// ---------------------------------------------------------------------------

let cerRows: Row[] = [];

interface SelectChain {
  from: (table: unknown) => SelectChain;
  where: (condition: unknown) => SelectChain;
  orderBy: (...cols: unknown[]) => SelectChain;
  limit: (n: number) => Promise<Row[]>;
}

function makeDbMock() {
  const selectChain: SelectChain = {
    from: vi.fn(() => selectChain),
    where: vi.fn(() => selectChain),
    orderBy: vi.fn(() => selectChain),
    limit: vi.fn(async () => cerRows),
  };
  return { select: vi.fn(() => selectChain) };
}

beforeEach(() => {
  cerRows = [];
});

afterEach(() => {
  vi.restoreAllMocks();
});

const PROJECT_ID = '00000000-0000-0000-0000-000000000001';
const ORG_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

describe('AC-04 / REQ-PMS-004 CER linkage (auto-linkage DEFERRED)', () => {
  it('returns manual override cerData without DB lookup when provided (functional path today)', async () => {
    const manual = {
      cerId: 'manual-cer-1',
      deviceName: 'ManualDevice',
      intendedUse: 'diagnosis',
      riskProfile: 'moderate',
    };
    const dbMock = makeDbMock();

    const result = await resolveCerLinkage(PROJECT_ID, ORG_ID, manual, dbMock);

    expect(result).toEqual(manual);
    expect(dbMock.select).not.toHaveBeenCalled();
  });

  it('returns null gracefully when no CER workflow_run exists (CURRENT PRODUCTION REALITY)', async () => {
    // CER results are not persisted to local workflow_runs today (hybrid-ra-saas BFF).
    // Auto-discovery therefore returns null in production. This is DEFERRED, not a bug.
    cerRows = [];
    const dbMock = makeDbMock();

    const result = await resolveCerLinkage(PROJECT_ID, ORG_ID, null, dbMock);

    expect(result).toBeNull();
  });

  it('returns null gracefully when DB query throws (no hard failure)', async () => {
    const dbMock = {
      select: vi.fn(() => {
        throw new Error('DB connection lost');
      }),
    };

    const result = await resolveCerLinkage(
      PROJECT_ID,
      ORG_ID,
      null,
      dbMock as Parameters<typeof resolveCerLinkage>[3],
    );

    expect(result).toBeNull();
  });

  // Forward-compatibility: verifies extraction shape for when CER local persistence
  // lands (cross-SPEC follow-up). NOT a claim that auto-linkage works in production.
  it('FORWARD-COMPAT: extracts device fields when a CER workflow_run exists (future activation)', async () => {
    cerRows = [
      {
        id: 'cer-run-uuid',
        resultJson: {
          deviceName: 'CardioStent-X',
          intendedUse: 'coronary artery stenting',
          riskProfile: 'high',
        },
      },
    ];
    const dbMock = makeDbMock();

    const result = await resolveCerLinkage(PROJECT_ID, ORG_ID, null, dbMock);

    expect(result).not.toBeNull();
    expect(result?.cerId).toBe('cer-run-uuid');
    expect(result?.deviceName).toBe('CardioStent-X');
    expect(result?.intendedUse).toBe('coronary artery stenting');
    expect(result?.riskProfile).toBe('high');
  });

  it('FORWARD-COMPAT: extracts device fields from nested device block when top-level absent', async () => {
    cerRows = [
      {
        id: 'cer-run-nested',
        resultJson: {
          device: { deviceName: 'NestedDevice', riskProfile: 'low' },
          intendedUse: 'monitoring',
        },
      },
    ];
    const dbMock = makeDbMock();

    const result = await resolveCerLinkage(PROJECT_ID, ORG_ID, null, dbMock);

    expect(result?.deviceName).toBe('NestedDevice');
    expect(result?.riskProfile).toBe('low');
    expect(result?.intendedUse).toBe('monitoring');
  });

  it('FORWARD-COMPAT: returns empty-string fallbacks when CER result_json has missing keys', async () => {
    cerRows = [{ id: 'cer-empty-result', resultJson: {} }];
    const dbMock = makeDbMock();

    const result = await resolveCerLinkage(PROJECT_ID, ORG_ID, null, dbMock);

    expect(result).not.toBeNull();
    expect(result?.cerId).toBe('cer-empty-result');
    expect(result?.deviceName).toBe('');
    expect(result?.intendedUse).toBe('');
    expect(result?.riskProfile).toBe('');
  });
});
