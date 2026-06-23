'use client';

// @MX:NOTE [AUTO] Knowledge Gap queue filters — client island that drives URL
// navigation so the list stays SSR-friendly. Each <select> change pushes a new
// query string and lets the Server Component re-render with fresh data.
// @MX:SPEC SPEC-REGULA-KNOWLEDGE-GAP-001 (REQ-008 context, Issue #35)

import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback } from 'react';

type Option = { value: string; label: string };

const STATUS_OPTIONS: Option[] = [
  { value: '', label: '전체 상태' },
  { value: 'open', label: '미처리' },
  { value: 'classified', label: '분류됨' },
  { value: 'resolved', label: '해결됨' },
];
const REASON_OPTIONS: Option[] = [
  { value: '', label: '전체 원인' },
  { value: 'low_confidence', label: '신뢰도 낮음' },
  { value: 'low_citation', label: '출처 부족' },
  { value: 'no_results', label: '검색 결과 없음' },
  { value: 'policy_blocked', label: '정책상 차단' },
];
const CLASSIFICATION_OPTIONS: Option[] = [
  { value: '', label: '전체 분류' },
  { value: 'ra_project_gap', label: 'RA 프로젝트 지식 누락' },
  { value: 'md_process_gap', label: 'MD-process SOP 누락' },
  { value: 'external_regulation_needed', label: '외부 규제 원문 필요' },
  { value: 'bug', label: '제품 버그' },
];

export default function QueueFilters() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const update = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value) params.set(key, value);
      else params.delete(key);
      params.delete('page');
      router.push(`/knowledge-gap?${params.toString()}`);
    },
    [router, searchParams],
  );

  return (
    <form
      className="flex flex-wrap gap-3 rounded-lg border border-ink-150 bg-surface p-4"
      aria-label="미답변 큐 필터"
    >
      <label className="flex flex-col text-xs text-ink-600">
        상태
        <select
          value={searchParams.get('status') ?? ''}
          onChange={(e) => update('status', e.target.value)}
          className="mt-1 rounded border border-ink-150 px-2 py-1 text-sm focus:border-brand-500 focus:outline-none"
        >
          {STATUS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col text-xs text-ink-600">
        원인
        <select
          value={searchParams.get('reason') ?? ''}
          onChange={(e) => update('reason', e.target.value)}
          className="mt-1 rounded border border-ink-150 px-2 py-1 text-sm focus:border-brand-500 focus:outline-none"
        >
          {REASON_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col text-xs text-ink-600">
        분류
        <select
          value={searchParams.get('classification') ?? ''}
          onChange={(e) => update('classification', e.target.value)}
          className="mt-1 rounded border border-ink-150 px-2 py-1 text-sm focus:border-brand-500 focus:outline-none"
        >
          {CLASSIFICATION_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </label>
    </form>
  );
}
