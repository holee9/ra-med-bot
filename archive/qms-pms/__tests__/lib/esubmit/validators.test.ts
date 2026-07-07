// @MX:SPEC SPEC-REGULA-ESUBMIT-001
// Unit tests for electronic submission validators.

// @MX:LEGACY archived from __tests__

import {
  validate510k,
  validateCER,
  validatePCCP,
  validateSubmissionPackage,
} from '@/lib/esubmit/validators';
import { describe, expect, it } from 'vitest';

// ---------------------------------------------------------------------------
// validate510k
// ---------------------------------------------------------------------------

describe('validate510k', () => {
  it('returns no errors for a complete manifest', () => {
    const manifest = {
      device_description: 'A detailed description of the device with sufficient length',
      intended_use: 'This device is intended for use in the treatment of X condition',
      substantial_equivalence:
        'Substantially equivalent to predicate device ABC-123 cleared in 2020',
      performance_testing: 'Bench testing conducted per ISO 10993 with passing results obtained',
      biocompatibility: 'Biocompatibility evaluation per ISO 10993-1 demonstrates safety',
      predicate_device: 'K203456',
    };

    const issues = validate510k(manifest);
    const errors = issues.filter((i) => i.severity === 'error');
    expect(errors).toHaveLength(0);
  });

  it('returns errors for missing required sections', () => {
    const issues = validate510k({});
    const errorCodes = issues.filter((i) => i.severity === 'error').map((i) => i.code);

    expect(errorCodes).toContain('MISSING_DEVICE_DESCRIPTION');
    expect(errorCodes).toContain('MISSING_INTENDED_USE');
    expect(errorCodes).toContain('MISSING_SUBSTANTIAL_EQUIVALENCE');
    expect(errorCodes).toContain('MISSING_PERFORMANCE_TESTING');
    expect(errorCodes).toContain('MISSING_BIOCOMPATIBILITY');
  });

  it('warns when predicate_device is absent', () => {
    const manifest = {
      device_description: 'A detailed description of the device with sufficient length',
      intended_use: 'This device is intended for use in the treatment of X condition',
      substantial_equivalence: 'Substantially equivalent to predicate device cleared in 2020',
      performance_testing: 'Bench testing conducted per ISO 10993 with passing results',
      biocompatibility: 'Biocompatibility evaluation per ISO 10993-1 demonstrates safety',
    };

    const issues = validate510k(manifest);
    const warnings = issues.filter((i) => i.severity === 'warning');
    const predWarning = warnings.find((i) => i.code === 'MISSING_PREDICATE_DEVICE');
    expect(predWarning).toBeDefined();
  });

  it('warns when section value is too short', () => {
    const manifest = {
      device_description: 'Short',
      intended_use: 'This device is intended for treating X',
      substantial_equivalence: 'Substantially equivalent to ABC',
      performance_testing: 'Testing done per ISO standards passes',
      biocompatibility: 'Biocompat eval per ISO 10993 done',
    };

    const issues = validate510k(manifest);
    const incompleteWarning = issues.find(
      (i) => i.severity === 'warning' && i.code === 'INCOMPLETE_DEVICE_DESCRIPTION',
    );
    expect(incompleteWarning).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// validateCER
// ---------------------------------------------------------------------------

describe('validateCER', () => {
  it('returns no errors for a complete CER manifest', () => {
    const manifest = {
      clinical_literature: 'Systematic literature search conducted per MEDDEV 2.7/1 Rev4',
      clinical_data: 'Post-market clinical follow-up data from 120 patients over 24 months',
      risk_benefit: 'Risk-benefit analysis demonstrates favorable profile for intended use',
      pmcf_plan: {
        description: 'PMCF plan includes annual registry data collection and surveys',
        rationale: 'Required under EU MDR Annex XIV for this device category',
      },
    };

    const issues = validateCER(manifest);
    const errors = issues.filter((i) => i.severity === 'error');
    expect(errors).toHaveLength(0);
  });

  it('returns errors for all missing CER sections', () => {
    const issues = validateCER({});
    const errorCodes = issues.filter((i) => i.severity === 'error').map((i) => i.code);

    expect(errorCodes).toContain('MISSING_CLINICAL_LITERATURE');
    expect(errorCodes).toContain('MISSING_CLINICAL_DATA');
    expect(errorCodes).toContain('MISSING_RISK_BENEFIT');
    expect(errorCodes).toContain('MISSING_PMCF_PLAN');
  });

  it('suggests adding pmcf rationale when missing', () => {
    const manifest = {
      clinical_literature: 'Systematic literature search per MEDDEV 2.7/1 Rev4 completed',
      clinical_data: 'Post-market data from 120 patients over 24 months available',
      risk_benefit: 'Risk-benefit analysis demonstrates favorable profile for use',
      pmcf_plan: { description: 'Annual registry collection' },
    };

    const issues = validateCER(manifest);
    const infoIssue = issues.find((i) => i.code === 'PMCF_MISSING_RATIONALE');
    expect(infoIssue).toBeDefined();
    expect(infoIssue?.severity).toBe('info');
  });
});

// ---------------------------------------------------------------------------
// validatePCCP
// ---------------------------------------------------------------------------

describe('validatePCCP', () => {
  it('returns no errors for a complete PCCP manifest', () => {
    const manifest = {
      device_description: 'AI-based wound assessment device using deep learning image analysis',
      pccp_sections: 'Algorithm update procedures for model retraining and validation',
      modification_protocol: 'Pre-specified modification criteria and performance thresholds',
      performance_targets: [
        { metric: 'sensitivity', baseline: 0.92, threshold: 0.9 },
        { metric: 'specificity', baseline: 0.88, threshold: 0.85 },
      ],
    };

    const issues = validatePCCP(manifest);
    const errors = issues.filter((i) => i.severity === 'error');
    expect(errors).toHaveLength(0);
  });

  it('returns errors for missing PCCP sections', () => {
    const issues = validatePCCP({});
    const errorCodes = issues.filter((i) => i.severity === 'error').map((i) => i.code);

    expect(errorCodes).toContain('MISSING_DEVICE_DESCRIPTION');
    expect(errorCodes).toContain('MISSING_PCCP_SECTIONS');
    expect(errorCodes).toContain('MISSING_MODIFICATION_PROTOCOL');
    expect(errorCodes).toContain('MISSING_PERFORMANCE_TARGETS');
  });

  it('errors when performance_targets is empty array', () => {
    const manifest = {
      device_description: 'AI-based wound assessment device using deep learning analysis',
      pccp_sections: 'Algorithm update procedures and retraining protocol defined',
      modification_protocol: 'Pre-specified modification criteria documented here',
      performance_targets: [],
    };

    const issues = validatePCCP(manifest);
    const emptyTargetsError = issues.find((i) => i.code === 'EMPTY_PERFORMANCE_TARGETS');
    expect(emptyTargetsError).toBeDefined();
    expect(emptyTargetsError?.severity).toBe('error');
  });
});

// ---------------------------------------------------------------------------
// validateSubmissionPackage (dispatcher)
// ---------------------------------------------------------------------------

describe('validateSubmissionPackage', () => {
  it('dispatches to 510k validator', () => {
    const issues = validateSubmissionPackage('510k', {});
    expect(issues.some((i) => i.code === 'MISSING_DEVICE_DESCRIPTION')).toBe(true);
  });

  it('dispatches to de_novo using 510k rules', () => {
    const issues = validateSubmissionPackage('de_novo', {});
    expect(issues.some((i) => i.code === 'MISSING_DEVICE_DESCRIPTION')).toBe(true);
  });

  it('dispatches to CER validator', () => {
    const issues = validateSubmissionPackage('cer', {});
    expect(issues.some((i) => i.code === 'MISSING_CLINICAL_LITERATURE')).toBe(true);
  });

  it('dispatches to PCCP validator', () => {
    const issues = validateSubmissionPackage('pccp', {});
    expect(issues.some((i) => i.code === 'MISSING_PCCP_SECTIONS')).toBe(true);
  });

  it('returns warning for unknown submission type', () => {
    const issues = validateSubmissionPackage('unknown_type', {});
    expect(issues).toHaveLength(1);
    const first = issues[0];
    expect(first).toBeDefined();
    expect(first?.code).toBe('UNKNOWN_SUBMISSION_TYPE');
    expect(first?.severity).toBe('warning');
  });

  it('returns empty array for complete 510k manifest', () => {
    const manifest = {
      device_description: 'A detailed description of the device with sufficient length here',
      intended_use: 'This device is intended for treatment of X condition in patients',
      substantial_equivalence: 'Substantially equivalent to predicate device K203456 cleared',
      performance_testing: 'Bench testing conducted per ISO 10993 with all passing results',
      biocompatibility: 'Biocompatibility evaluation per ISO 10993-1 confirms device safety',
      predicate_device: 'K203456',
    };

    const issues = validateSubmissionPackage('510k', manifest);
    const errors = issues.filter((i) => i.severity === 'error');
    expect(errors).toHaveLength(0);
  });
});
