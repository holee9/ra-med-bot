'use client';

// @MX:NOTE Hybrid RA 동기화 상태 표시 컴포넌트 — knowledge page 전용.
// @MX:SPEC Issue #199

import { useEffect, useState } from 'react';

interface SyncData {
  last_sync: string;
  total_documents: number;
  sync_status: SyncStatus;
  tenant_id: string;
}

type SyncStatus = 'synced' | 'stale' | 'unknown' | 'failed' | 'pending' | 'retry-needed';

type ViewState =
  | { kind: 'loading' }
  | { kind: 'unconfigured' }
  | { kind: 'ok'; sync: SyncData }
  | { kind: 'error'; message: string };

const STATUS_DOT: Record<SyncStatus, string> = {
  synced: 'bg-success-500',
  stale: 'bg-amber-500',
  unknown: 'bg-ink-400',
  failed: 'bg-red-500',
  pending: 'bg-blue-500',
  'retry-needed': 'bg-amber-600',
};

const STATUS_LABEL: Record<SyncStatus, string> = {
  synced: '동기화됨',
  stale: '동기화 오래됨',
  unknown: '상태 알 수 없음',
  failed: '동기화 실패',
  pending: '동기화 대기 중',
  'retry-needed': '재시도 필요',
};

const STATUS_MESSAGE: Partial<Record<SyncStatus, string>> = {
  stale: '동기화가 오래되었습니다. 관리자에게 재동기화를 요청하거나 잠시 후 새로고침하세요.',
  failed: '마지막 동기화가 실패했습니다. 재시도 또는 관리자 확인이 필요합니다.',
  pending: '동기화 작업이 대기열에 있습니다. 완료 후 새로고침하면 최신 상태가 표시됩니다.',
  'retry-needed': '동기화 재시도 조건이 감지되었습니다. 관리자에게 재동기화를 요청하세요.',
};

function formatDate(iso: string) {
  try {
    return new Intl.DateTimeFormat('ko-KR', {
      dateStyle: 'short',
      timeStyle: 'short',
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export function HybridSyncStatus() {
  const [view, setView] = useState<ViewState>({ kind: 'loading' });

  useEffect(() => {
    fetch('/api/ra/hybrid/sync-status')
      .then((r) => r.json() as Promise<{ status: string; sync?: SyncData; message?: string }>)
      .then((data) => {
        if (data.status === 'unconfigured') {
          setView({ kind: 'unconfigured' });
        } else if (data.status === 'ok' && data.sync) {
          setView({ kind: 'ok', sync: data.sync });
        } else {
          setView({ kind: 'error', message: data.message ?? '상태를 불러오지 못했습니다.' });
        }
      })
      .catch(() => setView({ kind: 'error', message: '네트워크 오류가 발생했습니다.' }));
  }, []);

  if (view.kind === 'loading') {
    return (
      <div
        aria-busy="true"
        className="h-16 animate-pulse rounded-lg border border-ink-150 bg-ink-50"
      />
    );
  }

  if (view.kind === 'unconfigured') {
    return (
      <div className="rounded-lg border border-ink-150 bg-ink-50 px-4 py-3 text-sm text-ink-500">
        Hybrid RA 연동 미설정 — 환경 변수를 구성하면 여기에 동기화 상태가 표시됩니다.
      </div>
    );
  }

  if (view.kind === 'error') {
    return (
      <div
        role="alert"
        className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800"
      >
        <span className="font-medium">동기화 상태 오류:</span> {view.message}{' '}
        <span className="text-amber-700">관리자에게 문의하세요.</span>
      </div>
    );
  }

  const { sync } = view;
  const status = sync.sync_status in STATUS_LABEL ? sync.sync_status : 'unknown';
  const dot = STATUS_DOT[status];
  const label = STATUS_LABEL[status];
  const message = STATUS_MESSAGE[status];

  return (
    <div className="flex flex-col gap-1 rounded-lg border border-ink-150 bg-surface px-4 py-3">
      <div className="flex items-center gap-2">
        <span className={`h-2 w-2 shrink-0 rounded-full ${dot}`} aria-hidden="true" />
        <span className="text-sm font-medium text-ink-900">{label}</span>
        <span className="ml-auto text-xs text-ink-500">테넌트: {sync.tenant_id}</span>
      </div>
      <div className="flex gap-4 text-xs text-ink-600">
        <span>마지막 동기화: {formatDate(sync.last_sync)}</span>
        <span>문서 수: {sync.total_documents.toLocaleString()}개</span>
      </div>
      {message && <p className="mt-1 text-xs text-amber-700">{message}</p>}
    </div>
  );
}
