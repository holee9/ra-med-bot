'use client';

// @MX:NOTE [AUTO] Predicate search page — device-name search against the openFDA
//   510(k) corpus, rendering the top results as selectable CandidateCards.
// @MX:SPEC SPEC-REGULA-PREDICATE-001 (REQ-PRE-007, REQ-PRE-026)
//
// REQ-PRE-007: the pre-2004 coverage notice is always shown below the results so
// users are aware some older 510(k) records may be missing.

import CandidateCard from '@/components/predicate/CandidateCard';
import type { PredicateCandidate } from '@/lib/predicate/types';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

// REQ-PRE-026: only the top-5 results are surfaced in the search UI.
const TOP_N = 5;

const COVERAGE_NOTICE =
  '일부 2004년 이전 510(k) 기록은 검색 결과에 포함되지 않을 수 있습니다.';

export default function PredicateSearchPage() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [candidates, setCandidates] = useState<PredicateCandidate[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = query.trim();
    if (!trimmed) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/ra/predicate/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ device_name: trimmed }),
      });
      if (!res.ok) {
        setError('검색에 실패했습니다. 잠시 후 다시 시도해 주세요.');
        setCandidates([]);
        return;
      }
      const body = (await res.json()) as { candidates?: PredicateCandidate[] };
      setCandidates((body.candidates ?? []).slice(0, TOP_N));
    } catch {
      setError('검색에 실패했습니다. 잠시 후 다시 시도해 주세요.');
      setCandidates([]);
    } finally {
      setLoading(false);
      setSearched(true);
    }
  }

  function handleSelect(candidate: PredicateCandidate) {
    router.push(`/predicate/compare?k=${candidate.k_number}`);
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <h1 className="text-xl font-semibold text-ink-900">Predicate 검색</h1>
      <p className="mt-1 text-sm text-ink-500">
        기기명을 입력하여 FDA 510(k) predicate 후보를 검색합니다.
      </p>

      <form onSubmit={handleSearch} className="mt-4 flex flex-col gap-2 sm:flex-row">
        <input
          type="text"
          data-testid="predicate-search-input"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="예: infusion pump"
          aria-label="기기명 검색"
          className="flex-1 rounded-md border border-ink-200 bg-surface px-3 py-2 text-sm text-ink-800 focus:border-brand-400 focus:outline-none focus:ring-1 focus:ring-brand-300"
        />
        <button
          type="submit"
          disabled={loading}
          className="rounded-md bg-brand-800 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-400 disabled:cursor-not-allowed disabled:opacity-60"
        >
          Search
        </button>
      </form>

      {loading && (
        <div
          data-testid="search-spinner"
          role="status"
          aria-live="polite"
          className="mt-6 flex items-center gap-2 text-sm text-ink-500"
        >
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-ink-200 border-t-brand-600" />
          검색 중...
        </div>
      )}

      {error && (
        <p role="alert" className="mt-4 text-sm text-danger">
          {error}
        </p>
      )}

      {!loading && searched && candidates.length === 0 && !error && (
        <p className="mt-6 text-sm text-ink-500">검색 결과가 없습니다.</p>
      )}

      {candidates.length > 0 && (
        <ul className="mt-6 flex flex-col gap-3">
          {candidates.map((candidate) => (
            <li key={candidate.k_number}>
              <CandidateCard candidate={candidate} onSelect={handleSelect} />
            </li>
          ))}
        </ul>
      )}

      <p
        data-testid="coverage-notice"
        className="mt-6 rounded-md border border-amber-400 bg-amber-50 px-4 py-3 text-xs text-amber-700"
      >
        {COVERAGE_NOTICE}
      </p>
    </div>
  );
}
