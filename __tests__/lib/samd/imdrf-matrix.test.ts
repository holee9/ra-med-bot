// SPEC-REGULA-SAMD-001 — unit tests for IMDRF N12 classification matrix.
// Verifies deterministic category assignment, EU AI Act risk level derivation,
// FDA pathway derivation, and PCCP requirement determination.
import { describe, expect, it } from 'vitest';
import {
  classifySaMD,
  computeImdrfCategory,
  deriveFdaPathway,
  deriveEuAiRiskLevel,
  isPccpRequired,
} from '../../../lib/samd/imdrf-matrix';

// ---------------------------------------------------------------------------
// IMDRF N12 matrix — all 9 combinations
// ---------------------------------------------------------------------------
describe('computeImdrfCategory', () => {
  it('critical × critical → IV', () => {
    expect(computeImdrfCategory('critical', 'critical')).toBe('IV');
  });

  it('critical × serious → III', () => {
    expect(computeImdrfCategory('critical', 'serious')).toBe('III');
  });

  it('critical × non_serious → III', () => {
    expect(computeImdrfCategory('critical', 'non_serious')).toBe('III');
  });

  it('serious × critical → III', () => {
    expect(computeImdrfCategory('serious', 'critical')).toBe('III');
  });

  it('serious × serious → II', () => {
    expect(computeImdrfCategory('serious', 'serious')).toBe('II');
  });

  it('serious × non_serious → II', () => {
    expect(computeImdrfCategory('serious', 'non_serious')).toBe('II');
  });

  it('non_serious × critical → I', () => {
    expect(computeImdrfCategory('non_serious', 'critical')).toBe('I');
  });

  it('non_serious × serious → I', () => {
    expect(computeImdrfCategory('non_serious', 'serious')).toBe('I');
  });

  it('non_serious × non_serious → I', () => {
    expect(computeImdrfCategory('non_serious', 'non_serious')).toBe('I');
  });
});

// ---------------------------------------------------------------------------
// EU AI Act risk level derivation
// ---------------------------------------------------------------------------
describe('deriveEuAiRiskLevel', () => {
  it('Category IV → high_risk', () => {
    expect(deriveEuAiRiskLevel('IV')).toBe('high_risk');
  });

  it('Category III → high_risk', () => {
    expect(deriveEuAiRiskLevel('III')).toBe('high_risk');
  });

  it('Category II → general_purpose', () => {
    expect(deriveEuAiRiskLevel('II')).toBe('general_purpose');
  });

  it('Category I → minimal', () => {
    expect(deriveEuAiRiskLevel('I')).toBe('minimal');
  });
});

// ---------------------------------------------------------------------------
// FDA pathway derivation
// ---------------------------------------------------------------------------
describe('deriveFdaPathway', () => {
  it('continuously_learning + high risk (IV) → pma', () => {
    expect(deriveFdaPathway('continuously_learning', 'IV')).toBe('pma');
  });

  it('continuously_learning + low risk (I) → de_novo', () => {
    expect(deriveFdaPathway('continuously_learning', 'I')).toBe('de_novo');
  });

  it('adaptive + any → de_novo', () => {
    expect(deriveFdaPathway('adaptive', 'II')).toBe('de_novo');
    expect(deriveFdaPathway('adaptive', 'IV')).toBe('de_novo');
  });

  it('locked → 510k', () => {
    expect(deriveFdaPathway('locked', 'I')).toBe('510k');
    expect(deriveFdaPathway('locked', 'III')).toBe('510k');
  });
});

// ---------------------------------------------------------------------------
// PCCP requirement
// ---------------------------------------------------------------------------
describe('isPccpRequired', () => {
  it('locked → false', () => {
    expect(isPccpRequired('locked')).toBe(false);
  });

  it('adaptive → true', () => {
    expect(isPccpRequired('adaptive')).toBe(true);
  });

  it('continuously_learning → true', () => {
    expect(isPccpRequired('continuously_learning')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// classifySaMD composite function
// ---------------------------------------------------------------------------
describe('classifySaMD', () => {
  it('locked + serious × serious → Category II, general_purpose, 510k, no PCCP', () => {
    const result = classifySaMD('locked', 'serious', 'serious');
    expect(result.imdrfCategory).toBe('II');
    expect(result.euAiRiskLevel).toBe('general_purpose');
    expect(result.fdaPathway).toBe('510k');
    expect(result.pccpRequired).toBe(false);
  });

  it('adaptive + critical × critical → Category IV, high_risk, de_novo, PCCP required', () => {
    const result = classifySaMD('adaptive', 'critical', 'critical');
    expect(result.imdrfCategory).toBe('IV');
    expect(result.euAiRiskLevel).toBe('high_risk');
    expect(result.fdaPathway).toBe('de_novo');
    expect(result.pccpRequired).toBe(true);
  });

  it('continuously_learning + critical × critical → Category IV, high_risk, pma, PCCP required', () => {
    const result = classifySaMD('continuously_learning', 'critical', 'critical');
    expect(result.imdrfCategory).toBe('IV');
    expect(result.euAiRiskLevel).toBe('high_risk');
    expect(result.fdaPathway).toBe('pma');
    expect(result.pccpRequired).toBe(true);
  });

  it('locked + non_serious × non_serious → Category I, minimal, 510k, no PCCP', () => {
    const result = classifySaMD('locked', 'non_serious', 'non_serious');
    expect(result.imdrfCategory).toBe('I');
    expect(result.euAiRiskLevel).toBe('minimal');
    expect(result.fdaPathway).toBe('510k');
    expect(result.pccpRequired).toBe(false);
  });
});
