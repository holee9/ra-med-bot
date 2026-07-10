// @MX:NOTE [AUTO] Unit tests for CER canonical step helpers (coverage 402).
// @MX:SPEC SPEC-REGULA-CER-001 (REQ-CER-001~011)

import { describe, expect, it } from 'vitest';
import { CER_STEPS, getNextStep, getStepIndex, isValidStep } from '../steps';

describe('cer/steps — canonical MEDDEV 2.7/1 Rev4 10-stage order', () => {
  it('CER_STEPS has exactly 10 stages in canonical order', () => {
    expect(CER_STEPS).toHaveLength(10);
    expect(CER_STEPS[0]).toBe('device_identification');
    expect(CER_STEPS[9]).toBe('pmcf_plan');
  });

  it('getStepIndex returns the 0-based index', () => {
    expect(getStepIndex('device_identification')).toBe(0);
    expect(getStepIndex('clinical_analysis')).toBe(5);
    expect(getStepIndex('conclusions')).toBe(8);
    expect(getStepIndex('pmcf_plan')).toBe(9);
  });

  it('isValidStep is a type guard accepting valid stages and rejecting others', () => {
    expect(isValidStep('literature_search')).toBe(true);
    expect(isValidStep('risk_benefit')).toBe(true);
    expect(isValidStep('invalid_step')).toBe(false);
    expect(isValidStep('')).toBe(false);
  });

  it('getNextStep returns the following stage', () => {
    expect(getNextStep('device_identification')).toBe('intended_use');
    expect(getNextStep('clinical_background')).toBe('literature_search');
    expect(getNextStep('conclusions')).toBe('pmcf_plan');
  });

  it('getNextStep returns null for the last stage (pmcf_plan)', () => {
    expect(getNextStep('pmcf_plan')).toBeNull();
  });
});
