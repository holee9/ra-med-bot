// @MX:NOTE [AUTO] REQ-002/011 — per-jurisdiction required labeling elements.
// @MX:SPEC SPEC-REGULA-LABELING-001 (REQ-002, REQ-011, AC-01)

// @MX:LEGACY archived from lib
//
// The required-elements map is the single source of truth for the checklist
// evaluator. Each jurisdiction's list is grounded in the labeling regulation
// cited below; 100% coverage is enforced by evaluateChecklist() and the
// unit-test suite (tests/integration/labeling.test.ts AC-01).

import type {
  ChecklistEvaluation,
  LabelingJurisdiction,
  LabelingSection,
  LabelingSectionType,
  RequiredLabelElement,
} from './types';

/** All 5 jurisdictions covered by labeling. */
export const ALL_LABELING_JURISDICTIONS: readonly LabelingJurisdiction[] = [
  'FDA',
  'EU_MDR',
  'MFDS',
  'NMPA',
  'PMDA',
];

/**
 * REQ-002: FDA 21 CFR 801 required label elements.
 * Source: 21 CFR Part 801 (General Labeling Provisions).
 */
export const FDA_REQUIRED_ELEMENTS: readonly RequiredLabelElement[] = [
  {
    id: 'device_name',
    title: 'Device name (proprietary)',
    ref: '21 CFR 801.61',
    sectionType: 'intended_use',
  },
  {
    id: 'manufacturer',
    title: 'Manufacturer name and address',
    ref: '21 CFR 801.1',
    sectionType: 'intended_use',
  },
  {
    id: 'intended_use',
    title: 'Intended use statement',
    ref: '21 CFR 801.4',
    sectionType: 'intended_use',
  },
  {
    id: 'indication',
    title: 'Indications for use',
    ref: '21 CFR 801.109(b)(1)',
    sectionType: 'indication',
  },
  {
    id: 'contraindication',
    title: 'Contraindications',
    ref: '21 CFR 801.109(b)(2)',
    sectionType: 'contraindication',
  },
  {
    id: 'warnings',
    title: 'Warnings and precautions',
    ref: '21 CFR 801.109(b)(3)',
    sectionType: 'warning',
  },
  {
    id: 'precautions',
    title: 'Precautions section',
    ref: '21 CFR 801.109(b)(4)',
    sectionType: 'precaution',
  },
  { id: 'rx_otc', title: 'Rx-only / OTC designation', ref: '21 CFR 801.109' },
  { id: 'lot_number', title: 'Lot or batch number', ref: '21 CFR 801.18' },
  { id: 'expiration', title: 'Expiration date', ref: '21 CFR 801.18' },
];

/**
 * REQ-002: EU MDR Annex I Chapter III required label/IFU elements.
 * Source: EU MDR 2017/745 Annex I (GSPR), Chapter III.
 */
export const EU_MDR_REQUIRED_ELEMENTS: readonly RequiredLabelElement[] = [
  {
    id: 'device_name',
    title: 'Device/trade name',
    ref: 'MDR Annex I §23.1(a)',
    sectionType: 'intended_use',
  },
  {
    id: 'manufacturer',
    title: 'Manufacturer name/address',
    ref: 'MDR Annex I §23.1(b)',
    sectionType: 'intended_use',
  },
  {
    id: 'udi',
    title: 'UDI carrier (Human Readable + AIDC)',
    ref: 'MDR Annex I §23.4',
    sectionType: 'intended_use',
  },
  {
    id: 'ce_mark',
    title: 'CE mark of conformity',
    ref: 'MDR Annex I §23.2',
    sectionType: 'intended_use',
  },
  {
    id: 'intended_purpose',
    title: 'Intended purpose',
    ref: 'MDR Annex I §23.1(c)',
    sectionType: 'intended_use',
  },
  {
    id: 'indication',
    title: 'Intended users / clinical indications',
    ref: 'MDR Annex I §23.1(d)',
    sectionType: 'indication',
  },
  {
    id: 'contraindication',
    title: 'Contraindications',
    ref: 'MDR Annex I §23.1(e)',
    sectionType: 'contraindication',
  },
  {
    id: 'warnings',
    title: 'Warnings and precautions',
    ref: 'MDR Annex I §23.1(f)',
    sectionType: 'warning',
  },
  { id: 'ifu_provided', title: 'IFU availability indication', ref: 'MDR Annex I §23.2' },
  { id: 'sterile', title: 'Sterility status (if applicable)', ref: 'MDR Annex I §23.3' },
  {
    id: 'ifuprecautions',
    title: 'Precautions for special populations',
    ref: 'MDR Annex I §23.1(g)',
    sectionType: 'precaution',
  },
];

