// @MX:NOTE [AUTO] Unit tests for combination-resolver.ts — active combo resolution (REQ-MODELGOV-013).
// @MX:SPEC SPEC-REGULA-MODEL-GOVERNANCE-001 (Issue 71, REQ-MODELGOV-013)
// @MX:REASON REQ-MODELGOV-013: exactly one active combination per org.
//   getActiveCombination: select().from().innerJoin().innerJoin().where().limit(1)
//   getPreviousCombination: select().from().where().orderBy().limit(1)

import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Two chain shapes:
//   1. getActiveCombination: select().from().innerJoin(t1, cond).innerJoin(t2, cond).where().limit(1)
//   2. getPreviousCombination: select().from().where().orderBy().limit(1)
//
// We use two separate result vars + two mock db factories so each test controls
// which function's chain resolves to which data.
// ---------------------------------------------------------------------------
let activeResult: unknown[] = [];
let previousResult: unknown[] = [];

function makeMockDb() {
  // Chain shapes:
  //   getActiveCombination: from().innerJoin().innerJoin().where().limit()
  //   getPreviousCombination: from().where().orderBy().limit()
  // from() returns an object with both innerJoin (active) and where (prev).
  // We type it as a simple intersection to avoid recursive ReturnType inference.
  type FromResult = {
    innerJoin: () => {
      innerJoin: () => {
        where: () => { limit: () => Promise<unknown[]> };
      };
    };
    where: () => { orderBy: () => { limit: () => Promise<unknown[]> } };
  };
  const selectMock = (): { from: () => FromResult } => ({
    from: () => ({
      // getActiveCombination path
      innerJoin: () => ({
        innerJoin: () => ({
          where: () => ({
            limit: () => Promise.resolve(activeResult),
          }),
        }),
      }),
      // getPreviousCombination path
      where: () => ({
        orderBy: () => ({
          limit: () => Promise.resolve(previousResult),
        }),
      }),
    }),
  });
  return { select: vi.fn(selectMock) };
}

beforeEach(() => {
  activeResult = [];
  previousResult = [];
  vi.resetModules();
  vi.doMock('@/lib/db/client', () => ({ db: makeMockDb() }));
});

// ---------------------------------------------------------------------------
// getActiveCombination
// ---------------------------------------------------------------------------
describe('getActiveCombination (REQ-MODELGOV-013 — active combo resolution)', () => {
  it('returns the active combination row when one exists', async () => {
    const approvedAt = new Date('2025-06-01');
    activeResult = [
      {
        id: 'combo-1',
        promptId: 'prompt-1',
        modelPinId: 'pin-1',
        promptVersion: 3,
        promptContentHash: 'hash-abc',
        modelProvider: 'openai',
        modelId: 'gpt-4o',
        modelVersion: '2024-08-06',
        approvedAt,
      },
    ];
    const { getActiveCombination } = await import('@/lib/model-governance/combination-resolver');
    const result = await getActiveCombination('org-1');
    expect(result).toEqual({
      id: 'combo-1',
      promptId: 'prompt-1',
      modelPinId: 'pin-1',
      promptVersion: 3,
      promptContentHash: 'hash-abc',
      modelProvider: 'openai',
      modelId: 'gpt-4o',
      modelVersion: '2024-08-06',
      approvedAt,
    });
  });

  it('returns null when no active combination exists (pre-approval bootstrap)', async () => {
    activeResult = [];
    const { getActiveCombination } = await import('@/lib/model-governance/combination-resolver');
    const result = await getActiveCombination('org-empty');
    expect(result).toBeNull();
  });

  it('returns null for an org with only inactive combinations', async () => {
    activeResult = [];
    const { getActiveCombination } = await import('@/lib/model-governance/combination-resolver');
    const result = await getActiveCombination('org-inactive-only');
    expect(result).toBeNull();
  });

  it('returns the first row when multiple active rows exist (defensive — limit 1)', async () => {
    activeResult = [
      {
        id: 'combo-a',
        promptId: 'p-a',
        modelPinId: 'm-a',
        promptVersion: 1,
        promptContentHash: 'h-a',
        modelProvider: 'openai',
        modelId: 'gpt-4o',
        modelVersion: 'v1',
        approvedAt: new Date('2025-06-01'),
      },
      {
        id: 'combo-b',
        promptId: 'p-b',
        modelPinId: 'm-b',
        promptVersion: 2,
        promptContentHash: 'h-b',
        modelProvider: 'anthropic',
        modelId: 'claude-3',
        modelVersion: 'v2',
        approvedAt: new Date('2025-06-02'),
      },
    ];
    const { getActiveCombination } = await import('@/lib/model-governance/combination-resolver');
    const result = await getActiveCombination('org-multi');
    // Destructuring [row] takes the first element.
    expect(result?.id).toBe('combo-a');
  });

  it('includes all joined fields (prompt + model metadata)', async () => {
    activeResult = [
      {
        id: 'combo-full',
        promptId: 'prompt-full',
        modelPinId: 'pin-full',
        promptVersion: 5,
        promptContentHash: 'sha256-full',
        modelProvider: 'anthropic',
        modelId: 'claude-sonnet-4',
        modelVersion: '2025-01-01',
        approvedAt: new Date('2025-07-01'),
      },
    ];
    const { getActiveCombination } = await import('@/lib/model-governance/combination-resolver');
    const result = await getActiveCombination('org-1');
    expect(result).not.toBeNull();
    expect(result?.promptVersion).toBe(5);
    expect(result?.promptContentHash).toBe('sha256-full');
    expect(result?.modelProvider).toBe('anthropic');
    expect(result?.modelId).toBe('claude-sonnet-4');
    expect(result?.modelVersion).toBe('2025-01-01');
  });
});

