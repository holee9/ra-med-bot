// @MX:ANCHOR [AUTO] hasRole — called by withPermission for every Route Handler request.
// @MX:REASON fan_in >= 3: withPermission (T-003 will add 10+ callers via all Route Handlers)
// @MX:SPEC SPEC-REGULA-ENTERPRISE-001 (REQ-ENTERPRISE-017)

// REQ-ENTERPRISE-017: Role type and hierarchy for RBAC enforcement.
// The hierarchy numeric values determine whether a user's role satisfies a
// minimum-role requirement. Higher value = more privileged.
//
// SPEC-REGULA-AUDITOR-VIEW-001: `auditor` is a read-only external-inspector role.
// It sits BELOW viewer (level 1) so it cannot satisfy any existing minRole.
// Access is granted exclusively via PERMISSIONS[*].additionalRoles on the two
// audit-read endpoints. The auditor write-block in withPermission.ts enforces
// read-only behavior for POST/PUT/PATCH/DELETE regardless of permission grants.
export type Role = 'admin' | 'qa-lead' | 'ra-lead' | 'ra-member' | 'viewer' | 'auditor';

export const ROLE_HIERARCHY: Record<Role, number> = {
  admin: 4,
  'ra-lead': 3,
  // QA lead can perform member-level work by default.
  // Signature-specific elevation is handled by PERMISSIONS.additionalRoles.
  'qa-lead': 2.5,
  'ra-member': 2,
  viewer: 1,
  // Read-only external inspector — least privileged operational role.
  auditor: 0.5,
};

/**
 * Returns true when userRole's hierarchy level is >= required role's level.
 * Used by withPermission to enforce minRole gating on every Route Handler.
 */
export function hasRole(userRole: Role, required: Role): boolean {
  return ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[required];
}
