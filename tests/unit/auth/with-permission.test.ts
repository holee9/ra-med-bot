// @MX:NOTE [AUTO] T-002 TDD RED phase — withPermission Route Handler wrapper tests.
// @MX:SPEC SPEC-REGULA-ENTERPRISE-001 (REQ-ENTERPRISE-019, 022, 023)

import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock dependencies before importing withPermission.
vi.mock('@/lib/kernel/auth', () => ({
  auth: vi.fn(),
  handlers: {},
  signIn: vi.fn(),
  signOut: vi.fn(),
}));

vi.mock('@/lib/kernel/auth/rbac', () => ({
  hasRole: vi.fn(),
  ROLE_HIERARCHY: { admin: 4, 'ra-lead': 3, 'ra-member': 2, viewer: 1 },
}));

vi.mock('@/lib/kernel/auth/acl', () => ({
  isOrgMember: vi.fn(),
  isProjectMember: vi.fn(),
}));

vi.mock('@/lib/kernel/audit', () => ({
  writeAudit: vi.fn().mockResolvedValue(undefined),
}));

describe('lib/kernel/auth/with-permission.ts (REQ-ENTERPRISE-019, 022, 023) — withPermission', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  describe('401 — no session', () => {
    it('returns 401 when session is null', async () => {
      const { auth } = await import('@/lib/kernel/auth');
      vi.mocked(auth).mockResolvedValueOnce(null as never);

      const { withPermission } = await import('@/lib/kernel/auth/with-permission');
      const handler = vi.fn();
      const wrapped = withPermission('conversation.view', handler);

      const req = new Request('http://localhost/api/test');
      const res = await wrapped(req, {});

      expect(res.status).toBe(401);
      const body = await res.json();
      expect(body).toHaveProperty('error');
      expect(handler).not.toHaveBeenCalled();
    });

    it('returns 401 when session.user is missing', async () => {
      const { auth } = await import('@/lib/kernel/auth');
      vi.mocked(auth).mockResolvedValueOnce({} as never);

      const { withPermission } = await import('@/lib/kernel/auth/with-permission');
      const handler = vi.fn();
      const wrapped = withPermission('dashboard.view', handler);

      const req = new Request('http://localhost/api/test');
      const res = await wrapped(req, {});

      expect(res.status).toBe(401);
      expect(handler).not.toHaveBeenCalled();
    });
  });

  describe('403 — role insufficient', () => {
    it('returns 403 when user role is insufficient', async () => {
      const { auth } = await import('@/lib/kernel/auth');
      vi.mocked(auth).mockResolvedValueOnce({
        user: { id: 'user-1', role: 'viewer', organizationId: 'org-1', email: 'v@test.com' },
      } as never);

      const { hasRole } = await import('@/lib/kernel/auth/rbac');
      vi.mocked(hasRole).mockReturnValue(false);

      const { withPermission } = await import('@/lib/kernel/auth/with-permission');
      const handler = vi.fn();
      const wrapped = withPermission('rbac.manage', handler);

      const req = new Request('http://localhost/api/test');
      const res = await wrapped(req, {});

      expect(res.status).toBe(403);
      const body = await res.json();
      expect(body).toHaveProperty('error', 'permission_denied');
      expect(body).toHaveProperty('required');
      expect(body).toHaveProperty('actual_role');
      expect(handler).not.toHaveBeenCalled();
    });

    it('calls writeAudit on role denial', async () => {
      const { auth } = await import('@/lib/kernel/auth');
      vi.mocked(auth).mockResolvedValueOnce({
        user: { id: 'user-2', role: 'ra-member', organizationId: 'org-2', email: 'm@test.com' },
      } as never);

      const { hasRole } = await import('@/lib/kernel/auth/rbac');
      vi.mocked(hasRole).mockReturnValue(false);

      const { writeAudit } = await import('@/lib/kernel/audit');

      const { withPermission } = await import('@/lib/kernel/auth/with-permission');
      const wrapped = withPermission('sources.ingest', vi.fn());

      const req = new Request('http://localhost/api/test');
      await wrapped(req, {});

      expect(writeAudit).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'rbac.permission_deny',
          actor_id: 'user-2',
        }),
      );
    });

    it('audit meta includes required action and actual role on denial', async () => {
      const { auth } = await import('@/lib/kernel/auth');
      vi.mocked(auth).mockResolvedValueOnce({
        user: { id: 'user-3', role: 'viewer', organizationId: 'org-3', email: 'v3@test.com' },
      } as never);

      const { hasRole } = await import('@/lib/kernel/auth/rbac');
      vi.mocked(hasRole).mockReturnValue(false);

      const { writeAudit } = await import('@/lib/kernel/audit');

      const { withPermission } = await import('@/lib/kernel/auth/with-permission');
      const wrapped = withPermission('dashboard.team', vi.fn());

      const req = new Request('http://localhost/api/test');
      await wrapped(req, {});

      expect(writeAudit).toHaveBeenCalledWith(
        expect.objectContaining({
          meta_json: expect.objectContaining({
            required: 'dashboard.team',
            actualRole: 'viewer',
            reason: 'role',
          }),
        }),
      );
    });
  });

  describe('403 — not org member', () => {
    it('returns 403 when user is not an org member (org-scoped action)', async () => {
      const { auth } = await import('@/lib/kernel/auth');
      vi.mocked(auth).mockResolvedValueOnce({
        user: { id: 'user-4', role: 'ra-member', organizationId: 'org-4', email: 'u4@test.com' },
      } as never);

      const { hasRole } = await import('@/lib/kernel/auth/rbac');
      vi.mocked(hasRole).mockReturnValue(true);

      const { isOrgMember } = await import('@/lib/kernel/auth/acl');
      vi.mocked(isOrgMember).mockResolvedValue(false);

      const { withPermission } = await import('@/lib/kernel/auth/with-permission');
      const handler = vi.fn();
      const wrapped = withPermission('conversation.view', handler);

      const req = new Request('http://localhost/api/test');
      const res = await wrapped(req, {});

      expect(res.status).toBe(403);
      const body = await res.json();
      expect(body).toHaveProperty('error', 'not_a_member');
      expect(handler).not.toHaveBeenCalled();
    });

    it('calls writeAudit on org membership denial', async () => {
      const { auth } = await import('@/lib/kernel/auth');
      vi.mocked(auth).mockResolvedValueOnce({
        user: { id: 'user-5', role: 'ra-lead', organizationId: 'org-5', email: 'u5@test.com' },
      } as never);

      const { hasRole } = await import('@/lib/kernel/auth/rbac');
      vi.mocked(hasRole).mockReturnValue(true);

      const { isOrgMember } = await import('@/lib/kernel/auth/acl');
      vi.mocked(isOrgMember).mockResolvedValue(false);

      const { writeAudit } = await import('@/lib/kernel/audit');

      const { withPermission } = await import('@/lib/kernel/auth/with-permission');
      const wrapped = withPermission('dashboard.view', vi.fn());

      const req = new Request('http://localhost/api/test');
      await wrapped(req, {});

      expect(writeAudit).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'rbac.permission_deny',
          actor_id: 'user-5',
        }),
      );
    });
  });

  describe('200 — valid session, role, and membership', () => {
    it('calls inner handler when all checks pass (org-scoped)', async () => {
      const { auth } = await import('@/lib/kernel/auth');
      vi.mocked(auth).mockResolvedValueOnce({
        user: { id: 'user-6', role: 'ra-member', organizationId: 'org-6', email: 'u6@test.com' },
      } as never);

      const { hasRole } = await import('@/lib/kernel/auth/rbac');
      vi.mocked(hasRole).mockReturnValue(true);

      const { isOrgMember } = await import('@/lib/kernel/auth/acl');
      vi.mocked(isOrgMember).mockResolvedValue(true);

      const { withPermission } = await import('@/lib/kernel/auth/with-permission');
      const handler = vi.fn().mockResolvedValue(Response.json({ ok: true }));
      const wrapped = withPermission('dashboard.view', handler);

      const req = new Request('http://localhost/api/test');
      const res = await wrapped(req, {});

      expect(handler).toHaveBeenCalledTimes(1);
      expect(res.status).toBe(200);
    });

    it('passes req, ctx, and session to inner handler', async () => {
      const { auth } = await import('@/lib/kernel/auth');
      const fakeSession = {
        user: { id: 'user-7', role: 'admin', organizationId: 'org-7', email: 'admin@test.com' },
      };
      vi.mocked(auth).mockResolvedValueOnce(fakeSession as never);

      const { hasRole } = await import('@/lib/kernel/auth/rbac');
      vi.mocked(hasRole).mockReturnValue(true);

      const { withPermission } = await import('@/lib/kernel/auth/with-permission');
      let capturedArgs: unknown[] = [];
      const handler = vi.fn().mockImplementation(async (...args) => {
        capturedArgs = args;
        return Response.json({ ok: true });
      });
      const wrapped = withPermission('rbac.manage', handler);

      const req = new Request('http://localhost/api/admin');
      const ctx = { params: { id: 'some-id' } };
      await wrapped(req, ctx);

      expect(capturedArgs[0]).toBe(req);
      expect(capturedArgs[1]).toBe(ctx);
      expect(capturedArgs[2]).toMatchObject({ user: fakeSession.user });
    });

    it('user-scoped action skips org membership check', async () => {
      const { auth } = await import('@/lib/kernel/auth');
      vi.mocked(auth).mockResolvedValueOnce({
        user: { id: 'user-8', role: 'ra-member', organizationId: 'org-8', email: 'u8@test.com' },
      } as never);

      const { hasRole } = await import('@/lib/kernel/auth/rbac');
      vi.mocked(hasRole).mockReturnValue(true);

      const { isOrgMember } = await import('@/lib/kernel/auth/acl');

      const { withPermission } = await import('@/lib/kernel/auth/with-permission');
      const handler = vi.fn().mockResolvedValue(Response.json({ ok: true }));
      const wrapped = withPermission('profile.edit', handler);

      const req = new Request('http://localhost/api/profile');
      await wrapped(req, {});

      // profile.edit is user-scoped, so isOrgMember should NOT be called
      expect(isOrgMember).not.toHaveBeenCalled();
      expect(handler).toHaveBeenCalledTimes(1);
    });

    it('resolves Promise params before project membership checks', async () => {
      const { auth } = await import('@/lib/kernel/auth');
      vi.mocked(auth).mockResolvedValueOnce({
        user: { id: 'user-9', role: 'ra-lead', organizationId: 'org-9', email: 'lead@test.com' },
      } as never);

      const { hasRole } = await import('@/lib/kernel/auth/rbac');
      vi.mocked(hasRole).mockReturnValue(true);

      const { isProjectMember } = await import('@/lib/kernel/auth/acl');
      vi.mocked(isProjectMember).mockResolvedValue(true);

      const { withPermission } = await import('@/lib/kernel/auth/with-permission');
      const handler = vi.fn().mockResolvedValue(Response.json({ ok: true }));
      const wrapped = withPermission('project.manage', handler);

      const req = new Request('http://localhost/api/ra/projects/project-1');
      const ctx = { params: Promise.resolve({ id: 'project-1' }) };
      const res = await wrapped(req, ctx);

      expect(isProjectMember).toHaveBeenCalledWith('user-9', 'project-1');
      expect(handler).toHaveBeenCalledTimes(1);
      expect(res.status).toBe(200);
    });
  });

  describe('multiple role scenarios', () => {
    it.each([
      ['admin', true, 200],
      ['ra-lead', false, 403],
      ['ra-member', false, 403],
      ['viewer', false, 403],
    ] as const)(
      'role %s with hasRole=%s → status %d for rbac.manage',
      async (role, hasRoleResult, expectedStatus) => {
        vi.resetModules();
        vi.clearAllMocks();

        const { auth } = await import('@/lib/kernel/auth');
        vi.mocked(auth).mockResolvedValueOnce({
          user: { id: `user-${role}`, role, organizationId: 'org-x', email: `${role}@test.com` },
        } as never);

        const { hasRole } = await import('@/lib/kernel/auth/rbac');
        vi.mocked(hasRole).mockReturnValue(hasRoleResult);

        if (hasRoleResult) {
          const { isOrgMember } = await import('@/lib/kernel/auth/acl');
          vi.mocked(isOrgMember).mockResolvedValue(true);
        }

        const { withPermission } = await import('@/lib/kernel/auth/with-permission');
        const handler = vi.fn().mockResolvedValue(Response.json({ ok: true }));
        const wrapped = withPermission('rbac.manage', handler);

        const req = new Request('http://localhost/api/rbac');
        const res = await wrapped(req, {});

        expect(res.status).toBe(expectedStatus);
      },
    );
  });
});
