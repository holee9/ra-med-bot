'use client';

// @MX:NOTE [AUTO] Traceability matrix filters — client island that drives URL
// navigation so the matrix stays SSR-friendly. Each <select> change pushes a
// new query string and lets the Server Component re-render with fresh data.
// @MX:SPEC SPEC-REGULA-TRACEABILITY-001 (REQ-TRACEABILITY-005)
// Pattern mirrors components/knowledge-gap/QueueFilters.tsx (Issue #35).

import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback } from 'react';

type Option = { value: string; label: string };

// REQ-TRACEABILITY-005: jurisdiction, product, package, risk level, stale-source.
const JURISDICTION_OPTIONS: Option[] = [
  { value: '', label: '전체 관할권' },
  { value: 'FDA', label: 'FDA (US)' },
  { value: 'EU_MDR', label: 'EU MDR' },
  { value: 'MFDS', label: 'MFDS (한국)' },
  { value: 'NMPA', label: 'NMPA (중국)' },
  { value: 'PMDA', label: 'PMDA (일본)' },
];

const RISK_LEVEL_OPTIONS: Option[] = [
  { value: '', label: '전체 위험 수준' },
  { value: 'acceptable', label: '허용 가능' },
  { value: 'alarp', label: 'ALARP' },
  { value: 'unacceptable', label: '허용 불가' },
  { value: 'unacc', label: '허용 불가 (요약)' },
];

const STALE_OPTIONS: Option[] = [
  { value: '', label: '전체 (stale 포함)' },
  { value: 'only', label: 'stale 만' },
  { value: 'exclude', label: 'stale 제외' },
];

export default function MatrixFilters() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const update = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value) params.set(key, value);
      else params.delete(key);
      router.push(`/traceability?${params.toString()}`);
    },
    [router, searchParams],
  );

  return (
    <form
      className="flex flex-wrap gap-3 rounded-lg border border-ink-150 bg-surface p-4"
      aria-label="추적 매트릭스 필터"
    >
      <label className="flex flex-col text-xs text-ink-600">
        관할권
        <select
          value={searchParams.get('jurisdiction') ?? ''}
          onChange={(e) => update('jurisdiction', e.target.value)}
          className="mt-1 rounded border border-ink-150 px-2 py-1 text-sm focus:border-brand-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
        >
          {JURISDICTION_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col text-xs text-ink-600">
        제품
        <input
          type="text"
          value={searchParams.get('product') ?? ''}
          onChange={(e) => update('product', e.target.value)}
          placeholder="예: Cardiac Sensor X1"
          className="mt-1 w-48 rounded border border-ink-150 px-2 py-1 text-sm focus:border-brand-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
        />
      </label>

      <label className="flex flex-col text-xs text-ink-600">
        패키지 ID
        <input
          type="text"
          value={searchParams.get('packageId') ?? ''}
          onChange={(e) => update('packageId', e.target.value)}
          placeholder="UUID (선택)"
          className="mt-1 w-56 rounded border border-ink-150 px-2 py-1 font-mono text-xs focus:border-brand-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
        />
      </label>

      <label className="flex flex-col text-xs text-ink-600">
        위험 수준
        <select
          value={searchParams.get('riskLevel') ?? ''}
          onChange={(e) => update('riskLevel', e.target.value)}
          className="mt-1 rounded border border-ink-150 px-2 py-1 text-sm focus:border-brand-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
        >
          {RISK_LEVEL_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col text-xs text-ink-600">
        Stale 출처
        <select
          value={searchParams.get('stale') ?? ''}
          onChange={(e) => update('stale', e.target.value)}
          className="mt-1 rounded border border-ink-150 px-2 py-1 text-sm focus:border-brand-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
        >
          {STALE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </label>
    </form>
  );
}
