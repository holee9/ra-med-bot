// @MX:NOTE [AUTO] FOUNDATION regression tests — validates T-001~T-013 invariants.
// @MX:SPEC SPEC-REGULA-ENTERPRISE-001 (REQ-ENTERPRISE-060)

import { PERMISSIONS } from '@/lib/auth/permissions';
import { hasRole } from '@/lib/auth/rbac';
import { describe, expect, it } from 'vitest';

describe('FOUNDATION regression', () => {
  // ---------------------------------------------------------------------------
  // RBAC hierarchy preserved
  // ---------------------------------------------------------------------------
  it('admin has all permissions (hierarchy preserved)', () => {
    expect(hasRole('admin', 'ra-lead')).toBe(true);
    expect(hasRole('admin', 'ra-member')).toBe(true);
    expect(hasRole('admin', 'viewer')).toBe(true);
  });

  it('ra-lead has ra-member and viewer permissions', () => {
    expect(hasRole('ra-lead', 'ra-member')).toBe(true);
    expect(hasRole('ra-lead', 'viewer')).toBe(true);
    expect(hasRole('ra-lead', 'admin')).toBe(false);
  });

  it('viewer cannot access ra-member actions', () => {
    expect(hasRole('viewer', 'ra-member')).toBe(false);
    expect(hasRole('viewer', 'ra-lead')).toBe(false);
    expect(hasRole('viewer', 'admin')).toBe(false);
  });

  it('ra-member cannot access ra-lead or admin actions', () => {
    expect(hasRole('ra-member', 'ra-lead')).toBe(false);
    expect(hasRole('ra-member', 'admin')).toBe(false);
  });

  // ---------------------------------------------------------------------------
  // Permissions matrix count preserved (32 base + signature.sign — SPEC-REGULA-ESIG-001
  // + audit.read, audit.package.generate — SPEC-REGULA-AUDITOR-VIEW-001
  // + personal.view — SPEC-REGULA-PERSONAL-LIB-001
  // + deadline.view, deadline.manage — SPEC-REGULA-CALENDAR-001)
  // ---------------------------------------------------------------------------
  it('has 77 permission actions defined', () => {
    expect(Object.keys(PERMISSIONS).length).toBe(79); // +2 corpuslicense.* (#72) +2 sourcegov.* (#48) +1 rlhf.feedback (#56) +2 knowledgepromo.* (#50) +2 standards.* (#62)
  });

  it('profile.edit permission exists with user scope', () => {
    expect(PERMISSIONS['profile.edit']).toBeDefined();
    expect(PERMISSIONS['profile.edit'].scope).toBe('user');
    expect(PERMISSIONS['profile.edit'].minRole).toBe('ra-member');
  });

  // ---------------------------------------------------------------------------
  // Audit actions count preserved (>= 25, may grow with profile.update)
  // ---------------------------------------------------------------------------
  it('audit action union has >= 25 values', async () => {
    const { auditActionEnum } = await import('@/lib/db/schema');
    expect(auditActionEnum.enumValues.length).toBeGreaterThanOrEqual(25);
  });

  it('audit action enum includes enterprise actions', async () => {
    const { auditActionEnum } = await import('@/lib/db/schema');
    const values = auditActionEnum.enumValues;
    expect(values).toContain('rbac.permission_deny');
    expect(values).toContain('auth.login');
    expect(values).toContain('auth.logout');
    expect(values).toContain('expert_review.create');
  });

  // ---------------------------------------------------------------------------
  // Expert review status enum
  // ---------------------------------------------------------------------------
  it('expert review status has pending/in_progress/resolved', async () => {
    const { expertReviewStatusEnum } = await import('@/lib/db/schema');
    expect(expertReviewStatusEnum.enumValues).toContain('pending');
    expect(expertReviewStatusEnum.enumValues).toContain('in_progress');
    expect(expertReviewStatusEnum.enumValues).toContain('resolved');
  });

  // ---------------------------------------------------------------------------
  // User role enum
  // ---------------------------------------------------------------------------
  it('user role enum has all 4 roles', async () => {
    const { userRoleEnum } = await import('@/lib/db/schema');
    expect(userRoleEnum.enumValues).toContain('admin');
    expect(userRoleEnum.enumValues).toContain('ra-lead');
    expect(userRoleEnum.enumValues).toContain('ra-member');
    expect(userRoleEnum.enumValues).toContain('viewer');
  });

  // ---------------------------------------------------------------------------
  // Critical RBAC invariants: profile.edit min role is ra-member
  // ---------------------------------------------------------------------------
  it('profile.edit is accessible to ra-member (not admin-only)', () => {
    const spec = PERMISSIONS['profile.edit'];
    expect(hasRole('ra-member', spec.minRole)).toBe(true);
    expect(hasRole('viewer', spec.minRole)).toBe(false);
  });

  // ---------------------------------------------------------------------------
  // consult.create scope check (REQ-ENTERPRISE-020 regression)
  // ---------------------------------------------------------------------------
  it('consult.create has org scope (organization membership check)', () => {
    expect(PERMISSIONS['consult.create'].scope).toBe('org');
  });

  // ---------------------------------------------------------------------------
  // rbac.manage is admin-only
  // ---------------------------------------------------------------------------
  it('rbac.manage requires admin role', () => {
    const spec = PERMISSIONS['rbac.manage'];
    expect(hasRole('admin', spec.minRole)).toBe(true);
    expect(hasRole('ra-lead', spec.minRole)).toBe(false);
  });
});
