// @MX:SPEC SPEC-REGULA-PCCP-001 (REQ-PCCP-013)
// Substantial equivalence gate — 5-dimension check.
// Warns if any dimension is 'Modified' (may require new 510(k) clearance).

import type { EquivalenceDimension } from './types';

export interface EquivalenceGateResult {
  pass: boolean;
  modifiedDimensions: string[];
  warnings: string[];
}

const DIMENSION_LABELS: Record<string, string> = {
  intended_use: 'Intended Use',
  indications: 'Indications for Use',
  technological_characteristics: 'Technological Characteristics',
  clinical_safety: 'Clinical Safety',
  user_interface: 'User Interface',
};

/**
 * Evaluates 5-dimension substantial equivalence.
 * Returns pass=true when all dimensions are Unchanged, with warnings for Modified.
 * New dimensions always require new clearance → pass=false.
 */
export function evaluateSubstantialEquivalence(
  dimensions: EquivalenceDimension[],
): EquivalenceGateResult {
  const modifiedDimensions: string[] = [];
  const warnings: string[] = [];
  let pass = true;

  for (const dim of dimensions) {
    const label = DIMENSION_LABELS[dim.dimension] ?? dim.dimension;
    if (dim.status === 'Modified') {
      modifiedDimensions.push(dim.dimension);
      warnings.push(
        `"${label}" is Modified — verify whether this constitutes a substantial equivalence deviation requiring new 510(k).`,
      );
    } else if (dim.status === 'New') {
      modifiedDimensions.push(dim.dimension);
      warnings.push(
        `"${label}" is New — new intended use or indication likely requires separate 510(k) clearance.`,
      );
      pass = false;
    }
  }

  return { pass, modifiedDimensions, warnings };
}
