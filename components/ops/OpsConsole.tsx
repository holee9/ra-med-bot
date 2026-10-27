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
interface IntakeSection {
  kind: string;
  title?: string;
  // metric
  value?: string | number;
  unit?: string;
  // timeseries
  points?: Array<Record<string, unknown>>;
  // table
  rows?: Array<Record<string, unknown>>;
  columns?: string[];
  // status
  detail?: unknown;
}
interface IntakeProducer {
  producer: string;
  generatedAt?: string;
  sections: IntakeSection[];
}
interface LedgerSummary {
  connected: boolean;
  rows: number;
  expiringSoon: Array<{ model: string; market: string; expiresInDays: number }>;
  expired: number;
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
  intake?: IntakeProducer[];
  ledger?: LedgerSummary | null;
  security?: { findings: number; samples: string[] };
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

      {/* RA 성장 대시보드 (B안) — 3세션 인테이크(/opt/ra-intake) + 로컬 기밀 원장 */}
      <section>
        <h2 className="mb-2 text-sm font-semibold text-ink-800">RA 성장 (세션 인테이크)</h2>
        {(snap.intake ?? []).length === 0 && (
          <p className="text-sm text-ink-500">인테이크 대기 중 (/opt/ra-intake)</p>
        )}
        {(snap.intake ?? []).map((p) => (
          <div key={p.producer} className="mb-3">
            <p className="mb-1 text-xs font-medium text-brand-700">
              {p.producer}
              {p.generatedAt ? ` · ${new Date(p.generatedAt).toLocaleString('ko-KR')}` : ''}
            </p>
            <div className="flex flex-wrap gap-2">
              {p.sections.map((sec, i) => (
                <div
                  key={`${p.producer}-${i}`}
                  className="min-w-40 rounded-md border border-ink-100 px-3 py-2 text-xs"
                >
                  <p className="mb-1 font-medium text-ink-700">{sec.title ?? sec.kind}</p>
                  {sec.kind === 'metric' && (
                    <p className="text-lg text-ink-900">
                      {sec.value ?? '-'}
                      {sec.unit ?? ''}
                    </p>
                  )}
                  {sec.kind === 'timeseries' && (
                    <p className="text-ink-600">
                      최근: {JSON.stringify((sec.points ?? []).slice(-1)[0] ?? {})}
                    </p>
                  )}
                  {sec.kind === 'table' && (
                    <p className="text-ink-600">{(sec.rows ?? []).length}행</p>
                  )}
                  {sec.kind === 'status' && (
                    <p className="text-ink-600">{JSON.stringify(sec.detail ?? {})}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold text-ink-800">인허가 원장 (로컬 기밀)</h2>
        {snap.ledger?.connected ? (
          <ul className="flex flex-wrap gap-2 text-sm">
            <li className="rounded-md border border-ink-100 px-3 py-2">
              등록 {snap.ledger.rows}건
            </li>
            <li className="rounded-md border border-ink-100 px-3 py-2">
              만료 {snap.ledger.expired}건
            </li>
            {(snap.ledger.expiringSoon ?? []).map((e) => (
              <li
                key={`${e.model}-${e.expiresInDays}`}
                className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2"
              >
                {e.model} ({e.market}) — D-{e.expiresInDays}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-ink-500">원장 미연결</p>
        )}
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold text-ink-800">보안 (규약 v1.0 자가 점검)</h2>
        <p className="text-sm">
          {snap.security?.findings
            ? `⚠️ 패턴 매칭 ${snap.security.findings}건 — 검토 필요`
            : '✅ 스캔 무결'}{' '}
          <span className="text-ink-500">
            (K번호·사업자번호·비예제 이메일 패턴, 브라우저에서 상세)
          </span>
        </p>
        {snap.security?.samples?.length ? (
          <ul className="mt-1 space-y-1 text-xs text-ink-600">
            {snap.security.samples.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
        ) : null}
      </section>
    </div>
  );
}
