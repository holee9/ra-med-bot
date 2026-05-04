'use client';

import { use } from 'react';
import { useUpdateDetail } from '@/lib/queries/useUpdate';
import { useUpdateImpactAnalysis } from '@/lib/queries/useUpdateImpactAnalysis';
import { ImpactChip } from '@/components/radar/ImpactChip';

export default function UpdateDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data, isLoading, isError } = useUpdateDetail(id);
  const { data: analysis, isLoading: analysisLoading } = useUpdateImpactAnalysis(id);

  if (isLoading) {
    return (
      <section className="mx-auto max-w-3xl px-6 py-8">
        <p className="text-sm text-ink-500">업데이트를 불러오는 중입니다...</p>
      </section>
    );
  }

  if (isError || !data?.update) {
    return (
      <section className="mx-auto max-w-3xl px-6 py-8">
        <p className="text-sm text-danger">업데이트를 찾을 수 없습니다.</p>
      </section>
    );
  }

  const update = data.update;
  const score =
    update.impactScore !== null && update.impactScore !== undefined
      ? parseFloat(String(update.impactScore))
      : null;
  const date = update.publishedAt
    ? new Date(update.publishedAt).toLocaleDateString('ko-KR', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : '—';

  return (
    <section className="mx-auto max-w-3xl px-6 py-8">
      <div className="flex items-start justify-between gap-4">
        <h1 className="font-serif text-2xl text-ink-900">{update.title}</h1>
        {score !== null && !isNaN(score) && <ImpactChip score={score} />}
      </div>

      <div className="mt-3 flex flex-wrap gap-3 text-sm text-ink-500">
        <span className="rounded bg-gray-100 px-2 py-0.5">{update.region}</span>
        {update.impactTypeHint && (
          <span className="rounded bg-blue-50 px-2 py-0.5 text-blue-600">
            {update.impactTypeHint}
          </span>
        )}
        <span>{date}</span>
      </div>

      {update.sourceUrl && (
        <a
          href={update.sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-4 block text-sm text-blue-600 hover:underline"
        >
          원문 보기
        </a>
      )}

      <div className="mt-6 rounded-lg border border-ink-150 bg-surface p-5">
        <h2 className="font-medium text-ink-800">영향 분석</h2>
        {analysisLoading && (
          <p className="mt-2 text-sm text-ink-500">분석 중...</p>
        )}
        {analysis?.impactAnalysisText ? (
          <p className="mt-2 text-sm text-ink-700 leading-relaxed">{analysis.impactAnalysisText}</p>
        ) : !analysisLoading && (
          <p className="mt-2 text-sm text-ink-400">분석 내용이 없습니다.</p>
        )}
      </div>

      {update.affectedProductTypes && update.affectedProductTypes.length > 0 && (
        <div className="mt-4">
          <h3 className="text-sm font-medium text-ink-700">영향 대상 제품 유형</h3>
          <div className="mt-2 flex flex-wrap gap-2">
            {update.affectedProductTypes.map((pt) => (
              <span key={pt} className="rounded bg-gray-100 px-2 py-0.5 text-xs text-ink-600">
                {pt}
              </span>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
