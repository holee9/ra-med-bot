'use client';
// @MX:NOTE [AUTO] PmcfPlanBuilder — PMCF plan builder (EU MDR Annex XIV Part B).
// @MX:SPEC SPEC-REGULA-PMS-001 (REQ-PMS-003, AC-03)
// POSTs to /api/workflows/pmcf-plan/run and renders the checklist result.

import { useId, useState } from 'react';

const DEVICE_CLASSES = ['I', 'Is', 'Im', 'IIa', 'IIb', 'III'] as const;
type DeviceClass = (typeof DEVICE_CLASSES)[number];

interface ChecklistItemApi {
  id: string;
  clause: string;
  title: string;
  description: string;
}

interface PmcfPlanResponse {
  runId: string;
  documentId: string;
  status: 'complete' | 'partial' | 'draft';
  checklist: ChecklistItemApi[];
}

interface PmcfPlanBuilderProps {
  projectId: string;
  /** ra-lead+ can submit. When false the form is disabled. */
  canManage: boolean;
}

export function PmcfPlanBuilder({ projectId, canManage }: PmcfPlanBuilderProps) {
  const [deviceName, setDeviceName] = useState('');
  const [deviceClass, setDeviceClass] = useState<DeviceClass | ''>('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [data, setData] = useState<PmcfPlanResponse | null>(null);

  const nameId = useId();

  const nameValid = deviceName.trim().length >= 2;
  const classValid = deviceClass !== '';
  const canSubmit = canManage && status !== 'loading' && nameValid && classValid;

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSubmit) return;

    setStatus('loading');
    setData(null);
    setErrorMessage('');

    try {
      const res = await fetch('/api/workflows/pmcf-plan/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          deviceName: deviceName.trim(),
          deviceClass: deviceClass as DeviceClass,
        }),
      });

      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? `요청 실패 (HTTP ${res.status})`);
      }

      const json = (await res.json()) as PmcfPlanResponse;
      setData(json);
      setStatus('done');
    } catch (err) {
      setStatus('error');
      setErrorMessage(err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다.');
    }
  }

  if (status === 'done' && data) {
    return <PmcfPlanResult data={data} />;
  }

  return (
    <form
      onSubmit={handleSubmit}
      aria-labelledby="pmcf-plan-heading"
      className="flex flex-col gap-6 rounded-lg border border-ink-200 bg-white p-6"
      noValidate
    >
      <div>
        <h2 id="pmcf-plan-heading" className="font-serif text-xl text-brand-800">
          PMCF 계획 빌더 (Annex XIV Part B)
        </h2>
        <p className="mt-1 text-sm text-ink-600">
          EU MDR Annex XIV Part B 요구사항 체크리스트를 생성하고 AI 작성을 지원합니다.
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
        <label className="block text-sm font-medium text-ink-700" htmlFor={`${nameId}-class`}>
          기기 등급{' '}
          <span aria-hidden="true" className="text-danger">
            *
          </span>
          <span className="sr-only"> (필수)</span>
        </label>
        <select
          id={`${nameId}-class`}
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

      <button
        type="submit"
        disabled={!canSubmit}
        data-testid="pmcf-plan-submit"
        className="w-fit rounded bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {status === 'loading' ? '생성 중...' : 'PMCF 계획 생성'}
      </button>

      {status === 'loading' && (
        <output
          className="flex items-center gap-2 text-sm text-brand-600"
          aria-live="polite"
          data-testid="pmcf-plan-loading"
        >
          <span
            className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-brand-300 border-t-brand-600 motion-safe:animate-spin"
            aria-hidden="true"
          />
          Annex XIV Part B 체크리스트를 생성하는 중...
        </output>
      )}

      {status === 'error' && (
        <p
          className="rounded border border-danger/30 bg-danger-bg px-3 py-2 text-sm text-danger"
          role="alert"
          data-testid="pmcf-plan-error"
        >
          {errorMessage}
        </p>
      )}
    </form>
  );
}

function PmcfPlanResult({ data }: { data: PmcfPlanResponse }) {
  const STATUS_LABELS: Record<PmcfPlanResponse['status'], string> = {
    complete: '완료',
    partial: '부분 완료',
    draft: '초안',
  };

  return (
    <div className="flex flex-col gap-4" data-testid="pmcf-plan-result">
      <div className="rounded-lg border border-brand-200 bg-brand-50 p-4">
        <h2 className="font-serif text-lg text-brand-800">PMCF 계획 — Annex XIV Part B</h2>
        <p className="mt-1 text-xs text-ink-500">
          워크플로우 실행 ID: <code className="font-mono">{data.runId}</code>
        </p>
        <p className="mt-1 text-xs text-ink-500">
          상태:{' '}
          <span className="font-medium text-brand-700" data-testid="pmcf-plan-status">
            {STATUS_LABELS[data.status]}
          </span>
        </p>
      </div>

      <ul className="flex flex-col gap-2" data-testid="pmcf-checklist">
        {data.checklist.map((item, idx) => (
          <li
            key={item.id}
            className="rounded border border-ink-200 bg-white p-3"
            data-testid={`pmcf-checklist-item-${item.id}`}
          >
            <div className="flex items-start gap-2">
              <span
                className="mt-0.5 inline-flex h-5 min-w-5 items-center justify-center rounded bg-brand-100 px-1 font-mono text-[10px] font-semibold text-brand-700"
                aria-label={`체크리스트 항목 ${idx + 1}`}
              >
                {idx + 1}
              </span>
              <div className="flex-1">
                <p className="text-sm font-medium text-ink-800">{item.title}</p>
                <p className="text-xs text-ink-500">{item.clause}</p>
                <p className="mt-1 text-xs text-ink-600">{item.description}</p>
              </div>
            </div>
          </li>
        ))}
      </ul>

      {/* Expert review gating (REQ-PMS-009) */}
      {data.status === 'draft' && (
        <p
          className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800"
          data-testid="pmcf-expert-review-gating"
        >
          <strong>전문가 검토 필요.</strong> 이 계획은 초안 상태입니다. 전문가 검토 완료 전까지
          export 또는 close할 수 없습니다.
        </p>
      )}
    </div>
  );
}
