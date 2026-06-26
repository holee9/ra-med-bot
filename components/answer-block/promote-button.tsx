'use client';

// @MX:NOTE [AUTO] PromoteButton — role-gated answer-promotion island.
// @MX:SPEC SPEC-REGULA-KNOWLEDGE-PROMO-001 (REQ-004, REQ-005, REQ-007, REQ-011, AC-02, AC-03)
// @MX:REASON Charter [지양-4] no auto-finalize — only ra-lead/admin see the
//           button. Non-authorized roles render nothing (no disabled affordance
//           leaking the action). The backend re-checks via withPermission, so a
//           spoofed prop only produces a 403. The source-message provenance link
//           (REQ-011) is surfaced in the promote dialog and in the library list.

import { AlertTriangle, BookmarkCheck, BookmarkPlus, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

/**
 * Roles permitted to promote. The backend PermissionAction is
 * `knowledgepromo.promote` (minRole: 'ra-lead'). Admin inherits via the role
 * hierarchy. Viewer role is passed from the server-rendered AnswerBlock parent
 * (resolved from auth() in the route), so this client island never touches
 * credentials.
 */
const PROMOTE_ROLES = new Set(['ra-lead', 'admin']);

interface PromoteButtonProps {
  messageId: string;
  /** Viewer role resolved server-side at the AnswerBlock parent. */
  viewerRole?: string;
  /**
   * If the backend already has a promoted_answer for this message, pass its id
   * so the button renders the "승격됨 / 취소" state. Fetched by the parent via
   * /api/knowledge-promo/library?messageId=… or via the page-level lookup.
   */
  promotedId?: string;
  /** Source-message href for the provenance link (REQ-011). Optional. */
  sourceHref?: string;
}

type UiState =
  | { kind: 'idle' }
  | { kind: 'promoting' }
  | { kind: 'unpromoting' }
  | { kind: 'error'; message: string };

export function PromoteButton({
  messageId,
  viewerRole,
  promotedId,
  sourceHref,
}: PromoteButtonProps) {
  const canPromote = !!viewerRole && PROMOTE_ROLES.has(viewerRole);
  const [activePromotedId, setActivePromotedId] = useState<string | null>(promotedId ?? null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [tagInput, setTagInput] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [state, setState] = useState<UiState>({ kind: 'idle' });
  const dialogRef = useRef<HTMLDivElement>(null);
  const firstFocusRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setActivePromotedId(promotedId ?? null);
  }, [promotedId]);

  // REQ-011 / Charter [지양-2]: basic focus trap inside the dialog.
  useEffect(() => {
    if (!dialogOpen) return;
    firstFocusRef.current?.focus();
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setDialogOpen(false);
        return;
      }
      if (e.key !== 'Tab' || !dialogRef.current) return;
      const focusables = dialogRef.current.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled])',
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
  }, [dialogOpen]);

  // Charter [지양-4]: unauthorized users see nothing. No disabled button that
  // would leak the action's existence.
  if (!canPromote) return null;

  function resetForm() {
    setTitle('');
    setTagInput('');
    setTags([]);
    if (state.kind === 'error') setState({ kind: 'idle' });
  }

  function closeDialog() {
    setDialogOpen(false);
    resetForm();
  }

  function addTagFromInput() {
    const t = tagInput.trim();
    if (!t) return;
    if (tags.includes(t)) {
      setTagInput('');
      return;
    }
    if (tags.length >= 20) {
      setState({ kind: 'error', message: '태그는 최대 20개까지 입력할 수 있습니다.' });
      return;
    }
    setTags((prev) => [...prev, t]);
    setTagInput('');
    if (state.kind === 'error') setState({ kind: 'idle' });
  }

  async function handlePromote(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!title.trim()) {
      setState({ kind: 'error', message: '제목을 입력해 주세요.' });
      return;
    }
    setState({ kind: 'promoting' });
    try {
      const res = await fetch('/api/knowledge-promo/promote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messageId,
          title: title.trim(),
          tags,
          scope: 'message',
        }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        if (res.status === 403) {
          throw new Error('승격 권한이 없습니다. RA Lead 이상만 가능합니다.');
        }
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      const body = (await res.json()) as { promotedId?: string; id?: string };
      const newId = body.promotedId ?? body.id ?? null;
      setActivePromotedId(newId);
      setDialogOpen(false);
      resetForm();
      setState({ kind: 'idle' });
    } catch (err) {
      setState({
        kind: 'error',
        message: err instanceof Error ? err.message : '승격에 실패했습니다.',
      });
    }
  }

  async function handleUnpromote() {
    if (!activePromotedId) return;
    setState({ kind: 'unpromoting' });
    try {
      const res = await fetch(`/api/knowledge-promo/promote/${activePromotedId}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        if (res.status === 403) {
          throw new Error('승격 취소 권한이 없습니다.');
        }
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      setActivePromotedId(null);
      setState({ kind: 'idle' });
    } catch (err) {
      setState({
        kind: 'error',
        message: err instanceof Error ? err.message : '승격 취소에 실패했습니다.',
      });
    }
  }

  if (activePromotedId) {
    return (
      <section
        data-testid="promote-button"
        aria-label="답변 승격 상태"
        className="mt-2 flex flex-wrap items-center gap-2 rounded-md border border-success/30 bg-success-bg/50 px-3 py-1.5"
      >
        <BookmarkCheck size={14} className="text-success" aria-hidden="true" />
        <span className="text-xs font-medium text-success">팀 지식으로 승격됨</span>
        {sourceHref && (
          <a
            href={sourceHref}
            data-testid="promote-source-link"
            className="text-xs text-brand-700 underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2"
          >
            원본 답변 보기
          </a>
        )}
        <button
          type="button"
          data-testid="promote-unpromote"
          onClick={() => void handleUnpromote()}
          disabled={state.kind === 'unpromoting'}
          className="ml-auto rounded-xs border border-ink-200 bg-white px-2 py-0.5 text-xs text-ink-600 hover:bg-ink-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {state.kind === 'unpromoting' ? '취소 중…' : '승격 취소'}
        </button>
        {state.kind === 'error' && (
          <p data-testid="promote-error" className="basis-full text-xs text-danger">
            {state.message}
          </p>
        )}
      </section>
    );
  }

  return (
    <section data-testid="promote-button" aria-label="답변 승격" className="mt-1">
      <button
        type="button"
        data-testid="promote-open"
        aria-haspopup="dialog"
        aria-expanded={dialogOpen}
        onClick={() => {
          setDialogOpen(true);
          setState({ kind: 'idle' });
        }}
        className="inline-flex items-center gap-1.5 rounded-xs border border-ink-200 bg-white px-2.5 py-1 text-xs font-medium text-ink-600 transition-colors motion-safe:duration-200 hover:bg-ink-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2"
      >
        <BookmarkPlus size={14} aria-hidden="true" />
        <span>팀 지식으로 승격</span>
      </button>

      {dialogOpen && (
        <div
          data-testid="promote-dialog-overlay"
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/40 p-4"
        >
          <div
            ref={dialogRef}
            // biome-ignore lint/a11y/useSemanticElements: <dialog> open/close API conflicts with React controlled state; div+role="dialog" is used intentionally (mirrors DocViewer pattern).
            role="dialog"
            aria-modal="true"
            aria-labelledby="promote-dialog-title"
            data-testid="promote-dialog"
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
            <h2 id="promote-dialog-title" className="font-serif text-lg text-brand-800">
              팀 지식으로 승격
            </h2>
            <p className="mt-1 text-xs text-ink-500">
              이 답변을 조직 공유 지식으로 승격합니다. 승격된 답변은 향후 유사 질문의 답변 생성 시
              우선 출처로 사용됩니다.
            </p>

            {sourceHref && (
              <p className="mt-2 text-xs text-ink-500">
                원본:{' '}
                <a
                  href={sourceHref}
                  data-testid="promote-source-link"
                  className="text-brand-700 underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2"
                >
                  메시지 {messageId.slice(0, 8)}…
                </a>
              </p>
            )}

            <form
              onSubmit={(e) => void handlePromote(e)}
              className="mt-4 flex flex-col gap-3"
              aria-label="승격 정보 입력"
            >
              <label className="flex flex-col gap-1">
                <span className="text-xs font-medium text-ink-700">제목 *</span>
                <input
                  ref={firstFocusRef}
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  maxLength={500}
                  required
                  aria-required="true"
                  data-testid="promote-title"
                  disabled={state.kind === 'promoting'}
                  className="rounded-xs border border-ink-200 bg-white px-2.5 py-1.5 text-sm text-ink-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 disabled:opacity-60"
                  placeholder="예: 510(k) 제출 체크리스트"
                />
              </label>

              <fieldset className="flex flex-col gap-1.5" aria-label="태그">
                <legend className="text-xs font-medium text-ink-700">태그 (최대 20개)</legend>
                {tags.length > 0 && (
                  <ul className="flex flex-wrap gap-1.5" aria-label="선택된 태그">
                    {tags.map((tag) => (
                      <li key={tag}>
                        <button
                          type="button"
                          data-testid={`promote-tag-${tag}`}
                          aria-pressed={true}
                          aria-label={`태그 ${tag} 제거`}
                          onClick={() => setTags((prev) => prev.filter((t) => t !== tag))}
                          className="inline-flex items-center gap-1 rounded-xs border border-brand-500 bg-brand-100 px-2 py-0.5 text-xs text-brand-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2"
                        >
                          {tag}
                          <X size={10} aria-hidden="true" />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                <div className="flex items-center gap-1.5">
                  <input
                    type="text"
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        addTagFromInput();
                      }
                    }}
                    maxLength={50}
                    data-testid="promote-tag-input"
                    disabled={state.kind === 'promoting'}
                    aria-label="태그 입력"
                    className="flex-1 rounded-xs border border-ink-200 bg-white px-2.5 py-1.5 text-sm text-ink-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 disabled:opacity-60"
                    placeholder="태그 입력 후 Enter"
                  />
                  <button
                    type="button"
                    data-testid="promote-tag-add"
                    onClick={addTagFromInput}
                    disabled={state.kind === 'promoting'}
                    className="rounded-xs border border-ink-200 bg-white px-2 py-1.5 text-xs text-ink-600 hover:bg-ink-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 disabled:opacity-60"
                  >
                    추가
                  </button>
                </div>
              </fieldset>

              {state.kind === 'error' && (
                <p
                  data-testid="promote-error"
                  role="alert"
                  className="flex items-start gap-1.5 text-xs text-danger"
                >
                  <AlertTriangle size={12} className="mt-0.5 shrink-0" aria-hidden="true" />
                  <span>{state.message}</span>
                </p>
              )}

              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={closeDialog}
                  disabled={state.kind === 'promoting'}
                  className="rounded-xs border border-ink-200 bg-white px-3 py-1.5 text-xs font-medium text-ink-600 hover:bg-ink-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 disabled:opacity-60"
                >
                  취소
                </button>
                <button
                  type="submit"
                  data-testid="promote-submit"
                  disabled={state.kind === 'promoting' || !title.trim()}
                  className="rounded-xs bg-brand-800 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {state.kind === 'promoting' ? '승격 중…' : '승격'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
}
