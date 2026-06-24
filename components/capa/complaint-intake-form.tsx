'use client';

// @MX:NOTE [AUTO] ComplaintIntakeForm — structured complaint intake (REQ-001, AC-01).
// @MX:SPEC SPEC-REGULA-CAPA-001 (REQ-001, REQ-002, AC-01)
//
// Client island that captures the structured complaint payload and POSTs to
// /api/ra/capa/complaints. On success, shows the complaintId and offers a
// "reportability 평가" action (REQ-002) that links the complaint to Vigilance.
// Mirrors the VigilanceForm field layout (shared device/outcome vocabulary).

import { assessReportability, createComplaint } from '@/lib/capa/api-client';
import type { ReportabilityResponse } from '@/lib/capa/api-client';
import type { DeviceCategory, PatientOutcome } from '@/lib/capa/types';
import { useRouter } from 'next/navigation';
import { type FormEvent, useCallback, useRef, useState } from 'react';

const OUTCOME_OPTIONS: ReadonlyArray<{ value: PatientOutcome; label: string }> = [
  { value: 'death', label: '사망 (Death)' },
  { value: 'serious_injury', label: '중대 손상 (Serious Injury)' },
  { value: 'malfunction', label: '오작동 (Malfunction)' },
  { value: 'no_injury', label: '손상 없음 (No Injury)' },
  { value: 'other', label: '기타 (Other)' },
] as const;

const DEVICE_CATEGORY_OPTIONS: ReadonlyArray<{ value: DeviceCategory; label: string }> = [
  { value: 'class_I', label: 'FDA Class I' },
  { value: 'class_II', label: 'FDA Class II' },
  { value: 'class_III', label: 'FDA Class III' },
  { value: 'IIa', label: 'EU MDR Class IIa' },
  { value: 'IIb', label: 'EU MDR Class IIb' },
  { value: 'III', label: 'EU MDR Class III' },
] as const;

interface ComplaintIntakeFormProps {
  projectId: string;
  /** Pre-filled reporter name from session (optional convenience). */
  defaultReporterName?: string;
}

