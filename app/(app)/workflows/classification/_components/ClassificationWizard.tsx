'use client';
// @MX:NOTE [AUTO] ClassificationWizard — client island for SPEC-REGULA-CLASSIFY-001 (Issue #59, T3).
// 2-step wizard: (1) device description + characteristics, (2) 5-jurisdiction results.
// POSTs to /api/classify/run and renders the committed response contract:
//   { workflowRunId, result: { fda, euMdr, mfds, nmpa, pmda, samdFlag } }
// Each JurisdictionResult = { class, path?, ruleNumbers?, citations, rationale, nextSteps }.
// @MX:SPEC SPEC-REGULA-CLASSIFY-001 (REQ-CLASSIFY-001~004, REQ-CLASSIFY-017, REQ-CLASSIFY-019~020)

import type {
  ClassificationCitation,
  ClassificationOutput,
  JurisdictionResult,
  WizardAnswers,
} from '@/lib/classify/types';
import { useId, useState } from 'react';

// --- WizardAnswers field options (mirror the backend Zod enum values) ---

type DeviceType = 'active' | 'non_active' | 'software_only' | 'ivd' | 'implantable';
type ContactType = 'no_contact' | 'external' | 'internal' | 'implant';

const DEVICE_TYPE_LABELS: ReadonlyArray<{ value: DeviceType; label: string }> = [
  { value: 'active', label: '능동형 (Active)' },
  { value: 'non_active', label: '비능동형 (Non-active)' },
  { value: 'software_only', label: '소프트웨어 단독 (SaMD)' },
  { value: 'ivd', label: '체외진단의료기기 (IVD)' },
  { value: 'implantable', label: '체내이식형 (Implantable)' },
];

const CONTACT_TYPE_LABELS: ReadonlyArray<{ value: ContactType; label: string }> = [
  { value: 'no_contact', label: '환자 접촉 없음' },
  { value: 'external', label: '외부 (피부 접촉)' },
  { value: 'internal', label: '내부 (체강)' },
  { value: 'implant', label: '이식 (Implant)' },
];

// --- Jurisdiction display config ---

type JurisdictionKey = keyof Pick<ClassificationOutput, 'fda' | 'euMdr' | 'mfds' | 'nmpa' | 'pmda'>;

const JURISDICTIONS: ReadonlyArray<{
  key: JurisdictionKey;
  label: string;
  pathLabel: string;
}> = [
  { key: 'fda', label: 'FDA (US)', pathLabel: '경로' },
  { key: 'euMdr', label: 'EU MDR', pathLabel: '경로' },
  { key: 'mfds', label: 'MFDS (한국)', pathLabel: '등급' },
  { key: 'nmpa', label: 'NMPA (중국)', pathLabel: '경로' },
  { key: 'pmda', label: 'PMDA (일본)', pathLabel: '경로' },
];

// --- API response shape (mirrors POST /api/classify/run) ---

interface ClassifyRunResponse {
  workflowRunId: string;
  result: ClassificationOutput;
}

interface FormState {
  deviceDescription: string;
  deviceType: DeviceType | '';
  contactType: ContactType | '';
  hasSoftware: boolean;
  hasAiMl: boolean;
  isSterile: boolean;
}

const INITIAL_FORM: FormState = {
  deviceDescription: '',
  deviceType: '',
  contactType: '',
  hasSoftware: false,
  hasAiMl: false,
  isSterile: false,
};

interface ClassificationWizardProps {
  /** classify.generate (ra-lead+). When false the form is disabled. */
  canGenerate: boolean;
}

