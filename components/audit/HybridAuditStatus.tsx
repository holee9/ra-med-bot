'use client';

// @MX:NOTE HybridAuditStatus — shows hybrid-ra health and exposes audit export entry point.
// @MX:SPEC Issue #201

import { useEffect, useState } from 'react';

interface HealthState {
  status: 'loading' | 'unconfigured' | 'ok' | 'degraded' | 'unavailable' | 'error';
  version?: string;
}

interface ExportState {
  status: 'idle' | 'loading' | 'done' | 'error';
  downloadUrl?: string;
  expiresAt?: string;
  recordCount?: number;
  error?: string;
}

export function HybridAuditStatus() {
  const [health, setHealth] = useState<HealthState>({ status: 'loading' });
  const [exportOpen, setExportOpen] = useState(false);
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [format, setFormat] = useState<'csv' | 'json'>('csv');
  const [exportState, setExportState] = useState<ExportState>({ status: 'idle' });

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch('/api/ra/hybrid/audit-status');
        const data = (await res.json()) as { status: string; health?: { status: string; version?: string } };
        if (data.status === 'unconfigured') {
          setHealth({ status: 'unconfigured' });
        } else if (data.status === 'ok' && data.health) {
          setHealth({ status: data.health.status as HealthState['status'], version: data.health.version });
        } else {
          setHealth({ status: 'error' });
        }
      } catch {
        setHealth({ status: 'error' });
      }
    })();
  }, []);

  const handleExport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fromDate || !toDate) return;
    setExportState({ status: 'loading' });
    try {
      const res = await fetch('/api/ra/hybrid/audit-export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: fromDate, to: toDate, format }),
      });
      const data = (await res.json()) as {
        status: string;
        export?: { download_url: string; expires_at: string; record_count: number };
        message?: string;
      };
      if (data.status === 'ok' && data.export) {
        setExportState({
          status: 'done',
          downloadUrl: data.export.download_url,
          expiresAt: data.export.expires_at,
          recordCount: data.export.record_count,
        });
      } else {
        setExportState({ status: 'error', error: data.message ?? '내보내기 실패' });
      }
    } catch {
      setExportState({ status: 'error', error: '요청 실패. 다시 시도하세요.' });
    }
  };

  if (health.status === 'loading') {
    return (
      <div className="animate-pulse rounded-lg border border-ink-150 bg-ink-50 p-4 text-sm text-ink-400">
        Hybrid RA 상태 확인 중…
      </div>
    );
  }

  if (health.status === 'unconfigured') {
    return (
      <div className="rounded-lg border border-ink-150 bg-ink-50 p-4 text-sm text-ink-500">
        Hybrid RA가 구성되지 않았습니다. Audit export는 Hybrid RA 연동 시 활성화됩니다.
      </div>
    );
  }

  const statusDot =
    health.status === 'ok'
      ? 'bg-success-500'
      : health.status === 'degraded'
        ? 'bg-amber-500'
        : 'bg-danger-500';

  const statusLabel =
    health.status === 'ok' ? '정상' : health.status === 'degraded' ? '저하' : '불가';

  return (
    <div className="rounded-lg border border-ink-150 bg-surface p-4 text-sm">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className={`h-2 w-2 rounded-full ${statusDot}`} aria-hidden="true" />
          <span className="font-medium text-ink-900">Hybrid RA</span>
          <span className="text-ink-500">{statusLabel}</span>
          {health.version && <span className="text-ink-400">v{health.version}</span>}
        </div>
        {health.status === 'ok' && (
          <button
            type="button"
            onClick={() => { setExportOpen((o) => !o); setExportState({ status: 'idle' }); }}
            className="rounded border border-brand-300 px-3 py-1 text-xs text-brand-700 hover:bg-brand-50 transition-colors"
          >
            {exportOpen ? '닫기' : 'Audit 내보내기'}
          </button>
        )}
      </div>

      {health.status === 'degraded' && (
        <p className="mt-2 text-xs text-amber-700">
          Hybrid RA 서비스가 저하 상태입니다. Audit export 결과가 불완전할 수 있습니다.
        </p>
      )}

      {health.status === 'unavailable' && (
        <p className="mt-2 text-xs text-danger">
          Hybrid RA 서비스에 연결할 수 없습니다. 관리자에게 문의하세요.
        </p>
      )}

      {exportOpen && (
        <form onSubmit={(e) => { void handleExport(e); }} className="mt-4 flex flex-col gap-3 border-t border-ink-100 pt-4">
          <div className="flex flex-wrap gap-3">
            <label className="flex flex-col text-xs text-ink-600">
              시작일
              <input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                required
                className="mt-1 rounded border border-ink-150 px-2 py-1 text-sm"
              />
            </label>
            <label className="flex flex-col text-xs text-ink-600">
              종료일
              <input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                required
                className="mt-1 rounded border border-ink-150 px-2 py-1 text-sm"
              />
            </label>
            <label className="flex flex-col text-xs text-ink-600">
              형식
              <select
                value={format}
                onChange={(e) => setFormat(e.target.value as 'csv' | 'json')}
                className="mt-1 rounded border border-ink-150 px-2 py-1 text-sm"
              >
                <option value="csv">CSV</option>
                <option value="json">JSON</option>
              </select>
            </label>
          </div>

          <button
            type="submit"
            disabled={exportState.status === 'loading'}
            className="self-start rounded bg-brand-700 px-4 py-1 text-xs text-white disabled:opacity-50 hover:bg-brand-800 transition-colors"
          >
            {exportState.status === 'loading' ? '처리 중…' : '내보내기 시작'}
          </button>

          {exportState.status === 'done' && exportState.downloadUrl && (
            <div className="rounded-lg border border-success-200 bg-success-50 p-3">
              <p className="text-xs font-medium text-success-700">
                내보내기 완료 ({exportState.recordCount?.toLocaleString()}건)
              </p>
              <a
                href={exportState.downloadUrl}
                download
                className="mt-1 inline-block text-xs text-brand-700 underline hover:text-brand-900"
              >
                다운로드
              </a>
              {exportState.expiresAt && (
                <p className="mt-1 text-xs text-ink-500">
                  만료: {new Intl.DateTimeFormat('ko-KR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(exportState.expiresAt))}
                </p>
              )}
            </div>
          )}

          {exportState.status === 'error' && (
            <p className="text-xs text-danger">{exportState.error}</p>
          )}
        </form>
      )}
    </div>
  );
}
