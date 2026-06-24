'use client';

// @MX:NOTE [AUTO] LabelingWorkbench — section tabs + checklist + claims + translations + gates.
// @MX:SPEC SPEC-REGULA-LABELING-001 (REQ-001~007, REQ-009, REQ-012, AC-01/02/03/04/05/08)
//
// Client island handling all labeling mutations: section content (read-only view
// of pre-created 5 sections), jurisdiction checklist (GET), claim input + citation
// linking + comparative/expert-review warnings (POST claims), translation diff
// (POST translations), RA-lead approval gate (POST approve), export gate with
// unsupported-claim 403 handling (POST export). Mirrors the AssessmentView
// client-island pattern (RSC shell pre-fetches, island handles mutations).
//
// #65 eSubmit stub disclosure: the approve response carries `esubmitForwarded:
// false` until #65 ships. We surface this as an explicit "eSubmit 연동: Beta"
// label next to the approve action (QA requirement: beta state must be visible).

import {
  ComparableClaimBadge,
  ExpertReviewRequiredBadge,
} from '@/components/labeling/ClaimWarningBadges';
import { LabelingStatusBadge } from '@/components/labeling/LabelingStatusBadge';
import {
  type ChecklistEvaluationResponse,
  type CreateClaimResponse,
  type CreateTranslationResponse,
  type LabelingDocumentDetailResponse,
  approveDocument,
  createClaim,
  createTranslation,
  exportDocument,
  fetchChecklist,
} from '@/lib/labeling/api-client';
import { ALL_LABELING_JURISDICTIONS } from '@/lib/labeling/jurisdiction-checklist';
import { SECTION_TYPE_LABELS } from '@/lib/labeling/section-builder';
import type { LabelingJurisdiction, LabelingSectionType } from '@/lib/labeling/types';
import { AlertTriangle, CheckCircle2, FileDown, Loader2 } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';

interface LabelingWorkbenchProps {
  documentId: string;
  initial: LabelingDocumentDetailResponse;
  /** ra-member+ can edit (create claims/translations). */
  canEdit: boolean;
  /** ra-lead only can approve (REQ-012). */
  canApprove: boolean;
  /** ra-lead only can export (label.export mirrors label.approve). */
  canExport: boolean;
}

type TabId = 'sections' | 'checklist' | 'claims' | 'translations';

const TABS: ReadonlyArray<{ id: TabId; label: string }> = [
  { id: 'sections', label: '섹션' },
  { id: 'checklist', label: '관할권 체크리스트' },
  { id: 'claims', label: 'Claim 검증' },
  { id: 'translations', label: '번역 diff' },
] as const;

const JURISDICTION_LABEL: Readonly<Record<LabelingJurisdiction, string>> = {
  FDA: 'FDA',
  EU_MDR: 'EU MDR',
  MFDS: 'MFDS',
  NMPA: 'NMPA',
  PMDA: 'PMDA',
};

