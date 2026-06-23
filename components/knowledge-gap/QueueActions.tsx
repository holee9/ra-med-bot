'use client';

// @MX:NOTE [AUTO] Knowledge Gap queue actions — classify + replay client islands.
// @MX:SPEC SPEC-REGULA-KNOWLEDGE-GAP-001 (REQ-008, REQ-009, REQ-014, REQ-015, AC-04, AC-06, Issue #35)
//
// Role-gating is resolved SERVER-SIDE in the page (via hasRole) and passed down
// as `canClassify` / `canReplay` booleans. This keeps the permission check in a
// single trusted location and avoids a client session round-trip. The backend
// route re-checks with `withPermission`, so a tampered client cannot escalate.

import { useState } from 'react';

type Classification = 'ra_project_gap' | 'md_process_gap' | 'external_regulation_needed' | 'bug';

const CLASSIFICATION_LABELS: Record<Classification, string> = {
  ra_project_gap: 'RA 프로젝트 지식 누락',
  md_process_gap: 'MD-process SOP 누락',
  external_regulation_needed: '외부 규제 원문 필요',
  bug: '제품 버그',
};

interface QueueActionsProps {
  queueId: string;
  currentClassification: Classification | null;
  canClassify: boolean;
  canReplay: boolean;
  /** Called after a successful classify to bubble the new state up to the parent. */
  onClassified?: (queueId: string, next: Classification) => void;
  /** Called after a replay attempt with the pass/fail outcome. */
  onReplayResult?: (queueId: string, passed: boolean, summary?: string) => void;
}

type ClassifyState =
  | { kind: 'idle' }
  | { kind: 'submitting' }
  | { kind: 'success'; classification: Classification }
  | { kind: 'error'; message: string };

type ReplayState =
  | { kind: 'idle' }
  | { kind: 'running' }
  | { kind: 'done'; passed: boolean; summary?: string }
  | { kind: 'error'; message: string };

export function QueueActions({
  queueId,
  currentClassification,
  canClassify,
  canReplay,
  onClassified,
  onReplayResult,
}: QueueActionsProps) {
  const [classify, setClassify] = useState<ClassifyState>({ kind: 'idle' });
  const [replay, setReplay] = useState<ReplayState>({ kind: 'idle' });
  const [selected, setSelected] = useState<Classification | ''>(currentClassification ?? '');
  const [note, setNote] = useState('');

  async function submitClassify(e: React.FormEvent) {
    e.preventDefault();
    if (!selected) return;
    const classification = selected as Classification;
    setClassify({ kind: 'submitting' });
    try {
      const res = await fetch('/api/knowledge-gap/classify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ queueId, classification, note: note || undefined }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      setClassify({ kind: 'success', classification });
      onClassified?.(queueId, classification);
    } catch (err) {
      setClassify({
        kind: 'error',
        message: err instanceof Error ? err.message : '분류에 실패했습니다.',
      });
    }
  }

  async function runReplay() {
    setReplay({ kind: 'running' });
    try {
      const res = await fetch(`/api/knowledge-gap/replay/${queueId}`, {
        method: 'POST',
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      const body = (await res.json()) as {
        passed: boolean;
        reasonSummary?: string;
        remainingReason?: string;
      };
      const passed = body.passed === true;
      setReplay({
        kind: 'done',
        passed,
        summary: body.reasonSummary ?? body.remainingReason,
      });
      onReplayResult?.(queueId, passed, body.reasonSummary ?? body.remainingReason);
    } catch (err) {
      setReplay({
        kind: 'error',
        message: err instanceof Error ? err.message : '재실행에 실패했습니다.',
      });
    }
  }

  // Replay is only meaningful when there is a gap still open/failed.
  return (
    <div className="flex flex-col gap-3">
      {canClassify ? (
        <form onSubmit={submitClassify} className="flex flex-col gap-2" aria-label="미답변 분류">
          <label className="flex flex-col gap-1 text-xs text-ink-600">
            분류
            <select
              value={selected}
              onChange={(e) => setSelected(e.target.value as Classification | '')}
              className="rounded border border-ink-150 bg-surface px-2 py-1 text-sm focus:border-brand-500 focus:outline-none"
              aria-label="분류 카테고리"
            >
              <option value="">선택하세요</option>
              {(Object.keys(CLASSIFICATION_LABELS) as Classification[]).map((c) => (
                <option key={c} value={c}>
                  {CLASSIFICATION_LABELS[c]}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs text-ink-600">
            메모 (선택)
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              maxLength={2000}
              className="rounded border border-ink-150 bg-surface px-2 py-1 text-sm focus:border-brand-500 focus:outline-none"
              aria-label="분류 메모"
            />
          </label>
          <button
            type="submit"
            disabled={classify.kind === 'submitting' || !selected}
            className="self-start rounded bg-brand-700 px-3 py-1 text-xs text-white hover:bg-brand-800 disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2"
          >
            {classify.kind === 'submitting' ? '저장 중…' : '분류 저장'}
          </button>
          {classify.kind === 'success' && (
            <output className="text-xs text-success" data-testid="classify-success">
              분류 완료: {CLASSIFICATION_LABELS[classify.classification]} (audit 기록됨)
            </output>
          )}
          {classify.kind === 'error' && (
            <p className="text-xs text-danger" role="alert">
              {classify.message}
            </p>
          )}
        </form>
      ) : (
        <p className="text-xs text-ink-400" data-testid="classify-disabled">
          분류 권한이 없습니다.
        </p>
      )}

      {canReplay && (
        <div className="flex flex-col gap-1">
          <button
            type="button"
            onClick={runReplay}
            disabled={replay.kind === 'running'}
            className="self-start rounded border border-brand-200 bg-brand-50 px-3 py-1 text-xs font-medium text-brand-700 hover:bg-brand-100 disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2"
            aria-label="재실행"
          >
            {replay.kind === 'running' ? '재실행 중…' : '재실행'}
          </button>
          {replay.kind === 'done' && (
            <output
              className={`text-xs ${replay.passed ? 'text-success' : 'text-amber-600'}`}
              data-testid="replay-result"
            >
              {replay.passed
                ? '통과 — resolved 처리됨'
                : `미통과${replay.summary ? `: ${replay.summary}` : ''}`}
            </output>
          )}
          {replay.kind === 'error' && (
            <p className="text-xs text-danger" role="alert">
              {replay.message}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
