'use client';
// @MX:NOTE [AUTO] PmcfEvaluationBuilder — PMCF evaluation draft builder (REQ-PMS-011).
// @MX:SPEC SPEC-REGULA-PMS-001 (REQ-PMS-011, AC-03)
// POSTs to /api/workflows/pmcf-evaluation/run and renders the evaluation draft.
// The evaluation compares collected clinical data against the PMCF plan objectives.
// Charter [지양-2]: this is a DRAFT only — no approve/finalize/export bypass.
// Expert-review gating is display-only; the actual block is backend-enforced
// (REQ-PMS-009). RA Lead reviews before any regulatory action.

import { useId, useState } from 'react';

const DEVICE_CLASSES = ['I', 'Is', 'Im', 'IIa', 'IIb', 'III'] as const;
type DeviceClass = (typeof DEVICE_CLASSES)[number];

// Response shape returned by POST /api/workflows/pmcf-evaluation/run.
// Mirrors the route's `Response.json({...}, { status: 201 })` payload.
interface PmcfEvaluationResponse {
  runId: string;
  documentId: string;
  status: 'complete' | 'draft';
  sections: {
    objective_assessment: string;
    data_coverage_assessment: string;
    adverse_event_analysis: string;
    conclusions: string;
  };
}

interface PmcfEvaluationBuilderProps {
  projectId: string;
  /** ra-lead+ can submit. When false the form is disabled (same gate as pmcf-plan). */
  canManage: boolean;
}

/**
 * PMCF evaluation draft builder.
 *
 * The RA Lead supplies the device identification, the PMCF plan objectives and
 * methods (Annex XIV Part B), and the aggregate collected-data counts. The
 * component POSTs these to the workflow route and renders the returned draft.
 */