// ---------------------------------------------------------------------------
// getPreviousCombination
// ---------------------------------------------------------------------------
describe('getPreviousCombination (rollback — most-recent superseded)', () => {
  it('returns the most-recent superseded combination for rollback', async () => {
    previousResult = [
      {
        id: 'combo-old',
        promptId: 'prompt-old',
        modelPinId: 'pin-old',
        supersededAt: new Date('2025-05-01'),
      },
    ];
    const { getPreviousCombination } = await import('@/lib/model-governance/combination-resolver');
    const result = await getPreviousCombination('org-1', 'combo-current');
    expect(result).toEqual({
      id: 'combo-old',
      promptId: 'prompt-old',
      modelPinId: 'pin-old',
    });
  });

  it('returns null when no prior combination exists (first approval)', async () => {
    previousResult = [];
    const { getPreviousCombination } = await import('@/lib/model-governance/combination-resolver');
    const result = await getPreviousCombination('org-first', 'combo-current');
    expect(result).toBeNull();
  });

  it('returns null when the only superseded row matches currentActiveId (defensive exclusion)', async () => {
    previousResult = [
      {
        id: 'combo-current',
        promptId: 'prompt-1',
        modelPinId: 'pin-1',
        supersededAt: new Date('2025-05-01'),
      },
    ];
    const { getPreviousCombination } = await import('@/lib/model-governance/combination-resolver');
    const result = await getPreviousCombination('org-1', 'combo-current');
    expect(result).toBeNull();
  });

  it('returns the first row when multiple superseded rows exist (limit 1 — most recent via DESC)', async () => {
    previousResult = [
      {
        id: 'combo-recent',
        promptId: 'p-recent',
        modelPinId: 'm-recent',
        supersededAt: new Date('2025-06-01'),
      },
      {
        id: 'combo-older',
        promptId: 'p-older',
        modelPinId: 'm-older',
        supersededAt: new Date('2025-05-01'),
      },
    ];
    const { getPreviousCombination } = await import('@/lib/model-governance/combination-resolver');
    const result = await getPreviousCombination('org-1', 'combo-current');
    expect(result?.id).toBe('combo-recent');
  });

  it('returns only id, promptId, modelPinId (not supersededAt)', async () => {
    previousResult = [
      {
        id: 'combo-prev',
        promptId: 'prompt-prev',
        modelPinId: 'pin-prev',
        supersededAt: new Date('2025-04-01'),
      },
    ];
    const { getPreviousCombination } = await import('@/lib/model-governance/combination-resolver');
    const result = await getPreviousCombination('org-1', 'combo-current');
    expect(result).toEqual({
      id: 'combo-prev',
      promptId: 'prompt-prev',
      modelPinId: 'pin-prev',
    });
    // supersededAt is not in the returned object
    expect(result).not.toHaveProperty('supersededAt');
  });

  it('excludes currentActiveId even when it appears among superseded rows (defensive)', async () => {
    previousResult = [
      {
        id: 'combo-current', // matches currentActiveId — should be excluded
        promptId: 'p-cur',
        modelPinId: 'm-cur',
        supersededAt: new Date('2025-06-01'),
      },
      {
        id: 'combo-prev',
        promptId: 'p-prev',
        modelPinId: 'm-prev',
        supersededAt: new Date('2025-05-01'),
      },
    ];
    const { getPreviousCombination } = await import('@/lib/model-governance/combination-resolver');
    const result = await getPreviousCombination('org-1', 'combo-current');
    // The first row matched currentActiveId, so the function returns null
    // (defensive check only inspects the first row from limit(1)).
    expect(result).toBeNull();
  });
});
