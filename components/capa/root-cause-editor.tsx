'use client';

// @MX:NOTE [AUTO] RootCauseEditor — 5 Whys / Fishbone RCA editor (REQ-003, AC-01).
// @MX:SPEC SPEC-REGULA-CAPA-001 (REQ-003, AC-01)
//
// Client island that captures the root cause analysis and POSTs to
// /api/ra/capa/records/[id]/root-cause. Two methods: sequential 5 Whys chain
// or Fishbone 6M categories. The server validates the structure
// (lib/capa/root-cause.ts validateRootCauseAnalysis). Pure data capture —
// no AI judgement (per SPEC out-of-scope note).

import { saveRootCause } from '@/lib/capa/api-client';
import type { FishboneAnalysis, FiveWhysAnalysis, RootCauseMethod } from '@/lib/capa/types';
import { type FormEvent, useCallback, useRef, useState } from 'react';

const FIVE_WHYS_KEYS = ['why1', 'why2', 'why3', 'why4', 'why5'] as const;
const FIVE_WHYS_LABELS: Record<(typeof FIVE_WHYS_KEYS)[number], string> = {
  why1: '왜? (1단계)',
  why2: '왜? (2단계)',
  why3: '왜? (3단계)',
  why4: '왜? (4단계)',
  why5: '왜? (5단계)',
} as const;

const FISHBONE_CATEGORIES = [
  { key: 'man', label: '사람 (Man)' },
  { key: 'machine', label: '기계 (Machine)' },
  { key: 'material', label: '재료 (Material)' },
  { key: 'method', label: '방법 (Method)' },
  { key: 'measurement', label: '측정 (Measurement)' },
  { key: 'environment', label: '환경 (Environment)' },
] as const;

interface RootCauseEditorProps {
  capaId: string;
  /** Called after successful save. */
  onSaved?: () => void;
}

const EMPTY_FIVE_WHYS: FiveWhysAnalysis = {
  why1: '',
  why2: '',
  why3: '',
  why4: '',
  why5: '',
  rootCause: '',
};

const EMPTY_FISHBONE: FishboneAnalysis = {
  man: [],
  machine: [],
  material: [],
  method: [],
  measurement: [],
  environment: [],
  rootCause: '',
};