export function ClassificationWizard({ canGenerate }: ClassificationWizardProps) {
  const [form, setForm] = useState<FormState>(INITIAL_FORM);
  const [status, setStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [data, setData] = useState<ClassifyRunResponse | null>(null);

  const descriptionId = useId();

  const descriptionValid = form.deviceDescription.trim().length >= 10;
  const characteristicsValid = form.deviceType !== '' && form.contactType !== '';
  const canSubmit = canGenerate && status !== 'loading' && descriptionValid && characteristicsValid;

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSubmit) return;

    // Build the WizardAnswers payload. deviceType/contactType are required by the
    // backend Zod schema (non-empty enums); empty strings would 400.
    const payload: WizardAnswers = {
      deviceDescription: form.deviceDescription.trim(),
      deviceType: form.deviceType as DeviceType,
      contactType: form.contactType as ContactType,
      hasSoftware: form.hasSoftware,
      hasAiMl: form.hasAiMl,
      isSterile: form.isSterile,
    };

    setStatus('loading');
    setData(null);
    setErrorMessage('');

    try {
      const res = await fetch('/api/classify/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? `요청 실패 (HTTP ${res.status})`);
      }

      const json = (await res.json()) as ClassifyRunResponse;
      setData(json);
      setStatus('done');
    } catch (err) {
      setStatus('error');
      setErrorMessage(err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다.');
    }
  }

  function handleReset() {
    setStatus('idle');
    setData(null);
    setErrorMessage('');
  }

  // --- Result view (Step 2) ---
  if (status === 'done' && data) {
    return (
      <ClassificationResult data={data} samdFlag={data.result.samdFlag} onReset={handleReset} />
    );
  }

  // --- Wizard form (Step 1) ---
  return (
    <form
      onSubmit={handleSubmit}
      aria-labelledby="classify-wizard-heading"
      className="flex flex-col gap-6 rounded-lg border border-ink-200 bg-white p-6"
      noValidate
    >
      <div>
        <h2 id="classify-wizard-heading" className="font-serif text-xl text-brand-800">
          기기 정보
        </h2>
        <p className="mt-1 text-sm text-ink-600">
          의료기기의 의도된 용도와 특성을 입력하세요. 입력값이 5개 관할권 분류 엔진에 전달됩니다.
        </p>
      </div>

      {/* Permission notice: ra-member can see the page but cannot run. */}
      {!canGenerate && (
        <p
          className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800"
          data-testid="classify-permission-notice"
        >
          분석을 실행하려면 RA Lead 이상의 권한이 필요합니다. (classify.generate)
        </p>
      )}

      {/* Device description */}
      <div>
        <label className="block text-sm font-medium text-ink-700" htmlFor={descriptionId}>
          기기 설명{' '}
          <span aria-hidden="true" className="text-danger">
            *
          </span>
          <span className="sr-only"> (필수)</span>
        </label>
        <textarea
          id={descriptionId}
          required
          minLength={10}
          maxLength={8000}
          rows={4}
          aria-describedby={`${descriptionId}-hint`}
          className="mt-1 w-full rounded border border-ink-300 px-3 py-2 text-sm text-ink-800 placeholder:text-ink-400 focus-visible:border-brand-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2"
          placeholder="의료기기의 의도된 용도, 환자 접촉 방식, 소프트웨어·AI/ML 구성 여부 등을 설명하세요..."
          value={form.deviceDescription}
          onChange={(e) => setForm((f) => ({ ...f, deviceDescription: e.target.value }))}
        />
        <p id={`${descriptionId}-hint`} className="mt-1 text-xs text-ink-500">
          최소 10자 이상 입력하세요.
        </p>
      </div>

      {/* Device type — required */}
      <fieldset>
        <legend className="text-sm font-medium text-ink-700">
          기기 유형{' '}
          <span aria-hidden="true" className="text-danger">
            *
          </span>
          <span className="sr-only"> (필수)</span>
        </legend>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          {DEVICE_TYPE_LABELS.map((opt) => (
            <label
              key={opt.value}
              className={[
                'flex cursor-pointer items-center gap-2 rounded border px-3 py-2 text-sm',
                form.deviceType === opt.value
                  ? 'border-brand-600 bg-brand-50 text-brand-700'
                  : 'border-ink-200 bg-white text-ink-700 hover:border-ink-400',
              ].join(' ')}
            >
              <input
                type="radio"
                name="deviceType"
                value={opt.value}
                required
                checked={form.deviceType === opt.value}
                onChange={() => setForm((f) => ({ ...f, deviceType: opt.value }))}
                className="focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2"
              />
              {opt.label}
            </label>
          ))}
        </div>
      </fieldset>

      {/* Contact type — required */}
      <fieldset>
        <legend className="text-sm font-medium text-ink-700">
          환자 접촉 유형{' '}
          <span aria-hidden="true" className="text-danger">
            *
          </span>
          <span className="sr-only"> (필수)</span>
        </legend>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          {CONTACT_TYPE_LABELS.map((opt) => (
            <label
              key={opt.value}
              className={[
                'flex cursor-pointer items-center gap-2 rounded border px-3 py-2 text-sm',
                form.contactType === opt.value
                  ? 'border-brand-600 bg-brand-50 text-brand-700'
                  : 'border-ink-200 bg-white text-ink-700 hover:border-ink-400',
              ].join(' ')}
            >
              <input
                type="radio"
                name="contactType"
                value={opt.value}
                required
                checked={form.contactType === opt.value}
                onChange={() => setForm((f) => ({ ...f, contactType: opt.value }))}
                className="focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2"
              />
              {opt.label}
            </label>
          ))}
        </div>
      </fieldset>

      {/* Boolean characteristics */}
      <fieldset>
        <legend className="text-sm font-medium text-ink-700">추가 특성</legend>
        <div className="mt-2 flex flex-wrap gap-6">
          {[
            { field: 'hasSoftware' as const, label: '소프트웨어 포함' },
            { field: 'hasAiMl' as const, label: 'AI/ML 구성' },
            { field: 'isSterile' as const, label: '멸균 제공' },
          ].map(({ field, label }) => (
            <label key={field} className="flex items-center gap-2 text-sm text-ink-700">
              <input
                type="checkbox"
                checked={form[field]}
                onChange={(e) => setForm((f) => ({ ...f, [field]: e.target.checked }))}
                className="rounded border-ink-300 focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2"
              />
              {label}
            </label>
          ))}
        </div>
      </fieldset>

      {/* Submit / Reset */}
      <div className="flex gap-3">
        <button
          type="submit"
          disabled={!canSubmit}
          data-testid="classify-submit"
          className="rounded bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {status === 'loading' ? '분석 중...' : '분류 실행'}
        </button>
        {status === 'error' && (
          <button
            type="button"
            onClick={handleReset}
            className="rounded border border-ink-300 px-4 py-2 text-sm text-ink-700 hover:bg-ink-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2"
          >
            다시 시도
          </button>
        )}
      </div>

      {/* Loading state — <output> is an ARIA live region (role=status equivalent). */}
      {status === 'loading' && (
        <output
          className="flex items-center gap-2 text-sm text-brand-600"
          aria-live="polite"
          data-testid="classify-loading"
        >
          <span
            className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-brand-300 border-t-brand-600 motion-safe:animate-spin"
            aria-hidden="true"
          />
          5개 관할권 분류 엔진이 기기를 분석하고 있습니다...
        </output>
      )}

      {/* Error state */}
      {status === 'error' && (
        <p
          className="rounded border border-danger/30 bg-danger-bg px-3 py-2 text-sm text-danger"
          role="alert"
          data-testid="classify-error"
        >
          {errorMessage}
        </p>
      )}
    </form>
  );
}

