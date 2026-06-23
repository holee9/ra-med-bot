'use client';
// @MX:NOTE [AUTO] CERLinkageIndicator — shows CER auto-linkage status for PMS docs.
// @MX:SPEC SPEC-REGULA-PMS-001 (REQ-PMS-004, AC-07)
// WCAG 2.1 AA: icon + text (color is never the only signal).

interface CERLinkageIndicatorProps {
  /** CER document id from the same project, or null when not linked. */
  cerRefId: string | null;
  /** CER device name for display context, or null. */
  cerDeviceName: string | null;
}

export function CERLinkageIndicator({ cerRefId, cerDeviceName }: CERLinkageIndicatorProps) {
  const linked = cerRefId !== null;

  if (linked) {
    return (
      <span
        className="inline-flex items-center gap-1 rounded bg-success-bg px-2 py-0.5 text-xs font-medium text-success"
        data-testid="cer-linkage-indicator"
        aria-label={`CER 연결됨: ${cerRefId}`}
      >
        <span aria-hidden="true">✓</span>
        CER 연결됨
        <code className="font-mono text-[11px] text-success/80">{cerRefId}</code>
        {cerDeviceName && <span className="text-success/70">— {cerDeviceName}</span>}
      </span>
    );
  }

  return (
    <span
      className="inline-flex items-center gap-1 rounded bg-warn-bg px-2 py-0.5 text-xs font-medium text-warn"
      data-testid="cer-linkage-indicator"
      aria-label="CER 연결되지 않음"
    >
      <span aria-hidden="true">⚠</span>
      CER 연결되지 않음
      <span className="text-warn/70">— 같은 프로젝트의 CER 문서가 필요합니다.</span>
    </span>
  );
}
