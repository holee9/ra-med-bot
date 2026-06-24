'use client';

// @MX:NOTE [AUTO] CapaWorkbench — CAPA closed-loop workbench client island.
// @MX:SPEC SPEC-REGULA-CAPA-001 (REQ-001~012, AC-01/04/07/08)
//
// Manages tab switching between:
//   - Reportability (REQ-002): assess + show vigilance linkage
//   - Root Cause (REQ-003): 5 Whys / Fishbone editor
//   - Corrective (REQ-004/005): corrective CAPA creation + effectiveness
//   - Preventive (REQ-004/005): preventive CAPA creation
//   - Close (REQ-010/011/012): ESIG modal + vigilance gate
//   - QMS Sync (REQ-009): stub button with #57 beta label
//
// Mirrors the labeling workbench tab pattern. All writes go through
// lib/capa/api-client.ts which hits /api/ra/capa/* routes.

import { CapaRecordForm } from '@/components/capa/capa-record-form';
import { EsigCloseModal } from '@/components/capa/esig-modal';
import { QmsStubBadge } from '@/components/capa/qms-stub-badge';
import { RootCauseEditor } from '@/components/capa/root-cause-editor';
import {
  type ReportabilityResponse,
  assessReportability,
  checkEffectiveness,
  syncQms,
} from '@/lib/capa/api-client';
import type { ComplaintIntake } from '@/lib/capa/types';
import { useCallback, useRef, useState } from 'react';

type TabId =
  | 'reportability'
  | 'root-cause'
  | 'corrective'
  | 'preventive'
  | 'effectiveness'
  | 'close';

interface CapaWorkbenchProps {
  complaintId: string;
  orgId: string;
  projectId: string;
  projectName: string;
  intake: ComplaintIntake;
  reportabilityStatus: string;
  vigilanceRef: string | null;
  capaRecords: Array<{
    id: string;
    type: string;
    description: string;
    status: string;
    effectivenessStatus: string;
    ownerId: string;
  }>;
  canClose: boolean;
  /** Server-computed gate state (advisory; server enforces on POST). */
  closeGateState: 'allowed' | 'blocked_vigilance' | 'insufficient_role';
}

const TABS: ReadonlyArray<{ id: TabId; label: string; testId: string }> = [
  { id: 'reportability', label: '보고 의무 (REQ-002)', testId: 'tab-reportability' },
  { id: 'root-cause', label: '근본 원인 (REQ-003)', testId: 'tab-root-cause' },
  { id: 'corrective', label: '시정조치 (REQ-004)', testId: 'tab-corrective' },
  { id: 'preventive', label: '예방조치 (REQ-004)', testId: 'tab-preventive' },
  { id: 'effectiveness', label: '실효성 검증 (REQ-006)', testId: 'tab-effectiveness' },
  { id: 'close', label: '종료 (REQ-010)', testId: 'tab-close' },
] as const;

