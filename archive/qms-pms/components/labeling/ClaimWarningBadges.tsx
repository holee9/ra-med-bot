// @MX:NOTE [AUTO] ClaimWarningBadges — REQ-004/005 warning markers.
// @MX:SPEC SPEC-REGULA-LABELING-001 (REQ-004, REQ-005, AC-02, AC-04)
//
// Two badge variants:
//   - ExpertReviewRequiredBadge (REQ-004): citation missing → forces expert review.
//   - ComparableClaimBadge (REQ-005): comparative/superiority language detected.
// WCAG 2.1 AA: amber-800 on amber-100; danger on danger-bg; warn on warn-bg.
// Icons are decorative (aria-hidden); text carries the meaning.

import { AlertTriangle, TrendingUp } from 'lucide-react';

/** REQ-004: claim has no grounded citation — expert review required. */
export function ExpertReviewRequiredBadge() {
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-xs border border-danger/30 bg-danger-bg px-2 py-0.5 text-xs font-medium text-danger"
      data-testid="labeling-expert-review-required"
      title="근거 citation이 없어 전문가 검토가 필요합니다 (REQ-004)"
    >
      <AlertTriangle aria-hidden="true" size={12} className="shrink-0" />
      전문가 검토 필요
    </span>
  );
}

interface ComparableClaimBadgeProps {
  /** REQ-005: true when superiority language (superior/better than) detected. */
  isSuperiority: boolean;
  /** REQ-005: true when comparative language (compared to/vs) detected. */
  isComparative: boolean;
  /** Matched keyword list (for tooltip context). */
  matchedKeywords: string[];
}

/**
 * REQ-005: renders an amber warning when comparative or superiority language
 * is detected in a claim. No-op when neither flag is set (clean claim).
 */
export function ComparableClaimBadge({
  isSuperiority,
  isComparative,
  matchedKeywords,
}: ComparableClaimBadgeProps) {
  if (!isComparative && !isSuperiority) return null;

  const label = isSuperiority ? '우월성 주의 (Superiority)' : '비교 주의 (Comparative)';
  const keywordHint =
    matchedKeywords.length > 0 ? `감지 키워드: ${matchedKeywords.join(', ')}` : undefined;

  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-xs border border-amber-400/40 bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800"
      data-testid="labeling-comparable-warning"
      title={keywordHint ?? '비교/우월성 표현이 감지되었습니다 (REQ-005)'}
    >
      <TrendingUp aria-hidden="true" size={12} className="shrink-0" />
      {label}
    </span>
  );
}
