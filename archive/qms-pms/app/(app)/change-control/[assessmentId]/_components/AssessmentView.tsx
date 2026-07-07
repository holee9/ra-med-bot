
// @MX:LEGACY archived from app
'use client';

// @MX:NOTE [AUTO] AssessmentView — verdict display + expert review gate + export (client island).
// @MX:SPEC SPEC-REGULA-CHANGE-CONTROL-001 (REQ-004, REQ-006, REQ-007, REQ-009, REQ-010, REQ-011, AC-03/05/06/07/08)
//
// Renders the per-jurisdiction verdicts, provisional badge, expert review
// action button, and the PDF export button. Mirrors the PmsWorkbench client
// island pattern: the RSC shell pre-fetches data server-side and passes it
// here as initial props; this island handles mutations (review, export).

import { ProvisionalBadge } from '@/components/change-control/ProvisionalBadge';
import { VerdictCard } from '@/components/change-control/VerdictCard';
import { CHANGE_TYPE_LABELS } from '@/components/change-control/verdict-labels';
import {
  type AssessmentDetailResponse,
  confirmExpertReview,
  exportAssessment,
} from '@/lib/change-control/api-client';
import { AlertTriangle, CheckCircle2, FileDown, Loader2 } from 'lucide-react';
import { useCallback, useState } from 'react';

interface AssessmentViewProps {
  assessmentId: string;
  initial: AssessmentDetailResponse;
  /** ra-lead can review + export; ra-member is read-only. */
  canManage: boolean;
  /** ra-lead+ can export. */
  canExport: boolean;
}

