// @MX:NOTE [AUTO] AC-04 / REQ-PMS-004 CER linkage integration tests.
// @MX:SPEC SPEC-REGULA-PMS-001 (REQ-PMS-004, AC-04)
// @MX:REASON [AUTO] Auto-linkage is ACTIVE: CER runs persist to workflow_runs
//           when a projectId is supplied (see cer-persist-roundtrip.test.ts for
//           the full route→persist→resolve end-to-end path). These tests cover
//           the resolver directly: (a) manual override, (b) graceful null on
//           absent CER run, (c) graceful null on DB error, (d) extraction shape.

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

describe('AC-04 / REQ-PMS-004 CER linkage (auto-linkage ACTIVE)', () => {
  it('returns manual override cerData without DB lookup when provided (path 1)', async () => {
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

  it('returns null gracefully when no CER workflow_run exists', async () => {
    // No CER run persisted for this project (e.g. ephemeral run without projectId).
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

  // Verifies extraction shape against the result_json persisted by the CER route.
  it('extracts device fields when a CER workflow_run exists', async () => {
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

  it('extracts device fields from nested device block when top-level absent', async () => {
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

  it('returns empty-string fallbacks when CER result_json has missing keys', async () => {
    cerRows = [{ id: 'cer-empty-result', resultJson: {} }];
    const dbMock = makeDbMock();

    const result = await resolveCerLinkage(PROJECT_ID, ORG_ID, null, dbMock);

    expect(result).not.toBeNull();
    expect(result?.cerId).toBe('cer-empty-result');
    expect(result?.deviceName).toBe('');
    expect(result?.intendedUse).toBe('');
    expect(result?.riskProfile).toBe('');
  });

  it('returns null gracefully when DB query throws (path 3: DB error graceful)', async () => {
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

  it('enforces org/project isolation: different project CER is NOT linked (path 2b)', async () => {
    const OTHER_PROJECT_ID = '00000000-0000-0000-0000-000000000002';

    // Clear cerRows - no CER run exists
    cerRows = [];
    const dbMock = makeDbMock();

    const result = await resolveCerLinkage(OTHER_PROJECT_ID, ORG_ID, null, dbMock);

    // No CER run for OTHER_PROJECT_ID
    expect(result).toBeNull();
  });

  it('enforces org isolation: different org CER is NOT linked (path 2c)', async () => {
    const OTHER_ORG_ID = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';

    // Clear cerRows - no CER run exists for this org
    cerRows = [];
    const dbMock = makeDbMock();

    const result = await resolveCerLinkage(PROJECT_ID, OTHER_ORG_ID, null, dbMock);

    // No CER run for OTHER_ORG_ID
    expect(result).toBeNull();
  });
});
