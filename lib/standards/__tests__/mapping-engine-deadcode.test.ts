// @MX:NOTE [AUTO] Unit tests for mapping-engine.ts — SPEC-REGULA-STANDARDS-001.
// Verifies the engine reuses applicability-engine.getApplicableStandards (L-002
// dead-code proof) and adds citation provenance via catalog join.

import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock the underlying applicability-engine so we assert the call-site (L-002).
const getApplicableStandardsMock = vi.fn();
vi.mock('@/lib/standards/applicability-engine', () => ({
  getApplicableStandards: (...args: unknown[]) => getApplicableStandardsMock(...args),
  STANDARDS_SEED_DATA: [],
}));

// Mock the DB client — withTenantScope passes the tx to the callback.
const txSelect = vi.fn();
const txFrom = vi.fn(() => ({ select: txSelect }));
vi.mock('@/lib/kernel/db/client', () => ({
  withTenantScope: vi.fn(async (_orgId: string, cb: (tx: unknown) => Promise<unknown>) =>
    cb({ select: txFrom }),
  ),
  db: {},
}));

describe('mapApplicableStandards — reuses applicability-engine (L-002 dead-code proof)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls getApplicableStandards with the device profile (call-site verified)', async () => {
    getApplicableStandardsMock.mockReturnValue([]);
    const { mapApplicableStandards } = await import('../mapping-engine');

    const profile = {
      deviceTypeKey: 'electrical_medical_device',
      regulatoryPathway: 'fda_510k',
      hasSoftware: false,
      isElectrical: true,
      isSterile: false,
      usesAnimalTissue: false,
    };

    await mapApplicableStandards(profile, 'org-123');

    expect(getApplicableStandardsMock).toHaveBeenCalledTimes(1);
    expect(getApplicableStandardsMock).toHaveBeenCalledWith(profile);
  });

  it('returns empty results with durationMs when engine returns []', async () => {
    getApplicableStandardsMock.mockReturnValue([]);
    const { mapApplicableStandards } = await import('../mapping-engine');

    const outcome = await mapApplicableStandards(
      {
        deviceTypeKey: 'software_only',
        regulatoryPathway: 'all',
        hasSoftware: true,
        isElectrical: false,
        isSterile: false,
        usesAnimalTissue: false,
      },
      'org-123',
    );

    expect(outcome.results).toEqual([]);
    expect(outcome.deviceProfileKey).toBe('software_only');
    expect(outcome.durationMs).toBeGreaterThanOrEqual(0);
  });
});
