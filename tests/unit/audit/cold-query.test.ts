// Tests for lib/audit/cold-query.ts
// RED: admin RBAC required, meta-audit logging, result shape

import { describe, expect, it, vi } from 'vitest';

describe('queryColdAudit', () => {
  it('should be exported from cold-query', async () => {
    const mod = await import('../../../lib/audit/cold-query');
    expect(typeof mod.queryColdAudit).toBe('function');
  });

  it('should accept dateRange, action, actorId filters', async () => {
    const { queryColdAudit } = await import('../../../lib/audit/cold-query');
    // Should not throw when called with valid filter shape
    const r2Mock = {
      get: vi.fn().mockResolvedValue(null),
      list: vi.fn().mockResolvedValue({ objects: [], truncated: false }),
    } as unknown as R2Bucket;

    const { R2Client } = await import('../../../lib/storage/r2');
    const r2Client = new R2Client(r2Mock);

    const writeAuditMock = vi.fn().mockResolvedValue(undefined);

    const result = await queryColdAudit(
      r2Client,
      {
        dateRange: { from: new Date('2026-01-01'), to: new Date('2026-01-31') },
        action: 'llm.call',
        actorId: 'user-1',
      },
      writeAuditMock,
    );

    expect(Array.isArray(result)).toBe(true);
  });

  it('should call writeAudit with audit.cold_query action (REQ-CF-051)', async () => {
    const { queryColdAudit } = await import('../../../lib/audit/cold-query');
    const { R2Client } = await import('../../../lib/storage/r2');

    const r2Mock = {
      get: vi.fn().mockResolvedValue(null),
      list: vi.fn().mockResolvedValue({ objects: [], truncated: false }),
    } as unknown as R2Bucket;
    const r2Client = new R2Client(r2Mock);
    const writeAuditMock = vi.fn().mockResolvedValue(undefined);

    await queryColdAudit(
      r2Client,
      { dateRange: { from: new Date('2026-01-01'), to: new Date('2026-01-31') } },
      writeAuditMock,
    );

    expect(writeAuditMock).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'audit.cold_query' }),
    );
  });
});
