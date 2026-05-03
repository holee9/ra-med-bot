'use client';

import { useDashboardStats } from '@/lib/queries/useDashboardStats';
import { useProjects } from '@/lib/queries/useProjects';
import { useUpdates } from '@/lib/queries/useUpdates';

function valueFromStats(stats: unknown, key: string): string {
  if (!stats || typeof stats !== 'object') return '0';
  const direct = (stats as Record<string, unknown>)[key];
  if (direct !== undefined) return String(direct);
  const nested = (stats as { stats?: Record<string, unknown> }).stats?.[key];
  return nested !== undefined ? String(nested) : '0';
}

export default function DashboardPage() {
  const dashboard = useDashboardStats();
  const projects = useProjects();
  const updates = useUpdates();
  const updateCount = updates.data?.pages.flatMap((page) => page.data).length ?? 0;

  const cards = [
    { label: '상담', value: valueFromStats(dashboard.data, 'totalConversations') },
    { label: '프로젝트', value: String(projects.data?.length ?? 0) },
    { label: '전문가 검토', value: valueFromStats(dashboard.data, 'pendingReviews') },
    { label: '규제 업데이트', value: String(updateCount) },
  ];

  return (
    <section className="mx-auto flex max-w-content flex-col gap-6 px-6 py-8">
      <header>
        <h1 className="font-serif text-3xl text-brand-800">대시보드</h1>
        <p className="mt-2 text-sm text-ink-600">
          상담, 프로젝트, 검토, 업데이트 상태를 요약합니다.
        </p>
      </header>

      <div className="grid gap-3 md:grid-cols-4">
        {cards.map((card) => (
          <article key={card.label} className="rounded-lg border border-ink-150 bg-surface p-4">
            <p className="text-xs text-ink-500">{card.label}</p>
            <p className="mt-2 font-serif text-3xl text-ink-900">{card.value}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