export function AssessmentView({
  assessmentId,
  initial,
  canManage,
  canExport,
}: AssessmentViewProps) {
  const [detail, setDetail] = useState<AssessmentDetailResponse>(initial);
  const [reviewing, setReviewing] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const [exportNotice, setExportNotice] = useState<string | null>(null);

  const isProvisional = detail.isProvisional || detail.assessment.status === 'provisional';
  const changeTypeLabel = CHANGE_TYPE_LABELS[detail.assessment.changeType];

  const handleReview = useCallback(async () => {
    if (!canManage) return;
    setReviewing(true);
    setReviewError(null);
    try {
      await confirmExpertReview(assessmentId);
      // Optimistic state transition — REQ-009 provisional → reviewed.
      setDetail((prev) => ({
        ...prev,
        assessment: { ...prev.assessment, status: 'reviewed', updatedAt: new Date().toISOString() },
        isProvisional: false,
      }));
    } catch (err) {
      setReviewError(err instanceof Error ? err.message : '검토 확정 실패');
    } finally {
      setReviewing(false);
    }
  }, [assessmentId, canManage]);

  const handleExport = useCallback(async () => {
    if (!canExport || isProvisional) return;
    setExporting(true);
    setExportError(null);
    setExportNotice(null);
    try {
      const report = await exportAssessment(assessmentId);
      // MVP: the backend returns `format: 'pdf-json'` — a structured report,
      // not a PDF byte stream (Phase 6+ will wire real PDF rendering).
      // We surface this honestly: download the canonical JSON as a stub report
      // and label it as the MVP format.
      const blob = new Blob([JSON.stringify(report, null, 2)], {
        type: 'application/json',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `change-assessment-${assessmentId}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setExportNotice(
        '평가 보고서를 내보냈습니다. (Beta: PDF 렌더링은 Phase 6+ 예정 — 현재는 정형 JSON 보고서로 제공됩니다.)',
      );
    } catch (err) {
      setExportError(err instanceof Error ? err.message : 'export 실패');
    } finally {
      setExporting(false);
    }
  }, [assessmentId, canExport, isProvisional]);

  return (
    <div className="flex flex-col gap-6" data-testid="assessment-view">
      {/* Header: status + metadata */}
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-3">
            <h1 className="font-serif text-2xl text-brand-800" data-testid="assessment-change-type">
              {changeTypeLabel.ko} 평가
            </h1>
            <ProvisionalBadge reviewed={!isProvisional} />
          </div>
          <p className="text-xs text-ink-500">
            평가 ID: <span className="font-mono">{assessmentId}</span>
          </p>
        </div>

        {/* Action bar */}
        <div className="flex flex-wrap items-center gap-2">
          {canManage && isProvisional && (
            <button
              type="button"
              onClick={handleReview}
              disabled={reviewing}
              className="inline-flex items-center gap-1.5 rounded-md bg-brand-800 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
              data-testid="cc-review-confirm-btn"
              aria-busy={reviewing}
            >
              {reviewing ? (
                <Loader2 aria-hidden="true" size={14} className="animate-spin" />
              ) : (
                <CheckCircle2 aria-hidden="true" size={14} />
              )}
              검토 완료
            </button>
          )}
          <button
            type="button"
            onClick={handleExport}
            disabled={!canExport || isProvisional || exporting}
            className="inline-flex items-center gap-1.5 rounded-md border border-ink-300 bg-surface px-4 py-2 text-sm font-medium text-ink-700 hover:bg-ink-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
            data-testid="cc-export-btn"
            aria-busy={exporting}
            aria-disabled={!canExport || isProvisional}
            title={
              isProvisional
                ? '전문가 검토 완료 후 내보낼 수 있습니다'
                : canExport
                  ? '평가 보고서 내보내기'
                  : 'export 권한이 필요합니다 (change.export)'
            }
          >
            {exporting ? (
              <Loader2 aria-hidden="true" size={14} className="animate-spin" />
            ) : (
              <FileDown aria-hidden="true" size={14} />
            )}
            PDF 내보내기
            {isProvisional && (
              <span className="ml-1 rounded-xs bg-amber-100 px-1.5 py-0.5 text-[10px] text-amber-800">
                Beta
              </span>
            )}
          </button>
        </div>
      </header>

      {/* REQ-011 provisional isolation banner */}
      {isProvisional && (
        <div
          className="flex items-start gap-2 rounded-md border border-amber-400/40 bg-amber-50 px-4 py-3 text-sm text-amber-800"
          role="alert"
          data-testid="cc-provisional-banner"
        >
          <AlertTriangle aria-hidden="true" size={16} className="mt-0.5 shrink-0" />
          <div>
            <p className="font-medium">전문가 검토 대기 중 (Provisional)</p>
            <p className="mt-0.5 text-xs">
              AI verdict는 전문가(RA Lead) 검토 완료 전까지 provisional로 표시되며, PDF 내보내기에서
              제외됩니다. (REQ-009 / REQ-011)
            </p>
          </div>
        </div>
      )}

      {/* Error surfaces */}
      {reviewError && (
        <p
          className="rounded-xs border border-danger/30 bg-danger-bg px-3 py-2 text-sm text-danger"
          role="alert"
          data-testid="cc-review-error"
        >
          {reviewError}
        </p>
      )}
      {exportError && (
        <p
          className="rounded-xs border border-danger/30 bg-danger-bg px-3 py-2 text-sm text-danger"
          role="alert"
          data-testid="cc-export-error"
        >
          {exportError}
        </p>
      )}
      {exportNotice && (
        <output
          className="block rounded-xs border border-success/30 bg-success-bg px-3 py-2 text-sm text-success"
          data-testid="cc-export-notice"
        >
          {exportNotice}
        </output>
      )}

      {/* Verdict grid */}
      <section aria-label="관할권별 verdict">
        <h2 className="mb-3 font-serif text-xl text-brand-700">관할권별 규제 영향 평가</h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2" data-testid="cc-verdict-grid">
          {detail.verdicts.map((v) => (
            <VerdictCard key={v.id} verdict={v} />
          ))}
        </div>
      </section>

      {/* ISO 14971 risk links (REQ-008) */}
      <section aria-label="ISO 14971 위험 재평가 연계">
        <h2 className="mb-3 font-serif text-xl text-brand-700">ISO 14971 위험 재평가 연계</h2>
        {detail.riskLinks.length === 0 ? (
          <p
            className="rounded-md border border-ink-200 bg-ink-50 px-4 py-3 text-sm text-ink-600"
            data-testid="cc-risk-links-empty"
          >
            이 평가에 연결된 위험 항목이 없습니다.
          </p>
        ) : (
          <ul className="flex flex-col gap-2" data-testid="cc-risk-links-list">
            {detail.riskLinks.map((r) => (
              <li
                key={r.riskItemId}
                className="flex items-center justify-between rounded-md border border-ink-200 bg-surface px-4 py-2.5"
                data-testid={`cc-risk-link-${r.riskItemId}`}
              >
                <div className="flex flex-col">
                  <span className="text-sm font-medium text-ink-800">{r.title}</span>
                  {r.severity && <span className="text-xs text-ink-500">심각도: {r.severity}</span>}
                </div>
                {r.recommendedForReevaluation && (
                  <span className="rounded-xs bg-warn-bg px-2 py-0.5 text-xs font-medium text-warn">
                    재평가 권장
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Version metadata (REQ-010, AC-08) */}
      <section
        aria-label="모델/프롬프트/템플릿 버전 메타데이터"
        className="rounded-md border border-ink-100 bg-ink-50/60 px-4 py-3"
        data-testid="cc-version-metadata"
      >
        <h2 className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-ink-500">
          버전 메타데이터 (롤백 추적)
        </h2>
        <dl className="grid grid-cols-1 gap-2 text-xs text-ink-600 sm:grid-cols-3">
          <div>
            <dt className="font-medium text-ink-500">Model</dt>
            <dd className="font-mono text-ink-700" data-testid="cc-model-version">
              {detail.assessment.modelVersion}
            </dd>
          </div>
          <div>
            <dt className="font-medium text-ink-500">Prompt</dt>
            <dd className="font-mono text-ink-700" data-testid="cc-prompt-version">
              {detail.assessment.promptVersion}
            </dd>
          </div>
          <div>
            <dt className="font-medium text-ink-500">Template</dt>
            <dd className="font-mono text-ink-700" data-testid="cc-template-version">
              {detail.assessment.templateVersion}
            </dd>
          </div>
        </dl>
      </section>
    </div>
  );
}
