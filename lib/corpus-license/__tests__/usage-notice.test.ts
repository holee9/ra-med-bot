// @vitest-environment node
// @MX:NOTE [AUTO] Unit tests for lib/corpus-license/usage-notice (SPEC-REGULA-CORPUS-LICENSE-001).
// @MX:SPEC SPEC-REGULA-CORPUS-LICENSE-001 (REQ-CORPUSLIC-007/011)

import { beforeEach, describe, expect, it, vi } from 'vitest';

let rows: unknown[] = [];

vi.mock('@/lib/db/client', () => {
  const chain: Record<string, unknown> = {};
  chain.from = () => chain;
  chain.where = () => chain;
  // Intentional thenable: `await` on the chain resolves to rows.
  // biome-ignore lint/suspicious/noThenProperty: deliberate chainable thenable for the db mock
  chain.then = (resolve: (v: unknown) => void) => resolve(rows);
  return { db: { select: () => chain } };
});

const { generateUsageNotice } = await import('../usage-notice');

beforeEach(() => {
  vi.clearAllMocks();
  rows = [];
});

describe('generateUsageNotice (REQ-007/011)', () => {
  it('returns [] for empty sourceIds', async () => {
    expect(await generateUsageNotice([], 'org-1')).toEqual([]);
  });

  it('maps known license types to their notice text', async () => {
    rows = [
      { sourceId: 's1', licenseType: 'standard_paid', abstractOnly: false },
      { sourceId: 's2', licenseType: 'open', abstractOnly: false },
    ];
    const notices = await generateUsageNotice(['s1', 's2'], 'org-1');
    expect(notices).toHaveLength(2);
    expect(notices[0]?.notice).toContain('paid standard');
    expect(notices[1]?.notice).toContain('Public-domain');
  });

  it('appends abstract-only suffix when abstractOnly is true', async () => {
    rows = [{ sourceId: 's1', licenseType: 'journal', abstractOnly: true }];
    const notices = await generateUsageNotice(['s1'], 'org-1');
    expect(notices[0]?.notice).toContain('Abstract-only policy applies');
  });

  it('falls back to generic text for unknown license types', async () => {
    rows = [{ sourceId: 's1', licenseType: 'custom_type', abstractOnly: false }];
    const notices = await generateUsageNotice(['s1'], 'org-1');
    expect(notices[0]?.notice).toContain('Usage restricted per source license');
  });
});
