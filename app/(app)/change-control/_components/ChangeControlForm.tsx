'use client';

// @MX:NOTE [AUTO] ChangeControlForm — structured change input (REQ-002, AC-01).
// @MX:SPEC SPEC-REGULA-CHANGE-CONTROL-001 (REQ-002, REQ-003, AC-01)
//
// Client island that captures the structured change input and POSTs to
// /api/change-control/run. On success, router.push to the assessment detail page.
// Mirrors the PmsInputsUploader client-island pattern (RSC shell + client form).

import { CHANGE_TYPE_LABELS } from '@/components/change-control/verdict-labels';
import { runChangeControl } from '@/lib/change-control/api-client';
import type { RunChangeControlInput } from '@/lib/change-control/api-client';
import type { ProjectSummary } from '@/lib/queries/useProjects';
import { useRouter } from 'next/navigation';
import { type FormEvent, useCallback, useRef, useState } from 'react';

type ChangeType = RunChangeControlInput['changeType'];

/** All 6 change types from REQ-003. */
const CHANGE_TYPE_OPTIONS = Object.entries(CHANGE_TYPE_LABELS) as Array<
  [ChangeType, { ko: string; en: string }]
>;

/** Canonical target market options — the backend resolves free-form strings. */
const TARGET_MARKET_OPTIONS: ReadonlyArray<{ value: string; label: string }> = [
  { value: 'FDA', label: 'FDA (미국)' },
  { value: 'EU', label: 'EU MDR (유럽)' },
  { value: 'KR', label: 'MFDS (한국)' },
  { value: 'CN', label: 'NMPA (중국)' },
  { value: 'JP', label: 'PMDA (일본)' },
] as const;

interface ChangeControlFormProps {
  projects: Array<Pick<ProjectSummary, 'id' | 'name'>>;
  /** Pre-selected project ID (from Zustand store or URL). */
  defaultProjectId?: string;
  /** ra-lead can submit; ra-member is read-only. */
  canAssess: boolean;
}