// --- Result view component ---

interface ClassificationResultProps {
  data: ClassifyRunResponse;
  samdFlag: ClassificationOutput['samdFlag'];
  onReset: () => void;
}

function ClassificationResult({ data, samdFlag, onReset }: ClassificationResultProps) {
  return (
    <div className="flex flex-col gap-4" data-testid="classify-result">
      {/* SaMD flag note (when AI/ML detected) */}
      {samdFlag === 'detected' && (
        <p
          className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800"
          data-testid="classify-samd-flag"
        >
          <strong>AI/ML 구성 감지됨.</strong> 본 기기는 SaMD로 분류될 수 있습니다. PCCP(예정 변경
          통제 계획) 워크플로우를 함께 검토하세요.
        </p>
      )}

      <div className="rounded-lg border border-brand-200 bg-brand-50 p-4">
        <h2 className="font-serif text-lg text-brand-800">분류 결과</h2>
        <p className="mt-1 text-xs text-ink-500">
          FDA 21 CFR · EU MDR 2017/745 · MFDS 의료기기법 · NMPA 分类 · PMDA 薬機法 기준
        </p>
        <p className="mt-1 text-xs text-ink-400">
          워크플로우 실행 ID:{' '}
          <code className="font-mono" data-testid="classify-run-id">
            {data.workflowRunId}
          </code>
        </p>
      </div>

      {/* 5-jurisdiction grid */}
      <div
        className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
        data-testid="classify-jurisdictions"
      >
        {JURISDICTIONS.map((j) => (
          <JurisdictionCard
            key={j.key}
            label={j.label}
            pathLabel={j.pathLabel}
            result={data.result[j.key]}
          />
        ))}
      </div>

      <div>
        <button
          type="button"
          onClick={onReset}
          data-testid="classify-reset"
          className="rounded border border-ink-300 px-4 py-2 text-sm text-ink-700 hover:bg-ink-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2"
        >
          새로운 기기 분류
        </button>
      </div>
    </div>
  );
}

