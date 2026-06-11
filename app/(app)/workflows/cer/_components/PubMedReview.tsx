'use client';

// @MX:NOTE [AUTO] PubMedReview — renders appraised literature returned by the
// CER run. Field names mirror the /api/ra/workflows/cer response (PubMedArticle
// + Vancouver citation + AppraisalResult), so no field remapping is needed.
// @MX:SPEC SPEC-REGULA-CER-001 (REQ-CER-016~022)

import { useMemo, useState } from 'react';

export interface LiteratureItem {
  pmid: string;
  title: string;
  abstract: string;
  /** Vancouver-formatted citation string from the API. */
  citation: string;
  appraisal: {
    sign50Level: string;
    gradeQuality: 'high' | 'moderate' | 'low' | 'very_low';
  };
  /** Inclusion status; the API returns all candidates, defaults to included. */
  included?: boolean;
}

interface PubMedReviewProps {
  literature: LiteratureItem[];
}

type Filter = 'all' | 'included' | 'excluded';

const GRADE_BADGE: Record<LiteratureItem['appraisal']['gradeQuality'], string> = {
  high: 'bg-green-100 text-green-700 border-green-300',
  moderate: 'bg-blue-100 text-blue-700 border-blue-300',
  low: 'bg-amber-50 text-amber-700 border-amber-400',
  very_low: 'bg-gray-100 text-gray-500 border-gray-300',
};

function truncate(text: string, max = 120): string {
  return text.length > max ? `${text.slice(0, max).trimEnd()}…` : text;
}

export function PubMedReview({ literature }: PubMedReviewProps) {
  const [filter, setFilter] = useState<Filter>('all');

  const visible = useMemo(() => {
    if (filter === 'all') {
      return literature;
    }
    const wantIncluded = filter === 'included';
    return literature.filter((item) => (item.included ?? true) === wantIncluded);
  }, [literature, filter]);

  if (literature.length === 0) {
    return (
      <p className="rounded-md border border-ink-200 bg-surface px-4 py-6 text-center text-sm text-ink-500">
        No literature found
      </p>
    );
  }

  const FILTERS: ReadonlyArray<{ key: Filter; label: string }> = [
    { key: 'all', label: 'All' },
    { key: 'included', label: 'Included' },
    { key: 'excluded', label: 'Excluded' },
  ];

  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-2">
        {FILTERS.map(({ key, label }) => (
          <button
            key={key}
            type="button"
            onClick={() => setFilter(key)}
            aria-pressed={filter === key}
            className={`rounded-md border px-3 py-1 text-xs ${
              filter === key
                ? 'border-brand-300 bg-brand-50 text-brand-700'
                : 'border-ink-200 text-ink-600 hover:bg-ink-50'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <ul className="flex flex-col gap-2">
        {visible.map((item) => {
          const included = item.included ?? true;
          return (
            <li
              key={item.pmid}
              className="flex flex-col gap-2 rounded-md border border-ink-200 bg-surface p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <p className="min-w-0 flex-1 text-sm font-medium text-ink-900">
                  {truncate(item.title)}
                </p>
                <span
                  className={`shrink-0 rounded border px-2 py-0.5 text-xs ${
                    included
                      ? 'border-green-300 bg-green-100 text-green-700'
                      : 'border-gray-300 bg-gray-100 text-gray-500'
                  }`}
                >
                  {included ? 'Included' : 'Excluded'}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="font-mono text-ink-500">PMID {item.pmid}</span>
                <span className="rounded border border-ink-200 bg-ink-50 px-2 py-0.5 text-ink-600">
                  SIGN 50: {item.appraisal.sign50Level}
                </span>
                <span
                  className={`rounded border px-2 py-0.5 font-medium ${
                    GRADE_BADGE[item.appraisal.gradeQuality]
                  }`}
                >
                  GRADE: {item.appraisal.gradeQuality.replace('_', ' ')}
                </span>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
