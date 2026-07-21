// @MX:ANCHOR [AUTO] Predicate RBAC matrix — single source of truth for the
//   department gate on every predicate route (REQ-PRE-029, REQ-PRE-022).
// @MX:REASON fan_in >= 4: search, comparison (create + list), export, approve,
//   and admin cache/clear routes all gate on these helpers; widening any set
//   here silently changes the access policy across the whole feature.
// @MX:SPEC SPEC-REGULA-PREDICATE-001

// Department values mirror lib/kernel/auth/department.ts (PascalCase as stored in DB).
// Helpers accept the raw `string | null` returned by the user lookup so callers
// need not narrow the type before checking; any unknown value (or null) denies.

const RA_DEV = new Set(['RA', 'Dev']);
const RA_DEV_EXEC = new Set(['RA', 'Dev', 'Exec']);
const DEV_ONLY = new Set(['Dev']);

/** REQ-PRE-029: RA/Dev may run predicate searches. */
export function canSearchPredicates(dept: string | null): boolean {
  return dept != null && RA_DEV.has(dept);
}

/** REQ-PRE-029: RA/Dev may create/approve comparisons (write scope). */
export function canManageComparisons(dept: string | null): boolean {
  return dept != null && RA_DEV.has(dept);
}

/** REQ-PRE-029: RA/Dev/Exec may read comparison history (Exec is read-only). */
export function canViewComparisons(dept: string | null): boolean {
  return dept != null && RA_DEV_EXEC.has(dept);
}

/** REQ-PRE-029: RA/Dev may export comparisons (write scope). */
export function canExportComparisons(dept: string | null): boolean {
  return dept != null && RA_DEV.has(dept);
}

/** REQ-PRE-022: only Dev may invalidate the predicate cache. */
export function canClearPredicateCache(dept: string | null): boolean {
  return dept != null && DEV_ONLY.has(dept);
}
