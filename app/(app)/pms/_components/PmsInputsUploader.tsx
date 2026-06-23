'use client';
// @MX:NOTE [AUTO] PmsInputsUploader — complaint/vigilance data input + upload.
// @MX:SPEC SPEC-REGULA-PMS-001 (REQ-PMS-005, REQ-PMS-006, REQ-PMS-012, AC-05)
// POSTs to /api/pms/inputs. Shows inline error on 400 (REQ-PMS-012).

import { useId, useState } from 'react';

const SOURCE_OPTIONS = [
  { value: '', label: '선택하세요' },
  { value: 'complaint', label: 'Complaint (불만)' },
  { value: 'vigilance', label: 'Vigilance (경계 데이터)' },
  { value: 'susar', label: 'SUSAR' },
  { value: 'trend', label: 'Trend (추세)' },
] as const;

const SEVERITY_OPTIONS = [
  { value: '', label: '해당 없음' },
  { value: 'non_serious', label: 'Non-serious' },
  { value: 'serious', label: 'Serious' },
  { value: 'death', label: 'Death' },
] as const;

interface PmsInputsUploaderProps {
  projectId: string;
}

interface PmsInputError {
  error: string;
  details?: Record<string, unknown>;
}

export function PmsInputsUploader({ projectId }: PmsInputsUploaderProps) {
  const [source, setSource] = useState('');
  const [severity, setSeverity] = useState('');
  const [susarFlag, setSusarFlag] = useState(false);
  const [trendCategory, setTrendCategory] = useState('');
  const [payload, setPayload] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  const sourceId = useId();
  const severityId = useId();

  const sourceValid = source !== '';

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!sourceValid || status === 'loading') return;

    setStatus('loading');
    setErrorMessage('');

    const body: Record<string, unknown> = {
      projectId,
      source,
      susar_flag: susarFlag,
    };
    if (severity) body.severity = severity;
    if (trendCategory.trim()) body.trend_category = trendCategory.trim();
    if (payload.trim()) {
      try {
        body.payload = JSON.parse(payload);
      } catch {
        body.payload = { note: payload.trim() };
      }
    }

    try {
      const res = await fetch('/api/pms/inputs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const errBody = (await res.json().catch(() => null)) as PmsInputError | null;
        // REQ-PMS-012: clear, field-level error message.
        const detailMsg = errBody?.details
          ? ` (${JSON.stringify(errBody.details).slice(0, 200)})`
          : '';
        throw new Error(`${errBody?.error ?? `요청 실패 (HTTP ${res.status})`}${detailMsg}`);
      }

      setStatus('done');
      // Reset form for next entry.
      setSource('');
      setSeverity('');
      setSusarFlag(false);
      setTrendCategory('');
      setPayload('');
    } catch (err) {
      setStatus('error');
      setErrorMessage(err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다.');
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      aria-labelledby="pms-inputs-heading"
      className="flex flex-col gap-4 rounded-lg border border-ink-200 bg-white p-6"
      noValidate
    >
      <div>
        <h2 id="pms-inputs-heading" className="font-serif text-xl text-brand-800">
          Complaint / Vigilance 데이터 입력
        </h2>
        <p className="mt-1 text-sm text-ink-600">
          PMS 보고서 입력으로 통합되는 불만 및 경계 데이터를 기록합니다.
        </p>
      </div>

      {/* Source (REQ-PMS-005/006) */}
      <div>
        <label className="block text-sm font-medium text-ink-700" htmlFor={sourceId}>
          데이터 유형{' '}
          <span aria-hidden="true" className="text-danger">
            *
          </span>
          <span className="sr-only"> (필수)</span>
        </label>
        <select
          id={sourceId}
          required
          value={source}
          onChange={(e) => setSource(e.target.value)}
          className="mt-1 w-full rounded border border-ink-300 px-3 py-2 text-sm text-ink-800 focus-visible:border-brand-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2"
        >
          {SOURCE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {/* Severity */}
      <div>
        <label className="block text-sm font-medium text-ink-700" htmlFor={severityId}>
          심각도
        </label>
        <select
          id={severityId}
          value={severity}
          onChange={(e) => setSeverity(e.target.value)}
          className="mt-1 w-full rounded border border-ink-300 px-3 py-2 text-sm text-ink-800 focus-visible:border-brand-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2"
        >
          {SEVERITY_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {/* SUSAR flag (REQ-PMS-005) */}
      <label className="flex items-center gap-2 text-sm text-ink-700">
        <input
          type="checkbox"
          checked={susarFlag}
          onChange={(e) => setSusarFlag(e.target.checked)}
          className="rounded border-ink-300 focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2"
        />
        SUSAR (Suspected Unexpected Serious Adverse Reaction)
      </label>

      {/* Trend category */}
      <div>
        <label className="block text-sm font-medium text-ink-700" htmlFor={`${sourceId}-trend`}>
          추세 카테고리 (선택)
        </label>
        <input
          id={`${sourceId}-trend`}
          type="text"
          maxLength={64}
          value={trendCategory}
          onChange={(e) => setTrendCategory(e.target.value)}
          className="mt-1 w-full rounded border border-ink-300 px-3 py-2 text-sm text-ink-800 focus-visible:border-brand-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2"
          placeholder="예: infection_rate_increase"
        />
      </div>

      {/* Free-form payload */}
      <div>
        <label className="block text-sm font-medium text-ink-700" htmlFor={`${sourceId}-payload`}>
          추가 메모 / JSON 페이로드 (선택)
        </label>
        <textarea
          id={`${sourceId}-payload`}
          rows={3}
          value={payload}
          onChange={(e) => setPayload(e.target.value)}
          className="mt-1 w-full rounded border border-ink-300 px-3 py-2 text-sm text-ink-800 focus-visible:border-brand-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2"
          placeholder='예: {"device_id": "DEV-001", "event_date": "2026-01-15"}'
        />
      </div>

      <button
        type="submit"
        disabled={!sourceValid || status === 'loading'}
        data-testid="pms-inputs-submit"
        className="w-fit rounded bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {status === 'loading' ? '저장 중...' : '데이터 저장'}
      </button>

      {status === 'loading' && (
        <output
          className="flex items-center gap-2 text-sm text-brand-600"
          aria-live="polite"
          data-testid="pms-inputs-loading"
        >
          <span
            className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-brand-300 border-t-brand-600 motion-safe:animate-spin"
            aria-hidden="true"
          />
          데이터를 저장하는 중...
        </output>
      )}

      {/* REQ-PMS-012: inline error message on 400 */}
      {status === 'error' && (
        <p
          className="rounded border border-danger/30 bg-danger-bg px-3 py-2 text-sm text-danger"
          role="alert"
          data-testid="pms-inputs-error"
        >
          {errorMessage}
        </p>
      )}

      {status === 'done' && (
        <output
          className="rounded border border-success/30 bg-success-bg px-3 py-2 text-sm text-success"
          aria-live="polite"
          data-testid="pms-inputs-success"
        >
          <span aria-hidden="true">✓</span> 데이터가 저장되었습니다.
        </output>
      )}
    </form>
  );
}