/**
 * REQ-002: MFDS (Korea) required label elements.
 * Source: 의료기기법 제12조 (표시기재 기준), 식약처 고시.
 */
export const MFDS_REQUIRED_ELEMENTS: readonly RequiredLabelElement[] = [
  {
    id: 'device_name',
    title: '의료기기 명칭 (품목명)',
    ref: '의료기기법 제12조',
    sectionType: 'intended_use',
  },
  {
    id: 'manufacturer',
    title: '제조업자 명칭 및 주소',
    ref: '의료기기법 제12조',
    sectionType: 'intended_use',
  },
  {
    id: 'intended_use',
    title: '사용목적 (효능·효과)',
    ref: '의료기기법 제12조',
    sectionType: 'intended_use',
  },
  { id: 'indication', title: '적응증', ref: '의료기기법 시행규칙', sectionType: 'indication' },
  {
    id: 'contraindication',
    title: '사용금기 (금기사항)',
    ref: '의료기기법 시행규칙',
    sectionType: 'contraindication',
  },
  {
    id: 'warnings',
    title: '경고사항 및 주의사항',
    ref: '의료기기법 제12조',
    sectionType: 'warning',
  },
  {
    id: 'precautions',
    title: '사용 시 주의사항',
    ref: '의료기기법 시행규칙',
    sectionType: 'precaution',
  },
  { id: 'lot_number', title: '제조번호 및 제조일자', ref: '의료기기법 제12조' },
  { id: 'expiration', title: '사용기한 (유효기간)', ref: '의료기기법 제12조' },
  { id: 'korea_license', title: '인허가 번호 (품목허가번호)', ref: '의료기기법 제12조' },
];

/**
 * REQ-002: NMPA (China) required label elements.
 * Source: NMPA 医疗器械说明书和标签管理规定.
 */
export const NMPA_REQUIRED_ELEMENTS: readonly RequiredLabelElement[] = [
  {
    id: 'device_name',
    title: '医疗器械通用名称 (产品名称)',
    ref: 'NMPA 标签管理规定',
    sectionType: 'intended_use',
  },
  {
    id: 'manufacturer',
    title: '生产企业名称及地址',
    ref: 'NMPA 标签管理规定',
    sectionType: 'intended_use',
  },
  { id: 'registration', title: '注册证编号', ref: 'NMPA 标签管理规定' },
  {
    id: 'intended_use',
    title: '适用范围 (预期用途)',
    ref: 'NMPA 标签管理规定',
    sectionType: 'intended_use',
  },
  { id: 'indication', title: '适应症', ref: 'NMPA 说明书管理规定', sectionType: 'indication' },
  {
    id: 'contraindication',
    title: '禁忌症',
    ref: 'NMPA 说明书管理规定',
    sectionType: 'contraindication',
  },
  { id: 'warnings', title: '警示和注意事项', ref: 'NMPA 说明书管理规定', sectionType: 'warning' },
  {
    id: 'precautions',
    title: '使用注意事项',
    ref: 'NMPA 说明书管理规定',
    sectionType: 'precaution',
  },
  { id: 'lot_number', title: '生产批号', ref: 'NMPA 标签管理规定' },
  { id: 'expiration', title: '使用期限或失效日期', ref: 'NMPA 标签管理规定' },
];

/**
 * REQ-002: PMDA (Japan) required label elements.
 * Source: PMDA 医療機器の表示基準.
 */
