// @MX:ANCHOR: [AUTO] validateSubmissionPackage — fan_in >= 3 (validate route, tests, detail component)
// @MX:REASON: [AUTO] Central validation entry point called by API route, frontend, and test suite
// @MX:SPEC SPEC-REGULA-ESUBMIT-001
// Pure validation functions for electronic submission packages.
// No real FDA eSTAR / EUDAMED API integration — structural validation only.
// RA Lead reviews final output before actual submission.

export interface ValidationIssue {
  code: string;
  severity: 'error' | 'warning' | 'info';
  section: string;
  message: string;
}

// Required sections per submission type
const REQUIRED_SECTIONS_510K = [
  'device_description',
  'intended_use',
  'substantial_equivalence',
  'performance_testing',
  'biocompatibility',
] as const;

const REQUIRED_SECTIONS_CER = [
  'clinical_literature',
  'clinical_data',
  'risk_benefit',
  'pmcf_plan',
] as const;

const REQUIRED_SECTIONS_PCCP = [
  'device_description',
  'pccp_sections',
  'modification_protocol',
  'performance_targets',
] as const;

// Generic section presence check helper
function checkRequiredSections(
  manifest: Record<string, unknown>,
  requiredSections: readonly string[],
  submissionLabel: string,
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  for (const section of requiredSections) {
    const value = manifest[section];
    if (value === undefined || value === null || value === '') {
      issues.push({
        code: `MISSING_${section.toUpperCase()}`,
        severity: 'error',
        section,
        message: `${submissionLabel} requires section "${section}" but it is missing or empty.`,
      });
    } else if (typeof value === 'string' && value.trim().length < 20) {
      issues.push({
        code: `INCOMPLETE_${section.toUpperCase()}`,
        severity: 'warning',
        section,
        message: `Section "${section}" appears incomplete (fewer than 20 characters).`,
      });
    }
  }

  return issues;
}

/** Validate FDA 510(k) submission package */
export function validate510k(manifest: Record<string, unknown>): ValidationIssue[] {
  const issues = checkRequiredSections(manifest, REQUIRED_SECTIONS_510K, 'FDA 510(k)');

  // Predicate device check
  if (!manifest.predicate_device) {
    issues.push({
      code: 'MISSING_PREDICATE_DEVICE',
      severity: 'warning',
      section: 'substantial_equivalence',
      message:
        '510(k) substantial equivalence requires a predicate device reference. Consider adding predicate_device.',
    });
  }

  return issues;
}

/** Validate CER (Clinical Evaluation Report) submission package */
export function validateCER(manifest: Record<string, unknown>): ValidationIssue[] {
  const issues = checkRequiredSections(manifest, REQUIRED_SECTIONS_CER, 'EU MDR CER');

  // PMCF plan is mandatory under EU MDR unless justified
  const pmcfPlan = manifest.pmcf_plan;
  if (
    typeof pmcfPlan === 'object' &&
    pmcfPlan !== null &&
    !(pmcfPlan as Record<string, unknown>).rationale
  ) {
    issues.push({
      code: 'PMCF_MISSING_RATIONALE',
      severity: 'info',
      section: 'pmcf_plan',
      message:
        'EU MDR Annex XIV requires PMCF plan rationale. Consider adding pmcf_plan.rationale.',
    });
  }

  return issues;
}

/** Validate PCCP (Predetermined Change Control Plan) submission package */
export function validatePCCP(manifest: Record<string, unknown>): ValidationIssue[] {
  const issues = checkRequiredSections(manifest, REQUIRED_SECTIONS_PCCP, 'PCCP');

  // Performance targets must be measurable
  const targets = manifest.performance_targets;
  if (Array.isArray(targets) && targets.length === 0) {
    issues.push({
      code: 'EMPTY_PERFORMANCE_TARGETS',
      severity: 'error',
      section: 'performance_targets',
      message: 'PCCP requires at least one quantitative performance target.',
    });
  }

  return issues;
}

// @MX:NOTE: [AUTO] De Novo and PMA share 510k-style structure — extend as real guidance matures
const SUBMISSION_TYPE_VALIDATORS: Record<
  string,
  (manifest: Record<string, unknown>) => ValidationIssue[]
> = {
  '510k': validate510k,
  de_novo: validate510k, // Same required sections as 510(k) by default
  pma: validate510k, // Superset — extend when PMA-specific sections are known
  cer: validateCER,
  pccp: validatePCCP,
};

/**
 * Generic validation dispatcher for all submission types.
 * Returns structural issues found in the manifest.
 * Does NOT call external APIs.
 */
export function validateSubmissionPackage(
  submissionType: string,
  manifest: Record<string, unknown>,
): ValidationIssue[] {
  const validator = SUBMISSION_TYPE_VALIDATORS[submissionType];
  if (!validator) {
    return [
      {
        code: 'UNKNOWN_SUBMISSION_TYPE',
        severity: 'warning',
        section: 'general',
        message: `No validation rules found for submission type "${submissionType}". Manual review required.`,
      },
    ];
  }
  return validator(manifest);
}
