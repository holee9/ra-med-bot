import { and, eq } from 'drizzle-orm';
// @MX:SPEC SPEC-REGULA-DIGEST-001
// Public shareable digest view — no auth required (token-gated).
import { notFound } from 'next/navigation';
import { db } from '../../../../../lib/db/client';
import { weeklyDigests } from '../../../../../lib/db/schema';
import type { DigestPayload, DigestUpdate } from '../../../../../lib/digest/digest-generator';

interface PageProps {
  params: Promise<{ weekId: string }>;
  searchParams: Promise<{ token?: string }>;
}

const SEVERITY_COLORS: Record<string, string> = {
  critical: 'bg-red-100 text-red-700 border-red-300',
  high: 'bg-amber-100 text-amber-700 border-amber-300',
  medium: 'bg-blue-100 text-blue-700 border-blue-300',
  low: 'bg-green-100 text-green-700 border-green-300',
};

const SEVERITY_LABELS: Record<string, string> = {
  critical: '긴급',
  high: '중요',
  medium: '주의',
  low: '참고',
};

function UpdateCard({ update }: { update: DigestUpdate }) {
  const colorClass = SEVERITY_COLORS[update.severity_classification] ?? SEVERITY_COLORS.low;
  const label = SEVERITY_LABELS[update.severity_classification] ?? update.severity_classification;
  return (
    <div className={`border rounded-md p-4 mb-3 border-l-4 ${colorClass}`}>
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-semibold text-sm text-gray-900">{update.title}</h3>
        <span className={`shrink-0 text-xs px-2 py-0.5 rounded-full border ${colorClass}`}>
          {label}
        </span>
      </div>
      <p className="text-xs text-gray-500 mt-1">
        {update.region} · <span suppressHydrationWarning>{new Date(update.published_at).toLocaleDateString('ko-KR')}</span>
      </p>
      <p className="text-sm text-gray-700 mt-2">{update.impact_summary}</p>
      {update.source_url && (
        <a
          href={update.source_url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-blue-600 hover:underline mt-1 inline-block"
        >
          원문 보기 →
        </a>
      )}
    </div>
  );
}

export default async function DigestPage({ params, searchParams }: PageProps) {
  const { weekId } = await params;
  const { token } = await searchParams;

  if (!token) notFound();

  const rows = await db
    .select()
    .from(weeklyDigests)
    .where(and(eq(weeklyDigests.weekId, weekId), eq(weeklyDigests.shareToken, token)))
    .limit(1);

  const digest = rows[0];
  if (!digest) notFound();

  const payload = digest.digestJson as unknown as DigestPayload;

  return (
    <main className="max-w-2xl mx-auto px-4 py-8">
      <div className="bg-slate-800 text-white rounded-t-lg p-5">
        <h1 className="text-xl font-bold">Regula 규제 인텔리전스 다이제스트</h1>
        <p className="text-sm opacity-75 mt-1">
          {payload.week_id} · {payload.update_count}개 업데이트
        </p>
      </div>
      <div className="bg-gray-50 rounded-b-lg p-5">
        <div className="flex flex-wrap gap-2 mb-4">
          {payload.critical_count > 0 && (
            <span className="text-xs bg-red-100 text-red-700 px-3 py-1 rounded-full">
              긴급 {payload.critical_count}건
            </span>
          )}
          {payload.high_count > 0 && (
            <span className="text-xs bg-amber-100 text-amber-700 px-3 py-1 rounded-full">
              중요 {payload.high_count}건
            </span>
          )}
          {payload.medium_count > 0 && (
            <span className="text-xs bg-blue-100 text-blue-700 px-3 py-1 rounded-full">
              주의 {payload.medium_count}건
            </span>
          )}
          {payload.low_count > 0 && (
            <span className="text-xs bg-green-100 text-green-700 px-3 py-1 rounded-full">
              참고 {payload.low_count}건
            </span>
          )}
        </div>
        {payload.updates.map((u) => (
          <UpdateCard key={u.id} update={u} />
        ))}
        {payload.update_count === 0 && (
          <p className="text-sm text-gray-500 text-center py-8">
            이번 주 규제 업데이트가 없습니다.
          </p>
        )}
        <p className="text-xs text-gray-400 text-center mt-6">
          생성일: {new Date(digest.generatedAt).toLocaleString('ko-KR')}
        </p>
      </div>
    </main>
  );
}
