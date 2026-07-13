// @vitest-environment node
// @MX:NOTE [AUTO] Unit tests for lib/pccp/equivalence-gate (SPEC-REGULA-PCCP-001).
// @MX:SPEC SPEC-REGULA-PCCP-001 (REQ-PCCP-013)

import { describe, expect, it } from 'vitest';
import { evaluateSubstantialEquivalence } from '../equivalence-gate';

describe('evaluateSubstantialEquivalence (REQ-PCCP-013)', () => {
  it('passes when all dimensions are Unchanged', () => {
    const result = evaluateSubstantialEquivalence([
      { dimension: 'intended_use', status: 'Unchanged' },
      { dimension: 'indications', status: 'Unchanged' },
    ]);
    expect(result.pass).toBe(true);
    expect(result.modifiedDimensions).toHaveLength(0);
  });

  it('passes with warnings when a dimension is Modified', () => {
    const result = evaluateSubstantialEquivalence([
      { dimension: 'intended_use', status: 'Unchanged' },
      { dimension: 'technological_characteristics', status: 'Modified' },
    ]);
    expect(result.pass).toBe(true);
    expect(result.modifiedDimensions).toEqual(['technological_characteristics']);
    expect(result.warnings[0]).toContain('Technological Characteristics');
  });

  it('fails when any dimension is New', () => {
    const result = evaluateSubstantialEquivalence([
      { dimension: 'intended_use', status: 'Unchanged' },
      { dimension: 'clinical_safety', status: 'New' },
    ]);
    expect(result.pass).toBe(false);
    expect(result.modifiedDimensions).toEqual(['clinical_safety']);
    expect(result.warnings[0]).toContain('New');
  });

  it('handles an empty dimensions array', () => {
    expect(evaluateSubstantialEquivalence([])).toEqual({
      pass: true,
      modifiedDimensions: [],
      warnings: [],
    });
  });
});
