'use client';

import { useConversations } from '@/lib/queries/useConversations';

export default function HistoryPage() {
  const { data, isLoading, isError } = useConversations({ limit: 20 });
  const conversations = data?.pages.flatMap((page) => page.data) ?? [];

  return (
    <section className="mx-auto flex max-w-content flex-col gap-6 px-6 py-8">
      <header>
        <h1 className="font-serif text-3xl text-brand-800">상담 이력</h1>
        <p className="mt-2 text-sm text-ink-600">프로젝트별 규제 상담 내역을 확인합니다.</p>
      </header>

      {isLoading && <p className="text-sm text-ink-500">이력을 불러오는 중입니다.</p>}
      {isError && <p className="text-sm text-danger">상담 이력을 불러오지 못했습니다.</p>}
      {!isLoading && !isError && conversations.length === 0 && (
        <p className="rounded-lg border border-ink-150 bg-surface p-4 text-sm text-ink-500">
          아직 저장된 상담 이력이 없습니다.
        </p>
      )}

      <div className="flex flex-col gap-2">
        {conversations.map((conversation) => (
          <article
            key={conversation.id}
            className="rounded-lg border border-ink-150 bg-surface p-4"
          >
            <h2 className="text-sm font-medium text-ink-900">
              {conversation.title || '제목 없는 상담'}
            </h2>
            <p className="mt-1 text-xs text-ink-500">
              {conversation.status ?? 'active'} · {String(conversation.createdAt ?? '')}
            </p>
          </article>
        ))}
      </div>
    </section>
  );
}