interface JurisdictionCardProps {
  label: string;
  pathLabel: string;
  result: JurisdictionResult;
}

function JurisdictionCard({ label, pathLabel, result }: JurisdictionCardProps) {
  // High-risk classes: III, IIb, 4등급, Class III/IV-style → amber emphasis.
  const isHighRisk = /^(III|IIb|IV|4|Class IV)$/i.test(result.class);

  return (
    <div
      className={[
        'flex flex-col gap-2 rounded-lg border p-4',
        isHighRisk ? 'border-amber-300 bg-amber-50' : 'border-ink-200 bg-white',
      ].join(' ')}
      data-testid={`classify-jurisdiction-${label}`}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="text-sm font-medium text-ink-700">{label}</span>
        <span
          className={[
            'rounded px-2 py-0.5 text-xs font-bold',
            isHighRisk ? 'bg-amber-200 text-amber-800' : 'bg-brand-100 text-brand-700',
          ].join(' ')}
          data-testid={`classify-class-${label}`}
        >
          {result.class}
        </span>
      </div>

      {result.path && (
        <p className="text-xs text-ink-600">
          {pathLabel}:{' '}
          <span className="font-medium text-ink-800" data-testid={`classify-path-${label}`}>
            {result.path}
          </span>
        </p>
      )}

      {result.ruleNumbers && result.ruleNumbers.length > 0 && (
        <p className="text-xs text-ink-500">
          적용 규칙:{' '}
          {result.ruleNumbers.map((rn, i) => (
            <span key={rn}>
              {i > 0 && ', '}
              <span className="font-mono">{rn}</span>
            </span>
          ))}
        </p>
      )}

      <p
        className="text-xs leading-relaxed text-ink-600"
        data-testid={`classify-rationale-${label}`}
      >
        {result.rationale}
      </p>

      {/* Citations */}
      {result.citations.length > 0 && (
        <ul
          className="mt-1 flex flex-col gap-1"
          aria-label={`${label} 근거 출처`}
          data-testid={`classify-citations-${label}`}
        >
          {result.citations.map((cite, i) => (
            <CitationItem key={`${cite.source}-${cite.id}-${i}`} citation={cite} index={i} />
          ))}
        </ul>
      )}

      {/* Next steps */}
      {result.nextSteps.length > 0 && (
        <div className="mt-1" data-testid={`classify-nextsteps-${label}`}>
          <p className="text-xs font-medium text-ink-600">다음 단계:</p>
          <ul className="ml-4 list-disc text-xs text-ink-600">
            {result.nextSteps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

interface CitationItemProps {
  citation: ClassificationCitation;
  index: number;
}

function CitationItem({ citation, index }: CitationItemProps) {
  // citation.source is a corpus/regulation identifier (e.g. '21 CFR 880.2900').
  // No external URL is available in the contract; render as a styled badge so
  // the citation is visible and auditable without a dead link.
  return (
    <li className="flex items-start gap-1 text-xs text-ink-600">
      <span
        className="inline-flex h-4 min-w-4 items-center justify-center rounded bg-brand-100 px-1 font-mono text-[10px] font-semibold text-brand-700"
        aria-label={`근거 ${index + 1}`}
      >
        {index + 1}
      </span>
      <span className="font-mono text-ink-700">{citation.source}</span>
      <span className="text-ink-400">—</span>
      <span className="text-ink-600">{citation.id}</span>
    </li>
  );
}
