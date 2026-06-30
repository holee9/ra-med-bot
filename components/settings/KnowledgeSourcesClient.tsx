'use client';

// @MX:NOTE [AUTO] KnowledgeSourcesClient — UI for managing git-backed knowledge sources.
// @MX:SPEC Issue #307 D-2 Phase 2 (Knowledge Sources Settings UI)
//
// Connects to D-2a API:
//   GET    /api/ra/knowledge-sources           (knowledgesources.view)
//   POST   /api/ra/knowledge-sources           (knowledgesources.manage)
//   DELETE /api/ra/knowledge-sources/[id]      (knowledgesources.manage)
//   POST   /api/ra/knowledge-sources/[id]/sync (knowledgesources.manage)
//
// auth_token is write-only: never fetched back, never displayed.
// Server is source of truth for git_url validation (parseGitUrl); client only
// does a basic required + URL-ish check to avoid a round-trip for obvious errors.

import { useCallback, useEffect, useState } from 'react';

type SyncStatus = 'idle' | 'syncing' | 'synced' | 'failed';

interface KnowledgeSource {
  id: string;
  gitUrl: string;
  branch: string;
  syncStatus: SyncStatus;
  lastSyncedAt: string | null;
  createdAt: string;
}

const STATUS_LABELS: Record<SyncStatus, string> = {
  idle: '대기 중',
  syncing: '동기화 중',
  synced: '동기화됨',
  failed: '실패',
};

const STATUS_BADGE_CLASS: Record<SyncStatus, string> = {
  idle: 'bg-ink-100 text-ink-700',
  syncing: 'bg-brand-100 text-brand-700',
  synced: 'bg-success-bg text-success',
  failed: 'bg-danger-bg text-danger',
};

function formatLastSynced(iso: string | null): string {
  if (!iso) return '미연동';
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '미연동';
  const diffMs = Date.now() - then;
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return '방금 전';
  if (minutes < 60) return `${minutes}분 전`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}시간 전`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}일 전`;
  // Fall back to absolute date for older entries.
  return new Date(iso).toLocaleDateString('ko-KR');
}

