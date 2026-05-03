// @MX:ANCHOR [AUTO] hasRole — called by withPermission for every Route Handler request.
// @MX:REASON fan_in >= 3: withPermission (T-003 will add 10+ callers via all Route Handlers)
// @MX:SPEC SPEC-REGULA-ENTERPRISE-001 (REQ-ENTERPRISE-017)

// REQ-ENTERPRISE-017: Role type and hierarchy for RBAC enforcement.
// The hierarchy numeric values determine whether a user's role satisfies a
// minimum-role requirement. Higher value = more privileged.
export type Role = 'admin' | 'ra-lead' | 'ra-member' | 'viewer';

export const ROLE_HIERARCHY: Record<Role, number> = {
  admin: 4,
  'ra-lead': 3,
  'ra-member': 2,
  viewer: 1,
};

/**
 * Returns true when userRole's hierarchy level is >= required role's level.
 * Used by withPermission to enforce minRole gating on every Route Handler.
 */
export function hasRole(userRole: Role, required: Role): boolean {
  return ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[required];
}
