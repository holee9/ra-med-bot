'use client';
// @MX:NOTE [AUTO] PmsReportWizard — PMS report generation wizard (MDCG 2022-21).
// @MX:SPEC SPEC-REGULA-PMS-001 (REQ-PMS-002, REQ-PMS-004, REQ-PMS-008, AC-02)
//
// 2-step wizard: (1) device info form, (2) result with MDCG 2022-21 sections +
// citations. POSTs to /api/workflows/pms-report/run. The backend re-checks
// permissions via withPermission('workflow.execute') — the client gate is UX-only.

import { useId, useState } from 'react';
import { CERLinkageIndicator } from './CERLinkageIndicator';

const DEVICE_CLASSES = ['I', 'Is', 'Im', 'IIa', 'IIb', 'III'] as const;
type DeviceClass = (typeof DEVICE_CLASSES)[number];

interface PmsReportResponse {
  runId: string;
  documentId: string;
  status: 'complete' | 'pending';
  confidence: 'verified' | 'unverified';
  sections: Record<string, string>;
}

interface PmsReportWizardProps {
  projectId: string;
  /** ra-lead+ can submit. When false the form is disabled. */
  canManage: boolean;
  /** CER reference id for display (when available). */
  cerRefId?: string | null;
  cerDeviceName?: string | null;
}

export function PmsReportWizard({
  projectId,
  canManage,
  cerRefId = null,
  cerDeviceName = null,
}: PmsReportWizardProps) {
  const [deviceName, setDeviceName] = useState('');
  const [deviceClass, setDeviceClass] = useState<DeviceClass | ''>('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [data, setData] = useState<PmsReportResponse | null>(null);

  const nameId = useId();

  const nameValid = deviceName.trim().length >= 2;
  const classValid = deviceClass !== '';
  const canSubmit = canManage && status !== 'loading' && nameValid && classValid;

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSubmit) return;

    const payload = {
      projectId,
      deviceName: deviceName.trim(),
      deviceClass: deviceClass as DeviceClass,
    };

    setStatus('loading');
    setData(null);
    setErrorMessage('');

    try {
      const res = await fetch('/api/workflows/pms-report/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? `요청 실패 (HTTP ${res.status})`);
      }

      const json = (await res.json()) as PmsReportResponse;
      setData(json);
      setStatus('done');
    } catch (err) {
      setStatus('error');
      setErrorMessage(err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다.');
    }
  }

  // --- Result view (Step 2) ---
  if (status === 'done' && data) {
    return <PmsReportResult data={data} cerRefId={cerRefId} cerDeviceName={cerDeviceName} />;
  }

  // --- Wizard form (Step 1) ---
  return (
    <form
      onSubmit={handleSubmit}
      aria-labelledby="pms-report-heading"
      className="flex flex-col gap-6 rounded-lg border border-ink-200 bg-white p-6"
      noValidate
    >
      <div>
        <h2 id="pms-report-heading" className="font-serif text-xl text-brand-800">
          PMS 보고서 생성 (MDCG 2022-21)
        </h2>
        <p className="mt-1 text-sm text-ink-600">
          EU MDR Article 83-86 기반 사후시장 감시 보고서를 생성합니다. MDCG 2022-21 섹션 구조를
          따릅니다.
        </p>
      </div>

      {/* CER linkage indicator (REQ-PMS-004) */}
      <div>
        <CERLinkageIndicator cerRefId={cerRefId} cerDeviceName={cerDeviceName} />
      </div>

      {/* Permission notice */}
      {!canManage && (
        <p
          className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800"
          data-testid="pms-permission-notice"
        >
          PMS 보고서를 생성하려면 RA Lead 이상의 권한이 필요합니다.
        </p>
      )}

      {/* Device name */}
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

      {/* Device class */}
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

      {/* Submit */}
      <button
        type="submit"
        disabled={!canSubmit}
        data-testid="pms-report-submit"
        className="w-fit rounded bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {status === 'loading' ? '생성 중...' : 'PMS 보고서 생성'}
      </button>

      {status === 'loading' && (
        <output
          className="flex items-center gap-2 text-sm text-brand-600"
          aria-live="polite"
          data-testid="pms-report-loading"
        >
          <span
            className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-brand-300 border-t-brand-600 motion-safe:animate-spin"
            aria-hidden="true"
          />
          MDCG 2022-21 섹션 구조를 생성하는 중...
        </output>
      )}

      {status === 'error' && (
        <p
          className="rounded border border-danger/30 bg-danger-bg px-3 py-2 text-sm text-danger"
          role="alert"
          data-testid="pms-report-error"
        >
          {errorMessage}
        </p>
      )}
    </form>
  );
}

