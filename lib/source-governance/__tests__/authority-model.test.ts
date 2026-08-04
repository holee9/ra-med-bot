// @vitest-environment node
// @MX:NOTE [AUTO] Unit tests for lib/source-governance/authority-model (SPEC-REGULA-SOURCE-GOVERNANCE-001).
// @MX:SPEC SPEC-REGULA-SOURCE-GOVERNANCE-001 (REQ-SOURCE-GOV-001/002/004/008)

import { describe, expect, it } from 'vitest';
import {
  AUTHORITY_RANK,
  authorityRank,
  compareByAuthority,
  isPrimaryGrade,
} from '../authority-model';

describe('authority-model (REQ-SOURCE-GOV-001/002/004/008)', () => {
  it('AUTHORITY_RANK has 6 tiers ordered high→low', () => {
    expect(AUTHORITY_RANK).toHaveLength(6);
    expect(AUTHORITY_RANK[0]).toBe('regulator_official');
    expect(AUTHORITY_RANK[5]).toBe('secondary_reference');
  });

  it('authorityRank returns 0 for the highest grade, 5 for lowest, 6 for null/unknown', () => {
    expect(authorityRank('regulator_official')).toBe(0);
    expect(authorityRank('secondary_reference')).toBe(5);
    expect(authorityRank(null)).toBe(6);
    expect(authorityRank(undefined)).toBe(6);
  });

  it('compareByAuthority sorts higher-authority grades first', () => {
    expect(compareByAuthority('regulator_official', 'secondary_reference')).toBeLessThan(0);
    expect(compareByAuthority('secondary_reference', 'regulator_official')).toBeGreaterThan(0);
    expect(compareByAuthority('internal_sop', 'internal_sop')).toBe(0);
  });

  it('isPrimaryGrade is true for top-4 grades, false for bottom-2 and null', () => {
    expect(isPrimaryGrade('regulator_official')).toBe(true);
    expect(isPrimaryGrade('prior_submission')).toBe(true);
    expect(isPrimaryGrade('public_database')).toBe(false);
    expect(isPrimaryGrade('secondary_reference')).toBe(false);
    expect(isPrimaryGrade(null)).toBe(false);
  });
});
