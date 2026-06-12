// @MX:NOTE EU MDR Annex XIV Clinical Evaluation Report stage model.
// @MX:SPEC SPEC-REGULA-CER-001 (REQ-CER-001~011)
//
// Stage definitions for EU MDR Annex XIV CER (MEDDEV 2.7/1 Rev4).
// The 10-stage structure is the canonical CER outline; stage ordering and
// the `required` flag are fixed by the guideline and must not be reordered.

export type CerStageId = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;

export interface CerStage {
  id: CerStageId;
  title: string;
  description: string;
  required: boolean;
}

// 10 stages per MEDDEV 2.7/1 Rev4. Every stage is required for a complete
// Annex XIV CER; the `required` flag is kept explicit for forward
// compatibility with reduced-scope reports.
export const CER_STAGES: readonly CerStage[] = [
  {
    id: 1,
    title: 'Device identification and description',
    description:
      'Identification of the device, models, variants, accessories, and a technical description of its construction and operating principle.',
    required: true,
  },
  {
    id: 2,
    title: 'Intended use and intended purpose',
    description:
      'Intended purpose, indications, contraindications, target patient population, intended users, and intended environment of use.',
    required: true,
  },
  {
    id: 3,
    title: 'Clinical background and state of the art',
    description:
      'Current knowledge and state of the art for the medical condition and device type, including applicable standards and alternative therapies.',
    required: true,
  },
  {
    id: 4,
    title: 'Literature search strategy',
    description:
      'Search protocol covering databases, search terms, inclusion/exclusion criteria, and date ranges used to identify pertinent clinical data.',
    required: true,
  },
  {
    id: 5,
    title: 'Appraisal of pertinent data',
    description:
      'Appraisal of each data source for scientific validity, relevance, and weighting using a predefined appraisal plan (e.g. SIGN 50 / GRADE).',
    required: true,
  },
  {
    id: 6,
    title: 'Analysis of the clinical data',
    description:
      'Analysis of the appraised data against the intended purpose, performance, and safety claims, identifying gaps in the clinical evidence.',
    required: true,
  },
  {
    id: 7,
    title: 'Equivalence assessment (Article 61(4))',
    description:
      'Assessment of equivalence to one or more devices across clinical, technical, and biological characteristics per EU MDR Article 61(4).',
    required: true,
  },
  {
    id: 8,
    title: 'Risk-benefit analysis',
    description:
      'Evaluation of the benefit-risk profile, demonstrating that benefits outweigh residual risks under normal conditions of use.',
    required: true,
  },
  {
    id: 9,
    title: 'Conclusions',
    description:
      'Conclusions on the safety, performance, and acceptability of the benefit-risk profile in light of the clinical evidence.',
    required: true,
  },
  {
    id: 10,
    title: 'Clinical follow-up plan (PMCF)',
    description:
      'Post-Market Clinical Follow-up plan to proactively collect clinical data and address residual uncertainties throughout the device lifecycle.',
    required: true,
  },
];

/**
 * Resolve a stage by its id. Throws if the id is out of range — callers are
 * expected to pass a validated CerStageId, so an unknown id is a programming
 * error rather than a recoverable runtime condition.
 */
export function getStage(id: CerStageId): CerStage {
  const stage = CER_STAGES.find((s) => s.id === id);
  if (!stage) {
    throw new Error(`Unknown CER stage id: ${id}`);
  }
  return stage;
}

export function isLastStage(id: CerStageId): boolean {
  return id === 10;
}