export function ChangeControlForm({
  projects,
  defaultProjectId,
  canAssess,
}: ChangeControlFormProps) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const [projectId, setProjectId] = useState(defaultProjectId ?? projects[0]?.id ?? '');
  const [changeType, setChangeType] = useState<ChangeType>('design');
  const [description, setDescription] = useState('');
  const [impactScope, setImpactScope] = useState('');
  const [targetMarkets, setTargetMarkets] = useState<string[]>(['FDA', 'EU']);

  const toggleMarket = useCallback((value: string) => {
    setTargetMarkets((prev) =>
      prev.includes(value) ? prev.filter((m) => m !== value) : [...prev, value],
    );
  }, []);

  const handleSubmit = useCallback(
    async (e: FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      if (!canAssess) return;
      if (!projectId || !description.trim() || !impactScope.trim() || targetMarkets.length === 0) {
        setError('프로젝트·설명·영향 범위·대상 시장을 모두 입력하세요.');
        return;
      }

      // Abort any in-flight submit (L-007: avoid race on double-click).
      abortRef.current?.abort();
      const ac = new AbortController();
      abortRef.current = ac;

      setSubmitting(true);
      setError(null);

      try {
        const result = await runChangeControl(
          {
            projectId,
            changeType,
            description: description.trim(),
            impactScope: impactScope.trim(),
            targetMarkets,
          },
          ac.signal,
        );
        router.push(`/change-control/${result.assessmentId}`);
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') return;
        setError(err instanceof Error ? err.message : '평가 실행 중 오류가 발생했습니다.');
        setSubmitting(false);
      }
    },
    [canAssess, projectId, changeType, description, impactScope, targetMarkets, router],
  );

  if (!canAssess) {
    return (
      <div
        className="rounded-md border border-ink-200 bg-ink-50 px-4 py-6 text-sm text-ink-600"
        role="alert"
      >
        변경 영향 평가 생성은 RA Lead 권한 이상 필요합니다 (change.assess).
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-5"
      data-testid="change-control-form"
      aria-label="설계 변경 영향 평가 입력"
    >
      {/* Project select */}
      <div className="flex flex-col gap-1.5">
        <label htmlFor="cc-project" className="text-sm font-medium text-ink-700">
          프로젝트{' '}
          <span aria-hidden="true" className="text-danger">
            *
          </span>
        </label>
        <select
          id="cc-project"
          value={projectId}
          onChange={(e) => setProjectId(e.target.value)}
          required
          className="rounded-md border border-ink-200 bg-surface px-3 py-2 text-sm text-ink-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2"
          data-testid="cc-project-select"
        >
          <option value="" disabled>
            프로젝트 선택
          </option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </div>

      {/* Change type select */}
      <div className="flex flex-col gap-1.5">
        <label htmlFor="cc-change-type" className="text-sm font-medium text-ink-700">
          변경 유형{' '}
          <span aria-hidden="true" className="text-danger">
            *
          </span>
        </label>
        <select
          id="cc-change-type"
          value={changeType}
          onChange={(e) => setChangeType(e.target.value as ChangeType)}
          required
          className="rounded-md border border-ink-200 bg-surface px-3 py-2 text-sm text-ink-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2"
          data-testid="cc-change-type-select"
        >
          {CHANGE_TYPE_OPTIONS.map(([value, label]) => (
            <option key={value} value={value}>
              {label.ko}
            </option>
          ))}
        </select>
      </div>

      {/* Description */}
      <div className="flex flex-col gap-1.5">
        <label htmlFor="cc-description" className="text-sm font-medium text-ink-700">
          변경 설명{' '}
          <span aria-hidden="true" className="text-danger">
            *
          </span>
        </label>
        <textarea
          id="cc-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          required
          maxLength={8000}
          rows={4}
          placeholder="예: 하우징 재료를 ABS에서 PC로 변경"
          className="rounded-md border border-ink-200 bg-surface px-3 py-2 text-sm text-ink-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2"
          data-testid="cc-description-input"
        />
      </div>

      {/* Impact scope */}
      <div className="flex flex-col gap-1.5">
        <label htmlFor="cc-impact-scope" className="text-sm font-medium text-ink-700">
          영향 범위{' '}
          <span aria-hidden="true" className="text-danger">
            *
          </span>
        </label>
        <textarea
          id="cc-impact-scope"
          value={impactScope}
          onChange={(e) => setImpactScope(e.target.value)}
          required
          maxLength={8000}
          rows={3}
          placeholder="예: 기계적 강도, 생체적합성, 제조 공정"
          className="rounded-md border border-ink-200 bg-surface px-3 py-2 text-sm text-ink-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2"
          data-testid="cc-impact-scope-input"
        />
      </div>

      {/* Target markets */}
      <fieldset className="flex flex-col gap-2">
        <legend className="text-sm font-medium text-ink-700">
          대상 시장{' '}
          <span aria-hidden="true" className="text-danger">
            *
          </span>
        </legend>
        <p className="text-xs text-ink-500">선택한 시장의 관할권별로 verdict가 생성됩니다.</p>
        {/* biome-ignore lint/a11y/useSemanticElements: a nested <fieldset> is invalid inside the enclosing fieldset; role="group" + aria-label labels the target-market checkbox cluster */}
        <div className="flex flex-wrap gap-2" role="group" aria-label="대상 시장 선택">
          {TARGET_MARKET_OPTIONS.map((m) => {
            const checked = targetMarkets.includes(m.value);
            return (
              <label
                key={m.value}
                className={[
                  'cursor-pointer rounded-xs border px-3 py-1.5 text-sm focus-within:ring-2 focus-within:ring-brand-500 focus-within:ring-offset-2',
                  checked
                    ? 'border-brand-500 bg-brand-50 text-brand-700'
                    : 'border-ink-200 bg-surface text-ink-700 hover:border-ink-300',
                ].join(' ')}
              >
                <input
                  type="checkbox"
                  value={m.value}
                  checked={checked}
                  onChange={() => toggleMarket(m.value)}
                  className="sr-only"
                  data-testid={`cc-market-${m.value.toLowerCase()}`}
                />
                {m.label}
              </label>
            );
          })}
        </div>
      </fieldset>

      {/* Error */}
      {error && (
        <p
          className="rounded-xs border border-danger/30 bg-danger-bg px-3 py-2 text-sm text-danger"
          role="alert"
          data-testid="cc-form-error"
        >
          {error}
        </p>
      )}

      {/* Submit */}
      <div className="flex justify-end">
        <button
          type="submit"
          disabled={submitting}
          className="inline-flex items-center gap-2 rounded-md bg-brand-800 px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
          data-testid="cc-submit-btn"
          aria-busy={submitting}
        >
          {submitting ? '평가 실행 중…' : '평가 실행'}
        </button>
      </div>
    </form>
  );
}
