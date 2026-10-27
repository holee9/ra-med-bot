// @MX:NOTE [AUTO] FOUNDATION regression tests — validates T-001~T-013 invariants.
// @MX:SPEC SPEC-REGULA-ENTERPRISE-001 (REQ-ENTERPRISE-060)

import { PERMISSIONS } from '@/lib/kernel/auth/permissions';
import { hasRole } from '@/lib/kernel/auth/rbac';
import { describe, expect, it } from 'vitest';

describe('FOUNDATION regression', () => {
  // ---------------------------------------------------------------------------
  // RBAC hierarchy preserved
  // ---------------------------------------------------------------------------
  it('admin has all permissions (hierarchy preserved)', () => {
    expect(hasRole('admin', 'ra')).toBe(true);
    expect(hasRole('admin', 'ra')).toBe(true);
    expect(hasRole('admin', 'viewer')).toBe(true);
  });

  it('ra has ra and viewer permissions', () => {
    expect(hasRole('ra', 'ra')).toBe(true);
    expect(hasRole('ra', 'viewer')).toBe(true);
    expect(hasRole('ra', 'admin')).toBe(false);
  });

  it('viewer cannot access ra actions', () => {
    expect(hasRole('viewer', 'ra')).toBe(false);
    expect(hasRole('viewer', 'ra')).toBe(false);
    expect(hasRole('viewer', 'admin')).toBe(false);
  });

  it('viewer cannot access admin actions (#547 — ra seniority split retired)', () => {
    expect(hasRole('viewer', 'ra')).toBe(false);
    expect(hasRole('viewer', 'admin')).toBe(false);
  });

  // ---------------------------------------------------------------------------
  // Permissions matrix count preserved (32 base + signature.sign — SPEC-REGULA-ESIG-001
  // + audit.read, audit.package.generate — SPEC-REGULA-AUDITOR-VIEW-001
  // + personal.view — SPEC-REGULA-PERSONAL-LIB-001
  // + deadline.view, deadline.manage — SPEC-REGULA-CALENDAR-001)
  // ---------------------------------------------------------------------------
  it('has 92 permission actions defined', () => {
    expect(Object.keys(PERMISSIONS).length).toBe(92); // +3 validation.* (#49 SPEC-REGULA-VALIDATION-001: read/run/approve) +2 corpuslicense.* (#72) +2 sourcegov.* (#48) +1 rlhf.feedback (#56) +2 knowledgepromo.* (#50) +2 standards.* (#62) +2 inbox.* (#320) +1 ask.create (#320) +4 consult.* (#341 SPEC-V3-CONSULT-001) +3 impact.* (SPEC-V3-IMPACT-001)
  });

  it('profile.edit permission exists with user scope', () => {
    expect(PERMISSIONS['profile.edit']).toBeDefined();
    expect(PERMISSIONS['profile.edit'].scope).toBe('user');
    expect(PERMISSIONS['profile.edit'].minRole).toBe('ra');
  });

  // ---------------------------------------------------------------------------
  // Audit actions count preserved (>= 25, may grow with profile.update)
  // ---------------------------------------------------------------------------
  it('audit action union has >= 25 values', async () => {
    const { auditActionEnum } = await import('@/lib/kernel/db/schema');
    expect(auditActionEnum.enumValues.length).toBeGreaterThanOrEqual(25);
  });

  it('audit action enum includes enterprise actions', async () => {
    const { auditActionEnum } = await import('@/lib/kernel/db/schema');
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
    const { expertReviewStatusEnum } = await import('@/lib/kernel/db/schema');
    expect(expertReviewStatusEnum.enumValues).toContain('pending');
    expect(expertReviewStatusEnum.enumValues).toContain('in_progress');
    expect(expertReviewStatusEnum.enumValues).toContain('resolved');
  });

  // ---------------------------------------------------------------------------
  // User role enum
  // ---------------------------------------------------------------------------
  it('user role enum has all 4 roles', async () => {
    const { userRoleEnum } = await import('@/lib/kernel/db/schema');
    expect(userRoleEnum.enumValues).toContain('admin');
    expect(userRoleEnum.enumValues).toContain('ra');
    expect(userRoleEnum.enumValues).toContain('ra');
    expect(userRoleEnum.enumValues).toContain('viewer');
  });

  // ---------------------------------------------------------------------------
  // Critical RBAC invariants: profile.edit min role is ra
  // ---------------------------------------------------------------------------
  it('profile.edit is accessible to ra (not admin-only)', () => {
    const spec = PERMISSIONS['profile.edit'];
    expect(hasRole('ra', spec.minRole)).toBe(true);
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
    expect(hasRole('ra', spec.minRole)).toBe(false);
  });
});
