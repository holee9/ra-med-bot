// @MX:ANCHOR [AUTO] IMDRF N12 Classification Matrix — rule-based, no AI
// @MX:REASON Called by POST /api/ra/samd (create) and PATCH /api/ra/samd/[id] (update).
// Encapsulates IMDRF N12 Annex II table + FDA/EU pathway derivation.
// @MX:SPEC SPEC-REGULA-SAMD-001

export type ImdrfClinicalSituation = 'critical' | 'serious' | 'non_serious';
export type ImdrfHealthcareSituation = 'critical' | 'serious' | 'non_serious';
export type ImdrfCategory = 'I' | 'II' | 'III' | 'IV';
export type AiMlType = 'locked' | 'adaptive' | 'continuously_learning';
export type FdaPathway = '510k' | 'de_novo' | 'pma' | 'exempt';
export type EuAiRiskLevel = 'prohibited' | 'high_risk' | 'general_purpose' | 'minimal';

/**
 * IMDRF N12 Annex II Category matrix.
 * Rows = clinical situation, Columns = healthcare situation.
 */
const IMDRF_MATRIX: Record<ImdrfClinicalSituation, Record<ImdrfHealthcareSituation, ImdrfCategory>> =
  {
    critical: {
      critical: 'IV',
      serious: 'III',
      non_serious: 'III',
    },
    serious: {
      critical: 'III',
      serious: 'II',
      non_serious: 'II',
    },
    non_serious: {
      critical: 'I',
      serious: 'I',
      non_serious: 'I',
    },
  };

/** Compute IMDRF N12 category from clinical × healthcare situation. */
export function computeImdrfCategory(
  clinical: ImdrfClinicalSituation,
  healthcare: ImdrfHealthcareSituation,
): ImdrfCategory {
  return IMDRF_MATRIX[clinical][healthcare];
}

/** Derive EU AI Act risk level from IMDRF category. */
export function deriveEuAiRiskLevel(category: ImdrfCategory): EuAiRiskLevel {
  if (category === 'IV' || category === 'III') return 'high_risk';
  if (category === 'II') return 'general_purpose';
  return 'minimal';
}

/**
 * Approximate FDA pathway from AI/ML type and risk level.
 * These are guidance approximations; final determination requires regulatory counsel.
 */
export function deriveFdaPathway(aiMlType: AiMlType, category: ImdrfCategory): FdaPathway {
  const isHighRisk = category === 'III' || category === 'IV';

  if (aiMlType === 'continuously_learning' && isHighRisk) return 'pma';
  if (aiMlType === 'continuously_learning') return 'de_novo';
  if (aiMlType === 'adaptive') return 'de_novo';
  // locked — default 510(k) when predicate may exist
  return '510k';
}

/** PCCP is required for adaptive or continuously learning AI/ML models. */
export function isPccpRequired(aiMlType: AiMlType): boolean {
  return aiMlType === 'adaptive' || aiMlType === 'continuously_learning';
}

export interface SaMDClassificationResult {
  imdrfCategory: ImdrfCategory;
  euAiRiskLevel: EuAiRiskLevel;
  fdaPathway: FdaPathway;
  pccpRequired: boolean;
}

/** Compute all derived regulatory pathway fields in one call. */
export function classifySaMD(
  aiMlType: AiMlType,
  clinicalSituation: ImdrfClinicalSituation,
  healthcareSituation: ImdrfHealthcareSituation,
): SaMDClassificationResult {
  const imdrfCategory = computeImdrfCategory(clinicalSituation, healthcareSituation);
  return {
    imdrfCategory,
    euAiRiskLevel: deriveEuAiRiskLevel(imdrfCategory),
    fdaPathway: deriveFdaPathway(aiMlType, imdrfCategory),
    pccpRequired: isPccpRequired(aiMlType),
  };
}
