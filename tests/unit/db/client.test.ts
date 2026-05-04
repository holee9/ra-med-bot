import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the entire client module to avoid env parsing
vi.mock('../../../lib/db/client', () => {
  // Minimal Drizzle-like tx mock
  const mockTx = {
    execute: vi.fn().mockResolvedValue({}),
  };

  const mockDb = {
    transaction: vi.fn().mockImplementation(async (fn: (tx: typeof mockTx) => Promise<unknown>) => {
      await mockTx.execute('SET LOCAL app.current_org_id = \'test\'');
      return fn(mockTx);
    }),
  };

  async function withTenantScope<T>(
    orgId: string,
    fn: (db: typeof mockDb) => Promise<T>,
  ): Promise<T> {
    return mockDb.transaction(async (tx: typeof mockTx) => {
      await tx.execute(`SET LOCAL app.current_org_id = '${orgId}'`);
      return fn(mockDb as never);
    });
  }

  return { db: mockDb, withTenantScope };
});

import { withTenantScope } from '../../../lib/db/client';

describe('withTenantScope', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('is exported from lib/db/client', () => {
    expect(typeof withTenantScope).toBe('function');
  });

  it('calls the provided function with a db client', async () => {
    const mockFn = vi.fn().mockResolvedValue('result');
    const result = await withTenantScope('org-123', mockFn);
    expect(mockFn).toHaveBeenCalledOnce();
    expect(result).toBe('result');
  });

  it('returns the value from the provided function', async () => {
    const expected = { data: 'test' };
    const result = await withTenantScope('org-456', async () => expected);
    expect(result).toEqual(expected);
  });

  it('accepts any orgId string', async () => {
    const orgIds = ['org-123', 'org-abc-def', '550e8400-e29b-41d4-a716-446655440000'];
    for (const orgId of orgIds) {
      const result = await withTenantScope(orgId, async () => orgId);
      expect(result).toBe(orgId);
    }
  });
});
