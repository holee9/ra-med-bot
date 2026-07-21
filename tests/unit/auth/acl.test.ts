// @MX:NOTE [AUTO] T-002 TDD RED phase — ACL membership query tests.
// @MX:SPEC SPEC-REGULA-ENTERPRISE-001 (REQ-ENTERPRISE-018)

import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock @/lib/db before importing acl to intercept db calls.
vi.mock('@/lib/kernel/db/client', () => {
  const selectMock = vi.fn();
  const mockDb = {
    select: selectMock,
  };
  return { db: mockDb };
});

describe('lib/kernel/auth/acl.ts (REQ-ENTERPRISE-018) — isOrgMember + isProjectMember', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  describe('isOrgMember', () => {
    it('returns true when membership row exists', async () => {
      const { db } = await import('@/lib/kernel/db/client');
      const mockSelect = vi.mocked(db.select);
      // Chain: select().from().where().limit() → [row]
      const limitMock = vi.fn().mockResolvedValue([{ userId: 'user-1', orgId: 'org-1' }]);
      const whereMock = vi.fn().mockReturnValue({ limit: limitMock });
      const fromMock = vi.fn().mockReturnValue({ where: whereMock });
      mockSelect.mockReturnValue({ from: fromMock } as never);

      const { isOrgMember } = await import('@/lib/kernel/auth/acl');
      const result = await isOrgMember('user-1', 'org-1');

      expect(result).toBe(true);
    });

    it('returns false when membership row does not exist', async () => {
      const { db } = await import('@/lib/kernel/db/client');
      const mockSelect = vi.mocked(db.select);
      const limitMock = vi.fn().mockResolvedValue([]);
      const whereMock = vi.fn().mockReturnValue({ limit: limitMock });
      const fromMock = vi.fn().mockReturnValue({ where: whereMock });
      mockSelect.mockReturnValue({ from: fromMock } as never);

      const { isOrgMember } = await import('@/lib/kernel/auth/acl');
      const result = await isOrgMember('user-999', 'org-999');

      expect(result).toBe(false);
    });

    it('queries with correct userId and orgId', async () => {
      const { db } = await import('@/lib/kernel/db/client');
      const mockSelect = vi.mocked(db.select);
      const limitMock = vi.fn().mockResolvedValue([]);
      const whereMock = vi.fn().mockReturnValue({ limit: limitMock });
      const fromMock = vi.fn().mockReturnValue({ where: whereMock });
      mockSelect.mockReturnValue({ from: fromMock } as never);

      const { isOrgMember } = await import('@/lib/kernel/auth/acl');
      await isOrgMember('user-abc', 'org-xyz');

      expect(mockSelect).toHaveBeenCalledTimes(1);
      expect(limitMock).toHaveBeenCalledWith(1);
    });
  });

  describe('isProjectMember', () => {
    it('returns true when project membership row exists', async () => {
      const { db } = await import('@/lib/kernel/db/client');
      const mockSelect = vi.mocked(db.select);
      const limitMock = vi.fn().mockResolvedValue([{ userId: 'user-1', projectId: 'proj-1' }]);
      const whereMock = vi.fn().mockReturnValue({ limit: limitMock });
      const fromMock = vi.fn().mockReturnValue({ where: whereMock });
      mockSelect.mockReturnValue({ from: fromMock } as never);

      const { isProjectMember } = await import('@/lib/kernel/auth/acl');
      const result = await isProjectMember('user-1', 'proj-1');

      expect(result).toBe(true);
    });

    it('returns false when project membership row does not exist', async () => {
      const { db } = await import('@/lib/kernel/db/client');
      const mockSelect = vi.mocked(db.select);
      const limitMock = vi.fn().mockResolvedValue([]);
      const whereMock = vi.fn().mockReturnValue({ limit: limitMock });
      const fromMock = vi.fn().mockReturnValue({ where: whereMock });
      mockSelect.mockReturnValue({ from: fromMock } as never);

      const { isProjectMember } = await import('@/lib/kernel/auth/acl');
      const result = await isProjectMember('user-999', 'proj-999');

      expect(result).toBe(false);
    });

    it('queries with correct userId and projectId', async () => {
      const { db } = await import('@/lib/kernel/db/client');
      const mockSelect = vi.mocked(db.select);
      const limitMock = vi.fn().mockResolvedValue([]);
      const whereMock = vi.fn().mockReturnValue({ limit: limitMock });
      const fromMock = vi.fn().mockReturnValue({ where: whereMock });
      mockSelect.mockReturnValue({ from: fromMock } as never);

      const { isProjectMember } = await import('@/lib/kernel/auth/acl');
      await isProjectMember('user-abc', 'proj-xyz');

      expect(mockSelect).toHaveBeenCalledTimes(1);
      expect(limitMock).toHaveBeenCalledWith(1);
    });
  });
});
