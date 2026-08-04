// @vitest-environment node
// @MX:NOTE [AUTO] Unit tests for lib/corpus-license/permitted-use (SPEC-REGULA-CORPUS-LICENSE-001).
// @MX:SPEC SPEC-REGULA-CORPUS-LICENSE-001 (REQ-CORPUSLIC-005/013)

import { beforeEach, describe, expect, it, vi } from 'vitest';

let selectQueue: unknown[][] = [];

vi.mock('@/lib/db/client', () => {
  const chain: Record<string, unknown> = {};
  chain.from = () => chain;
  chain.where = () => chain;
  chain.limit = () => chain;
  // Intentional thenable: `await` on the chain pops the next queued select result.
  // biome-ignore lint/suspicious/noThenProperty: deliberate chainable thenable for the db mock
  chain.then = (resolve: (v: unknown) => void) => resolve(selectQueue.shift() ?? []);
  return { db: { select: () => chain } };
});

const { fetchPermittedUse, isFullTextBlocked } = await import('../permitted-use');

beforeEach(() => {
  vi.clearAllMocks();
  selectQueue = [];
});

describe('fetchPermittedUse (REQ-005/013)', () => {
  it('returns null when no license row exists', async () => {
    selectQueue = [[]];
    expect(await fetchPermittedUse('s1', 'org-1')).toBeNull();
  });

  it('collapses standard_paid to all-false without an active entitlement (REQ-004)', async () => {
    selectQueue = [
      [
        {
          id: 'lic-1',
          licenseType: 'standard_paid',
          permittedUse: { ingest: true },
          fullTextAllowed: true,
          abstractOnly: false,
        },
      ],
      [], // no active entitlement
    ];
    const policy = await fetchPermittedUse('s1', 'org-1');
    expect(policy?.permittedUse.ingest).toBe(false);
    expect(policy?.permittedUse.search).toBe(false);
    expect(policy?.abstractOnly).toBe(true);
  });

  it('returns full policy with defaults for a non-paid license', async () => {
    selectQueue = [
      [
        {
          id: 'lic-1',
          licenseType: 'open',
          permittedUse: {},
          fullTextAllowed: true,
          abstractOnly: false,
        },
      ],
      [], // no entitlement (OK for open)
    ];
    const policy = await fetchPermittedUse('s1', 'org-1');
    expect(policy?.permittedUse.ingest).toBe(true);
    expect(policy?.permittedUse.search).toBe(true);
    expect(policy?.fullTextAllowed).toBe(true);
  });

  it('returns the policy for a standard_paid with an active entitlement', async () => {
    selectQueue = [
      [
        {
          id: 'lic-1',
          licenseType: 'standard_paid',
          permittedUse: { ingest: true },
          fullTextAllowed: true,
          abstractOnly: false,
        },
      ],
      [{ id: 'ent-1' }], // active entitlement
    ];
    const policy = await fetchPermittedUse('s1', 'org-1');
    expect(policy?.permittedUse.ingest).toBe(true);
    expect(policy?.hasActiveEntitlement).toBe(true);
  });
});

describe('isFullTextBlocked (REQ-013)', () => {
  it('returns true when abstractOnly is set', () => {
    expect(isFullTextBlocked({ abstractOnly: true, fullTextAllowed: true } as never)).toBe(true);
  });

  it('returns true when fullTextAllowed is false', () => {
    expect(isFullTextBlocked({ abstractOnly: false, fullTextAllowed: false } as never)).toBe(true);
  });

  it('returns false when both are OK', () => {
    expect(isFullTextBlocked({ abstractOnly: false, fullTextAllowed: true } as never)).toBe(false);
  });
});
