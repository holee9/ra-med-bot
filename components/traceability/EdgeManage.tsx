'use client';

// @MX:NOTE [AUTO] Edge manage controls — create/delete evidence graph edges.
// @MX:SPEC SPEC-REGULA-TRACEABILITY-001 (REQ-TRACEABILITY-001, REQ-003, REQ-010)
//
// RBAC (REQ-010): edge writes require `traceability.manage` (ra-lead only).
// When `canManage` is false the whole control is NOT rendered — per the user's
// directive we never show a button that 403s on click. The RSC page resolves
// the role server-side and passes `canManage` down.

import { EDGE_RELATIONS, type EdgeRelation, writeEdge } from '@/lib/traceability/client';
import { useState } from 'react';

interface EdgeManageProps {
  /** Node the edge originates from (the deliverable). */
  fromNodeId: string;
  /** Whether the current user can manage edges (ra-lead only). Defaults to false. */
  canManage?: boolean;
  /** Optional callback after a successful mutation (lets the page revalidate). */
  onChanged?: () => void;
}

type State =
  | { kind: 'idle' }
  | { kind: 'submitting' }
  | { kind: 'success'; message: string }
  | { kind: 'error'; message: string };

/**
 * Compact inline form for linking the deliverable to another evidence node.
 * The `toNodeId` is a free-text UUID input — operators copy it from the packet
 * view or the matrix. A production enhance could add a typeahead picker, but
 * that is out of scope for REQ-001..003 (no speculative features).
 */
export function EdgeManage({ fromNodeId, canManage, onChanged }: EdgeManageProps) {
  const [toNodeId, setToNodeId] = useState('');
  const [relation, setRelation] = useState<EdgeRelation>('derived_from');
  const [state, setState] = useState<State>({ kind: 'idle' });

  // REQ-010 + user directive: hide entirely for non-ra-lead. No disabled button
  // that 403s on click.
  if (!canManage) return null;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!toNodeId.trim()) return;
    setState({ kind: 'submitting' });
    try {
      const res = await writeEdge({
        fromNodeId,
        toNodeId: toNodeId.trim(),
        relation,
        action: 'create',
      });
      setState({
        kind: 'success',
        message: res.created
          ? '근거 연결이 생성되었습니다 (audit 기록됨).'
          : '이미 존재하는 연결입니다.',
      });
      setToNodeId('');
      onChanged?.();
    } catch (err) {
      setState({
        kind: 'error',
        message: err instanceof Error ? err.message : '연결 생성에 실패했습니다.',
      });
    }
  }

  return (
    <form
      onSubmit={submit}
      aria-label="근거 연결 관리"
      className="flex flex-col gap-2 rounded-lg border border-ink-150 bg-surface p-3"
    >
      <p className="text-xs font-medium text-brand-700">근거 연결 (ra-lead 전용)</p>
      <div className="flex flex-wrap gap-2">
        <label className="flex flex-col text-xs text-ink-600">
          대상 노드 ID
          <input
            type="text"
            value={toNodeId}
            onChange={(e) => setToNodeId(e.target.value)}
            placeholder="UUID"
            required
            className="mt-1 w-64 rounded border border-ink-150 px-2 py-1 font-mono text-xs focus:border-brand-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
            aria-label="대상 노드 UUID"
          />
        </label>
        <label className="flex flex-col text-xs text-ink-600">
          관계
          <select
            value={relation}
            onChange={(e) => setRelation(e.target.value as EdgeRelation)}
            className="mt-1 rounded border border-ink-150 px-2 py-1 text-xs focus:border-brand-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
            aria-label="관계 유형"
          >
            {EDGE_RELATIONS.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </label>
        <button
          type="submit"
          disabled={state.kind === 'submitting' || !toNodeId.trim()}
          className="mt-5 self-start rounded bg-brand-700 px-3 py-1 text-xs text-white hover:bg-brand-800 disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2"
        >
          {state.kind === 'submitting' ? '생성 중…' : '연결 생성'}
        </button>
      </div>
      {state.kind === 'success' && (
        <output className="text-xs text-success" data-testid="edge-success">
          {state.message}
        </output>
      )}
      {state.kind === 'error' && (
        <p className="text-xs text-danger" role="alert">
          {state.message}
        </p>
      )}
    </form>
  );
}
