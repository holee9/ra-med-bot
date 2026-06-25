// @MX:NOTE [AUTO] Source authority model — 6-tier hierarchy (REQ-SOURCE-GOV-001/002/004/008).
// @MX:SPEC SPEC-REGULA-SOURCE-GOVERNANCE-001 (Issue #48)
//
// Defines the authority-grade ranking consumed by retrieval-gate.ts (priority
// ordering for REQ-004) and the low-authority assessor (REQ-008 expert-review
// trigger). Authority grades are RA-owner-set explicitly (SPEC §1.4 out-of-scope
// for auto-inference) and stored on sources.authority_grade.

import type { AuthorityGrade } from './types';

/**
 * Ordered authority tiers (index 0 = highest). REQ-SOURCE-GOV-004:
 * regulator_official and internal approved SOP receive retrieval priority.
 *
 * Regulatory anchor (SPEC §1.2): ISO 13485 / 21 CFR Part 820 document control
 * recognises a hierarchy from official regulator text → harmonised standards →
 * internal SOPs → prior submissions → public databases → secondary references.
 */
export const AUTHORITY_RANK: ReadonlyArray<AuthorityGrade> = [
  'regulator_official',
  'harmonized_standard',
  'internal_sop',
  'prior_submission',
  'public_database',
  'secondary_reference',
];

/** Numeric rank for a grade (0 = highest). null → lowest priority. */
export function authorityRank(grade: AuthorityGrade | null | undefined): number {
  if (!grade) return AUTHORITY_RANK.length;
  const idx = AUTHORITY_RANK.indexOf(grade);
  return idx === -1 ? AUTHORITY_RANK.length : idx;
}

/** Comparator: higher-authority grades sort first (asc rank = priority). */
export function compareByAuthority(
  a: AuthorityGrade | null | undefined,
  b: AuthorityGrade | null | undefined,
): number {
  return authorityRank(a) - authorityRank(b);
}

/** REQ-SOURCE-GOV-008 — "primary" grades are the top 4 tiers. */
const PRIMARY_GRADES: ReadonlySet<AuthorityGrade> = new Set([
  'regulator_official',
  'harmonized_standard',
  'internal_sop',
  'prior_submission',
]);

/** True for grades considered high-authority (not low-authority-only). */
export function isPrimaryGrade(grade: AuthorityGrade | null | undefined): boolean {
  return !!grade && PRIMARY_GRADES.has(grade);
}
