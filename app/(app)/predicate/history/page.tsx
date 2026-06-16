'use client';

// @MX:NOTE [AUTO] Predicate comparison history — lists the caller's saved
//   comparisons with a sort toggle and resume links.
// @MX:SPEC SPEC-REGULA-PREDICATE-001 (REQ-PRE-020)

import { useEffect, useState } from 'react';

interface HistoryRow {
  id: string;
  resultJson: { subject_device_name?: string } | null;
  createdAt: string;
}

type SortDir = 'desc' | 'asc';

const dateFormatter = new Intl.DateTimeFormat('ko-KR', {
  timeZone: 'Asia/Seoul',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

export default function PredicateHistoryPage() {
  const [rows, setRows] = useState<HistoryRow[]>([]);
  const [sort, setSort] = useState<SortDir>('desc');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    fetch(`/api/ra/predicate/comparison?sort=${sort}`)
      .then((res) => (res.ok ? res.json() : { comparisons: [] }))
      .then((body: { comparisons?: HistoryRow[] }) => {
        if (active) setRows(body.comparisons ?? []);
      })
      .catch(() => {
        if (active) setRows([]);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [sort]);

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-ink-900">비교 이력</h1>
        <button
          type="button"
          data-testid="history-sort-toggle"
          onClick={() => setSort((s) => (s === 'desc' ? 'asc' : 'desc'))}
          className="rounded-md border border-ink-200 px-3 py-1.5 text-sm text-ink-700 hover:bg-ink-50"
        >
          {sort === 'desc' ? '최신순' : '오래된순'}
        </button>
      </div>

      {loading ? (
        <p className="mt-6 text-sm text-ink-500">불러오는 중...</p>
      ) : rows.length === 0 ? (
        <p className="mt-6 text-sm text-ink-500">저장된 비교가 없습니다.</p>
      ) : (
        <ul data-testid="predicate-history-list" className="mt-4 flex flex-col gap-2">
          {rows.map((row) => (
            <li key={row.id} data-testid="predicate-history-item">
              <a
                href={`/predicate/compare?id=${row.id}`}
                className="flex items-center justify-between rounded-md border border-ink-150 bg-surface-elevated px-4 py-3 text-sm hover:border-brand-300"
              >
                <span className="font-medium text-ink-800">
                  {row.resultJson?.subject_device_name ?? '(제목 없음)'}
                </span>
                <span className="text-xs text-ink-500">
                  {dateFormatter.format(new Date(row.createdAt))}
                </span>
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
