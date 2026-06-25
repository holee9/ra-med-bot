'use client';

// @MX:NOTE [AUTO] Quality heatmap page — feedback score by corpus.
// @MX:SPEC SPEC-REGULA-RLHF-001 (REQ-RLHF-012, AC-08)
//
// Architecture: client page fetching GET /api/rlhf/heatmap. The heatmap route is
// gated by audit.read, so RA leads and auditors can view quality trends. v1
// groups feedback by conversationId as the corpus proxy (see route comment for
// the deferred per-source-type breakdown). The dashboard renders a corpus list
// with mean-score bars and up/down counts.

import { useEffect, useState } from 'react';

interface CorpusEntry {
  meanScore: number;
  total: number;
  upCount: number;
  downCount: number;
}
interface HeatmapResponse {
  heatmap: Record<string, CorpusEntry>;
  sampledAt: string;
}
type LoadState =
  | { kind: 'loading' }
  | { kind: 'ready'; data: HeatmapResponse }
  | { kind: 'empty' }
  | { kind: 'error'; message: string };

function scoreColor(mean: number): string {
  if (mean >= 0.75) return 'bg-success';
  if (mean >= 0.5) return 'bg-warn';
  return 'bg-danger';
}

function scoreLabel(mean: number): string {
  if (mean >= 0.75) return '높음';
  if (mean >= 0.5) return '보통';
  return '낮음';
}

function truncateCorpus(id: string): string {
  return id.length > 12 ? `${id.slice(0, 8)}…${id.slice(-4)}` : id;
}

export default function HeatmapPage() {
  const [state, setState] = useState<LoadState>({ kind: 'loading' });

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch('/api/rlhf/heatmap?limit=200', { cache: 'no-store' });
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }
        const body = (await res.json()) as HeatmapResponse;
        if (cancelled) return;
        const entries = Object.keys(body.heatmap ?? {});
        setState(entries.length === 0 ? { kind: 'empty' } : { kind: 'ready', data: body });
      } catch (err) {
        if (!cancelled) {
          setState({
            kind: 'error',
            message: err instanceof Error ? err.message : '히트맵 로드에 실패했습니다.',
          });
        }
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <header className="mb-6">
        <h1 className="font-serif text-2xl text-ink-900">품질 히트맵</h1>
        <p className="mt-1 text-sm text-ink-500">
          사용자 피드백 기반 답변 품질 분포. 항목별 평균 점수와 엄지 위/아래 비율.
        </p>
      </header>

      {state.kind === 'loading' && (
        <output data-testid="heatmap-loading" className="text-sm text-ink-500">
          불러오는 중…
        </output>
      )}

      {state.kind === 'error' && (
        <div
          data-testid="heatmap-error"
          className="rounded-md border border-danger bg-danger-bg px-4 py-3 text-sm text-danger"
        >
          <p className="font-medium">히트맵을 불러오지 못했습니다.</p>
          <p className="mt-1 text-xs">{state.message}</p>
        </div>
      )}

      {state.kind === 'empty' && (
        <div
          data-testid="heatmap-empty"
          className="rounded-md border border-ink-100 bg-surface-elevated px-4 py-6 text-center text-sm text-ink-500"
        >
          아직 집계된 피드백이 없습니다. 답변에 평가를 남기면 이 대시보드에 반영됩니다.
        </div>
      )}

      {state.kind === 'ready' && <HeatmapTable data={state.data} />}
    </div>
  );
}

function HeatmapTable({ data }: { data: HeatmapResponse }) {
  const entries = Object.entries(data.heatmap)
    .map(([id, e]) => ({ id, ...e }))
    .sort((a, b) => a.meanScore - b.meanScore); // lowest scores first (biggest gaps on top)

  const sampledAt = new Date(data.sampledAt).toLocaleString('ko-KR');

  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs text-ink-400">집계 시각: {sampledAt}</p>
      <div className="overflow-hidden rounded-md border border-ink-100">
        <table className="w-full text-sm" data-testid="heatmap-table">
          <caption className="sr-only">항목별 평균 점수와 엄지 위/아래 횟수</caption>
          <thead className="bg-ink-50 text-left text-xs text-ink-500">
            <tr>
              <th scope="col" className="px-4 py-2 font-medium">
                항목 (conversation)
              </th>
              <th scope="col" className="px-4 py-2 font-medium">
                평균 점수
              </th>
              <th scope="col" className="px-4 py-2 font-medium">
                평가
              </th>
              <th scope="col" className="px-4 py-2 font-medium">
                비율
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ink-100">
            {entries.map((e) => {
              const pct = e.total === 0 ? 0 : Math.round((e.upCount / e.total) * 100);
              return (
                <tr key={e.id} className="text-ink-700">
                  <td className="px-4 py-2 font-mono text-xs" title={e.id}>
                    {truncateCorpus(e.id)}
                  </td>
                  <td className="px-4 py-2">
                    <div className="flex items-center gap-2">
                      <div
                        className="h-1.5 w-16 rounded-full bg-ink-100"
                        role="img"
                        aria-label={`평균 점수 ${e.meanScore.toFixed(2)} (${scoreLabel(e.meanScore)})`}
                      >
                        <div
                          className={`h-full rounded-full ${scoreColor(e.meanScore)}`}
                          style={{ width: `${Math.round(e.meanScore * 100)}%` }}
                        />
                      </div>
                      <span className="font-mono text-xs text-ink-600">
                        {e.meanScore.toFixed(2)}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-2 text-xs">
                    <span className="text-success">▲ {e.upCount}</span>
                    {' / '}
                    <span className="text-danger">▼ {e.downCount}</span>
                    <span className="ml-2 text-ink-400">(총 {e.total})</span>
                  </td>
                  <td className="px-4 py-2 font-mono text-xs text-ink-600">{pct}%</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-ink-400">
        v1 집계 기준: 항목별 대화(conversation) 단위 그룹. 출처 유형별 분해는 추후 확장 예정.
      </p>
    </div>
  );
}
