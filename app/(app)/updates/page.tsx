'use client';

import { useUpdates } from '@/lib/queries/useUpdates';

export default function UpdatesPage() {
  const { data, isLoading, isError } = useUpdates();
  const updates = data?.pages.flatMap((page) => page.data) ?? [];

  return (
    <section className="mx-auto flex max-w-content flex-col gap-6 px-6 py-8">
      <header>
        <h1 className="font-serif text-3xl text-brand-800">규제 업데이트</h1>
        <p className="mt-2 text-sm text-ink-600">주요 권역별 규제 변경사항을 추적합니다.</p>
      </header>

      {isLoading && <p className="text-sm text-ink-500">업데이트를 불러오는 중입니다.</p>}
      {isError && <p className="text-sm text-danger">업데이트를 불러오지 못했습니다.</p>}
      {!isLoading && !isError && updates.length === 0 && (
        <p className="rounded-lg border border-ink-150 bg-surface p-4 text-sm text-ink-500">
          표시할 규제 업데이트가 없습니다.
        </p>
      )}

      <div className="flex flex-col gap-3">
        {updates.map((update) => (
          <article key={update.id} className="rounded-lg border border-ink-150 bg-surface p-4">
            <div className="flex items-center gap-2 text-xs text-ink-500">
              <span className="font-medium text-brand-700">{update.region ?? 'GLOBAL'}</span>
              <span>{update.severity ?? 'normal'}</span>
              <span>{String(update.publishedAt ?? '')}</span>
            </div>
            <h2 className="mt-2 font-serif text-lg text-ink-900">{update.title ?? '업데이트'}</h2>
            {update.sourceUrl && (
              <a
                href={update.sourceUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-3 inline-flex text-sm text-brand-700 hover:text-brand-800"
              >
                원문 보기
              </a>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}