export function KnowledgeSourcesClient() {
  const [sources, setSources] = useState<KnowledgeSource[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [gitUrl, setGitUrl] = useState('');
  const [branch, setBranch] = useState('main');
  const [authToken, setAuthToken] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Per-row action state
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<KnowledgeSource | null>(null);

  // Status announcements for screen readers (aria-live).
  const [announcement, setAnnouncement] = useState<string | null>(null);

  const loadSources = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/ra/knowledge-sources', { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { sources: KnowledgeSource[] };
      setSources(data.sources ?? []);
    } catch {
      setError('지식베이스 목록을 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadSources();
  }, [loadSources]);

  async function handleCreate(event: React.FormEvent) {
    event.preventDefault();
    setFormError(null);

    // Basic client-side hint; server parseGitUrl is the source of truth.
    const trimmedUrl = gitUrl.trim();
    if (!trimmedUrl) {
      setFormError('Git 저장소 URL을 입력하세요.');
      return;
    }
    if (!/^https?:\/\//i.test(trimmedUrl)) {
      setFormError('URL은 https:// 로 시작해야 합니다.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/ra/knowledge-sources', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          git_url: trimmedUrl,
          branch: branch.trim() || 'main',
          auth_token: authToken.trim() || undefined,
        }),
      });
      if (res.status === 400) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        setFormError(
          body.error === 'invalid_git_url' ? '잘못된 Git URL 형식입니다.' : '입력을 확인해 주세요.',
        );
        return;
      }
      if (!res.ok) {
        setFormError('연결에 실패했습니다. 다시 시도해 주세요.');
        return;
      }
      setAnnouncement('지식베이스가 연결되었습니다.');
      setGitUrl('');
      setBranch('main');
      setAuthToken('');
      await loadSources();
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSync(source: KnowledgeSource) {
    setSyncingId(source.id);
    setAnnouncement('동기화를 시작합니다.');
    try {
      const res = await fetch(`/api/ra/knowledge-sources/${source.id}/sync`, {
        method: 'POST',
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        setAnnouncement(
          body.error === 'sync_failed'
            ? '동기화에 실패했습니다.'
            : '동기화 중 오류가 발생했습니다.',
        );
        return;
      }
      setAnnouncement('동기화가 완료되었습니다.');
      await loadSources();
    } finally {
      setSyncingId(null);
    }
  }

  async function handleConfirmDelete() {
    const source = pendingDelete;
    if (!source) return;
    setDeletingId(source.id);
    try {
      const res = await fetch(`/api/ra/knowledge-sources/${source.id}`, { method: 'DELETE' });
      if (!res.ok) {
        setAnnouncement('삭제에 실패했습니다.');
        return;
      }
      setAnnouncement('지식베이스 연결이 삭제되었습니다.');
      setPendingDelete(null);
      await loadSources();
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div data-testid="knowledge-sources-section">
      {/* Create form */}
      <form onSubmit={handleCreate} className="space-y-3" aria-label="지식베이스 연결 추가">
        <div className="space-y-1">
          <label htmlFor="ks-git-url" className="block text-sm font-medium text-ink-700">
            Git 저장소 URL
          </label>
          <input
            id="ks-git-url"
            type="text"
            inputMode="url"
            autoComplete="off"
            placeholder="https://github.com/owner/repo.git"
            value={gitUrl}
            onChange={(e) => setGitUrl(e.target.value)}
            disabled={submitting}
            className="w-full rounded-md border border-ink-150 bg-surface px-3 py-2 text-sm text-ink-900 placeholder:text-ink-400 focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
            data-testid="ks-git-url"
          />
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <label htmlFor="ks-branch" className="block text-sm font-medium text-ink-700">
              브랜치
            </label>
            <input
              id="ks-branch"
              type="text"
              autoComplete="off"
              placeholder="main"
              value={branch}
              onChange={(e) => setBranch(e.target.value)}
              disabled={submitting}
              className="w-full rounded-md border border-ink-150 bg-surface px-3 py-2 text-sm text-ink-900 placeholder:text-ink-400 focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
              data-testid="ks-branch"
            />
          </div>

          <div className="space-y-1">
            <label htmlFor="ks-auth-token" className="block text-sm font-medium text-ink-700">
              액세스 토큰(선택)
            </label>
            <input
              id="ks-auth-token"
              type="password"
              autoComplete="off"
              placeholder="비공개 저장소인 경우 입력"
              value={authToken}
              onChange={(e) => setAuthToken(e.target.value)}
              disabled={submitting}
              className="w-full rounded-md border border-ink-150 bg-surface px-3 py-2 text-sm text-ink-900 placeholder:text-ink-400 focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
              data-testid="ks-auth-token"
            />
          </div>
        </div>

        {formError && (
          <p role="alert" data-testid="ks-form-error" className="text-sm text-danger">
            {formError}
          </p>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="inline-flex items-center rounded-md bg-brand-800 px-4 py-2 text-sm font-medium text-surface shadow-sm hover:bg-brand-700 focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 motion-safe:transition-colors"
          data-testid="ks-submit"
        >
          {submitting ? '연결 중…' : '연결'}
        </button>
      </form>

      {/* Status announcements for assistive tech */}
      <div aria-live="polite" className="sr-only">
        {announcement}
      </div>

      {/* Existing sources list */}
      <div className="mt-6">
        <h3 className="font-serif text-base text-ink-900">연결된 저장소</h3>

        {loading && (
          <p data-testid="ks-loading" className="mt-2 py-4 text-sm text-ink-400">
            불러오는 중…
          </p>
        )}

        {error && !loading && (
          <p role="alert" data-testid="ks-load-error" className="mt-2 text-sm text-danger">
            {error}
          </p>
        )}

        {!loading && !error && sources.length === 0 && (
          <p data-testid="ks-empty" className="mt-2 py-4 text-sm text-ink-400">
            아직 연결된 저장소가 없습니다.
          </p>
        )}

        {sources.length > 0 && (
          <ul className="mt-3 space-y-2" data-testid="ks-list">
            {sources.map((source) => {
              const isSyncing = syncingId === source.id;
              const isDeleting = deletingId === source.id;
              const rowDisabled = isSyncing || isDeleting || submitting;
              return (
                <li
                  key={source.id}
                  className="flex flex-col gap-3 rounded-md border border-ink-150 bg-surface px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                  data-testid={`ks-row-${source.id}`}
                >
                  <div className="min-w-0 space-y-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate font-mono text-sm text-ink-900" title={source.gitUrl}>
                        {source.gitUrl}
                      </p>
                      <span
                        className={`inline-flex shrink-0 items-center rounded-xs px-2 py-0.5 text-xs font-medium ${STATUS_BADGE_CLASS[source.syncStatus]}`}
                        data-testid={`ks-status-${source.id}`}
                      >
                        {STATUS_LABELS[source.syncStatus]}
                      </span>
                    </div>
                    <p className="text-xs text-ink-500">
                      <span className="font-mono">{source.branch}</span>
                      <span className="mx-1">·</span>
                      <span>마지막 동기화: {formatLastSynced(source.lastSyncedAt)}</span>
                    </p>
                  </div>

                  <div className="flex shrink-0 gap-2">
                    <button
                      type="button"
                      onClick={() => void handleSync(source)}
                      disabled={rowDisabled}
                      className="inline-flex items-center rounded-md border border-ink-150 bg-surface px-3 py-1.5 text-xs font-medium text-ink-700 hover:bg-ink-50 focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 motion-safe:transition-colors"
                      aria-label={`${source.gitUrl} 다시 동기화`}
                      data-testid={`ks-sync-${source.id}`}
                    >
                      {isSyncing ? '동기화 중…' : '다시 동기화'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setPendingDelete(source)}
                      disabled={rowDisabled}
                      className="inline-flex items-center rounded-md border border-danger/30 bg-surface px-3 py-1.5 text-xs font-medium text-danger hover:bg-danger-bg focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 motion-safe:transition-colors"
                      aria-label={`${source.gitUrl} 삭제`}
                      data-testid={`ks-delete-${source.id}`}
                    >
                      {isDeleting ? '삭제 중…' : '삭제'}
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Delete confirmation dialog.
          Native <dialog> requires imperative showModal()/close() calls that
          conflict with React state-driven rendering; the ARIA modal pattern
          (role=dialog + aria-modal) is intentional here. */}
      {pendingDelete && (
        // biome-ignore lint/a11y/useSemanticElements: intentional ARIA modal pattern
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="ks-delete-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink-950/40 px-4"
          data-testid="ks-delete-dialog"
        >
          <div className="w-full max-w-sm rounded-lg border border-ink-150 bg-surface p-6 shadow-lg">
            <h3 id="ks-delete-title" className="font-serif text-lg text-ink-900">
              연결 삭제
            </h3>
            <p className="mt-2 text-sm text-ink-600">
              이 저장소의 연결을 삭제하시겠습니까? 이미 동기화된 지식은 유지됩니다.
            </p>
            <p className="mt-2 break-all font-mono text-xs text-ink-500">{pendingDelete.gitUrl}</p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setPendingDelete(null)}
                disabled={deletingId !== null}
                className="inline-flex items-center rounded-md border border-ink-150 bg-surface px-3 py-1.5 text-sm font-medium text-ink-700 hover:bg-ink-50 focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
                data-testid="ks-delete-cancel"
              >
                취소
              </button>
              <button
                type="button"
                onClick={() => void handleConfirmDelete()}
                disabled={deletingId !== null}
                className="inline-flex items-center rounded-md bg-danger px-3 py-1.5 text-sm font-medium text-surface hover:opacity-90 focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
                data-testid="ks-delete-confirm"
              >
                {deletingId !== null ? '삭제 중…' : '삭제'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
