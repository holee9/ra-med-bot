// @MX:NOTE [AUTO] REQ-005 jurisdiction-specific assessment rules.
// @MX:SPEC SPEC-REGULA-CHANGE-CONTROL-001 (REQ-004, REQ-005, AC-03)

// @MX:LEGACY archived from lib
//
// Per-jurisdiction rule-hint retrieval queries (fed to the RAG retriever) and
// the regulatory anchor citations used by the LLM prompt builder. These mirror
// the CLASSIFY RULE_QUERIES pattern (lib/classify/engine.ts).

import type { ChangeType, Jurisdiction } from './types';

/** All 5 jurisdictions covered by the change-control assessment. */
export const ALL_JURISDICTIONS: readonly Jurisdiction[] = ['FDA', 'EU_MDR', 'MFDS', 'NMPA', 'PMDA'];

/**
 * Map a project's target_markets string array to the Jurisdiction union.
 * Unknown values are dropped (the route rejects invalid input upstream).
 */
export function resolveJurisdictions(targetMarkets: ReadonlyArray<string>): Jurisdiction[] {
  const upper = targetMarkets.map((m) => m.toUpperCase());
  const out: Jurisdiction[] = [];
  if (upper.includes('FDA') || upper.includes('US')) out.push('FDA');
  if (upper.includes('EU') || upper.includes('EU_MDR') || upper.includes('EU-MDR')) {
    out.push('EU_MDR');
  }
  if (upper.includes('MFDS') || upper.includes('KR') || upper.includes('KOREA')) out.push('MFDS');
  if (upper.includes('NMPA') || upper.includes('CN') || upper.includes('CHINA')) out.push('NMPA');
  if (upper.includes('PMDA') || upper.includes('JP') || upper.includes('JAPAN')) out.push('PMDA');
  // Dedupe + default to all 5 when nothing matched (fail-open so the operator
  // sees the full matrix rather than an empty result for unfamiliar markets).
  const dedup = Array.from(new Set(out));
  return dedup.length > 0 ? dedup : [...ALL_JURISDICTIONS];
}

/** RAG retrieval queries per jurisdiction (mirrors CLASSIFY RULE_QUERIES). */
export const RULE_QUERIES: Record<Jurisdiction, string> = {
  FDA: 'FDA 21 CFR 807.81(a)(3) significant change or modification 510(k) when to submit',
  EU_MDR: 'EU MDR Article 120(3) transitional significant change MDCG 2020-3 significant changes',
  MFDS: 'MFDS Korea medical device act Article 12 change approval notification 식약처 의료기기 변경',
  NMPA: 'NMPA China medical device registration change application significant change',
  PMDA: 'PMDA Japan medical device partial change approval 部分変更承認',
};

/** Regulatory anchor citation per jurisdiction (used by the prompt + audit). */
export const REGULATORY_ANCHOR: Record<Jurisdiction, { source: string; section: string }> = {
  FDA: { source: '21 CFR 807.81(a)(3)', section: 'significant change or modification' },
  EU_MDR: { source: 'EU MDR Article 120(3)', section: 'MDCG 2020-3 significant changes' },
  MFDS: { source: '의료기기법 제12조', section: '변경 허가/신고 기준' },
  NMPA: { source: 'NMPA 변경 등록 기준', section: 'significant change' },
  PMDA: { source: 'PMDA 일부변경 승인', section: '部分変更承認' },
};

/**
 * REQ-004 default verdict weighting hint per change type. The LLM still makes
 * the final call, but this table seeds the prompt with the jurisdiction's
 * conservative default for the change type. Mirrors how CLASSIFY seeds EU MDR
 * Annex VIII rules per device type.
 */
export const DEFAULT_VERDICT_HINT: Record<ChangeType, Partial<Record<Jurisdiction, string>>> = {
  design: { FDA: 'new_submission_required', EU_MDR: 'change_notification' },
  material: { FDA: 'new_submission_required', EU_MDR: 'change_notification' },
  manufacturing_process: { FDA: 'change_notification', EU_MDR: 'change_notification' },
  software: { FDA: 'new_submission_required', EU_MDR: 'change_notification' },
  labeling: { FDA: 'change_notification', EU_MDR: 'internal_record_only' },
  intended_use: {
    FDA: 'new_submission_required',
    EU_MDR: 'new_submission_required',
    MFDS: 'new_submission_required',
  },
};
