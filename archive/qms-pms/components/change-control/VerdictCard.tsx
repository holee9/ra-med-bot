// @MX:NOTE [AUTO] VerdictCard — per-jurisdiction verdict display (REQ-004, REQ-006).
// @MX:SPEC SPEC-REGULA-CHANGE-CONTROL-001 (REQ-004, REQ-006, REQ-011, AC-03)

// @MX:LEGACY archived from components
//
// Shows jurisdiction, verdict badge, rationale, and the citation list backing it.
// When citationRejected is true (verdict downgraded by REQ-006 enforcement),
// renders a warning banner so the operator knows to re-run or supply a citation.

import type { JurisdictionVerdictResponse } from '@/lib/change-control/api-client';
import { AlertTriangle } from 'lucide-react';
import { CitationList } from './CitationList';
import { JURISDICTION_LABELS, VERDICT_BADGE_CLASS, VERDICT_LABELS } from './verdict-labels';

interface VerdictCardProps {
  verdict: JurisdictionVerdictResponse;
}

export function VerdictCard({ verdict }: VerdictCardProps) {
  const jurisdictionLabel = JURISDICTION_LABELS[verdict.jurisdiction];
  const verdictLabel = VERDICT_LABELS[verdict.verdict];
  const badgeClass = VERDICT_BADGE_CLASS[verdict.verdict];

  // REQ-006: when citations are empty, the verdict was downgraded by citation
  // enforcement. Surface this clearly.
  const citationRejected = verdict.citations.length === 0;

  return (
    <article
      className="flex flex-col gap-3 rounded-md border border-ink-200 bg-surface p-4"
      data-testid={`verdict-card-${verdict.jurisdiction.toLowerCase()}`}
    >
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <h3 className="font-serif text-lg text-brand-800">{jurisdictionLabel.ko}</h3>
          <span className="font-mono text-[10px] text-ink-500">{jurisdictionLabel.anchor}</span>
        </div>
        <span
          className={`inline-flex items-center rounded-xs border px-2.5 py-1 text-xs font-semibold ${badgeClass}`}
          data-testid={`verdict-badge-${verdict.jurisdiction.toLowerCase()}`}
        >
          {verdictLabel.ko}
        </span>
      </header>

      <p className="text-sm text-ink-700">{verdict.rationale}</p>

      {citationRejected && (
        <div
          className="flex items-start gap-2 rounded-xs border border-danger/30 bg-danger-bg px-3 py-2 text-xs text-danger"
          role="alert"
          data-testid={`verdict-citation-rejected-${verdict.jurisdiction.toLowerCase()}`}
        >
          <AlertTriangle aria-hidden="true" size={14} className="mt-0.5 shrink-0" />
          <span>
            REQ-006: citation이 확인되지 않아 ‘내부 기록만’으로 강등되었습니다. 재평가 또는 근거
            보완이 필요합니다.
          </span>
        </div>
      )}

      <section
        aria-label={`${jurisdictionLabel.ko} 근거 citation`}
        className="border-t border-ink-100 pt-3"
      >
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-ink-500">
          근거 citation
        </p>
        <CitationList citations={verdict.citations} />
      </section>
    </article>
  );
}
