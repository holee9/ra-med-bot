// @MX:NOTE [AUTO] T-003 RED phase — integration test verifying withPermission 401/403 behavior.
// @MX:SPEC SPEC-REGULA-ENTERPRISE-001 (REQ-ENTERPRISE-019, 022, 023)

import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock auth module before any import that uses it.
vi.mock('@/lib/kernel/auth', () => ({
  auth: vi.fn(),
  handlers: {},
  signIn: vi.fn(),
  signOut: vi.fn(),
}));

vi.mock('@/lib/kernel/auth/acl', () => ({
  isOrgMember: vi.fn().mockResolvedValue(true),
  isProjectMember: vi.fn().mockResolvedValue(true),
}));

vi.mock('@/lib/kernel/audit', () => ({
  writeAudit: vi.fn().mockResolvedValue(undefined),
}));

describe('withPermission — integration: permission deny scenarios', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('401 — no session', () => {
    it('returns 401 with JSON error when auth() returns null', async () => {
      const { auth } = await import('@/lib/kernel/auth');
      vi.mocked(auth).mockResolvedValueOnce(null as never);

      const { withPermission } = await import('@/lib/kernel/auth/with-permission');
      const handler = vi.fn();
      const wrapped = withPermission('dashboard.view', handler);

      const req = new Request('http://localhost/api/ra/dashboard');
      const res = await wrapped(req, {});

      expect(res.status).toBe(401);
      expect(handler).not.toHaveBeenCalled();
    });
  });

  describe('403 — insufficient role (real hasRole)', () => {
    it('returns 403 when viewer calls ra-lead action (conversation.delete)', async () => {
      // viewer has hierarchy=1, conversation.delete requires ra-lead (hierarchy=3)
      // Use real hasRole (not mocked in this suite)
      const { auth } = await import('@/lib/kernel/auth');
      vi.mocked(auth).mockResolvedValueOnce({
        user: {
          id: 'viewer-user',
          role: 'viewer',
          organizationId: 'org-1',
          email: 'viewer@test.com',
        },
      } as never);

      const { withPermission } = await import('@/lib/kernel/auth/with-permission');
      const handler = vi.fn().mockResolvedValue(Response.json({ ok: true }));
      const wrapped = withPermission('conversation.delete', handler);

      const req = new Request('http://localhost/api/ra/conversations/test-id');
      const res = await wrapped(req, {});

      expect(res.status).toBe(403);
      const body = await res.json();
      expect(body).toHaveProperty('error', 'permission_denied');
      expect(handler).not.toHaveBeenCalled();
    });
  });

  describe('200 — authorized access', () => {
    it('calls handler and returns its response when ra-member calls dashboard.view', async () => {
      // dashboard.view requires ra-member (hierarchy=2), ra-member has hierarchy=2 → pass
      const { auth } = await import('@/lib/kernel/auth');
      vi.mocked(auth).mockResolvedValueOnce({
        user: {
          id: 'member-user',
          role: 'ra-member',
          organizationId: 'org-2',
          email: 'member@test.com',
        },
      } as never);

      // isOrgMember is mocked to return true at the top level
      const { isOrgMember } = await import('@/lib/kernel/auth/acl');
      vi.mocked(isOrgMember).mockResolvedValueOnce(true);

      const { withPermission } = await import('@/lib/kernel/auth/with-permission');
      const handler = vi.fn().mockResolvedValue(Response.json({ data: [] }));
      const wrapped = withPermission('dashboard.view', handler);

      const req = new Request('http://localhost/api/ra/dashboard');
      const res = await wrapped(req, {});

      expect(res.status).toBe(200);
      expect(handler).toHaveBeenCalledTimes(1);
    });
  });
});
