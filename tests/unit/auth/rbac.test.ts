// @MX:NOTE [AUTO] T-002 — RBAC role hierarchy tests.
// @MX:SPEC SPEC-REGULA-ENTERPRISE-001 (REQ-ENTERPRISE-017)
// #547 (2026-10-27): ra-lead/ra-member/qa-lead unified into single 'ra'.

import { ROLE_HIERARCHY, hasRole } from '@/lib/kernel/auth/rbac';
import { describe, expect, it } from 'vitest';

const ROLES = ['admin', 'ra', 'viewer', 'auditor'] as const;
type Role = (typeof ROLES)[number];

describe('lib/kernel/auth/rbac.ts (REQ-ENTERPRISE-017) — ROLE_HIERARCHY + hasRole', () => {
  describe('ROLE_HIERARCHY values', () => {
    it('admin has highest hierarchy value (4)', () => {
      expect(ROLE_HIERARCHY.admin).toBe(4);
    });

    it('ra has hierarchy value 3 (inherited from former ra-lead, #547)', () => {
      expect(ROLE_HIERARCHY.ra).toBe(3);
    });

    it('viewer has hierarchy value 1', () => {
      expect(ROLE_HIERARCHY.viewer).toBe(1);
    });

    it('auditor sits below viewer (0.5) so it satisfies no minRole gate', () => {
      expect(ROLE_HIERARCHY.auditor).toBeLessThan(ROLE_HIERARCHY.viewer);
    });

    it('hierarchy covers all 4 roles (#547 unification)', () => {
      expect(Object.keys(ROLE_HIERARCHY)).toHaveLength(4);
    });
  });

  describe('hasRole — specific cases', () => {
    it('admin passes ra required', () => {
      expect(hasRole('admin', 'ra')).toBe(true);
    });

    it('viewer fails ra required', () => {
      expect(hasRole('viewer', 'ra')).toBe(false);
    });

    it('ra passes ra required (same level)', () => {
      expect(hasRole('ra', 'ra')).toBe(true);
    });

    it('ra fails admin required', () => {
      expect(hasRole('ra', 'admin')).toBe(false);
    });

    it('admin passes admin required (same level)', () => {
      expect(hasRole('admin', 'admin')).toBe(true);
    });

    it('viewer passes viewer required (same level)', () => {
      expect(hasRole('viewer', 'viewer')).toBe(true);
    });
  });

  describe('hasRole — all 4x4 role combinations (16 cases)', () => {
    // Matrix: [userRole, requiredRole, expected]
    const matrix: [Role, Role, boolean][] = [
      // admin (4) vs all
      ['admin', 'admin', true],
      ['admin', 'ra', true],
      ['admin', 'viewer', true],
      ['admin', 'auditor', true],
      // ra (3) vs all
      ['ra', 'admin', false],
      ['ra', 'ra', true],
      ['ra', 'viewer', true],
      ['ra', 'auditor', true],
      // viewer (1) vs all
      ['viewer', 'admin', false],
      ['viewer', 'ra', false],
      ['viewer', 'viewer', true],
      ['viewer', 'auditor', true],
      // auditor (0.5) vs all
      ['auditor', 'admin', false],
      ['auditor', 'ra', false],
      ['auditor', 'viewer', false],
      ['auditor', 'auditor', true],
    ];

    it.each(matrix)('hasRole(%s, %s) → %s', (userRole, requiredRole, expected) => {
      expect(hasRole(userRole, requiredRole)).toBe(expected);
    });
  });
});
