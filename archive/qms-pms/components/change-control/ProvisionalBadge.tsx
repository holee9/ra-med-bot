// @MX:NOTE [AUTO] ProvisionalBadge — REQ-011 visual marker for unreviewed verdicts.
// @MX:SPEC SPEC-REGULA-CHANGE-CONTROL-001 (REQ-011, AC-07)
//
// Amber badge with icon + text. WCAG 2.1 AA: text-amber-800 on amber-100
// background yields >= 4.5:1 contrast. The icon is decorative (aria-hidden);
// the text label carries the meaning.

import { AlertTriangle } from 'lucide-react';

interface ProvisionalBadgeProps {
  /** When true, render the "reviewed" state (green check). Default: provisional. */
  reviewed?: boolean;
}

export function ProvisionalBadge({ reviewed = false }: ProvisionalBadgeProps) {
  if (reviewed) {
    return (
      <span
        className="inline-flex items-center gap-1.5 rounded-xs border border-success/30 bg-success-bg px-2.5 py-1 text-xs font-medium text-success"
        data-testid="change-control-status-reviewed"
      >
        <svg
          aria-hidden="true"
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polyline points="20 6 9 17 4 12" />
        </svg>
        검토 완료
      </span>
    );
  }

  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-xs border border-amber-400/40 bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-800"
      data-testid="change-control-status-provisional"
    >
      <AlertTriangle aria-hidden="true" size={14} className="shrink-0" />
      전문가 검토 대기 (Provisional)
    </span>
  );
}
