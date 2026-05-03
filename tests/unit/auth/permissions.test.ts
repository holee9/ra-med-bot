// @MX:NOTE [AUTO] T-002 TDD RED phase — PERMISSIONS matrix static validation tests.
// @MX:SPEC SPEC-REGULA-ENTERPRISE-001 (REQ-ENTERPRISE-020)

import { PERMISSIONS, type PermissionAction } from '@/lib/auth/permissions';
import { describe, expect, it } from 'vitest';

// All 15 action strings defined in SPEC REQ-ENTERPRISE-020
const EXPECTED_ACTIONS: PermissionAction[] = [
  'consult.create',
  'conversation.view',
  'conversation.delete',
  'expertReview.create',
  'dashboard.view',
  'dashboard.team',
  'expertReview.view',
  'expertReview.assign',
  'expertReview.resolve',
  'profile.edit',
  'project.create',
  'project.manage',
  'sources.ingest',
  'templates.edit',
  'rbac.manage',
];

const VALID_ROLES = ['admin', 'ra-lead', 'ra-member', 'viewer'] as const;
const VALID_SCOPES = ['org', 'project', 'user', 'none'] as const;

describe('lib/auth/permissions.ts (REQ-ENTERPRISE-020) — PERMISSIONS matrix', () => {
  it('PERMISSIONS contains exactly 15 entries', () => {
    expect(Object.keys(PERMISSIONS)).toHaveLength(15);
  });

  it.each(EXPECTED_ACTIONS)('PERMISSIONS contains action: %s', (action) => {
    expect(PERMISSIONS).toHaveProperty(action);
  });

  it('no duplicate action keys', () => {
    const keys = Object.keys(PERMISSIONS);
    const unique = new Set(keys);
    expect(unique.size).toBe(keys.length);
  });

  describe('each PERMISSIONS entry has required fields', () => {
    it.each(EXPECTED_ACTIONS)('entry %s has minRole field', (action) => {
      expect(PERMISSIONS[action]).toHaveProperty('minRole');
    });

    it.each(EXPECTED_ACTIONS)('entry %s has scope field', (action) => {
      expect(PERMISSIONS[action]).toHaveProperty('scope');
    });

    it.each(EXPECTED_ACTIONS)('entry %s has resourceType field', (action) => {
      expect(PERMISSIONS[action]).toHaveProperty('resourceType');
    });

    it.each(EXPECTED_ACTIONS)('entry %s minRole is a valid role', (action) => {
      const { minRole } = PERMISSIONS[action];
      expect(VALID_ROLES).toContain(minRole);
    });

    it.each(EXPECTED_ACTIONS)('entry %s scope is a valid scope value', (action) => {
      const { scope } = PERMISSIONS[action];
      expect(VALID_SCOPES).toContain(scope);
    });

    it.each(EXPECTED_ACTIONS)('entry %s resourceType is a non-empty string', (action) => {
      const { resourceType } = PERMISSIONS[action];
      expect(typeof resourceType).toBe('string');
      expect(resourceType.length).toBeGreaterThan(0);
    });
  });

  describe('specific minRole values from SPEC', () => {
    it('consult.create requires ra-member', () => {
      expect(PERMISSIONS['consult.create'].minRole).toBe('ra-member');
    });

    it('conversation.delete requires ra-lead', () => {
      expect(PERMISSIONS['conversation.delete'].minRole).toBe('ra-lead');
    });

    it('sources.ingest requires admin', () => {
      expect(PERMISSIONS['sources.ingest'].minRole).toBe('admin');
    });

    it('rbac.manage requires admin', () => {
      expect(PERMISSIONS['rbac.manage'].minRole).toBe('admin');
    });

    it('profile.edit requires ra-member', () => {
      expect(PERMISSIONS['profile.edit'].minRole).toBe('ra-member');
    });
  });

  describe('specific scope values from SPEC', () => {
    it('profile.edit is user-scoped', () => {
      expect(PERMISSIONS['profile.edit'].scope).toBe('user');
    });

    it('project.manage is project-scoped', () => {
      expect(PERMISSIONS['project.manage'].scope).toBe('project');
    });

    it('rbac.manage is org-scoped', () => {
      expect(PERMISSIONS['rbac.manage'].scope).toBe('org');
    });
  });
});
