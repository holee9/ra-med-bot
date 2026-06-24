// @MX:NOTE [AUTO] Root cause analysis helpers (5 Whys / Fishbone).
// @MX:SPEC SPEC-REGULA-CAPA-001 (REQ-003)
//
// REQ-003: supports structured RCA via two methods. Pure validation functions
// — persistence is the caller's responsibility (lib/capa/records.ts).

import type { FishboneAnalysis, FiveWhysAnalysis, RootCauseMethod } from './types';

/**
 * Validate a 5 Whys analysis. Each step must be non-empty and the chain must
 * terminate in a rootCause. REQ-003: the method drives toward the systemic
 * root cause, not just the immediate symptom.
 */
export function validateFiveWhys(data: FiveWhysAnalysis): string[] {
  const errors: string[] = [];
  if (!data.why1?.trim()) errors.push('why1 is required');
  if (!data.why2?.trim()) errors.push('why2 is required');
  if (!data.why3?.trim()) errors.push('why3 is required');
  if (!data.why4?.trim()) errors.push('why4 is required');
  if (!data.why5?.trim()) errors.push('why5 is required');
  if (!data.rootCause?.trim()) errors.push('rootCause is required');
  return errors;
}

/**
 * Validate a Fishbone (Ishikawa) analysis. At least one of the 6M categories
 * must have ≥1 entry, and rootCause is required. REQ-003: the 6M categories
 * (Man, Machine, Material, Method, Measurement, Environment) ensure broad
 * causal coverage.
 */
export function validateFishbone(data: FishboneAnalysis): string[] {
  const errors: string[] = [];
  const categories = [
    data.man,
    data.machine,
    data.material,
    data.method,
    data.measurement,
    data.environment,
  ];
  const hasAnyCause = categories.some((c) => Array.isArray(c) && c.some((x) => x?.trim()));
  if (!hasAnyCause) {
    errors.push('at least one 6M category must have a cause entry');
  }
  if (!data.rootCause?.trim()) errors.push('rootCause is required');
  return errors;
}

/**
 * Validate the analysis data for the given method. Returns a list of error
 * messages (empty = valid).
 */
export function validateRootCauseAnalysis(method: RootCauseMethod, data: unknown): string[] {
  if (method === '5whys') {
    return validateFiveWhys(data as FiveWhysAnalysis);
  }
  if (method === 'fishbone') {
    return validateFishbone(data as FishboneAnalysis);
  }
  return [`unknown method: ${method satisfies never}`];
}
