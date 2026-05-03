'use client';

import { useTemplates } from '@/lib/queries/useTemplates';

export default function TemplatesPage() {
  const { data = [], isLoading, isError } = useTemplates();

  return (
    <section className="mx-auto flex max-w-content flex-col gap-6 px-6 py-8">
      <header>
        <h1 className="font-serif text-3xl text-brand-800">문서 템플릿</h1>
        <p className="mt-2 text-sm text-ink-600">반복 제출 문서와 규제 대응 템플릿을 확인합니다.</p>
      </header>

      {isLoading && <p className="text-sm text-ink-500">템플릿을 불러오는 중입니다.</p>}
      {isError && <p className="text-sm text-danger">템플릿을 불러오지 못했습니다.</p>}
      {!isLoading && !isError && data.length === 0 && (
        <p className="rounded-lg border border-ink-150 bg-surface p-4 text-sm text-ink-500">
          등록된 템플릿이 없습니다.
        </p>
      )}

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {data.map((template) => (
          <article key={template.id} className="rounded-lg border border-ink-150 bg-surface p-4">
            <p className="text-xs font-medium uppercase tracking-widest text-brand-600">
              {template.region ?? 'GLOBAL'}
            </p>
            <h2 className="mt-2 font-serif text-lg text-ink-900">
              {template.title ?? template.name ?? '제목 없는 템플릿'}
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-ink-600">
              {template.description ?? '설명 없음'}
            </p>
            <p className="mt-3 text-xs text-ink-400">{template.category ?? 'general'}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