export function LabelingWorkbench({
  documentId,
  initial,
  canEdit,
  canApprove,
  canExport,
}: LabelingWorkbenchProps) {
  const [detail, setDetail] = useState<LabelingDocumentDetailResponse>(initial);
  const [activeTab, setActiveTab] = useState<TabId>('sections');
  const [checklist, setChecklist] = useState<ChecklistEvaluationResponse | null>(null);
  const [checklistLoading, setChecklistLoading] = useState(false);
  const [checklistError, setChecklistError] = useState<string | null>(null);
  const [selectedJurisdiction, setSelectedJurisdiction] = useState<LabelingJurisdiction>(
    initial.document.jurisdiction,
  );

  const [approveError, setApproveError] = useState<string | null>(null);
  const [approveNotice, setApproveNotice] = useState<string | null>(null);
  const [approving, setApproving] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [exportNotice, setExportNotice] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  const isApproved = detail.document.status === 'approved';

  // REQ-002/011: fetch checklist whenever jurisdiction or document changes.
  const loadChecklist = useCallback(
    async (jurisdiction: LabelingJurisdiction) => {
      setChecklistLoading(true);
      setChecklistError(null);
      try {
        const evalResult = await fetchChecklist(documentId, jurisdiction);
        setChecklist(evalResult);
      } catch (err) {
        setChecklistError(err instanceof Error ? err.message : '체크리스트 조회 실패');
        setChecklist(null);
      } finally {
        setChecklistLoading(false);
      }
    },
    [documentId],
  );

  useEffect(() => {
    void loadChecklist(selectedJurisdiction);
  }, [loadChecklist, selectedJurisdiction]);

  const handleApprove = useCallback(async () => {
    if (!canApprove || isApproved) return;
    setApproving(true);
    setApproveError(null);
    setApproveNotice(null);
    try {
      const result = await approveDocument(documentId);
      // Optimistic state transition — REQ-012 approval flips status.
      setDetail((prev) => ({
        ...prev,
        document: { ...prev.document, status: 'approved' },
      }));
      // #65 eSubmit stub disclosure — forwarded:false is expected until #65 ships.
      const esubmitNote = result.esubmitForwarded
        ? '승인본이 eSubmit 패키지로 전달되었습니다.'
        : 'eSubmit 연동: #65 구현 후 활성화 예정 (Beta — 현재는 전달되지 않습니다).';
      setApproveNotice(`라벨링 문서가 승인되었습니다. ${esubmitNote}`);
    } catch (err) {
      setApproveError(err instanceof Error ? err.message : '승인 실패');
    } finally {
      setApproving(false);
    }
  }, [canApprove, documentId, isApproved]);

  const handleExport = useCallback(async () => {
    if (!canExport) return;
    setExporting(true);
    setExportError(null);
    setExportNotice(null);
    try {
      const report = await exportDocument(documentId);
      // MVP: download the canonical JSON (mirrors change-control export pattern).
      // Phase 6+ may wire a richer exporter via the export-hub.
      const blob = new Blob([JSON.stringify(report, null, 2)], {
        type: 'application/json',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `labeling-${documentId}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setExportNotice('라벨링 문서를 내보냈습니다. (Beta: 정형 JSON 보고서로 제공됩니다.)');
    } catch (err) {
      setExportError(err instanceof Error ? err.message : 'export 실패');
    } finally {
      setExporting(false);
    }
  }, [canExport, documentId]);

  const sectionsById = useMemo(() => {
    const map = new Map<LabelingSectionType, (typeof detail.sections)[number]>();
    for (const s of detail.sections) {
      map.set(s.sectionType, s);
    }
    return map;
  }, [detail.sections]);

  return (
    <div className="flex flex-col gap-6" data-testid="labeling-workbench">
      {/* Header: status + metadata */}
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-3">
            <h1 className="font-serif text-2xl text-brand-800" data-testid="labeling-product-name">
              {detail.document.productName}
            </h1>
            <LabelingStatusBadge status={detail.document.status} />
          </div>
          <p className="text-xs text-ink-500">
            문서 ID: <span className="font-mono">{documentId}</span> · 관할권:{' '}
            {JURISDICTION_LABEL[detail.document.jurisdiction]}
          </p>
        </div>

        {/* Action bar: approve (REQ-012) + export (REQ-006) */}
        <div className="flex flex-wrap items-center gap-2">
          {canApprove && !isApproved && (
            <button
              type="button"
              onClick={handleApprove}
              disabled={approving}
              className="inline-flex items-center gap-1.5 rounded-md bg-brand-800 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
              data-testid="labeling-approve-btn"
              aria-busy={approving}
            >
              {approving ? (
                <Loader2 aria-hidden="true" size={14} className="animate-spin" />
              ) : (
                <CheckCircle2 aria-hidden="true" size={14} />
              )}
              승인 (RA Lead)
              <span className="ml-1 rounded-xs bg-amber-100 px-1.5 py-0.5 text-[10px] text-amber-800">
                eSubmit Beta
              </span>
            </button>
          )}
          <button
            type="button"
            onClick={handleExport}
            disabled={!canExport || exporting}
            className="inline-flex items-center gap-1.5 rounded-md border border-ink-300 bg-surface px-4 py-2 text-sm font-medium text-ink-700 hover:bg-ink-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
            data-testid="labeling-export-btn"
            aria-busy={exporting}
            aria-disabled={!canExport}
            title={
              canExport
                ? '라벨링 문서 내보내기 (미해결 claim 존재 시 차단)'
                : 'export 권한이 필요합니다 (label.export — RA Lead)'
            }
          >
            {exporting ? (
              <Loader2 aria-hidden="true" size={14} className="animate-spin" />
            ) : (
              <FileDown aria-hidden="true" size={14} />
            )}
            내보내기
          </button>
        </div>
      </header>

      {/* REQ-006 export-gate banner: shown when not yet approved. */}
      {!isApproved && (
        <div
          className="flex items-start gap-2 rounded-md border border-amber-400/40 bg-amber-50 px-4 py-3 text-sm text-amber-800"
          role="alert"
          data-testid="labeling-draft-banner"
        >
          <AlertTriangle aria-hidden="true" size={16} className="mt-0.5 shrink-0" />
          <div>
            <p className="font-medium">승인 대기 중 (Draft)</p>
            <p className="mt-0.5 text-xs">
              모든 claim의 citation이 확인되고, 체크리스트가 100% 충족되어야 RA Lead 승인이
              가능합니다. 미해결(unsupported/expert-review-required) claim이 존재하면 export가
              차단됩니다 (REQ-004, REQ-006).
            </p>
          </div>
        </div>
      )}

      {/* Error / notice surfaces */}
      {approveError && (
        <p
          className="rounded-xs border border-danger/30 bg-danger-bg px-3 py-2 text-sm text-danger"
          role="alert"
          data-testid="labeling-approve-error"
        >
          {approveError}
        </p>
      )}
      {approveNotice && (
        <output
          className="block rounded-xs border border-success/30 bg-success-bg px-3 py-2 text-sm text-success"
          data-testid="labeling-approve-notice"
        >
          {approveNotice}
        </output>
      )}
      {exportError && (
        <p
          className="rounded-xs border border-danger/30 bg-danger-bg px-3 py-2 text-sm text-danger"
          role="alert"
          data-testid="labeling-export-error"
        >
          {exportError}
        </p>
      )}
      {exportNotice && (
        <output
          className="block rounded-xs border border-success/30 bg-success-bg px-3 py-2 text-sm text-success"
          data-testid="labeling-export-notice"
        >
          {exportNotice}
        </output>
      )}

      {/* Tabs */}
      <div
        role="tablist"
        aria-label="라벨링 워크벤치 섹션"
        className="flex flex-wrap gap-1 border-b border-ink-200"
      >
        {TABS.map((tab) => {
          const selected = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={selected}
              aria-controls={`labeling-panel-${tab.id}`}
              id={`labeling-tab-${tab.id}`}
              onClick={() => setActiveTab(tab.id)}
              className={[
                'rounded-t-md px-4 py-2 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2',
                selected
                  ? 'border-x border-t border-ink-200 bg-surface text-brand-800 -mb-px'
                  : 'text-ink-600 hover:text-ink-800',
              ].join(' ')}
              data-testid={`labeling-tab-${tab.id}`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab panels */}
      {activeTab === 'sections' && (
        <SectionListPanel sections={detail.sections} sectionsById={sectionsById} />
      )}
      {activeTab === 'checklist' && (
        <ChecklistPanel
          jurisdiction={selectedJurisdiction}
          onSelectJurisdiction={setSelectedJurisdiction}
          checklist={checklist}
          loading={checklistLoading}
          error={checklistError}
        />
      )}
      {activeTab === 'claims' && (
        <ClaimsPanel documentId={documentId} sectionsById={sectionsById} canEdit={canEdit} />
      )}
      {activeTab === 'translations' && (
        <TranslationsPanel documentId={documentId} sectionsById={sectionsById} canEdit={canEdit} />
      )}
    </div>
  );
}

/* ------------------------------- Sections tab ------------------------------ */

interface SectionListPanelProps {
  sections: LabelingDocumentDetailResponse['sections'];
  sectionsById: Map<LabelingSectionType, LabelingDocumentDetailResponse['sections'][number]>;
}

function SectionListPanel({ sections }: SectionListPanelProps) {
  return (
    <section
      id="labeling-panel-sections"
      role="tabpanel"
      aria-labelledby="labeling-tab-sections"
      className="flex flex-col gap-4"
      data-testid="labeling-sections-panel"
    >
      <h2 className="font-serif text-xl text-brand-700">구조화 섹션 (REQ-001)</h2>
      <p className="text-sm text-ink-600">
        라벨링 문서는 intended use·indication·contraindication·warning·precaution 5개 섹션으로
        구성됩니다. 각 섹션의 내용은 체크리스트 커버리지 산정에 사용됩니다.
      </p>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {sections.map((s) => (
          <article
            key={s.id}
            className="rounded-md border border-ink-200 bg-surface p-4"
            data-testid={`labeling-section-${s.sectionType}`}
          >
            <h3 className="mb-2 text-sm font-semibold text-brand-700">
              {SECTION_TYPE_LABELS[s.sectionType]}
              <span className="ml-2 text-xs font-normal text-ink-500">({s.locale})</span>
            </h3>
            {s.content.trim().length > 0 ? (
              <p className="whitespace-pre-wrap text-sm text-ink-700">{s.content}</p>
            ) : (
              <p className="text-xs italic text-ink-400">내용이 아직 입력되지 않았습니다.</p>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}

/* ------------------------------- Checklist tab ----------------------------- */

interface ChecklistPanelProps {
  jurisdiction: LabelingJurisdiction;
  onSelectJurisdiction: (j: LabelingJurisdiction) => void;
  checklist: ChecklistEvaluationResponse | null;
  loading: boolean;
  error: string | null;
}

function ChecklistPanel({
  jurisdiction,
  onSelectJurisdiction,
  checklist,
  loading,
  error,
}: ChecklistPanelProps) {
  return (
    <section
      id="labeling-panel-checklist"
      role="tabpanel"
      aria-labelledby="labeling-tab-checklist"
      className="flex flex-col gap-4"
      data-testid="labeling-checklist-panel"
    >
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h2 className="font-serif text-xl text-brand-700">관할권 필수 표시사항 (REQ-002/011)</h2>
        <div className="flex flex-col gap-1">
          <label
            htmlFor="labeling-checklist-jurisdiction"
            className="text-xs font-medium text-ink-600"
          >
            관할권 전환
          </label>
          <select
            id="labeling-checklist-jurisdiction"
            value={jurisdiction}
            onChange={(e) => onSelectJurisdiction(e.target.value as LabelingJurisdiction)}
            className="rounded-md border border-ink-200 bg-surface px-3 py-1.5 text-sm text-ink-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2"
            data-testid="labeling-checklist-jurisdiction-select"
          >
            {ALL_LABELING_JURISDICTIONS.map((j) => (
              <option key={j} value={j}>
                {JURISDICTION_LABEL[j]}
              </option>
            ))}
          </select>
        </div>
      </div>

      {loading && (
        <p className="text-sm text-ink-500" data-testid="labeling-checklist-loading">
          체크리스트 계산 중…
        </p>
      )}
      {error && (
        <p
          className="rounded-xs border border-danger/30 bg-danger-bg px-3 py-2 text-sm text-danger"
          role="alert"
        >
          {error}
        </p>
      )}
      {checklist && !loading && <ChecklistResult evaluation={checklist} />}
    </section>
  );
}

function ChecklistResult({ evaluation }: { evaluation: ChecklistEvaluationResponse }) {
  const isComplete = evaluation.coveragePercent >= 100;
  return (
    <div className="flex flex-col gap-4" data-testid="labeling-checklist-result">
      {/* Coverage meter */}
      <div
        className="rounded-md border border-ink-200 bg-ink-50/60 px-4 py-3"
        data-testid="labeling-checklist-coverage"
      >
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-ink-700">커버리지</span>
          <span
            className={`font-mono text-lg font-semibold ${
              isComplete ? 'text-success' : 'text-amber-700'
            }`}
          >
            {evaluation.coveragePercent}%
          </span>
        </div>
        <p className="mt-1 text-xs text-ink-500">
          {evaluation.satisfied} / {evaluation.total} 항목 충족
          {!isComplete && ' — 100% 달성 시 승인 가능 (REQ-011)'}
        </p>
      </div>

      {/* Missing elements */}
      {evaluation.missing.length > 0 ? (
        <div>
          <h3 className="mb-2 text-sm font-semibold text-danger">누락된 필수 항목</h3>
          <ul className="flex flex-col gap-2" data-testid="labeling-checklist-missing">
            {evaluation.missing.map((m) => (
              <li
                key={m.id}
                className="rounded-md border border-amber-400/40 bg-amber-50 px-3 py-2 text-sm text-amber-900"
              >
                <span className="font-medium">{m.title}</span>
                {m.ref && <span className="ml-2 text-xs text-amber-700">({m.ref})</span>}
                {m.sectionType && (
                  <span className="ml-2 text-xs text-amber-700">
                    → {SECTION_TYPE_LABELS[m.sectionType]} 섹션 입력 필요
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <div
          className="flex items-center gap-2 rounded-md border border-success/30 bg-success-bg px-4 py-3 text-sm text-success"
          data-testid="labeling-checklist-complete"
          aria-label="체크리스트 100% 완료"
        >
          <CheckCircle2 aria-hidden="true" size={16} />
          모든 필수 표시사항이 충족되었습니다 (100%).
        </div>
      )}
    </div>
  );
}

/* -------------------------------- Claims tab ------------------------------ */

interface ClaimsPanelProps {
  documentId: string;
  sectionsById: Map<LabelingSectionType, LabelingDocumentDetailResponse['sections'][number]>;
  canEdit: boolean;
}

function ClaimsPanel({ documentId, sectionsById, canEdit }: ClaimsPanelProps) {
  // Track claims created in this session (the list endpoint is out of scope;
  // we surface each created claim's validation result inline).
  const [results, setResults] = useState<CreateClaimResponse[]>([]);
  const [sectionId, setSectionId] = useState<string>(sectionsById.get('intended_use')?.id ?? '');
  const [claimText, setClaimText] = useState('');
  const [citations, setCitations] = useState<string>(''); // textarea: one citation per line as `source|excerpt`
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = useCallback(async () => {
    if (!canEdit) return;
    if (!sectionId || !claimText.trim()) {
      setError('섹션과 claim 문구를 입력하세요.');
      return;
    }
    // Parse citations: each non-empty line as "source|excerpt" (or "source|section|excerpt").
    const parsedCitations = citations
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
      .map((line) => {
        const parts = line.split('|').map((p) => p.trim());
        if (parts.length >= 3) {
          return { source: parts[0] ?? '', section: parts[1], excerpt: parts[2] ?? '' };
        }
        if (parts.length === 2) {
          return { source: parts[0] ?? '', excerpt: parts[1] ?? '' };
        }
        return { source: parts[0] ?? '', excerpt: parts[0] ?? '' };
      });

    setSubmitting(true);
    setError(null);
    try {
      const result = await createClaim(documentId, {
        sectionId,
        claimText: claimText.trim(),
        citations: parsedCitations,
      });
      setResults((prev) => [result, ...prev]);
      setClaimText('');
      setCitations('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'claim 생성 실패');
    } finally {
      setSubmitting(false);
    }
  }, [canEdit, documentId, sectionId, claimText, citations]);

  return (
    <section
      id="labeling-panel-claims"
      role="tabpanel"
      aria-labelledby="labeling-tab-claims"
      className="flex flex-col gap-4"
      data-testid="labeling-claims-panel"
    >
      <h2 className="font-serif text-xl text-brand-700">Claim 입력·검증 (REQ-003/004/005)</h2>
      <p className="text-sm text-ink-600">
        모든 claim은 근거 citation 연결이 권장됩니다. citation 없이 입력하면{' '}
        <strong>전문가 검토 필요</strong> 배지가 자동 부여되며(REQ-004), 비교·우월성 표현 감지 시
        경고가 표시됩니다(REQ-005).
      </p>

      <div className="rounded-md border border-ink-200 bg-surface p-4">
        <div className="mb-3 flex flex-col gap-1.5">
          <label htmlFor="label-claim-section" className="text-sm font-medium text-ink-700">
            대상 섹션
          </label>
          <select
            id="label-claim-section"
            value={sectionId}
            onChange={(e) => setSectionId(e.target.value)}
            disabled={!canEdit}
            className="rounded-md border border-ink-200 bg-surface px-3 py-2 text-sm text-ink-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 disabled:opacity-60"
            data-testid="label-claim-section-select"
          >
            {[...sectionsById.values()].map((s) => (
              <option key={s.id} value={s.id}>
                {SECTION_TYPE_LABELS[s.sectionType]}
              </option>
            ))}
          </select>
        </div>

        <div className="mb-3 flex flex-col gap-1.5">
          <label htmlFor="label-claim-text" className="text-sm font-medium text-ink-700">
            Claim 문구
          </label>
          <textarea
            id="label-claim-text"
            value={claimText}
            onChange={(e) => setClaimText(e.target.value)}
            disabled={!canEdit}
            maxLength={8000}
            rows={3}
            placeholder="예: 본 기기는 기존 대비 30% 빠른 혈류 복원을 지원합니다."
            className="rounded-md border border-ink-200 bg-surface px-3 py-2 text-sm text-ink-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 disabled:opacity-60"
            data-testid="label-claim-text-input"
          />
        </div>

        <div className="mb-3 flex flex-col gap-1.5">
          <label htmlFor="label-claim-citations" className="text-sm font-medium text-ink-700">
            근거 citation (한 줄에 하나 — 형식: <code>출처|발췌</code> 또는{' '}
            <code>출처|섹션|발췌</code>)
          </label>
          <textarea
            id="label-claim-citations"
            value={citations}
            onChange={(e) => setCitations(e.target.value)}
            disabled={!canEdit}
            rows={3}
            placeholder={
              '예: 21 CFR 801.109(b)(1)|적응증 명시 필요\nClinical Report 2024-03|30% 향상 데이터'
            }
            className="rounded-md border border-ink-200 bg-surface px-3 py-2 font-mono text-xs text-ink-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 disabled:opacity-60"
            data-testid="label-claim-citations-input"
          />
          <p className="text-xs text-ink-500">
            빈 줄은 무시됩니다. citation 없이 제출 시 자동으로 expert-review-required 상태가 됩니다.
          </p>
        </div>

        {error && (
          <p
            className="mb-3 rounded-xs border border-danger/30 bg-danger-bg px-3 py-2 text-sm text-danger"
            role="alert"
            data-testid="label-claim-error"
          >
            {error}
          </p>
        )}

        <div className="flex justify-end">
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!canEdit || submitting}
            className="inline-flex items-center gap-2 rounded-md bg-brand-800 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
            data-testid="label-claim-submit"
            aria-busy={submitting}
          >
            {submitting ? (
              <Loader2 aria-hidden="true" size={14} className="animate-spin" />
            ) : (
              <CheckCircle2 aria-hidden="true" size={14} />
            )}
            claim 검증
          </button>
        </div>
      </div>

      {/* Results */}
      {results.length > 0 && (
        <div className="flex flex-col gap-3" data-testid="labeling-claims-results">
          <h3 className="text-sm font-semibold text-ink-700">이번 세션에서 검증한 claim</h3>
          {results.map((r, idx) => (
            <article
              key={r.claimId}
              className="rounded-md border border-ink-200 bg-surface p-4"
              data-testid={`labeling-claim-result-${idx}`}
            >
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <span className="rounded-xs bg-brand-50 px-2 py-0.5 text-xs font-medium text-brand-700">
                  {r.claimType}
                </span>
                {r.expertReviewRequired && <ExpertReviewRequiredBadge />}
                <ComparableClaimBadge
                  isSuperiority={r.isSuperiority}
                  isComparative={r.isComparative}
                  matchedKeywords={r.matchedKeywords}
                />
              </div>
              <p className="text-xs text-ink-500">
                근거 citation: {r.groundedCitationCount}건
                {r.rejectedCitationCount > 0 && (
                  <span className="text-danger"> (거부: {r.rejectedCitationCount}건)</span>
                )}
                {' · '}
                <span className="font-mono">{r.claimId.slice(0, 8)}</span>
              </p>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

/* ----------------------------- Translations tab --------------------------- */

interface TranslationsPanelProps {
  documentId: string;
  sectionsById: Map<LabelingSectionType, LabelingDocumentDetailResponse['sections'][number]>;
  canEdit: boolean;
}

function TranslationsPanel({ documentId, sectionsById, canEdit }: TranslationsPanelProps) {
  const [results, setResults] = useState<CreateTranslationResponse[]>([]);
  const [sectionId, setSectionId] = useState<string>(sectionsById.get('intended_use')?.id ?? '');
  const [sourceLocale, setSourceLocale] = useState('ko');
  const [targetLocale, setTargetLocale] = useState('en');
  const [targetText, setTargetText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sourceText = useMemo(() => {
    const entry = [...sectionsById.values()].find((s) => s.id === sectionId);
    return entry?.content ?? '';
  }, [sectionsById, sectionId]);

  const handleSubmit = useCallback(async () => {
    if (!canEdit) return;
    if (!sectionId || !targetText.trim()) {
      setError('섹션과 번역문을 입력하세요.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const result = await createTranslation(documentId, {
        sectionId,
        sourceLocale,
        targetLocale,
        targetText: targetText.trim(),
      });
      setResults((prev) => [result, ...prev]);
      setTargetText('');
    } catch (err) {
      setError(err instanceof Error ? err.message : '번역 등록 실패');
    } finally {
      setSubmitting(false);
    }
  }, [canEdit, documentId, sectionId, sourceLocale, targetLocale, targetText]);

  return (
    <section
      id="labeling-panel-translations"
      role="tabpanel"
      aria-labelledby="labeling-tab-translations"
      className="flex flex-col gap-4"
      data-testid="labeling-translations-panel"
    >
      <h2 className="font-serif text-xl text-brand-700">번역 의미 diff (REQ-007)</h2>
      <p className="text-sm text-ink-600">
        원본과 번역문 간 의미 차이를 휴리스틱으로 검출합니다. <code>major_diff</code> 감지 시 RA
        승인 게이트가 강제됩니다.
      </p>

      <div className="rounded-md border border-ink-200 bg-surface p-4">
        <div className="mb-3 flex flex-col gap-1.5">
          <label htmlFor="label-translation-section" className="text-sm font-medium text-ink-700">
            대상 섹션
          </label>
          <select
            id="label-translation-section"
            value={sectionId}
            onChange={(e) => setSectionId(e.target.value)}
            disabled={!canEdit}
            className="rounded-md border border-ink-200 bg-surface px-3 py-2 text-sm text-ink-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 disabled:opacity-60"
            data-testid="label-translation-section-select"
          >
            {[...sectionsById.values()].map((s) => (
              <option key={s.id} value={s.id}>
                {SECTION_TYPE_LABELS[s.sectionType]}
              </option>
            ))}
          </select>
        </div>

        <div className="mb-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="label-translation-source-locale"
              className="text-xs font-medium text-ink-600"
            >
              원본 로케일
            </label>
            <input
              id="label-translation-source-locale"
              type="text"
              value={sourceLocale}
              onChange={(e) => setSourceLocale(e.target.value)}
              disabled={!canEdit}
              maxLength={16}
              className="rounded-md border border-ink-200 bg-surface px-3 py-1.5 text-sm text-ink-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 disabled:opacity-60"
              data-testid="label-translation-source-locale"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="label-translation-target-locale"
              className="text-xs font-medium text-ink-600"
            >
              대상 로케일
            </label>
            <input
              id="label-translation-target-locale"
              type="text"
              value={targetLocale}
              onChange={(e) => setTargetLocale(e.target.value)}
              disabled={!canEdit}
              maxLength={16}
              className="rounded-md border border-ink-200 bg-surface px-3 py-1.5 text-sm text-ink-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 disabled:opacity-60"
              data-testid="label-translation-target-locale"
            />
          </div>
        </div>

        {/* Source preview */}
        {sourceText.trim().length > 0 && (
          <div className="mb-3">
            <p className="mb-1 text-xs font-medium text-ink-500">원본 섹션 내용</p>
            <p className="max-h-32 overflow-y-auto whitespace-pre-wrap rounded-xs bg-ink-50 p-2 text-xs text-ink-700">
              {sourceText}
            </p>
          </div>
        )}

        <div className="mb-3 flex flex-col gap-1.5">
          <label
            htmlFor="label-translation-target-text"
            className="text-sm font-medium text-ink-700"
          >
            번역문
          </label>
          <textarea
            id="label-translation-target-text"
            value={targetText}
            onChange={(e) => setTargetText(e.target.value)}
            disabled={!canEdit}
            maxLength={20000}
            rows={4}
            placeholder="번역된 섹션 내용을 입력하세요"
            className="rounded-md border border-ink-200 bg-surface px-3 py-2 text-sm text-ink-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 disabled:opacity-60"
            data-testid="label-translation-target-input"
          />
        </div>

        {error && (
          <p
            className="mb-3 rounded-xs border border-danger/30 bg-danger-bg px-3 py-2 text-sm text-danger"
            role="alert"
            data-testid="label-translation-error"
          >
            {error}
          </p>
        )}

        <div className="flex justify-end">
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!canEdit || submitting}
            className="inline-flex items-center gap-2 rounded-md bg-brand-800 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
            data-testid="label-translation-submit"
            aria-busy={submitting}
          >
            {submitting ? (
              <Loader2 aria-hidden="true" size={14} className="animate-spin" />
            ) : (
              <CheckCircle2 aria-hidden="true" size={14} />
            )}
            번역 diff 실행
          </button>
        </div>
      </div>

      {/* Diff results */}
      {results.length > 0 && (
        <div className="flex flex-col gap-3" data-testid="labeling-translation-results">
          <h3 className="text-sm font-semibold text-ink-700">이번 세션의 번역 diff 결과</h3>
          {results.map((r, idx) => (
            <TranslationDiffCard key={r.translationId} result={r} index={idx} />
          ))}
        </div>
      )}
    </section>
  );
}

function TranslationDiffCard({
  result,
  index,
}: {
  result: CreateTranslationResponse;
  index: number;
}) {
  const isMajor = result.diffStatus === 'major_diff' || result.diffStatus === 'review_required';
  const statusLabel: Record<typeof result.diffStatus, string> = {
    match: '일치 (Match)',
    minor_diff: '경미한 차이 (Minor)',
    major_diff: '주요 차이 (Major)',
    review_required: '검토 필요 (Review Required)',
  };
  return (
    <article
      className={`rounded-md border p-4 ${
        isMajor ? 'border-amber-400/50 bg-amber-50' : 'border-ink-200 bg-surface'
      }`}
      data-testid={`labeling-translation-result-${index}`}
    >
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <span
          className={`rounded-xs px-2 py-0.5 text-xs font-medium ${
            isMajor ? 'bg-amber-100 text-amber-800' : 'bg-success-bg text-success'
          }`}
        >
          {statusLabel[result.diffStatus]}
        </span>
        {isMajor && (
          <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-800">
            <AlertTriangle aria-hidden="true" size={12} />
            RA 승인 게이트 강제
          </span>
        )}
        <span className="font-mono text-xs text-ink-500">{result.translationId.slice(0, 8)}</span>
      </div>
      {result.details.length > 0 ? (
        <ul className="flex flex-col gap-1 text-xs text-ink-700">
          {result.details.map((d, i) => (
            <li key={`${d.type}-${i}`}>
              <span className="font-mono text-ink-500">[{d.type}]</span> {d.description}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-ink-500">감지된 의미 차이가 없습니다.</p>
      )}
    </article>
  );
}