export function RootCauseEditor({ capaId, onSaved }: RootCauseEditorProps) {
  const [method, setMethod] = useState<RootCauseMethod>('5whys');
  const [fiveWhys, setFiveWhys] = useState<FiveWhysAnalysis>(EMPTY_FIVE_WHYS);
  const [fishbone, setFishbone] = useState<FishboneAnalysis>(EMPTY_FISHBONE);
  const [summary, setSummary] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const handleSubmit = useCallback(
    async (e: FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      if (!summary.trim()) {
        setError('근본 원인 요약을 입력하세요.');
        return;
      }

      const analysisData =
        method === '5whys' ? (fiveWhys as FiveWhysAnalysis) : (fishbone as FishboneAnalysis);

      abortRef.current?.abort();
      const ac = new AbortController();
      abortRef.current = ac;

      setSubmitting(true);
      setError(null);
      setSaved(false);

      try {
        await saveRootCause(capaId, { method, analysisData, summary: summary.trim() }, ac.signal);
        setSaved(true);
        onSaved?.();
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') return;
        setError(err instanceof Error ? err.message : 'RCA 저장 중 오류가 발생했습니다.');
      } finally {
        setSubmitting(false);
      }
    },
    [capaId, method, fiveWhys, fishbone, summary, onSaved],
  );

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-5"
      data-testid="root-cause-editor"
      aria-label="근본 원인 분석 편집"
    >
      {/* Method selector */}
      <fieldset className="flex flex-col gap-2">
        <legend className="text-sm font-medium text-ink-700">분석 방법</legend>
        <div className="flex gap-2" role="radiogroup" aria-label="분석 방법 선택">
          {(
            [
              { value: '5whys', label: '5 Whys (순차 추적)' },
              { value: 'fishbone', label: 'Fishbone (6M 범주)' },
            ] as const
          ).map((opt) => (
            <label
              key={opt.value}
              className={[
                'cursor-pointer rounded-xs border px-3 py-1.5 text-sm focus-within:ring-2 focus-within:ring-brand-500 focus-within:ring-offset-2',
                method === opt.value
                  ? 'border-brand-500 bg-brand-50 text-brand-700'
                  : 'border-ink-200 bg-surface text-ink-700 hover:border-ink-300',
              ].join(' ')}
            >
              <input
                type="radio"
                name="rca-method"
                value={opt.value}
                checked={method === opt.value}
                onChange={() => setMethod(opt.value)}
                className="sr-only"
              />
              {opt.label}
            </label>
          ))}
        </div>
      </fieldset>

      {/* 5 Whys editor */}
      {method === '5whys' && (
        <div className="flex flex-col gap-3" data-testid="rca-5whys-fields">
          <p className="text-xs text-ink-500">
            각 단계는 이전 단계의 답에 대해 "왜?"를 묻는 방식으로 근본 원인에 도달합니다.
          </p>
          {FIVE_WHYS_KEYS.map((key, idx) => (
            <div key={key} className="flex flex-col gap-1.5">
              <label htmlFor={`rca-${key}`} className="text-sm font-medium text-ink-700">
                {FIVE_WHYS_LABELS[key]}{' '}
                <span aria-hidden="true" className="text-danger">
                  *
                </span>
              </label>
              <input
                id={`rca-${key}`}
                type="text"
                value={fiveWhys[key]}
                onChange={(e) => setFiveWhys({ ...fiveWhys, [key]: e.target.value })}
                required={idx < 5}
                maxLength={2000}
                placeholder={idx === 0 ? '예: 기기가 작동을 멈췄다' : `예: ${idx + 1}단계 원인`}
                className="rounded-md border border-ink-200 bg-surface px-3 py-2 text-sm text-ink-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2"
                data-testid={`rca-${key}`}
              />
            </div>
          ))}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="rca-5w-root" className="text-sm font-medium text-ink-700">
              도출된 근본 원인{' '}
              <span aria-hidden="true" className="text-danger">
                *
              </span>
            </label>
            <input
              id="rca-5w-root"
              type="text"
              value={fiveWhys.rootCause}
              onChange={(e) => setFiveWhys({ ...fiveWhys, rootCause: e.target.value })}
              required
              maxLength={2000}
              placeholder="5 Whys 체인에서 식별된 근본 원인"
              className="rounded-md border border-ink-200 bg-surface px-3 py-2 text-sm text-ink-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2"
              data-testid="rca-5w-root"
            />
          </div>
        </div>
      )}

      {/* Fishbone editor */}
      {method === 'fishbone' && (
        <div className="flex flex-col gap-3" data-testid="rca-fishbone-fields">
          <p className="text-xs text-ink-500">
            6M(Man, Machine, Material, Method, Measurement, Environment) 범주별로 가능한 원인을 한
            줄에 하나씩 입력하세요.
          </p>
          {FISHBONE_CATEGORIES.map((cat) => (
            <div key={cat.key} className="flex flex-col gap-1.5">
              <label htmlFor={`rca-fb-${cat.key}`} className="text-sm font-medium text-ink-700">
                {cat.label}
              </label>
              <textarea
                id={`rca-fb-${cat.key}`}
                value={fishbone[cat.key].join('\n')}
                onChange={(e) =>
                  setFishbone({
                    ...fishbone,
                    [cat.key]: e.target.value
                      .split('\n')
                      .map((s) => s.trim())
                      .filter((s) => s.length > 0),
                  })
                }
                rows={2}
                placeholder="한 줄에 하나씩 원인 입력"
                className="rounded-md border border-ink-200 bg-surface px-3 py-2 text-sm text-ink-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2"
                data-testid={`rca-fb-${cat.key}`}
              />
            </div>
          ))}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="rca-fb-root" className="text-sm font-medium text-ink-700">
              도출된 근본 원인{' '}
              <span aria-hidden="true" className="text-danger">
                *
              </span>
            </label>
            <input
              id="rca-fb-root"
              type="text"
              value={fishbone.rootCause}
              onChange={(e) => setFishbone({ ...fishbone, rootCause: e.target.value })}
              required
              maxLength={2000}
              placeholder="6M 분석에서 식별된 근본 원인"
              className="rounded-md border border-ink-200 bg-surface px-3 py-2 text-sm text-ink-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2"
              data-testid="rca-fb-root"
            />
          </div>
        </div>
      )}

      {/* Summary */}
      <div className="flex flex-col gap-1.5">
        <label htmlFor="rca-summary" className="text-sm font-medium text-ink-700">
          근본 원인 요약{' '}
          <span aria-hidden="true" className="text-danger">
            *
          </span>
        </label>
        <textarea
          id="rca-summary"
          value={summary}
          onChange={(e) => setSummary(e.target.value)}
          required
          maxLength={4000}
          rows={3}
          placeholder="식별된 근본 원인과 향후 조치 방향을 요약하세요."
          className="rounded-md border border-ink-200 bg-surface px-3 py-2 text-sm text-ink-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2"
          data-testid="rca-summary"
        />
      </div>

      {error && (
        <p
          className="rounded-xs border border-danger/30 bg-danger-bg px-3 py-2 text-sm text-danger"
          role="alert"
          data-testid="rca-error"
        >
          {error}
        </p>
      )}
      {saved && (
        <output
          className="rounded-xs border border-success/30 bg-success-bg px-3 py-2 text-sm text-success"
          data-testid="rca-saved"
        >
          근본 원인 분석이 저장되었습니다. (REQ-003)
        </output>
      )}

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={submitting}
          className="inline-flex items-center gap-2 rounded-md bg-brand-800 px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
          aria-busy={submitting}
          data-testid="rca-submit-btn"
        >
          {submitting ? '저장 중…' : 'RCA 저장'}
        </button>
      </div>
    </form>
  );
}
