// @vitest-environment node
// @MX:NOTE [AUTO] Unit tests for lib/corpus-license/access (SPEC-REGULA-CORPUS-LICENSE-001).
// @MX:SPEC SPEC-REGULA-CORPUS-LICENSE-001 (REQ-CORPUSLIC-012)

import { beforeEach, describe, expect, it, vi } from 'vitest';

let selectQueue: unknown[][] = [];

const auditCorpusAccessDenied = vi.fn(async () => {});

vi.mock('@/lib/corpus-license/audit', () => ({ auditCorpusAccessDenied }));

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

const { assertSourceInOrg, assertSourceLicenseInOrg } = await import('../access');

beforeEach(() => {
  vi.clearAllMocks();
  selectQueue = [];
});

describe('assertSourceLicenseInOrg (REQ-CORPUSLIC-012)', () => {
  it('returns {id, sourceId} on an in-org match', async () => {
    selectQueue = [[{ id: 'lic-1', sourceId: 'src-1', orgId: 'org-1' }]];
    expect(
      await assertSourceLicenseInOrg({ sourceLicenseId: 'lic-1', orgId: 'org-1', userId: 'u-1' }),
    ).toEqual({
      id: 'lic-1',
      sourceId: 'src-1',
    });
    expect(auditCorpusAccessDenied).not.toHaveBeenCalled();
  });

  it('returns null on a missing row (no audit)', async () => {
    selectQueue = [[]];
    expect(
      await assertSourceLicenseInOrg({ sourceLicenseId: 'x', orgId: 'org-1', userId: 'u-1' }),
    ).toBeNull();
    expect(auditCorpusAccessDenied).not.toHaveBeenCalled();
  });

  it('returns null + audits on a cross-org mismatch', async () => {
    selectQueue = [[{ id: 'lic-1', sourceId: 'src-1', orgId: 'org-B' }]];
    expect(
      await assertSourceLicenseInOrg({ sourceLicenseId: 'lic-1', orgId: 'org-A', userId: 'u-1' }),
    ).toBeNull();
    expect(auditCorpusAccessDenied).toHaveBeenCalledWith(
      expect.objectContaining({ reason: 'source_license_cross_org' }),
    );
  });
});

describe('assertSourceInOrg', () => {
  it('returns true on an in-org match', async () => {
    selectQueue = [[{ id: 'src-1', orgId: 'org-1' }]];
    expect(await assertSourceInOrg({ sourceId: 'src-1', orgId: 'org-1', userId: 'u-1' })).toBe(
      true,
    );
  });

  it('returns false on a missing source (no audit)', async () => {
    selectQueue = [[]];
    expect(await assertSourceInOrg({ sourceId: 'x', orgId: 'org-1', userId: 'u-1' })).toBe(false);
  });

  it('returns false + audits on a cross-org mismatch', async () => {
    selectQueue = [[{ id: 'src-1', orgId: 'org-B' }]];
    expect(await assertSourceInOrg({ sourceId: 'src-1', orgId: 'org-A', userId: 'u-1' })).toBe(
      false,
    );
    expect(auditCorpusAccessDenied).toHaveBeenCalledWith(
      expect.objectContaining({ reason: 'source_cross_org' }),
    );
  });
});
