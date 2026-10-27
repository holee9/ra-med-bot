/**
 * RBAC tests for signature.sign permission.
 * REQ-ESIG-006: Only ra, admin can sign.
 * #547 (2026-10-27): qa-lead/ra-lead/ra-member unified — hierarchy-distinction
 * cases retired with the split.
 */

import { describe, expect, it } from 'vitest';
import { PERMISSIONS, roleSatisfiesPermission } from '../../kernel/auth/permissions';
import { hasRole } from '../../kernel/auth/rbac';

describe('signature.sign permission', () => {
  it('exists in PERMISSIONS matrix', () => {
    expect(PERMISSIONS['signature.sign']).toBeDefined();
  });

  it('requires minRole of ra', () => {
    expect(PERMISSIONS['signature.sign'].minRole).toBe('ra');
  });

  it('ra can sign (hasRole ra >= ra)', () => {
    expect(hasRole('ra', 'ra')).toBe(true);
  });

  it('ra satisfies signature.sign through hierarchy alone (unification — additionalRoles entry retired)', () => {
    expect(roleSatisfiesPermission('ra', PERMISSIONS['signature.sign'])).toBe(true);
  });

  it('admin can sign (hasRole admin >= ra)', () => {
    expect(hasRole('admin', 'ra')).toBe(true);
  });

  it('viewer cannot sign (hasRole viewer < ra)', () => {
    expect(hasRole('viewer', 'ra')).toBe(false);
  });
});
