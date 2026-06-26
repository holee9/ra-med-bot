'use client';

// @MX:NOTE [AUTO] ProjectMemoryClient — project-scoped RA decision memory island.
// @MX:SPEC SPEC-REGULA-PROJECT-MEMORY-001 (REQ-005, REQ-006, REQ-007/008/009, REQ-012, REQ-013, REQ-014, AC-04)
// @MX:REASON Charter [지양-4]: pending AI suggestions NEVER auto-apply. Each
//   suggestion is rendered with a clear "검토 필요" state and an explicit
//   per-item Approve button (NO bulk approve). RA Lead only (projectmemory.manage).
//   The backend re-checks via withPermission, so a spoofed canManage prop only
//   yields 403s. viewerRole is resolved server-side and passed as a boolean —
//   this island never touches credentials. Matches promote-button (#50) RBAC
//   pattern. REQ-013 provenance: each memory with sourceConversationId renders
//   a traceable link back to the originating conversation.

import { AlertTriangle, Check, Pencil, Plus, Trash2, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

// --- Types (mirror backend shapes from lib/project-memory/manager.ts) ---

type MemoryType =
  | 'device_classification'
  | 'target_markets'
  | 'submission_strategy'
  | 'predicate_device'
  | 'risk_class'
  | 'custom';

interface ActiveMemory {
  id: string;
  memoryType: MemoryType;
  key: string;
  value: string;
  createdAt: string;
}

interface PendingSuggestion {
  id: string;
  memoryType: MemoryType;
  key: string;
  value: string;
  sourceConversationId: string | null;
  createdAt: string;
}

export interface ProjectMemoryClientProps {
  /** Project UUID from the route. */
  projectId: string;
  /**
   * Viewer role resolved server-side (auth() + rbac.hasRole). Used purely to
   * decide UI affordances — never sent to the client as a credential. The
   * backend re-checks every mutation via withPermission('projectmemory.manage').
   */
  viewerRole?: string;
}

const MANAGE_ROLES = new Set(['ra-lead', 'admin']);

const MEMORY_TYPE_LABELS: Record<MemoryType, string> = {
  device_classification: '디바이스 분류',
  target_markets: '목표 시장',
  submission_strategy: '제출 전략',
  predicate_device: 'Predicate Device',
  risk_class: '위험 등급',
  custom: '기타',
};

const ALL_MEMORY_TYPES = Object.keys(MEMORY_TYPE_LABELS) as MemoryType[];

type UiState = 'idle' | 'submitting' | 'error';

interface DialogState {
  open: boolean;
  mode: 'create' | 'edit';
  memoryId?: string;
  memoryType: MemoryType;
  key: string;
  value: string;
  error?: string;
}

const INITIAL_DIALOG: DialogState = {
  open: false,
  mode: 'create',
  memoryType: 'device_classification',
  key: '',
  value: '',
};

export default function ProjectMemoryClient({ projectId, viewerRole }: ProjectMemoryClientProps) {
  const canManage = !!viewerRole && MANAGE_ROLES.has(viewerRole);

  const [memories, setMemories] = useState<ActiveMemory[]>([]);
  const [suggestions, setSuggestions] = useState<PendingSuggestion[]>([]);
  const [activeFilter, setActiveFilter] = useState<MemoryType | 'all'>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dialog, setDialog] = useState<DialogState>(INITIAL_DIALOG);
  const [uiState, setUiState] = useState<UiState>('idle');
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const firstFocusRef = useRef<HTMLInputElement>(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [activeRes, pendingRes] = await Promise.all([
        fetch(`/api/project-memory?projectId=${projectId}`, { cache: 'no-store' }),
        fetch(`/api/project-memory/suggest?projectId=${projectId}`, { cache: 'no-store' }),
      ]);
      if (!activeRes.ok) throw new Error('활성 메모리를 불러오지 못했습니다.');
      const activeBody = (await activeRes.json()) as { memories?: ActiveMemory[] };
      const pendingBody = pendingRes.ok
        ? ((await pendingRes.json()) as { suggestions?: PendingSuggestion[] })
        : { suggestions: [] };
      setMemories(activeBody.memories ?? []);
      setSuggestions(pendingBody.suggestions ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : '메모리를 불러오지 못했습니다.');
      setMemories([]);
      setSuggestions([]);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    void fetchAll();
  }, [fetchAll]);

  // Focus trap inside the create/edit dialog (a11y, matches promote-button).
  useEffect(() => {
    if (!dialog.open) return;
    firstFocusRef.current?.focus();
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setDialog((d) => ({ ...d, open: false }));
        return;
      }
      if (e.key !== 'Tab' || !dialogRef.current) return;
      const focusables = dialogRef.current.querySelectorAll<HTMLElement>(
        'select:not([disabled]), input:not([disabled]), textarea:not([disabled]), button:not([disabled])',
      );
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (!first || !last) return;
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [dialog.open]);

  const filteredMemories = useMemo(() => {
    if (activeFilter === 'all') return memories;
    return memories.filter((m) => m.memoryType === activeFilter);
  }, [memories, activeFilter]);

  const grouped = useMemo(() => {
    const map = new Map<MemoryType, ActiveMemory[]>();
    for (const m of filteredMemories) {
      const arr = map.get(m.memoryType) ?? [];
      arr.push(m);
      map.set(m.memoryType, arr);
    }
    return ALL_MEMORY_TYPES.filter((t) => map.has(t)).map((t) => ({
      type: t,
      // map.has(t) guarantees the value exists; `?? []` keeps the type happy
      // without a non-null assertion.
      items: map.get(t) ?? [],
    }));
  }, [filteredMemories]);

  function openCreate() {
    setDialog({ ...INITIAL_DIALOG, open: true, mode: 'create' });
    setUiState('idle');
  }

  function openEdit(mem: ActiveMemory) {
    setDialog({
      open: true,
      mode: 'edit',
      memoryId: mem.id,
      memoryType: mem.memoryType,
      key: mem.key,
      value: mem.value,
    });
    setUiState('idle');
  }

  function closeDialog() {
    setDialog((d) => ({ ...d, open: false }));
    setUiState('idle');
  }

  async function handleDialogSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!dialog.key.trim() || !dialog.value.trim()) {
      setUiState('error');
      setDialog((d) => ({ ...d, error: '키와 값을 모두 입력해 주세요.' }));
      return;
    }
    setUiState('submitting');
    try {
      if (dialog.mode === 'create') {
        const res = await fetch('/api/project-memory', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            projectId,
            memoryType: dialog.memoryType,
            key: dialog.key.trim(),
            value: dialog.value.trim(),
          }),
        });
        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(
            res.status === 403
              ? '생성 권한이 없습니다. RA Lead 이상만 가능합니다.'
              : (body.error ?? `HTTP ${res.status}`),
          );
        }
      } else {
        const res = await fetch(`/api/project-memory/${dialog.memoryId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            memoryType: dialog.memoryType,
            key: dialog.key.trim(),
            value: dialog.value.trim(),
          }),
        });
        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(
            res.status === 403 ? '수정 권한이 없습니다.' : (body.error ?? `HTTP ${res.status}`),
          );
        }
      }
      setDialog((d) => ({ ...d, open: false }));
      setUiState('idle');
      await fetchAll();
    } catch (err) {
      setUiState('error');
      setDialog((d) => ({
        ...d,
        error: err instanceof Error ? err.message : '저장에 실패했습니다.',
      }));
    }
  }

  async function handleInvalidate(mem: ActiveMemory) {
    if (!window.confirm(`"${mem.key}" 메모리를 무효화하시겠습니까?`)) return;
    try {
      const res = await fetch(`/api/project-memory/${mem.id}`, { method: 'DELETE' });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      await fetchAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : '무효화에 실패했습니다.');
    }
  }

  async function handleApprove(sug: PendingSuggestion) {
    setApprovingId(sug.id);
    try {
      const res = await fetch('/api/project-memory/suggest/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ memoryId: sug.id }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(
          res.status === 403
            ? '승인 권한이 없습니다. RA Lead 이상만 가능합니다.'
            : (body.error ?? `HTTP ${res.status}`),
        );
      }
      await fetchAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : '승인에 실패했습니다.');
    } finally {
      setApprovingId(null);
    }
  }

  return (
    <section className="mx-auto flex max-w-content flex-col gap-6 px-6 py-8">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-serif text-3xl text-brand-800">프로젝트 메모리</h1>
          <p className="mt-2 text-sm text-ink-600">
            이 프로젝트의 의사결정 컨텍스트를 저장하여 향후 상담 시 자동으로 반영합니다. AI가 감지한
            의사결정은 RA Lead의 승인 후에만 활성화됩니다.
          </p>
        </div>
        {canManage && (
          <button
            type="button"
            data-testid="memory-create-open"
            onClick={openCreate}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-xs bg-brand-800 px-3 py-2 text-sm font-medium text-white transition-colors motion-safe:duration-200 hover:bg-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2"
          >
            <Plus size={14} aria-hidden="true" />
            <span>새 메모리</span>
          </button>
        )}
      </header>

      {error && (
        <p
          role="alert"
          className="flex items-start gap-1.5 rounded-md bg-danger-bg px-3 py-2 text-sm text-danger"
        >
          <AlertTriangle size={14} className="mt-0.5 shrink-0" aria-hidden="true" />
          <span>{error}</span>
        </p>
      )}

      {/* Pending AI suggestions — Charter [지양-4] / REQ-005 / REQ-014.
          Always visible (read-only review queue); Approve gated to ra-lead. */}
      {suggestions.length > 0 && (
        <section
          data-testid="pending-section"
          aria-labelledby="pending-heading"
          className="rounded-lg border border-amber-400/40 bg-amber-50 p-4"
        >
          <div className="flex items-center gap-2">
            <h2 id="pending-heading" className="font-serif text-lg text-brand-800">
              AI 제안 (검토 대기)
            </h2>
            <span
              data-testid="pending-review-required"
              className="inline-flex items-center gap-1 rounded-full bg-amber-500 px-2 py-0.5 text-[11px] font-medium text-white"
            >
              <AlertTriangle size={10} aria-hidden="true" />
              검토 필요
            </span>
          </div>
          <p className="mt-1 text-xs text-amber-700">
            AI가 대화에서 감지한 의사결정입니다. 자동 반영되지 않습니다 — 각 항목을 검토한 후 승인해
            주세요.
          </p>
          <ul className="mt-3 flex flex-col gap-2" aria-label="AI 제안 목록">
            {suggestions.map((sug) => (
              <li
                key={sug.id}
                data-testid="pending-card"
                className="rounded-md border border-amber-200 bg-surface p-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-xs bg-ink-50 px-2 py-0.5 text-[11px] text-ink-600">
                        {MEMORY_TYPE_LABELS[sug.memoryType]}
                      </span>
                      <span className="text-sm font-medium text-ink-900">{sug.key}</span>
                    </div>
                    <p className="mt-1 whitespace-pre-wrap break-words text-sm text-ink-700">
                      {sug.value}
                    </p>
                    {sug.sourceConversationId && (
                      <p className="mt-1 text-xs text-ink-500">
                        출처:{' '}
                        <a
                          href={`/chat?conversation=${encodeURIComponent(sug.sourceConversationId)}`}
                          data-testid="pending-source-link"
                          className="text-brand-700 underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2"
                        >
                          대화 {sug.sourceConversationId.slice(0, 8)}…
                        </a>
                      </p>
                    )}
                  </div>
                  {canManage && (
                    <button
                      type="button"
                      data-testid="pending-approve"
                      onClick={() => void handleApprove(sug)}
                      disabled={approvingId === sug.id}
                      className="inline-flex shrink-0 items-center gap-1 rounded-xs bg-success px-3 py-1.5 text-xs font-medium text-white transition-colors motion-safe:duration-200 hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-success focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <Check size={12} aria-hidden="true" />
                      {approvingId === sug.id ? '승인 중…' : '승인'}
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* memoryType filter chips */}
      {memories.length > 0 && (
        <div className="flex flex-wrap gap-2" aria-label="메모리 유형 필터">
          <button
            type="button"
            data-testid="filter-all"
            onClick={() => setActiveFilter('all')}
            className={`rounded-full px-3 py-1 text-xs ${
              activeFilter === 'all'
                ? 'bg-brand-800 text-white'
                : 'border border-ink-150 text-ink-600 hover:bg-ink-50'
            }`}
          >
            전체
          </button>
          {ALL_MEMORY_TYPES.filter((t) => memories.some((m) => m.memoryType === t)).map((t) => (
            <button
              key={t}
              type="button"
              data-testid={`filter-${t}`}
              onClick={() => setActiveFilter(t)}
              className={`rounded-full px-3 py-1 text-xs ${
                activeFilter === t
                  ? 'bg-brand-800 text-white'
                  : 'border border-ink-150 text-ink-600 hover:bg-ink-50'
              }`}
            >
              {MEMORY_TYPE_LABELS[t]}
            </button>
          ))}
        </div>
      )}

      {loading && <p className="text-sm text-ink-500">불러오는 중…</p>}
      {!loading && memories.length === 0 && (
        <p
          data-testid="memory-empty"
          className="rounded-lg border border-ink-150 bg-surface p-4 text-sm text-ink-500"
        >
          저장된 메모리가 없습니다. RA Lead 이상이 새 메모리를 추가하거나, 상담을 통해 AI가
          의사결정을 감지하면 여기에 제안으로 표시됩니다.
        </p>
      )}

      {/* Active memories grouped by memoryType */}
      <div className="flex flex-col gap-4">
        {grouped.map((group) => (
          <section key={group.type} aria-labelledby={`group-${group.type}`}>
            <h2 id={`group-${group.type}`} className="mb-2 font-serif text-lg text-brand-800">
              {MEMORY_TYPE_LABELS[group.type]}
            </h2>
            <ul
              className="flex flex-col gap-2"
              aria-label={`${MEMORY_TYPE_LABELS[group.type]} 메모리`}
            >
              {group.items.map((mem) => (
                <li key={mem.id}>
                  <article
                    data-testid="memory-card"
                    className="rounded-lg border border-ink-150 bg-surface p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-medium text-ink-900">{mem.key}</span>
                          <span className="rounded-xs bg-ink-50 px-2 py-0.5 text-[11px] text-ink-500">
                            {MEMORY_TYPE_LABELS[mem.memoryType]}
                          </span>
                        </div>
                        <p className="mt-1 whitespace-pre-wrap break-words text-sm text-ink-700">
                          {mem.value}
                        </p>
                        <p className="mt-1 text-xs text-ink-400">
                          생성 {new Date(mem.createdAt).toLocaleDateString('ko-KR')}
                        </p>
                      </div>
                      {canManage && (
                        <div className="flex shrink-0 gap-1">
                          <button
                            type="button"
                            data-testid="memory-edit"
                            aria-label={`${mem.key} 수정`}
                            onClick={() => openEdit(mem)}
                            className="inline-flex items-center gap-1 rounded-xs border border-ink-200 bg-white px-2 py-1 text-xs text-ink-600 hover:bg-ink-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2"
                          >
                            <Pencil size={11} aria-hidden="true" />
                            수정
                          </button>
                          <button
                            type="button"
                            data-testid="memory-invalidate"
                            aria-label={`${mem.key} 무효화`}
                            onClick={() => void handleInvalidate(mem)}
                            className="inline-flex items-center gap-1 rounded-xs border border-ink-200 bg-white px-2 py-1 text-xs text-ink-600 hover:bg-ink-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2"
                          >
                            <Trash2 size={11} aria-hidden="true" />
                            무효화
                          </button>
                        </div>
                      )}
                    </div>
                  </article>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>

      {/* Create / Edit dialog */}
      {dialog.open && (
        <div
          data-testid="memory-dialog-overlay"
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/40 p-4"
        >
          <div
            ref={dialogRef}
            // biome-ignore lint/a11y/useSemanticElements: <dialog> open/close API conflicts with React controlled state; div+role="dialog" is used intentionally (mirrors promote-button pattern).
            role="dialog"
            aria-modal="true"
            aria-labelledby="memory-dialog-title"
            data-testid="memory-dialog"
            className="relative w-full max-w-lg rounded-lg border border-ink-150 bg-surface px-5 py-4 shadow-lg"
          >
            <button
              type="button"
              aria-label="닫기"
              onClick={closeDialog}
              className="absolute right-3 top-3 rounded-xs p-1 text-ink-400 hover:text-ink-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2"
            >
              <X size={16} aria-hidden="true" />
            </button>
            <h2 id="memory-dialog-title" className="font-serif text-lg text-brand-800">
              {dialog.mode === 'create' ? '새 메모리 추가' : '메모리 수정'}
            </h2>
            {dialog.mode === 'edit' && (
              <p className="mt-1 text-xs text-ink-500">
                수정 시 기존 메모리는 무효화되고 새로운 메모리로 대체됩니다 (이력 보존).
              </p>
            )}
            <form
              onSubmit={(e) => void handleDialogSubmit(e)}
              className="mt-4 flex flex-col gap-3"
              aria-label="메모리 정보 입력"
            >
              <label className="flex flex-col gap-1">
                <span className="text-xs font-medium text-ink-700">유형 *</span>
                <select
                  value={dialog.memoryType}
                  onChange={(e) =>
                    setDialog((d) => ({ ...d, memoryType: e.target.value as MemoryType }))
                  }
                  data-testid="memory-type"
                  disabled={uiState === 'submitting'}
                  className="rounded-xs border border-ink-200 bg-white px-2.5 py-1.5 text-sm text-ink-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 disabled:opacity-60"
                >
                  {ALL_MEMORY_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {MEMORY_TYPE_LABELS[t]}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs font-medium text-ink-700">키 *</span>
                <input
                  ref={firstFocusRef}
                  type="text"
                  value={dialog.key}
                  onChange={(e) => setDialog((d) => ({ ...d, key: e.target.value }))}
                  maxLength={200}
                  required
                  data-testid="memory-key"
                  disabled={uiState === 'submitting'}
                  className="rounded-xs border border-ink-200 bg-white px-2.5 py-1.5 text-sm text-ink-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 disabled:opacity-60"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs font-medium text-ink-700">값 *</span>
                <textarea
                  value={dialog.value}
                  onChange={(e) => setDialog((d) => ({ ...d, value: e.target.value }))}
                  maxLength={2000}
                  required
                  rows={3}
                  data-testid="memory-value"
                  disabled={uiState === 'submitting'}
                  className="rounded-xs border border-ink-200 bg-white px-2.5 py-1.5 text-sm text-ink-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 disabled:opacity-60"
                />
              </label>
              {uiState === 'error' && dialog.error && (
                <p role="alert" className="flex items-start gap-1.5 text-xs text-danger">
                  <AlertTriangle size={12} className="mt-0.5 shrink-0" aria-hidden="true" />
                  <span>{dialog.error}</span>
                </p>
              )}
              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={closeDialog}
                  disabled={uiState === 'submitting'}
                  className="rounded-xs border border-ink-200 bg-white px-3 py-1.5 text-xs font-medium text-ink-600 hover:bg-ink-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 disabled:opacity-60"
                >
                  취소
                </button>
                <button
                  type="submit"
                  data-testid="memory-submit"
                  disabled={uiState === 'submitting'}
                  className="rounded-xs bg-brand-800 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {uiState === 'submitting' ? '저장 중…' : '저장'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
}
