// @MX:NOTE [AUTO] REQ-005 — comparative/superiority claim auto-detection.
// @MX:SPEC SPEC-REGULA-LABELING-001 (REQ-005, AC-04)
//
// MVP heuristic: keyword-based detection. False-positive risk is accepted
// because (1) the detector only flags the claim for RA review — it does NOT
// block export on its own (REQ-006 only blocks on "unsupported"), and (2)
// the keyword set is conservative. A follow-up LLM classifier can layer in
// via createHybridRaFetch when available (mirrors translation-diff.ts).

import type { ComparableDetectionResult, LabelingClaimType } from './types';

/**
 * Comparative-language keywords (multi-lingual). Match is case-insensitive
 * substring. "compared to" / "versus" / "vs." / "비교".
 */
export const COMPARATIVE_KEYWORDS: readonly string[] = [
  // English
  'compared to',
  'compared with',
  'in comparison',
  'versus',
  ' vs.',
  ' vs ',
  'relative to',
  'contrast with',
  // Korean
  '비교',
  '대비',
  // Japanese
  '比較して',
  'と比較',
  // Chinese
  '相比',
  '对比',
];

/**
 * Superiority-language keywords. "superior" / "better than" / "더 효과".
 */
export const SUPERIORITY_KEYWORDS: readonly string[] = [
  // English
  'superior',
  'better than',
  'more effective',
  'outperforms',
  'faster than',
  'safer than',
  'greater than',
  'exceeds',
  'best-in-class',
  'industry-leading',
  // Korean
  '우수',
  '더 효과',
  '더 안전',
  '더 빠르',
  '최고',
  '우위',
  // Japanese
  '優れ',
  'より効果',
  'より安全',
  // Chinese
  '更优',
  '更好',
  '更安全',
  '更有效',
];

/**
 * REQ-005: detect comparative/superiority language in a claim.
 *
 * Returns:
 *   - isComparative=true if ANY comparative keyword matches.
 *   - isSuperiority=true if ANY superiority keyword matches.
 *   - claimType: 'superiority' (highest precedence) > 'comparative' > 'supported'.
 *
 * Note: "unsupported" is never assigned here — that status comes from
 * claim-validator.isUnsupportedClaim (citation absence, not language).
 */
export function detectComparativeClaim(claimText: string): ComparableDetectionResult {
  const lower = claimText.toLowerCase();
  const matched: string[] = [];

  let isComparative = false;
  for (const kw of COMPARATIVE_KEYWORDS) {
    if (lower.includes(kw.toLowerCase())) {
      isComparative = true;
      matched.push(kw);
    }
  }

  let isSuperiority = false;
  for (const kw of SUPERIORITY_KEYWORDS) {
    if (lower.includes(kw.toLowerCase())) {
      isSuperiority = true;
      matched.push(kw);
    }
  }

  // Precedence: superiority > comparative > supported.
  let claimType: LabelingClaimType = 'supported';
  if (isSuperiority) {
    claimType = 'superiority';
  } else if (isComparative) {
    claimType = 'comparative';
  }

  return {
    isComparative,
    isSuperiority,
    matchedKeywords: matched,
    claimType,
  };
}
