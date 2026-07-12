// @vitest-environment node
// @MX:NOTE [AUTO] Unit tests for lib/model-governance/access (SPEC-REGULA-MODEL-GOVERNANCE-001).
// @MX:SPEC SPEC-REGULA-MODEL-GOVERNANCE-001 (Issue 71)

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

const { assertChangeRequestAccess, assertModelPinAccess, assertPromptAccess } = await import(
  '../access'
);

beforeEach(() => {
  vi.clearAllMocks();
  selectQueue = [];
});

describe('assertPromptAccess', () => {
  it('returns true when the prompt row exists in-org', async () => {
    selectQueue = [[{ id: 'p-1' }]];
    expect(await assertPromptAccess('p-1', 'org-1')).toBe(true);
  });

  it('returns false when the row is missing', async () => {
    selectQueue = [[]];
    expect(await assertPromptAccess('px', 'org-1')).toBe(false);
  });
});

describe('assertModelPinAccess', () => {
  it('returns true / false based on row presence', async () => {
    selectQueue = [[{ id: 'mp-1' }]];
    expect(await assertModelPinAccess('mp-1', 'org-1')).toBe(true);
    selectQueue = [[]];
    expect(await assertModelPinAccess('mx', 'org-1')).toBe(false);
  });
});

describe('assertChangeRequestAccess', () => {
  it('returns the row on success', async () => {
    selectQueue = [
      [
        {
          id: 'cr-1',
          promptId: 'p-1',
          modelPinId: 'mp-1',
          evalStatus: 'passed',
          approvalStatus: 'approved',
        },
      ],
    ];
    const row = await assertChangeRequestAccess('cr-1', 'org-1');
    expect(row).toMatchObject({ id: 'cr-1', evalStatus: 'passed' });
  });

  it('returns null on a missing / cross-org row', async () => {
    selectQueue = [[]];
    expect(await assertChangeRequestAccess('cx', 'org-1')).toBeNull();
  });
});
