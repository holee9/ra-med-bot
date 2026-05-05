'use client';

import { logger } from '@/lib/observability/logger';
import { useCrawlerRuns } from '@/lib/queries/useCrawlerRuns';
import { useState } from 'react';

type CrawlerName = 'fda-federal-register' | 'eu-oj' | 'mfds-notice';

export default function AdminRadarPage() {
  const { data, isLoading, refetch } = useCrawlerRuns();
  const [running, setRunning] = useState<string | null>(null);
  const [runResult, setRunResult] = useState<{
    crawler: string;
    records_added: number;
    errors: string[];
  } | null>(null);

  const runs = data?.runs ?? [];

  async function triggerCrawler(crawler: CrawlerName) {
    setRunning(crawler);
    setRunResult(null);
    try {
      const res = await fetch('/api/admin/radar/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ crawler }),
      });
      const result = (await res.json()) as {
        crawler: string;
        records_added: number;
        errors: string[];
      };
      setRunResult(result);
      void refetch();
    } catch (err) {
      logger.error('[admin/radar] Crawler run failed:', err);
    } finally {
      setRunning(null);
    }
  }

  return (
    <section className="mx-auto max-w-4xl px-6 py-8">
      <h1 className="font-serif text-3xl text-brand-800">Radar 관리</h1>
      <p className="mt-2 text-sm text-ink-600">크롤러 실행 현황 및 수동 실행</p>

      {/* Manual trigger */}
      <div className="mt-6 rounded-lg border border-ink-150 bg-surface p-5">
        <h2 className="font-medium text-ink-800">수동 크롤러 실행</h2>
        <div className="mt-3 flex flex-wrap gap-3">
          {(['fda-federal-register', 'eu-oj', 'mfds-notice'] as CrawlerName[]).map((crawler) => (
            <button
              type="button"
              key={crawler}
              onClick={() => void triggerCrawler(crawler)}
              disabled={running !== null}
              className="rounded border border-brand-200 bg-brand-50 px-4 py-2 text-sm text-brand-700 hover:bg-brand-100 disabled:opacity-50"
            >
              {running === crawler ? '실행 중...' : crawler}
            </button>
          ))}
        </div>

        {runResult && (
          <div className="mt-4 rounded border border-green-200 bg-green-50 p-3 text-sm">
            <strong>{runResult.crawler}</strong> — {runResult.records_added}건 추가
            {runResult.errors.length > 0 && (
              <ul className="mt-1 list-disc pl-4 text-red-600">
                {runResult.errors.map((e) => (
                  <li key={e}>{e}</li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      {/* Crawler runs table */}
      <div className="mt-6">
        <h2 className="font-medium text-ink-800">최근 실행 이력</h2>

        {isLoading && <p className="mt-2 text-sm text-ink-500">불러오는 중...</p>}

        {!isLoading && runs.length === 0 && (
          <p className="mt-2 text-sm text-ink-400">실행 이력이 없습니다.</p>
        )}

        {runs.length > 0 && (
          <div className="mt-3 overflow-x-auto rounded-lg border border-ink-150">
            <table className="min-w-full divide-y divide-ink-150 text-sm">
              <thead className="bg-surface">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-ink-500">크롤러</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-ink-500">시작</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-ink-500">상태</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-ink-500">
                    추가 건수
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100 bg-white">
                {runs.map((run) => (
                  <tr key={run.id}>
                    <td className="px-4 py-2 font-mono text-xs">{run.crawlerName}</td>
                    <td className="px-4 py-2 text-xs text-ink-500">
                      {run.startedAt ? new Date(run.startedAt).toLocaleString('ko-KR') : '—'}
                    </td>
                    <td className="px-4 py-2">
                      <span
                        className={`rounded px-1.5 py-0.5 text-xs font-medium ${
                          run.status === 'success'
                            ? 'bg-green-100 text-green-700'
                            : run.status === 'running'
                              ? 'bg-blue-100 text-blue-700'
                              : 'bg-red-100 text-red-700'
                        }`}
                      >
                        {run.status}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-xs">{run.recordsAdded ?? 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}
