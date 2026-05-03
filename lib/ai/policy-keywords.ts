// @MX:ANCHOR [AUTO] Policy keyword blocklist — single source of truth for auto-flag detection.
// @MX:REASON Exported array and function are called from shouldAutoFlag (expert-review-gating.ts)
// and potentially from future audit/reporting pipelines. fan_in expected >= 3.
// @MX:SPEC SPEC-REGULA-ENTERPRISE-001 (REQ-ENTERPRISE-007)

/**
 * Immutable list of policy-sensitive keywords triggering expert review.
 * Korean (7) + English (4) entries as defined in REQ-ENTERPRISE-007.
 */
export const POLICY_BLOCKED_KEYWORDS = Object.freeze([
  // Korean keywords
  '임상시험 면제',
  '임상시험 생략',
  'IDE 면제',
  '응급',
  '판매 허가 없이',
  '신고 없이 판매',
  '리콜 회피',
  // English keywords
  'emergency use authorization',
  'humanitarian',
  'off-label marketing',
  'recall avoidance',
] as const);

/**
 * Scans both question and prose for any policy-blocked keyword.
 * Matching is case-insensitive.
 *
 * @returns The matched keyword string, or null if none found.
 */
export function detectPolicyKeyword(question: string, prose: string): string | null {
  const combined = `${question} ${prose}`.toLowerCase();
  for (const keyword of POLICY_BLOCKED_KEYWORDS) {
    if (combined.includes(keyword.toLowerCase())) {
      return keyword;
    }
  }
  return null;
}
