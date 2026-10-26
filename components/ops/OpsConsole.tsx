'use client';

// @MX:NOTE [AUTO] OpsConsole — t3610 서비스 상황판 클라이언트 (2026-10-20).
// @MX:REASON Replaces the SSH+CLI routine check loop: one page shows service
//           liveness, repo WIP, cron freshness and system health. Read-only.

import { useCallback, useEffect, useState } from 'react';

interface HttpService {
  id: string;
  label: string;
  up: boolean;
}
interface RepoWip {
  name: string;
  branch: string;
  dirtyFiles: number;
  lastCommit: { hash: string; date: string; subject: string };
}
interface CronWatch {
  label: string;
  lastRunHoursAgo: number | null;
}
interface Snapshot {
  stale: boolean;
  generatedAt?: string;
  services?: { http: HttpService[]; containers: Record<string, string> };
  repos?: RepoWip[];
  cron?: CronWatch[];
  system?: {
    diskPct: number | null;
    memPct: number | null;
    uptimeHours: number;
    dbBackupHoursAgo: number | null;
    hostname: string;
  };
}

function hoursLabel(h: number | null): string {
  if (h === null) return '기록 없음';
  return h < 1 ? `${Math.round(h * 60)}분 전` : `${Math.round(h)}시간 전`;
}

export default function OpsConsole() {
  const [snap, setSnap] = useState<Snapshot | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/ops/status', { cache: 'no-store' });
      if (!res.ok) {
        setError(res.status === 403 ? '관리자 권한이 필요합니다' : '상태 파일을 읽을 수 없습니다');
        return;
      }
      setError(null);
      setSnap((await res.json()) as Snapshot);
    } catch {
      setError('상태 조회 실패');
    }
  }, []);

  useEffect(() => {
    void load();
    const t = setInterval(load, 30_000);
    return () => clearInterval(t);
  }, [load]);

  if (error) {
    return <p className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>;
  }
  if (!snap) {
    return <p className="px-1 py-2 text-sm text-ink-500">불러오는 중…</p>;
  }

  return (
    <div className="space-y-6">
      <p className="text-xs text-ink-500">
        수집 시각: {snap.generatedAt ? new Date(snap.generatedAt).toLocaleString('ko-KR') : '-'}
        {snap.stale ? ' · ⚠️ 스냅샷 만료 (수집 크론 확인 필요)' : ''} · 30초마다 갱신
      </p>

      <section>
        <h2 className="mb-2 text-sm font-semibold text-ink-800">서비스 상태</h2>
        <ul className="grid gap-2 sm:grid-cols-2">
          {(snap.services?.http ?? []).map((s) => (
            <li
              key={s.id}
              className="flex items-center justify-between rounded-md border border-ink-100 px-3 py-2 text-sm"
            >
              <span>{s.label}</span>
              <span className={s.up ? 'text-emerald-700' : 'text-red-700'}>
                {s.up ? '● 가동' : '● 응답 없음'}
              </span>
            </li>
          ))}
          {Object.entries(snap.services?.containers ?? {}).map(([name, status]) => (
            <li
              key={name}
              className="flex items-center justify-between rounded-md border border-ink-100 px-3 py-2 text-sm"
            >
              <span>{name}</span>
              <span className={status.startsWith('Up') ? 'text-emerald-700' : 'text-red-700'}>
                {status}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold text-ink-800">구축중(WIP) 저장소</h2>
        <ul className="space-y-1 text-sm">
          {(snap.repos ?? []).map((r) => (
            <li key={r.name} className="rounded-md border border-ink-100 px-3 py-2">
              <span className="font-medium">{r.name}</span>
              <span className="ml-2 text-ink-500">[{r.branch}]</span>
              <span className="ml-2 text-ink-600">
                미커밋 {r.dirtyFiles}건 · 마지막 커밋 {r.lastCommit.date} {r.lastCommit.hash}{' '}
                {r.lastCommit.subject}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold text-ink-800">배치작업 (마지막 로그 시각)</h2>
        <ul className="space-y-1 text-sm">
          {(snap.cron ?? []).map((c) => (
            <li
              key={c.label}
              className="flex justify-between rounded-md border border-ink-100 px-3 py-2"
            >
              <span>{c.label}</span>
              <span className="text-ink-600">{hoursLabel(c.lastRunHoursAgo)}</span>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold text-ink-800">
          시스템 ({snap.system?.hostname})
        </h2>
        <ul className="flex flex-wrap gap-2 text-sm">
          <li className="rounded-md border border-ink-100 px-3 py-2">
            디스크 {snap.system?.diskPct ?? '-'}%
          </li>
          <li className="rounded-md border border-ink-100 px-3 py-2">
            메모리 {snap.system?.memPct ?? '-'}%
          </li>
          <li className="rounded-md border border-ink-100 px-3 py-2">
            업타임 {snap.system?.uptimeHours ?? '-'}시간
          </li>
          <li className="rounded-md border border-ink-100 px-3 py-2">
            DB 백업 {hoursLabel(snap.system?.dbBackupHoursAgo ?? null)}
          </li>
        </ul>
      </section>
    </div>
  );
}