export function PmcfEvaluationBuilder({ projectId, canManage }: PmcfEvaluationBuilderProps) {
  const [deviceName, setDeviceName] = useState('');
  const [deviceClass, setDeviceClass] = useState<DeviceClass | ''>('');
  const [objectivesText, setObjectivesText] = useState('');
  const [methodsText, setMethodsText] = useState('');
  const [registrySize, setRegistrySize] = useState('');
  const [adverseEvents, setAdverseEvents] = useState('');
  const [surveyResponses, setSurveyResponses] = useState('');
  const [followUpMonths, setFollowUpMonths] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [data, setData] = useState<PmcfEvaluationResponse | null>(null);

  const nameId = useId();
  const classId = useId();
  const objectivesId = useId();
  const methodsId = useId();
  const registryId = useId();
  const adverseId = useId();
  const surveyId = useId();
  const followUpId = useId();

  const nameValid = deviceName.trim().length >= 2;
  const classValid = deviceClass !== '';
  const objectives = objectivesText
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  const objectivesValid = objectives.length >= 1;
  const methods = methodsText
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  const isNonNegInt = (value: string) => /^\d+$/.test(value) && Number.parseInt(value, 10) >= 0;
  const registryValid = isNonNegInt(registrySize);
  const adverseValid = isNonNegInt(adverseEvents);
  const surveyValid = surveyResponses === '' || isNonNegInt(surveyResponses);
  const followUpValid = followUpMonths === '' || isNonNegInt(followUpMonths);

  const canSubmit =
    canManage &&
    status !== 'loading' &&
    nameValid &&
    classValid &&
    objectivesValid &&
    registryValid &&
    adverseValid &&
    surveyValid &&
    followUpValid;

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSubmit) return;

    setStatus('loading');
    setData(null);
    setErrorMessage('');

    try {
      const res = await fetch('/api/workflows/pmcf-evaluation/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          deviceName: deviceName.trim(),
          deviceClass: deviceClass as DeviceClass,
          pmcfPlan: {
            objectives,
            methods,
          },
          collectedData: {
            registrySize: Number.parseInt(registrySize, 10),
            adverseEvents: Number.parseInt(adverseEvents, 10),
            surveyResponses: surveyResponses === '' ? 0 : Number.parseInt(surveyResponses, 10),
            followUpDurationMonths: followUpMonths === '' ? 0 : Number.parseInt(followUpMonths, 10),
          },
        }),
      });

      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? `요청 실패 (HTTP ${res.status})`);
      }

      const json = (await res.json()) as PmcfEvaluationResponse;
      setData(json);
      setStatus('done');
    } catch (err) {
      setStatus('error');
      setErrorMessage(err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다.');
    }
  }

  if (status === 'done' && data) {
    return <PmcfEvaluationResult data={data} />;
  }

  return (
    <form
      onSubmit={handleSubmit}
      aria-labelledby="pmcf-eval-heading"
      className="flex flex-col gap-6 rounded-lg border border-ink-200 bg-white p-6"
      noValidate
    >
      <div>
        <h2 id="pmcf-eval-heading" className="font-serif text-xl text-brand-800">
          PMCF 평가 초안 작성 (REQ-PMS-011)
        </h2>
        <p className="mt-1 text-sm text-ink-600">
          수집된 임상 데이터를 PMCF 계획 대비 평가한 초안을 생성합니다. 본 결과는 초안이며 전문가
          검토가 필요합니다.
        </p>
      </div>

      <div>
        <label className="block text-sm font-medium text-ink-700" htmlFor={nameId}>
          기기명{' '}
          <span aria-hidden="true" className="text-danger">
            *
          </span>
          <span className="sr-only"> (필수)</span>
        </label>
        <input
          id={nameId}
          type="text"
          required
          minLength={2}
          maxLength={256}
          value={deviceName}
          onChange={(e) => setDeviceName(e.target.value)}
          className="mt-1 w-full rounded border border-ink-300 px-3 py-2 text-sm text-ink-800 focus-visible:border-brand-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2"
          placeholder="예: Wireless Insulin Pump"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-ink-700" htmlFor={classId}>
          기기 등급{' '}
          <span aria-hidden="true" className="text-danger">
            *
          </span>
          <span className="sr-only"> (필수)</span>
        </label>
        <select
          id={classId}
          required
          value={deviceClass}
          onChange={(e) => setDeviceClass(e.target.value as DeviceClass)}
          className="mt-1 w-full rounded border border-ink-300 px-3 py-2 text-sm text-ink-800 focus-visible:border-brand-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2"
        >
          <option value="">선택하세요</option>
          {DEVICE_CLASSES.map((c) => (
            <option key={c} value={c}>
              Class {c}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-ink-700" htmlFor={objectivesId}>
          PMCF 계획 목표 (한 줄당 하나){' '}
          <span aria-hidden="true" className="text-danger">
            *
          </span>
          <span className="sr-only"> (필수, 최소 1개)</span>
        </label>
        <textarea
          id={objectivesId}
          rows={3}
          value={objectivesText}
          onChange={(e) => setObjectivesText(e.target.value)}
          className="mt-1 w-full rounded border border-ink-300 px-3 py-2 text-sm text-ink-800 focus-visible:border-brand-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2"
          placeholder={'예:\n장기 안전성 프로파일 확인\n유효성 end-point 유지 확인'}
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-ink-700" htmlFor={methodsId}>
          PMCF 방법론 (한 줄당 하나, 선택)
        </label>
        <textarea
          id={methodsId}
          rows={2}
          value={methodsText}
          onChange={(e) => setMethodsText(e.target.value)}
          className="mt-1 w-full rounded border border-ink-300 px-3 py-2 text-sm text-ink-800 focus-visible:border-brand-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2"
          placeholder="예: 레지스트리 데이터, 사용자 설문"
        />
      </div>

      <fieldset className="flex flex-col gap-4">
        <legend className="text-sm font-medium text-ink-700">수집된 임상 데이터</legend>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-ink-700" htmlFor={registryId}>
              레지스트리 대상자 수{' '}
              <span aria-hidden="true" className="text-danger">
                *
              </span>
              <span className="sr-only"> (필수, 0 이상 정수)</span>
            </label>
            <input
              id={registryId}
              type="number"
              inputMode="numeric"
              min={0}
              step={1}
              required
              value={registrySize}
              onChange={(e) => setRegistrySize(e.target.value)}
              className="mt-1 w-full rounded border border-ink-300 px-3 py-2 text-sm text-ink-800 focus-visible:border-brand-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2"
              placeholder="예: 50"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-ink-700" htmlFor={adverseId}>
              이상사례 수{' '}
              <span aria-hidden="true" className="text-danger">
                *
              </span>
              <span className="sr-only"> (필수, 0 이상 정수)</span>
            </label>
            <input
              id={adverseId}
              type="number"
              inputMode="numeric"
              min={0}
              step={1}
              required
              value={adverseEvents}
              onChange={(e) => setAdverseEvents(e.target.value)}
              className="mt-1 w-full rounded border border-ink-300 px-3 py-2 text-sm text-ink-800 focus-visible:border-brand-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2"
              placeholder="예: 2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-ink-700" htmlFor={surveyId}>
              설문 응답 수 (선택)
            </label>
            <input
              id={surveyId}
              type="number"
              inputMode="numeric"
              min={0}
              step={1}
              value={surveyResponses}
              onChange={(e) => setSurveyResponses(e.target.value)}
              className="mt-1 w-full rounded border border-ink-300 px-3 py-2 text-sm text-ink-800 focus-visible:border-brand-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2"
              placeholder="0"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-ink-700" htmlFor={followUpId}>
              추적 관찰 기간 (개월, 선택)
            </label>
            <input
              id={followUpId}
              type="number"
              inputMode="numeric"
              min={0}
              step={1}
              value={followUpMonths}
              onChange={(e) => setFollowUpMonths(e.target.value)}
              className="mt-1 w-full rounded border border-ink-300 px-3 py-2 text-sm text-ink-800 focus-visible:border-brand-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2"
              placeholder="0"
            />
          </div>
        </div>
      </fieldset>

      <button
        type="submit"
        disabled={!canSubmit}
        data-testid="pmcf-eval-submit"
        className="w-fit rounded bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {status === 'loading' ? '생성 중...' : 'PMCF 평가 초안 생성'}
      </button>

      {status === 'loading' && (
        <output
          className="flex items-center gap-2 text-sm text-brand-600"
          aria-live="polite"
          data-testid="pmcf-eval-loading"
        >
          <span
            className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-brand-300 border-t-brand-600 motion-safe:animate-spin"
            aria-hidden="true"
          />
          PMCF 평가 초안을 생성하는 중...
        </output>
      )}

      {status === 'error' && (
        <p
          className="rounded border border-danger/30 bg-danger-bg px-3 py-2 text-sm text-danger"
          role="alert"
          data-testid="pmcf-eval-error"
        >
          {errorMessage}
        </p>
      )}
    </form>
  );
}

function PmcfEvaluationResult({ data }: { data: PmcfEvaluationResponse }) {
  const STATUS_LABELS: Record<PmcfEvaluationResponse['status'], string> = {
    complete: '완료',
    draft: '초안',
  };

  const sections: ReadonlyArray<{ key: keyof PmcfEvaluationResponse['sections']; title: string }> =
    [
      { key: 'objective_assessment', title: '목표별 평가' },
      { key: 'data_coverage_assessment', title: '데이터 적합성 평가' },
      { key: 'adverse_event_analysis', title: '이상사례 분석' },
      { key: 'conclusions', title: '결론' },
    ];

  return (
    <div className="flex flex-col gap-4" data-testid="pmcf-eval-result">
      <div className="rounded-lg border border-brand-200 bg-brand-50 p-4">
        <h2 className="font-serif text-lg text-brand-800">PMCF 평가 — REQ-PMS-011</h2>
        <p className="mt-1 text-xs text-ink-500">
          워크플로우 실행 ID: <code className="font-mono">{data.runId}</code>
        </p>
        <p className="mt-1 text-xs text-ink-500">
          상태:{' '}
          <span className="font-medium text-brand-700" data-testid="pmcf-eval-status">
            {STATUS_LABELS[data.status]}
          </span>
        </p>
      </div>

      <div className="flex flex-col gap-3" data-testid="pmcf-eval-sections">
        {sections.map(({ key, title }) => (
          <section
            key={key}
            className="rounded border border-ink-200 bg-white p-3"
            data-testid={`pmcf-eval-section-${key}`}
            aria-label={title}
          >
            <h3 className="text-sm font-semibold text-brand-700">{title}</h3>
            <p className="mt-1 whitespace-pre-line text-sm text-ink-700">{data.sections[key]}</p>
          </section>
        ))}
      </div>

      {/* Expert review gating (REQ-PMS-009) — display-only, backend enforces the block. */}
      {data.status === 'draft' && (
        <p
          className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800"
          data-testid="pmcf-eval-expert-review-gating"
        >
          <strong>전문가 검토 필요.</strong> 이 평가는 초안 상태입니다. 전문가 검토 완료 전까지
          export 또는 close할 수 없습니다.
        </p>
      )}
    </div>
  );
}
