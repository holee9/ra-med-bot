// @MX:NOTE [AUTO] QmsStubBadge — REQ-009 / #57 deferred QMS integration marker.
// @MX:SPEC SPEC-REGULA-CAPA-001 (REQ-009, AC-05)
//
// Server component. Surfaces the "Beta" stub state on the QMS sync button so
// users understand the sync is a no-op until SPEC-REGULA-QMS-001 (#57) lands.
// The button's click handler lives in the client island (CapaWorkbench).

import { Info } from 'lucide-react';

interface QmsStubBadgeProps {
  /** Optional className override for layout-specific tweaks. */
  className?: string;
}

export function QmsStubBadge({ className }: QmsStubBadgeProps) {
  return (
    <span
      className={[
        'inline-flex items-center gap-1 rounded-xs border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700',
        className ?? '',
      ].join(' ')}
      role="note"
      title="QMS 통합은 SPEC-REGULA-QMS-001 (#57) 구현 후 활성화됩니다. 현재는 stub(no-op)입니다."
      data-testid="qms-stub-badge"
    >
      <Info size={12} aria-hidden="true" />
      Beta: #57 구현 후 활성화
    </span>
  );
}
