'use client';

// @MX:NOTE [AUTO] CandidateCard — displays one 510(k) predicate candidate with an
//   expandable detail section and a "Select as Predicate" action.
// @MX:SPEC SPEC-REGULA-PREDICATE-001 (REQ-PRE-011, REQ-PRE-027, REQ-PRE-028)
//
// REQ-PRE-011: no card is pre-selected; selection is driven entirely by the
// parent via the isSelected prop (defaults to false).

import type { PredicateCandidate } from '@/lib/predicate/types';
import { useState } from 'react';

interface CandidateCardProps {
  candidate: PredicateCandidate;
  onSelect: (c: PredicateCandidate) => void;
  isSelected?: boolean;
}

// FDA CDRH 510(k) detail base URL; the ID parameter is the K-number WITHOUT its
// leading "K" (REQ-PRE-027): K123456 -> ID=123456.
const FDA_CDRH_BASE =
  'https://www.accessdata.fda.gov/scripts/cdrh/cfdocs/cfpmn/pmn.cfm?ID=';

/** Strip the leading "K"/"k" so the FDA CDRH ID parameter is numeric. */
function fdaId(kNumber: string): string {
  return kNumber.replace(/^k/i, '');
}

/**
 * A 510(k) decision is "substantially equivalent" when the code starts with
 * "SE"; "SN"/"NS" style codes are not-substantially-equivalent. We treat any
 * non-SE decision as NSE for badge purposes (REQ-PRE-028).
 */
function isSubstantiallyEquivalent(decision: string): boolean {
  return /^SE/i.test(decision.trim());
}

export default function CandidateCard({
  candidate,
  onSelect,
  isSelected = false,
}: CandidateCardProps) {
  const [expanded, setExpanded] = useState(false);
  const se = isSubstantiallyEquivalent(candidate.decision);

  return (
    <article
      data-testid="candidate-card"
      aria-selected={isSelected}
      className={`rounded-lg border bg-surface-elevated p-4 transition-colors ${
        isSelected ? 'border-brand-500 ring-1 ring-brand-300' : 'border-ink-150'
      }`}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <button
          type="button"
          data-testid="candidate-card-header"
          aria-expanded={expanded}
          onClick={() => setExpanded((v) => !v)}
          className="min-w-0 flex-1 text-left"
        >
          <div className="flex flex-wrap items-center gap-2">
            <a
              href={`${FDA_CDRH_BASE}${fdaId(candidate.k_number)}`}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="font-mono text-sm font-semibold text-brand-600 underline hover:text-brand-800"
            >
              {candidate.k_number}
            </a>
            <span
              data-testid="decision-badge"
              className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-medium ${
                se
                  ? 'bg-success-bg text-success'
                  : 'bg-danger-bg text-danger'
              }`}
            >
              {se ? 'Substantially Equivalent' : 'Not Substantially Equivalent'}
            </span>
          </div>
          <p className="mt-1 truncate text-sm font-medium text-ink-800">
            {candidate.device_name}
          </p>
          <p className="truncate text-xs text-ink-500">{candidate.applicant_name}</p>
        </button>

        <button
          type="button"
          onClick={() => onSelect(candidate)}
          className="shrink-0 rounded-md bg-brand-800 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-400"
        >
          Select as Predicate
        </button>
      </div>

      {expanded && (
        <dl
          data-testid="candidate-card-details"
          className="mt-3 grid grid-cols-1 gap-x-6 gap-y-2 border-t border-ink-100 pt-3 text-sm sm:grid-cols-2"
        >
          <div>
            <dt className="text-xs text-ink-500">Product Code</dt>
            <dd className="text-ink-800">{candidate.product_code}</dd>
          </div>
          <div>
            <dt className="text-xs text-ink-500">Decision Date</dt>
            <dd className="text-ink-800">{candidate.decision_date}</dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-xs text-ink-500">Device Description</dt>
            <dd className="text-ink-800">{candidate.device_description}</dd>
          </div>
        </dl>
      )}

      {/* Always-visible compact fields (collapsed state still shows code) */}
      {!expanded && (
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-500">
          <span>{candidate.product_code}</span>
          <span>{candidate.decision_date}</span>
        </div>
      )}
    </article>
  );
}
