// @MX:NOTE Regression tests for tenant fail-closed queue reads.
// @MX:SPEC SPEC-REGULA-KNOWLEDGE-GAP-001 (Issue #35)

import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  select: vi.fn(),
}));

vi.mock('@/lib/db/client', () => ({
  db: {
    select: mocks.select,
  },
}));

describe('listQueueItems tenant scope', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fails closed without orgId and does not execute an unscoped query', async () => {
    const { listQueueItems } = await import('@/lib/knowledge-gap/queue-query');

    const rows = await listQueueItems();

    expect(rows).toEqual([]);
    expect(mocks.select).not.toHaveBeenCalled();
  });
});