export function ComplaintIntakeForm({ projectId, defaultReporterName }: ComplaintIntakeFormProps) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdComplaintId, setCreatedComplaintId] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // REQ-002 reportability assessment state.
  const [assessing, setAssessing] = useState(false);
  const [reportability, setReportability] = useState<ReportabilityResponse | null>(null);
  const [assessError, setAssessError] = useState<string | null>(null);
  const assessAbortRef = useRef<AbortController | null>(null);

  // Form fields
  const [deviceName, setDeviceName] = useState('');
  const [deviceModel, setDeviceModel] = useState('');
  const [lotNumber, setLotNumber] = useState('');
  const [eventDescription, setEventDescription] = useState('');
  const [patientOutcome, setPatientOutcome] = useState<PatientOutcome>('malfunction');
  const [deviceCategory, setDeviceCategory] = useState<DeviceCategory>('class_II');
  const [eventDate, setEventDate] = useState('');
  const [awarenessDate, setAwarenessDate] = useState('');
  const [isManufacturerAware, setIsManufacturerAware] = useState(false);
  const [reporterName, setReporterName] = useState(defaultReporterName ?? '');
  const [reporterRole, setReporterRole] = useState('');

  const handleSubmit = useCallback(
    async (e: FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      if (
        !deviceName.trim() ||
        !eventDescription.trim() ||
        !eventDate ||
        !awarenessDate ||
        !reporterName.trim() ||
        !reporterRole.trim()
      ) {
        setError('필수 항목을 모두 입력하세요.');
        return;
      }

      abortRef.current?.abort();
      const ac = new AbortController();
      abortRef.current = ac;

      setSubmitting(true);
      setError(null);

      try {
        const result = await createComplaint(
          {
            projectId,
            deviceName: deviceName.trim(),
            deviceModel: deviceModel.trim() || undefined,
            lotNumber: lotNumber.trim() || undefined,
            eventDescription: eventDescription.trim(),
            patientOutcome,
            deviceCategory,
            eventDate,
            awarenessDate,
            isManufacturerAware,
            reporterName: reporterName.trim(),
            reporterRole: reporterRole.trim(),
          },
          ac.signal,
        );
        setCreatedComplaintId(result.complaintId);
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') return;
        setError(err instanceof Error ? err.message : '불만 접수 중 오류가 발생했습니다.');
        setSubmitting(false);
      }
    },
    [
      projectId,
      deviceName,
      deviceModel,
      lotNumber,
      eventDescription,
      patientOutcome,
      deviceCategory,
      eventDate,
      awarenessDate,
      isManufacturerAware,
      reporterName,
      reporterRole,
    ],
  );

  const handleAssess = useCallback(async () => {
    if (!createdComplaintId) return;
    assessAbortRef.current?.abort();
    const ac = new AbortController();
    assessAbortRef.current = ac;

    setAssessing(true);
    setAssessError(null);

    try {
      const result = await assessReportability(createdComplaintId, ac.signal);
      setReportability(result);
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return;
      setAssessError(
        err instanceof Error ? err.message : 'reportability 평가 중 오류가 발생했습니다.',
      );
    } finally {
      setAssessing(false);
    }
  }, [createdComplaintId]);

  return (
    <div className="flex flex-col gap-6">
      <form
        onSubmit={handleSubmit}
        className="flex flex-col gap-5"
        data-testid="complaint-intake-form"
        aria-label="불만 접수 입력"
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {/* Device name */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="ci-device-name" className="text-sm font-medium text-ink-700">
              기기명{' '}
              <span aria-hidden="true" className="text-danger">
                *
              </span>
            </label>
            <input
              id="ci-device-name"
              type="text"
              value={deviceName}
              onChange={(e) => setDeviceName(e.target.value)}
              required
              maxLength={256}
              placeholder="예: 혈당 측정기 XYZ-100"
              className="rounded-md border border-ink-200 bg-surface px-3 py-2 text-sm text-ink-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2"
              data-testid="ci-device-name"
            />
          </div>

          {/* Device model */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="ci-device-model" className="text-sm font-medium text-ink-700">
              모델번호
            </label>
            <input
              id="ci-device-model"
              type="text"
              value={deviceModel}
              onChange={(e) => setDeviceModel(e.target.value)}
              maxLength={256}
              placeholder="예: XYZ-100-v2"
              className="rounded-md border border-ink-200 bg-surface px-3 py-2 text-sm text-ink-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2"
            />
          </div>

          {/* Lot number */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="ci-lot-number" className="text-sm font-medium text-ink-700">
              로트 번호
            </label>
            <input
              id="ci-lot-number"
              type="text"
              value={lotNumber}
              onChange={(e) => setLotNumber(e.target.value)}
              maxLength={128}
              placeholder="예: LOT2024001"
              className="rounded-md border border-ink-200 bg-surface px-3 py-2 text-sm text-ink-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2"
            />
          </div>

          {/* Device category */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="ci-device-category" className="text-sm font-medium text-ink-700">
              기기 분류{' '}
              <span aria-hidden="true" className="text-danger">
                *
              </span>
            </label>
            <select
              id="ci-device-category"
              value={deviceCategory}
              onChange={(e) => setDeviceCategory(e.target.value as DeviceCategory)}
              required
              className="rounded-md border border-ink-200 bg-surface px-3 py-2 text-sm text-ink-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2"
              data-testid="ci-device-category"
            >
              {DEVICE_CATEGORY_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>

          {/* Event date */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="ci-event-date" className="text-sm font-medium text-ink-700">
              사고 발생일{' '}
              <span aria-hidden="true" className="text-danger">
                *
              </span>
            </label>
            <input
              id="ci-event-date"
              type="date"
              value={eventDate}
              onChange={(e) => setEventDate(e.target.value)}
              required
              className="rounded-md border border-ink-200 bg-surface px-3 py-2 text-sm text-ink-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2"
              data-testid="ci-event-date"
            />
          </div>

          {/* Awareness date */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="ci-awareness-date" className="text-sm font-medium text-ink-700">
              인지일 (Awareness Date){' '}
              <span aria-hidden="true" className="text-danger">
                *
              </span>
            </label>
            <input
              id="ci-awareness-date"
              type="date"
              value={awarenessDate}
              onChange={(e) => setAwarenessDate(e.target.value)}
              required
              className="rounded-md border border-ink-200 bg-surface px-3 py-2 text-sm text-ink-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2"
              data-testid="ci-awareness-date"
            />
          </div>

          {/* Patient outcome */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="ci-outcome" className="text-sm font-medium text-ink-700">
              환자 결과{' '}
              <span aria-hidden="true" className="text-danger">
                *
              </span>
            </label>
            <select
              id="ci-outcome"
              value={patientOutcome}
              onChange={(e) => setPatientOutcome(e.target.value as PatientOutcome)}
              required
              className="rounded-md border border-ink-200 bg-surface px-3 py-2 text-sm text-ink-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2"
              data-testid="ci-outcome"
            >
              {OUTCOME_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>

          {/* Is manufacturer aware */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="ci-manufacturer-aware" className="text-sm font-medium text-ink-700">
              제조사 인지 여부
            </label>
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-ink-200 bg-surface px-3 py-2 text-sm text-ink-700 focus-within:ring-2 focus-within:ring-brand-500 focus-within:ring-offset-2">
              <input
                id="ci-manufacturer-aware"
                type="checkbox"
                checked={isManufacturerAware}
                onChange={(e) => setIsManufacturerAware(e.target.checked)}
                className="h-4 w-4 rounded border-ink-300 text-brand-600 focus-visible:ring-2 focus-visible:ring-brand-500"
                data-testid="ci-manufacturer-aware"
              />
              제조사가 본 사건을 인지하고 있습니다
            </label>
          </div>

          {/* Reporter name */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="ci-reporter-name" className="text-sm font-medium text-ink-700">
              보고자 이름{' '}
              <span aria-hidden="true" className="text-danger">
                *
              </span>
            </label>
            <input
              id="ci-reporter-name"
              type="text"
              value={reporterName}
              onChange={(e) => setReporterName(e.target.value)}
              required
              maxLength={256}
              placeholder="예: 홍길동"
              className="rounded-md border border-ink-200 bg-surface px-3 py-2 text-sm text-ink-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2"
              data-testid="ci-reporter-name"
            />
          </div>

          {/* Reporter role */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="ci-reporter-role" className="text-sm font-medium text-ink-700">
              보고자 직책{' '}
              <span aria-hidden="true" className="text-danger">
                *
              </span>
            </label>
            <input
              id="ci-reporter-role"
              type="text"
              value={reporterRole}
              onChange={(e) => setReporterRole(e.target.value)}
              required
              maxLength={256}
              placeholder="예: RA Manager"
              className="rounded-md border border-ink-200 bg-surface px-3 py-2 text-sm text-ink-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2"
              data-testid="ci-reporter-role"
            />
          </div>
        </div>

        {/* Event description */}
        <div className="flex flex-col gap-1.5">
          <label htmlFor="ci-description" className="text-sm font-medium text-ink-700">
            사고 경위{' '}
            <span aria-hidden="true" className="text-danger">
              *
            </span>
          </label>
          <textarea
            id="ci-description"
            value={eventDescription}
            onChange={(e) => setEventDescription(e.target.value)}
            required
            maxLength={8000}
            rows={4}
            placeholder="사건 발생 경위를 상세히 기술하세요..."
            className="rounded-md border border-ink-200 bg-surface px-3 py-2 text-sm text-ink-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2"
            data-testid="ci-description"
          />
        </div>

        {error && (
          <p
            className="rounded-xs border border-danger/30 bg-danger-bg px-3 py-2 text-sm text-danger"
            role="alert"
            data-testid="ci-form-error"
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
            aria-busy={submitting}
            data-testid="ci-submit-btn"
          >
            {submitting ? '접수 중…' : '불만 접수'}
          </button>
        </div>
      </form>

      {/* REQ-001 result: complaint created → offer REQ-002 reportability assessment. */}
      {createdComplaintId && (
        <div
          className="rounded-md border border-brand-200 bg-brand-50 p-4"
          data-testid="ci-created-result"
        >
          <h3 className="text-sm font-semibold text-brand-800">불만 접수 완료</h3>
          <p className="mt-1 text-xs text-ink-500">
            Complaint ID: <code className="font-mono">{createdComplaintId}</code>
          </p>

          {/* REQ-002 reportability action */}
          {!reportability && (
            <div className="mt-3 flex flex-col gap-2">
              <p className="text-sm text-ink-700">
                이 불만의 보고 의무(reportability)를 평가하고 Vigilance에 연결합니다.
              </p>
              {assessError && (
                <p
                  className="rounded-xs border border-danger/30 bg-danger-bg px-3 py-2 text-xs text-danger"
                  role="alert"
                >
                  {assessError}
                </p>
              )}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleAssess}
                  disabled={assessing}
                  className="inline-flex items-center gap-2 rounded-md border border-brand-300 bg-surface px-4 py-2 text-sm font-medium text-brand-700 hover:bg-brand-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
                  aria-busy={assessing}
                  data-testid="ci-assess-reportability-btn"
                >
                  {assessing ? '평가 중…' : 'Reportability 평가 (REQ-002)'}
                </button>
                <button
                  type="button"
                  onClick={() => router.push(`/capa/${createdComplaintId}`)}
                  className="inline-flex items-center gap-2 rounded-md border border-ink-200 bg-surface px-4 py-2 text-sm font-medium text-ink-700 hover:bg-ink-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2"
                >
                  CAPA 워크벤치로 이동
                </button>
              </div>
            </div>
          )}

          {/* REQ-002 result display (mirrors VigilanceForm assessment panel). */}
          {reportability && (
            <div className="mt-3 rounded-xs border border-brand-200 bg-surface p-3">
              <h4 className="text-sm font-semibold text-brand-800">보고 의무 판단 결과</h4>
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
                      ? '보고 대상 (reportable)'
                      : '보고 불필요 (not reportable)'}
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
              <button
                type="button"
                onClick={() => router.push(`/capa/${createdComplaintId}`)}
                className="mt-3 inline-flex items-center gap-2 rounded-md bg-brand-800 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2"
                data-testid="ci-go-to-workbench-btn"
              >
                CAPA 워크벤치로 이동
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
