// @vitest-environment node
// @MX:NOTE [AUTO] Unit tests for lib/standards/impact-analyzer (SPEC-REGULA-STANDARDS-001).
// @MX:SPEC SPEC-REGULA-STANDARDS-001 (REQ-STANDARDS-011)

import { beforeEach, describe, expect, it, vi } from 'vitest';

let catalogQueue: unknown[] = [];
let productsQueue: unknown[] = [];

vi.mock('@/lib/db/client', () => ({
  withTenantScope: vi.fn(async (_orgId: string, fn: (tx: unknown) => unknown) =>
    fn({
      select: () => ({
        from: () => {
          const p = Promise.resolve(productsQueue) as Promise<unknown> & {
            limit: (n: number) => Promise<unknown>;
          };
          p.limit = (n: number) =>
            n === 1 ? Promise.resolve(catalogQueue) : Promise.resolve(productsQueue);
          return { where: () => p };
        },
      }),
    }),
  ),
}));

const { identifyAffectedProducts } = await import('../impact-analyzer');

beforeEach(() => {
  vi.clearAllMocks();
  catalogQueue = [];
  productsQueue = [];
});

describe('identifyAffectedProducts (REQ-STANDARDS-011)', () => {
  it('returns affected products + pending review subset', async () => {
    catalogQueue = [{ standardNumber: 'ISO 13485:2016' }];
    productsQueue = [
      { productId: 'p1', projectId: 'proj-1', complianceStatus: 'compliant', lastAssessedAt: null },
      { productId: 'p2', projectId: null, complianceStatus: 'gap', lastAssessedAt: null },
      { productId: 'p3', projectId: null, complianceStatus: 'unknown', lastAssessedAt: null },
    ];
    const result = await identifyAffectedProducts('std-1', 'org-1');
    expect(result.standardNumber).toBe('ISO 13485:2016');
    expect(result.affected).toHaveLength(3);
    expect(result.pendingReview).toHaveLength(2);
    expect(
      result.pendingReview.every(
        (p) => p.complianceStatus === 'gap' || p.complianceStatus === 'unknown',
      ),
    ).toBe(true);
  });

  it('returns null standardNumber when the standard is not found', async () => {
    catalogQueue = [];
    productsQueue = [];
    const result = await identifyAffectedProducts('std-x', 'org-1');
    expect(result.standardNumber).toBeNull();
    expect(result.affected).toEqual([]);
  });
});