export function CapaWorkbench(props: CapaWorkbenchProps) {
  const [activeTab, setActiveTab] = useState<TabId>('reportability');
  const [showEsigModal, setShowEsigModal] = useState(false);
  const [qmsNotice, setQmsNotice] = useState<string | null>(null);
  const [qmsError, setQmsError] = useState<string | null>(null);

  // Reportability re-assessment state.
  const [reportability, setReportability] = useState<ReportabilityResponse | null>(
    props.reportabilityStatus !== 'pending'
      ? {
          complaintId: props.complaintId,
          reportabilityStatus: props.reportabilityStatus as 'reportable' | 'not_reportable',
          fdaMdrRequired: false,
          fdaMdrDeadlineDays: null,
          euMdvRequired: false,
          euMdvDeadlineDays: null,
          fscaRequired: false,
          vigilanceRef: props.vigilanceRef,
        }
      : null,
  );
  const [assessing, setAssessing] = useState(false);
  const [assessError, setAssessError] = useState<string | null>(null);
  const assessAbortRef = useRef<AbortController | null>(null);

  // Effectiveness check state.
  const [effDueDate, setEffDueDate] = useState('');
  const [effResult, setEffResult] = useState<'effective' | 'ineffective' | ''>('');
  const [effNotes, setEffNotes] = useState('');
  const [effSubmitting, setEffSubmitting] = useState(false);
  const [effError, setEffError] = useState<string | null>(null);
  const [effSaved, setEffSaved] = useState(false);
  const effAbortRef = useRef<AbortController | null>(null);

  const correctiveRecords = props.capaRecords.filter((r) => r.type === 'corrective');
  const preventiveRecords = props.capaRecords.filter((r) => r.type === 'preventive');
  const firstCapaId = correctiveRecords[0]?.id ?? preventiveRecords[0]?.id ?? null;

  const handleAssess = useCallback(async () => {
    assessAbortRef.current?.abort();
    const ac = new AbortController();
    assessAbortRef.current = ac;
    setAssessing(true);
    setAssessError(null);
    try {
      const result = await assessReportability(props.complaintId, ac.signal);
      setReportability(result);
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return;
      setAssessError(
        err instanceof Error ? err.message : 'reportability 평가 중 오류가 발생했습니다.',
      );
    } finally {
      setAssessing(false);
    }
  }, [props.complaintId]);

  const handleEffectiveness = useCallback(async () => {
    if (!firstCapaId) {
      setEffError('먼저 시정 또는 예방조치 CAPA를 생성하세요.');
      return;
    }
    if (!effDueDate) {
      setEffError('실효성 검증 기한을 입력하세요.');
      return;
    }
    effAbortRef.current?.abort();
    const ac = new AbortController();
    effAbortRef.current = ac;
    setEffSubmitting(true);
    setEffError(null);
    setEffSaved(false);
    try {
      await checkEffectiveness(
        firstCapaId,
        {
          dueDate: effDueDate,
          result: effResult || undefined,
          notes: effNotes.trim() || undefined,
        },
        ac.signal,
      );
      setEffSaved(true);
      setEffDueDate('');
      setEffResult('');
      setEffNotes('');
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return;
      setEffError(err instanceof Error ? err.message : '실효성 검증 저장 중 오류가 발생했습니다.');
    } finally {
      setEffSubmitting(false);
    }
  }, [firstCapaId, effDueDate, effResult, effNotes]);

  const handleQmsSync = useCallback(async () => {
    if (!firstCapaId) return;
    setQmsError(null);
    try {
      const result = await syncQms(firstCapaId);
      setQmsNotice(result.stubNotice);
    } catch (err) {
      setQmsError(err instanceof Error ? err.message : 'QMS 동기화 중 오류가 발생했습니다.');
    }
  }, [firstCapaId]);

  return (
    <div className="flex flex-col gap-4" data-testid="capa-workbench">
      {/* Tab bar */}
      <div
        className="flex flex-wrap gap-1 border-b border-ink-200"
        role="tablist"
        aria-label="CAPA 워크벤치 탭"
      >
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.id}
            onClick={() => setActiveTab(tab.id)}
            data-testid={tab.testId}
            className={[
              'border-b-2 -mb-px px-3 py-2 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2',
              activeTab === tab.id
                ? 'border-brand-600 text-brand-700 font-medium'
                : 'border-transparent text-ink-500 hover:text-ink-700',
            ].join(' ')}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab panels */}
      {/* REQ-002: Reportability */}
      {activeTab === 'reportability' && (
        <div
          role="tabpanel"
          data-testid="panel-reportability"
          className="rounded-lg border border-ink-200 bg-surface p-6"
        >
          <h2 className="mb-3 font-serif text-lg text-brand-700">보고 의무 평가 (REQ-002)</h2>
          <p className="mb-3 text-sm text-ink-600">
            불만 데이터를 #61 Vigilance 엔진으로 평가합니다. reportable인 경우 자동으로 Vigilance에
            연결되며, 연결 정보는 CAPA 종료 게이트(REQ-011)에 사용됩니다.
          </p>
          {reportability ? (
            <div className="rounded-xs border border-brand-200 bg-brand-50 p-3">
              <h3 className="text-sm font-semibold text-brand-800">평가 결과</h3>
              <ul className="mt-2 space-y-1 text-sm text-ink-700">
                <li>
                  <span className="font-medium">상태:</span>{' '}
                  <span
                    className={
                      reportability.reportabilityStatus === 'reportable'
                        ? 'font-medium text-danger'
                        : 'font-medium text-success'
                    }
                  >
                    {reportability.reportabilityStatus === 'reportable'
                      ? '보고 대상'
                      : '보고 불필요'}
                  </span>
                </li>
                <li>
                  <span className="font-medium">FDA MDR:</span>{' '}
                  {reportability.fdaMdrRequired
                    ? `필요 (${reportability.fdaMdrDeadlineDays}일 이내)`
                    : '불필요'}
                </li>
                <li>
                  <span className="font-medium">EU MDV:</span>{' '}
                  {reportability.euMdvRequired
                    ? `필요 (${reportability.euMdvDeadlineDays}일 이내)`
                    : '불필요'}
                </li>
                <li>
                  <span className="font-medium">FSCA:</span>{' '}
                  {reportability.fscaRequired ? '필요' : '불필요'}
                </li>
                {reportability.vigilanceRef && (
                  <li>
                    <span className="font-medium">Vigilance 연결:</span>{' '}
                    <code className="font-mono text-xs">{reportability.vigilanceRef}</code>
                  </li>
                )}
              </ul>
            </div>
          ) : (
            <p className="text-sm text-ink-500">아직 평가가 수행되지 않았습니다.</p>
          )}
          {assessError && (
            <p
              className="mt-3 rounded-xs border border-danger/30 bg-danger-bg px-3 py-2 text-sm text-danger"
              role="alert"
            >
              {assessError}
            </p>
          )}
          <button
            type="button"
            onClick={handleAssess}
            disabled={assessing}
            aria-busy={assessing}
            data-testid="wb-assess-reportability-btn"
            className="mt-4 inline-flex items-center gap-2 rounded-md border border-brand-300 bg-surface px-4 py-2 text-sm font-medium text-brand-700 hover:bg-brand-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {assessing ? '평가 중…' : reportability ? '재평가' : '평가 실행'}
          </button>
        </div>
      )}

      {/* REQ-003: Root cause */}
      {activeTab === 'root-cause' && (
        <div
          role="tabpanel"
          data-testid="panel-root-cause"
          className="rounded-lg border border-ink-200 bg-surface p-6"
        >
          <h2 className="mb-3 font-serif text-lg text-brand-700">근본 원인 분석 (REQ-003)</h2>
          {firstCapaId ? (
            <RootCauseEditor capaId={firstCapaId} />
          ) : (
            <p className="text-sm text-ink-500">
              근본 원인 분석을 작성하려면 먼저 시정 또는 예방조치 CAPA를 생성하세요.
            </p>
          )}
        </div>
      )}

      {/* REQ-004: Corrective */}
      {activeTab === 'corrective' && (
        <div
          role="tabpanel"
          data-testid="panel-corrective"
          className="rounded-lg border border-ink-200 bg-surface p-6"
        >
          <h2 className="mb-3 font-serif text-lg text-brand-700">시정조치 (REQ-004, corrective)</h2>
          {correctiveRecords.length > 0 && (
            <div className="mb-4 flex flex-col gap-2">
              {correctiveRecords.map((r) => (
                <div
                  key={r.id}
                  className="rounded-xs border border-ink-100 px-3 py-2 text-sm"
                  data-testid={`corrective-record-${r.id}`}
                >
                  <p className="text-ink-800">{r.description}</p>
                  <p className="mt-1 text-xs text-ink-400">
                    상태: {r.status} · 실효성: {r.effectivenessStatus}
                  </p>
                </div>
              ))}
            </div>
          )}
          <CapaRecordForm complaintId={props.complaintId} projectId={props.projectId} />
        </div>
      )}

      {/* REQ-004: Preventive */}
      {activeTab === 'preventive' && (
        <div
          role="tabpanel"
          data-testid="panel-preventive"
          className="rounded-lg border border-ink-200 bg-surface p-6"
        >
          <h2 className="mb-3 font-serif text-lg text-brand-700">예방조치 (REQ-004, preventive)</h2>
          {preventiveRecords.length > 0 && (
            <div className="mb-4 flex flex-col gap-2">
              {preventiveRecords.map((r) => (
                <div
                  key={r.id}
                  className="rounded-xs border border-ink-100 px-3 py-2 text-sm"
                  data-testid={`preventive-record-${r.id}`}
                >
                  <p className="text-ink-800">{r.description}</p>
                  <p className="mt-1 text-xs text-ink-400">
                    상태: {r.status} · 실효성: {r.effectivenessStatus}
                  </p>
                </div>
              ))}
            </div>
          )}
          <CapaRecordForm complaintId={props.complaintId} projectId={props.projectId} />
        </div>
      )}

      {/* REQ-006: Effectiveness */}
      {activeTab === 'effectiveness' && (
        <div
          role="tabpanel"
          data-testid="panel-effectiveness"
          className="rounded-lg border border-ink-200 bg-surface p-6"
        >
          <h2 className="mb-3 font-serif text-lg text-brand-700">실효성 검증 (REQ-006)</h2>
          <p className="mb-4 text-sm text-ink-600">
            시정·예방조치의 실효성 검증 기한을 예약하거나 결과를 기록합니다. 기한 도래 시 Inngest가
            담당자에게 알림을 전송합니다 (AC-02).
          </p>
          {!firstCapaId && (
            <p className="mb-4 text-sm text-amber-700">
              먼저 시정 또는 예방조치 CAPA를 생성하세요.
            </p>
          )}
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="eff-due" className="text-sm font-medium text-ink-700">
                검증 기한{' '}
                <span aria-hidden="true" className="text-danger">
                  *
                </span>
              </label>
              <input
                id="eff-due"
                type="date"
                value={effDueDate}
                onChange={(e) => setEffDueDate(e.target.value)}
                className="rounded-md border border-ink-200 bg-surface px-3 py-2 text-sm text-ink-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2"
                data-testid="eff-due"
              />
            </div>
            <fieldset className="flex flex-col gap-2">
              <legend className="text-sm font-medium text-ink-700">검증 결과 (선택)</legend>
              <div className="flex gap-2" role="radiogroup" aria-label="검증 결과 선택">
                {(
                  [
                    { value: '', label: '미정 (기한만 예약)' },
                    { value: 'effective', label: '유효함 (effective)' },
                    { value: 'ineffective', label: '유효하지 않음 (ineffective)' },
                  ] as const
                ).map((opt) => (
                  <label
                    key={opt.value}
                    className={[
                      'cursor-pointer rounded-xs border px-3 py-1.5 text-sm focus-within:ring-2 focus-within:ring-brand-500 focus-within:ring-offset-2',
                      effResult === opt.value
                        ? 'border-brand-500 bg-brand-50 text-brand-700'
                        : 'border-ink-200 bg-surface text-ink-700 hover:border-ink-300',
                    ].join(' ')}
                  >
                    <input
                      type="radio"
                      name="eff-result"
                      value={opt.value}
                      checked={effResult === opt.value}
                      onChange={() => setEffResult(opt.value as typeof effResult)}
                      className="sr-only"
                    />
                    {opt.label}
                  </label>
                ))}
              </div>
            </fieldset>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="eff-notes" className="text-sm font-medium text-ink-700">
                비고
              </label>
              <textarea
                id="eff-notes"
                value={effNotes}
                onChange={(e) => setEffNotes(e.target.value)}
                maxLength={4000}
                rows={3}
                placeholder="검증 방법 및 관찰 사항"
                className="rounded-md border border-ink-200 bg-surface px-3 py-2 text-sm text-ink-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2"
                data-testid="eff-notes"
              />
            </div>
            {effError && (
              <p
                className="rounded-xs border border-danger/30 bg-danger-bg px-3 py-2 text-sm text-danger"
                role="alert"
              >
                {effError}
              </p>
            )}
            {effSaved && (
              <output className="rounded-xs border border-success/30 bg-success-bg px-3 py-2 text-sm text-success">
                실효성 검증이 저장되었습니다. (REQ-006)
              </output>
            )}
            <div className="flex justify-end">
              <button
                type="button"
                onClick={handleEffectiveness}
                disabled={effSubmitting || !firstCapaId}
                aria-busy={effSubmitting}
                data-testid="eff-submit-btn"
                className="inline-flex items-center gap-2 rounded-md bg-brand-800 px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {effSubmitting ? '저장 중…' : '실효성 검증 저장'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* REQ-010/011/012: Close */}
      {activeTab === 'close' && (
        <div
          role="tabpanel"
          data-testid="panel-close"
          className="rounded-lg border border-ink-200 bg-surface p-6"
        >
          <h2 className="mb-3 font-serif text-lg text-brand-700">CAPA 종료 (REQ-010/011/012)</h2>
          <p className="mb-4 text-sm text-ink-600">
            종료 시 21 CFR Part 11 전자서명이 요구됩니다. reportable 불만이 Vigilance에 연결되지
            않은 경우 종료가 차단됩니다 (REQ-011 — 서버 게이트, 클라이언트 우회 불가).
          </p>

          {/* Close button: disabled when gate blocks or role insufficient. */}
          <button
            type="button"
            onClick={() => setShowEsigModal(true)}
            disabled={
              !props.canClose || props.closeGateState === 'blocked_vigilance' || !firstCapaId
            }
            aria-disabled={
              !props.canClose || props.closeGateState === 'blocked_vigilance' || !firstCapaId
            }
            title={
              !firstCapaId
                ? '먼저 CAPA 레코드를 생성하세요.'
                : props.closeGateState === 'blocked_vigilance'
                  ? 'Vigilance 연결 누락 — 먼저 reportability 평가를 수행하세요. (REQ-011)'
                  : !props.canClose
                    ? 'CAPA 종료는 RA Lead 권한 이상 필요합니다. (capa.close)'
                    : 'ESIG 서명 후 CAPA를 종료합니다.'
            }
            data-testid="wb-close-btn"
            className="inline-flex items-center gap-2 rounded-md bg-brand-800 px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
          >
            ESIG 서명 후 종료
          </button>

          {/* REQ-009: QMS sync stub */}
          <div className="mt-6 border-t border-ink-100 pt-4">
            <div className="mb-2 flex items-center gap-2">
              <h3 className="text-sm font-medium text-ink-700">QMS 동기화 (REQ-009)</h3>
              <QmsStubBadge />
            </div>
            <p className="mb-3 text-xs text-ink-500">
              CAPA 상태를 외부 QMS로 동기화합니다. 현재는 stub(no-op)이며,{' '}
              <span className="font-medium">#57 (SPEC-REGULA-QMS-001)</span> 구현 후 실제 통신이
              활성화됩니다.
            </p>
            <button
              type="button"
              onClick={handleQmsSync}
              disabled={!firstCapaId}
              data-testid="wb-qms-sync-btn"
              className="inline-flex items-center gap-2 rounded-md border border-ink-200 bg-surface px-4 py-2 text-sm font-medium text-ink-700 hover:bg-ink-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
            >
              QMS 동기화 (stub)
            </button>
            {qmsNotice && (
              <output
                className="mt-2 rounded-xs border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700"
                data-testid="wb-qms-notice"
              >
                {qmsNotice}
              </output>
            )}
            {qmsError && (
              <p
                className="mt-2 rounded-xs border border-danger/30 bg-danger-bg px-3 py-2 text-xs text-danger"
                role="alert"
              >
                {qmsError}
              </p>
            )}
          </div>
        </div>
      )}

      {/* ESIG close modal */}
      {showEsigModal && firstCapaId && (
        <EsigCloseModal
          capaId={firstCapaId}
          capaTitle={props.intake.deviceName}
          onClose={() => setShowEsigModal(false)}
          onClosed={() => {
            setShowEsigModal(false);
            // Refresh the page to reflect the closed status.
            if (typeof window !== 'undefined') window.location.reload();
          }}
        />
      )}
    </div>
  );
}
