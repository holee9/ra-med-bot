// @MX:NOTE [AUTO] TDD RED — auditor role RBAC tests (SPEC-REGULA-AUDITOR-VIEW-001).
// @MX:SPEC SPEC-REGULA-AUDITOR-VIEW-001 (AC #1, #2)

import {
  PERMISSIONS,
  type PermissionAction,
  roleSatisfiesPermission,
} from '@/lib/kernel/auth/permissions';
import { ROLE_HIERARCHY, type Role, hasRole } from '@/lib/kernel/auth/rbac';
import { describe, expect, it } from 'vitest';

describe('SPEC-REGULA-AUDITOR-VIEW-001 — auditor role', () => {
  it('Role union includes auditor', () => {
    const roles: Role[] = ['admin', 'qa-lead', 'ra-lead', 'ra-member', 'viewer', 'auditor'];
    expect(roles).toContain('auditor');
  });

  it('ROLE_HIERARCHY has auditor entry', () => {
    expect(ROLE_HIERARCHY).toHaveProperty('auditor');
    expect(typeof ROLE_HIERARCHY.auditor).toBe('number');
  });

  it('auditor hierarchy is below viewer (read-only, least privileged operational role)', () => {
    // Auditor must be the least-privileged role — cannot satisfy any existing minRole requirement.
    expect(ROLE_HIERARCHY.auditor).toBeLessThan(ROLE_HIERARCHY.viewer);
  });

  it('auditor cannot satisfy viewer-level permission via hierarchy', () => {
    // Any permission requiring viewer or higher must be denied to auditor via hierarchy.
    expect(hasRole('auditor', 'viewer')).toBe(false);
  });

  describe('auditor has explicit read permissions for audit endpoints', () => {
    it('PERMISSIONS includes audit.read', () => {
      expect(PERMISSIONS).toHaveProperty('audit.read');
    });

    it('audit.read grants auditor via additionalRoles', () => {
      const spec = PERMISSIONS['audit.read' as PermissionAction];
      expect(spec.additionalRoles).toContain('auditor');
    });

    it('PERMISSIONS includes audit.package.generate', () => {
      expect(PERMISSIONS).toHaveProperty('audit.package.generate');
    });

    it('audit.package.generate grants auditor via additionalRoles', () => {
      const spec = PERMISSIONS['audit.package.generate' as PermissionAction];
      expect(spec.additionalRoles).toContain('auditor');
    });
  });

  describe('auditor is denied every existing write-leaning permission', () => {
    const WRITE_ACTIONS: PermissionAction[] = [
      'consult.create',
      'conversation.delete',
      'expertReview.create',
      'project.create',
      'project.manage',
      'signature.sign',
      'templates.edit',
      'sources.ingest',
      'rbac.manage',
      'authoring.create',
      'authoring.approve',
      'risk.generate',
      'risk.update',
      'risk.approve',
      'checklist.update',
      'evidence.link',
      'evidence.binder',
    ];

    it.each(WRITE_ACTIONS)('auditor is denied %s', (action) => {
      expect(roleSatisfiesPermission('auditor', PERMISSIONS[action])).toBe(false);
    });
  });

  describe('existing roles still satisfy their permissions (additive check)', () => {
    it('admin still satisfies auditLogs.view', () => {
      expect(roleSatisfiesPermission('admin', PERMISSIONS['auditLogs.view'])).toBe(true);
    });

    it('ra-lead still satisfies signature.sign', () => {
      expect(roleSatisfiesPermission('ra-lead', PERMISSIONS['signature.sign'])).toBe(true);
    });

    it('qa-lead still satisfies signature.sign via additionalRoles', () => {
      expect(roleSatisfiesPermission('qa-lead', PERMISSIONS['signature.sign'])).toBe(true);
    });

    it('ra-member still satisfies consult.create', () => {
      expect(roleSatisfiesPermission('ra-member', PERMISSIONS['consult.create'])).toBe(true);
    });
  });
});
