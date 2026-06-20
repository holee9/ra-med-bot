// @MX:NOTE [AUTO] T-002 TDD RED phase — RBAC role hierarchy tests.
// @MX:SPEC SPEC-REGULA-ENTERPRISE-001 (REQ-ENTERPRISE-017)

import { describe, expect, it } from 'vitest';

// Import after source files are created in GREEN phase.
// Currently will fail with module-not-found — confirms RED state.
import { ROLE_HIERARCHY, hasRole } from '@/lib/auth/rbac';

const ROLES = ['admin', 'qa-lead', 'ra-lead', 'ra-member', 'viewer'] as const;
type Role = (typeof ROLES)[number];

describe('lib/auth/rbac.ts (REQ-ENTERPRISE-017) — ROLE_HIERARCHY + hasRole', () => {
  describe('ROLE_HIERARCHY values', () => {
    it('admin has highest hierarchy value (4)', () => {
      expect(ROLE_HIERARCHY.admin).toBe(4);
    });

    it('ra-lead has hierarchy value 3', () => {
      expect(ROLE_HIERARCHY['ra-lead']).toBe(3);
    });

    it('ra-member has hierarchy value 2', () => {
      expect(ROLE_HIERARCHY['ra-member']).toBe(2);
    });

    it('viewer has lowest hierarchy value (1)', () => {
      expect(ROLE_HIERARCHY.viewer).toBe(1);
    });

    it('qa-lead sits below ra-lead so it does not inherit every RA lead gate', () => {
      expect(ROLE_HIERARCHY['qa-lead']).toBeLessThan(ROLE_HIERARCHY['ra-lead']);
      expect(ROLE_HIERARCHY['qa-lead']).toBeGreaterThan(ROLE_HIERARCHY['ra-member']);
    });

    it('hierarchy covers all 6 roles', () => {
      // SPEC-REGULA-AUDITOR-VIEW-001 added auditor as the 6th role.
      expect(Object.keys(ROLE_HIERARCHY)).toHaveLength(6);
    });
  });

  describe('hasRole — specific cases', () => {
    it('admin passes ra-member required', () => {
      expect(hasRole('admin', 'ra-member')).toBe(true);
    });

    it('viewer fails ra-lead required', () => {
      expect(hasRole('viewer', 'ra-lead')).toBe(false);
    });

    it('ra-lead passes ra-lead required (same level)', () => {
      expect(hasRole('ra-lead', 'ra-lead')).toBe(true);
    });

    it('ra-member fails admin required', () => {
      expect(hasRole('ra-member', 'admin')).toBe(false);
    });

    it('admin passes admin required (same level)', () => {
      expect(hasRole('admin', 'admin')).toBe(true);
    });

    it('viewer passes viewer required (same level)', () => {
      expect(hasRole('viewer', 'viewer')).toBe(true);
    });
  });

  describe('hasRole — all 5x5 role combinations (25 cases)', () => {
    // Matrix: [userRole, requiredRole, expected]
    const matrix: [Role, Role, boolean][] = [
      // admin (4) vs all
      ['admin', 'admin', true],
      ['admin', 'qa-lead', true],
      ['admin', 'ra-lead', true],
      ['admin', 'ra-member', true],
      ['admin', 'viewer', true],
      // ra-lead (3) vs all
      ['ra-lead', 'admin', false],
      ['ra-lead', 'qa-lead', true],
      ['ra-lead', 'ra-lead', true],
      ['ra-lead', 'ra-member', true],
      ['ra-lead', 'viewer', true],
      // qa-lead (2.5) vs all
      ['qa-lead', 'admin', false],
      ['qa-lead', 'qa-lead', true],
      ['qa-lead', 'ra-lead', false],
      ['qa-lead', 'ra-member', true],
      ['qa-lead', 'viewer', true],
      // ra-member (2) vs all
      ['ra-member', 'admin', false],
      ['ra-member', 'qa-lead', false],
      ['ra-member', 'ra-lead', false],
      ['ra-member', 'ra-member', true],
      ['ra-member', 'viewer', true],
      // viewer (1) vs all
      ['viewer', 'admin', false],
      ['viewer', 'qa-lead', false],
      ['viewer', 'ra-lead', false],
      ['viewer', 'ra-member', false],
      ['viewer', 'viewer', true],
    ];

    it.each(matrix)('hasRole(%s, %s) → %s', (userRole, requiredRole, expected) => {
      expect(hasRole(userRole, requiredRole)).toBe(expected);
    });
  });
});