// --- Result view ---

interface PmsReportResultProps {
  data: PmsReportResponse;
  cerRefId: string | null;
  cerDeviceName: string | null;
}

function PmsReportResult({ data, cerRefId, cerDeviceName }: PmsReportResultProps) {
  const sectionEntries = Object.entries(data.sections);

  return (
    <div className="flex flex-col gap-4" data-testid="pms-report-result">
      {/* Confidence badge (REQ-PMS-008) */}
      <div className="flex items-center gap-2">
        {data.confidence === 'verified' ? (
          <span
            className="inline-flex items-center gap-1 rounded bg-success-bg px-2 py-0.5 text-xs font-semibold text-success"
            data-testid="pms-confidence-verified"
          >
            <span aria-hidden="true">✓</span>
            검증됨 (citation 확인 완료)
          </span>
        ) : (
          <span
            className="inline-flex items-center gap-1 rounded bg-danger/10 px-2 py-0.5 text-xs font-semibold text-danger"
            data-testid="pms-confidence-unverified"
            title="LLM이 생성한 인용이 검색된 소스와 일치하지 않습니다."
          >
            <span aria-hidden="true">⚠</span>
            미검증 (citation 매칭 실패)
          </span>
        )}
      </div>

      {/* CER linkage indicator on result too */}
      <div>
        <CERLinkageIndicator cerRefId={cerRefId} cerDeviceName={cerDeviceName} />
      </div>

      {/* Sections (MDCG 2022-21) */}
      <div className="rounded-lg border border-brand-200 bg-brand-50 p-4">
        <h2 className="font-serif text-lg text-brand-800">PMS 보고서 — MDCG 2022-21</h2>
        <p className="mt-1 text-xs text-ink-500">
          워크플로우 실행 ID: <code className="font-mono">{data.runId}</code>
        </p>
      </div>

      {sectionEntries.length > 0 && (
        <div className="flex flex-col gap-3" data-testid="pms-report-sections">
          {sectionEntries.map(([key, content]) => (
            <section key={key} className="rounded border border-ink-200 bg-white p-4">
              <h3 className="font-serif text-sm font-medium text-brand-700">
                {SECTION_LABELS[key] ?? key}
              </h3>
              <p className="mt-1 text-sm leading-relaxed text-ink-700 whitespace-pre-wrap">
                {content}
              </p>
            </section>
          ))}
        </div>
      )}

      {/* Expert review gating (REQ-PMS-009) — draft docs cannot export/close */}
      {data.status === 'pending' && (
        <p
          className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800"
          data-testid="pms-expert-review-gating"
        >
          <strong>전문가 검토 필요.</strong> 이 문서는 초안 상태입니다. 전문가 검토 완료 전까지
          export 또는 close할 수 없습니다.
        </p>
      )}
    </div>
  );
}

const SECTION_LABELS: Record<string, string> = {
  executive_summary: 'Executive Summary',
  device_description: 'Device Description',
  intended_use: 'Intended Use',
  pms_plan_summary: 'PMS Plan Summary',
  complaint_data: 'Complaint Data',
  vigilance_data: 'Vigilance Data',
  susar_trend_reporting: 'SUSAR / Trend Reporting',
  pmcf_findings: 'PMCF Findings',
  risk_benefit_reassessment: 'Risk-Benefit Reassessment',
  corrective_actions: 'Corrective Actions',
  conclusions: 'Conclusions',
};
