/**
 * TDD RED: RBAC tests for signature.sign permission.
 * REQ-ESIG-006: Only ra-lead, qa-lead, admin can sign.
 */

import { describe, expect, it } from 'vitest';
import { hasRole } from '../../auth/rbac';
import type { Role } from '../../auth/rbac';
import { PERMISSIONS } from '../../auth/permissions';

describe('signature.sign permission', () => {
  it('exists in PERMISSIONS matrix', () => {
    expect(PERMISSIONS['signature.sign']).toBeDefined();
  });

  it('requires minRole of ra-lead', () => {
    expect(PERMISSIONS['signature.sign'].minRole).toBe('ra-lead');
  });

  it('ra-lead can sign (hasRole ra-lead >= ra-lead)', () => {
    expect(hasRole('ra-lead', 'ra-lead')).toBe(true);
  });

  it('qa-lead can sign (hasRole qa-lead >= ra-lead)', () => {
    const qaLead = 'qa-lead' as Role;
    expect(hasRole(qaLead, 'ra-lead')).toBe(true);
  });

  it('admin can sign (hasRole admin >= ra-lead)', () => {
    expect(hasRole('admin', 'ra-lead')).toBe(true);
  });

  it('ra-member cannot sign (hasRole ra-member < ra-lead)', () => {
    expect(hasRole('ra-member', 'ra-lead')).toBe(false);
  });

  it('viewer cannot sign (hasRole viewer < ra-lead)', () => {
    expect(hasRole('viewer', 'ra-lead')).toBe(false);
  });
});
