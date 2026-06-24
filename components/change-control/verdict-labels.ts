// @MX:NOTE [AUTO] Display labels + color tokens for change-control verdicts — SPEC-REGULA-CHANGE-CONTROL-001.
// @MX:SPEC SPEC-REGULA-CHANGE-CONTROL-001 (REQ-004, REQ-011)
//
// Single source of truth for verdict → {label, badge class} mapping.
// Mirrors the 4 verdicts defined in lib/change-control/types.ts ChangeVerdict.

import type { JurisdictionVerdictResponse } from '@/lib/change-control/api-client';

export type ChangeVerdict = JurisdictionVerdictResponse['verdict'];
export type Jurisdiction = JurisdictionVerdictResponse['jurisdiction'];

/** Korean + English labels for each verdict value. */
export const VERDICT_LABELS: Record<ChangeVerdict, { ko: string; en: string }> = {
  new_submission_required: { ko: '새 허가 신청 필요', en: 'New submission required' },
  change_notification: { ko: '변경 신고', en: 'Change notification' },
  internal_record_only: { ko: '내부 기록만', en: 'Internal record only' },
  not_applicable: { ko: '해당 없음', en: 'Not applicable' },
};

/**
 * Tailwind badge classes per verdict.
 * - new_submission_required: danger (red) — highest regulatory impact
 * - change_notification: warn (amber) — action required, less severe
 * - internal_record_only: neutral ink — documentation only
 * - not_applicable: muted — no action
 *
 * Color tokens from regula-design-tokens: --color-danger/-bg, --color-warn/-bg, --color-ink-*.
 */
export const VERDICT_BADGE_CLASS: Record<ChangeVerdict, string> = {
  new_submission_required: 'bg-danger-bg text-danger border-danger/30',
  change_notification: 'bg-warn-bg text-warn border-warn/30',
  internal_record_only: 'bg-ink-100 text-ink-700 border-ink-200',
  not_applicable: 'bg-ink-50 text-ink-500 border-ink-100',
};

/** Jurisdiction display labels (Korean primary, English secondary). */
export const JURISDICTION_LABELS: Record<Jurisdiction, { ko: string; en: string; anchor: string }> =
  {
    FDA: { ko: 'FDA (미국)', en: 'FDA (US)', anchor: '21 CFR 807.81(a)(3)' },
    EU_MDR: { ko: 'EU MDR (유럽)', en: 'EU MDR (EU)', anchor: 'MDR Article 120(3)' },
    MFDS: { ko: 'MFDS (한국)', en: 'MFDS (KR)', anchor: '의료기기법 제12조' },
    NMPA: { ko: 'NMPA (중국)', en: 'NMPA (CN)', anchor: '변경 등록 기준' },
    PMDA: { ko: 'PMDA (일본)', en: 'PMDA (JP)', anchor: '일부변경 승인 기준' },
  };

/** Change type labels for the input form select. */
export const CHANGE_TYPE_LABELS: Record<
  'design' | 'material' | 'manufacturing_process' | 'software' | 'labeling' | 'intended_use',
  { ko: string; en: string }
> = {
  design: { ko: '설계 변경', en: 'Design change' },
  material: { ko: '재료 변경', en: 'Material change' },
  manufacturing_process: { ko: '제조 공정 변경', en: 'Manufacturing process change' },
  software: { ko: '소프트웨어 변경', en: 'Software change' },
  labeling: { ko: '라벨링 변경', en: 'Labeling change' },
  intended_use: { ko: '적응증(의도된 용도) 변경', en: 'Intended use change' },
};