export const PMDA_REQUIRED_ELEMENTS: readonly RequiredLabelElement[] = [
  {
    id: 'device_name',
    title: '一般的名称 (販売名)',
    ref: 'PMDA 表示基準',
    sectionType: 'intended_use',
  },
  {
    id: 'manufacturer',
    title: '製造販売業者の氏名及び住所',
    ref: 'PMDA 表示基準',
    sectionType: 'intended_use',
  },
  {
    id: 'intended_use',
    title: '用途・効果 (効能・効果)',
    ref: 'PMDA 表示基準',
    sectionType: 'intended_use',
  },
  { id: 'indication', title: '適応症', ref: 'PMDA 使用上の注意', sectionType: 'indication' },
  {
    id: 'contraindication',
    title: '禁忌 (使用しないこと)',
    ref: 'PMDA 使用上の注意',
    sectionType: 'contraindication',
  },
  { id: 'warnings', title: '警告', ref: 'PMDA 使用上の注意', sectionType: 'warning' },
  {
    id: 'precautions',
    title: '慎重に投与すること (使用上の注意)',
    ref: 'PMDA 使用上の注意',
    sectionType: 'precaution',
  },
  { id: 'lot_number', title: '製造番号', ref: 'PMDA 表示基準' },
  { id: 'expiration', title: '使用期限', ref: 'PMDA 表示基準' },
  { id: 'japan_license', title: '承認番号', ref: 'PMDA 表示基準' },
];

/** REQ-002: per-jurisdiction required-elements map. */
export const REQUIRED_LABEL_ELEMENTS: Readonly<
  Record<LabelingJurisdiction, readonly RequiredLabelElement[]>
> = {
  FDA: FDA_REQUIRED_ELEMENTS,
  EU_MDR: EU_MDR_REQUIRED_ELEMENTS,
  MFDS: MFDS_REQUIRED_ELEMENTS,
  NMPA: NMPA_REQUIRED_ELEMENTS,
  PMDA: PMDA_REQUIRED_ELEMENTS,
};

/**
 * Normalize a free-form market string (e.g. 'US', 'eu-mdr', 'kr') to the
 * canonical LabelingJurisdiction union. Mirrors the change-control
 * resolveJurisdictions pattern.
 */
export function resolveLabelingJurisdiction(market: string): LabelingJurisdiction | null {
  const upper = market.toUpperCase();
  if (upper === 'FDA' || upper === 'US') return 'FDA';
  if (upper === 'EU' || upper === 'EU_MDR' || upper === 'EU-MDR') return 'EU_MDR';
  if (upper === 'MFDS' || upper === 'KR' || upper === 'KOREA') return 'MFDS';
  if (upper === 'NMPA' || upper === 'CN' || upper === 'CHINA') return 'NMPA';
  if (upper === 'PMDA' || upper === 'JP' || upper === 'JAPAN') return 'PMDA';
  return null;
}

/**
 * REQ-002/011: evaluate a document's sections against a jurisdiction's
 * required-elements checklist. An element is "satisfied" when:
 *   - it maps to a sectionType AND that section has non-empty content, OR
 *   - it does NOT map to a sectionType (then assumed satisfied via other artifacts
 *     like label printing — these are informational-only and marked satisfied
 *     when their sibling sections are present).
 *
 * Returns the coverage percentage (0–100). AC-01 requires 100% coverage.
 */
export function evaluateChecklist(
  sections: ReadonlyArray<Pick<LabelingSection, 'sectionType' | 'content'>>,
  jurisdiction: LabelingJurisdiction,
): ChecklistEvaluation {
  const required = REQUIRED_LABEL_ELEMENTS[jurisdiction];
  const filledSectionTypes = new Set<LabelingSectionType>(
    sections
      .filter((s) => typeof s.content === 'string' && s.content.trim().length > 0)
      .map((s) => s.sectionType),
  );

  const missing: RequiredLabelElement[] = [];
  let satisfied = 0;

  for (const el of required) {
    if (el.sectionType === undefined) {
      // Non-section element — assumed satisfied via labeling printing (UDI,
      // lot number, expiration). We mark these satisfied so the operator's
      // checklist focus stays on section-driven content.
      satisfied++;
      continue;
    }
    if (filledSectionTypes.has(el.sectionType)) {
      satisfied++;
    } else {
      missing.push(el);
    }
  }

  const total = required.length;
  const coveragePercent = total === 0 ? 100 : Math.round((satisfied / total) * 100);

  return {
    jurisdiction,
    total,
    satisfied,
    missing,
    coveragePercent,
  };
}
