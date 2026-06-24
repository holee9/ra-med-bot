// @MX:NOTE [AUTO] CitationList — REQ-006 citation display for change-control verdicts.
// @MX:SPEC SPEC-REGULA-CHANGE-CONTROL-001 (REQ-006, AC-04)
//
// Renders the regulatory citations backing a verdict. Each citation shows the
// source label (e.g. "21 CFR 807.81(a)(3)") and the grounded excerpt text.
// Mirrors the CLASSIFY citation display pattern.

import type { VerdictCitationResponse } from '@/lib/change-control/api-client';
import { BookOpen } from 'lucide-react';

interface CitationListProps {
  citations: VerdictCitationResponse[];
  /** Optional testId hook for targeted assertions. */
  testId?: string;
}

export function CitationList({ citations, testId }: CitationListProps) {
  if (citations.length === 0) {
    return (
      <p
        className="text-xs italic text-danger"
        data-testid={testId ? `${testId}-empty` : 'citation-list-empty'}
      >
        근거 citation 없음 — REQ-006 위반 가능성 (재평가 필요)
      </p>
    );
  }

  return (
    <ul
      className="flex flex-col gap-2"
      data-testid={testId ?? 'citation-list'}
      aria-label="규제 근거 citation"
    >
      {citations.map((c, idx) => (
        <li
          key={c.id}
          className="rounded-xs border border-ink-100 bg-ink-50/60 px-3 py-2"
          data-testid={testId ? `${testId}-item-${idx}` : `citation-item-${idx}`}
        >
          <p className="flex items-center gap-1.5 text-xs font-semibold text-brand-700">
            <BookOpen aria-hidden="true" size={12} className="shrink-0" />
            <span>{c.sourceLabel}</span>
          </p>
          <blockquote className="mt-1.5 border-l-2 border-amber-400 pl-2.5 text-sm text-ink-700">
            {c.excerpt}
          </blockquote>
        </li>
      ))}
    </ul>
  );
}
