'use client';

import { UpdateCard } from '@/components/radar/UpdateCard';
import { useUpdates } from '@/lib/queries/useUpdates';
import { useState } from 'react';

const REGIONS = ['US', 'EU', 'KR', 'JP', 'CN'];
const IMPACT_TYPES = ['guidance', 'recall', 'legislation', 'enforcement_action', 'informational'];

export default function UpdatesPage() {
  const [impactMin, setImpactMin] = useState<string>('');
  const [region, setRegion] = useState<string>('');
  const [impactType, setImpactType] = useState<string>('');

  const filters = {
    impact_min: impactMin || undefined,
    region: region || undefined,
    impact_type: impactType || undefined,
  };

  const { data, isLoading, isError } = useUpdates(filters);
  const updates = data?.pages.flatMap((page) => page.data) ?? [];

  return (
    <section className="mx-auto flex max-w-content flex-col gap-6 px-6 py-8">
      <header>
        <h1 className="font-serif text-3xl text-brand-800">규제 업데이트</h1>
        <p className="mt-2 text-sm text-ink-600">주요 권역별 규제 변경사항을 추적합니다.</p>
      </header>

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-ink-150 bg-surface p-3">
        <div className="flex items-center gap-2">
          <label className="text-xs text-ink-600" htmlFor="impact-min">
            최소 영향도
          </label>
          <select
            id="impact-min"
            value={impactMin}
            onChange={(e) => setImpactMin(e.target.value)}
            className="rounded border border-ink-200 px-2 py-1 text-xs"
          >
            <option value="">전체</option>
            <option value="0.7">0.7 이상 (중요)</option>
            <option value="0.9">0.9 이상 (매우 높음)</option>
          </select>
        </div>

        <div className="flex items-center gap-2">
          <label className="text-xs text-ink-600" htmlFor="region-filter">
            지역
          </label>
          <select
            id="region-filter"
            value={region}
            onChange={(e) => setRegion(e.target.value)}
            className="rounded border border-ink-200 px-2 py-1 text-xs"
          >
            <option value="">전체</option>
            {REGIONS.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <label className="text-xs text-ink-600" htmlFor="type-filter">
            영향 유형
          </label>
          <select
            id="type-filter"
            value={impactType}
            onChange={(e) => setImpactType(e.target.value)}
            className="rounded border border-ink-200 px-2 py-1 text-xs"
          >
            <option value="">전체</option>
            {IMPACT_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>

        {(impactMin || region || impactType) && (
          <button
            type="button"
            onClick={() => {
              setImpactMin('');
              setRegion('');
              setImpactType('');
            }}
            className="text-xs text-ink-500 hover:text-ink-700 underline"
          >
            필터 초기화
          </button>
        )}
      </div>

      {isLoading && <p className="text-sm text-ink-500">업데이트를 불러오는 중입니다.</p>}
      {isError && <p className="text-sm text-danger">업데이트를 불러오지 못했습니다.</p>}
      {!isLoading && !isError && updates.length === 0 && (
        <p className="rounded-lg border border-ink-150 bg-surface p-4 text-sm text-ink-500">
          표시할 규제 업데이트가 없습니다.
        </p>
      )}

      <div className="flex flex-col gap-3">
        {updates.map((update) => (
          <UpdateCard
            key={update.id}
            id={update.id}
            title={update.title ?? '업데이트'}
            region={update.region ?? 'GLOBAL'}
            publishedAt={update.publishedAt ?? null}
            severity={update.severity ?? undefined}
            impactScore={update.impactScore ?? null}
            impactTypeHint={update.impactTypeHint ?? null}
            sourceUrl={update.sourceUrl ?? null}
          />
        ))}
      </div>
    </section>
  );
}
