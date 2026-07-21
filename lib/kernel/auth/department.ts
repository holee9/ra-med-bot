// Department attribute for secondary RBAC axis (SPEC-REGULA-TENANT-001 Tenant-Lite)
export type Department = 'RA' | 'Dev' | 'Exec' | 'External';

// Feature set that can be ACL-gated by department
export type DepartmentFeature =
  | 'dashboard.team' // Team-level dashboard visibility
  | 'sources.ingest' // Corpus ingestion
  | 'templates.edit'; // Template management

// Department-level feature access matrix
// null department = no department restriction (role-only enforcement)
export const DEPARTMENT_ACL: Record<Department, DepartmentFeature[]> = {
  RA: ['dashboard.team', 'sources.ingest', 'templates.edit'],
  Dev: ['sources.ingest', 'templates.edit'],
  Exec: ['dashboard.team'],
  External: [],
};

// Returns true when department grants access to feature, OR when department is null/undefined
// @MX:ANCHOR [AUTO] hasDepartmentAccess — called by withPermission for department-scoped features
// @MX:REASON fan_in >= 3: withPermission, profile API, and future feature gates will all call this
// @MX:SPEC SPEC-REGULA-TENANT-001
export function hasDepartmentAccess(
  department: Department | null | undefined,
  feature: DepartmentFeature,
): boolean {
  if (!department) return true; // no department = unrestricted
  return DEPARTMENT_ACL[department].includes(feature);
}
