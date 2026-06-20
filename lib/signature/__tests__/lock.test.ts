/**
 * TDD RED: Tests for isAnswerLocked helper.
 * REQ-ESIG-003: Post-signature modification must return 403 (lock enforcement).
 */

import { describe, expect, it, vi } from 'vitest';
import { isAnswerLocked } from '../lock';

// Mock the DB module — lock.ts queries answer_signatures
vi.mock('@/lib/db/client', () => ({
  db: {
    select: vi.fn(),
  },
}));

describe('isAnswerLocked', () => {
  it('returns false when no signature exists', async () => {
    const mockDb = {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([]),
        }),
      }),
    };

    const result = await isAnswerLocked('msg-no-sig', mockDb as never);
    expect(result).toBe(false);
  });

  it('returns true when an active (non-revoked) signature exists', async () => {
    const mockDb = {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ id: 'sig-001', revokedAt: null }]),
        }),
      }),
    };

    const result = await isAnswerLocked('msg-signed', mockDb as never);
    expect(result).toBe(true);
  });

  it('returns false when signature exists but is revoked', async () => {
    const mockDb = {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([]),
        }),
      }),
    };

    const result = await isAnswerLocked('msg-revoked', mockDb as never);
    expect(result).toBe(false);
  });
});
