'use client';

// @MX:NOTE [AUTO] VigilanceForm — adverse event input form with SSE streaming result display.
// Submits to POST /api/ra/vigilance, streams assessment + draft reports via SSE events.
// @MX:SPEC SPEC-REGULA-VIGILANCE-001

import { type FormEvent, useState } from 'react';

type PatientOutcome = 'death' | 'serious_injury' | 'malfunction' | 'no_injury' | 'other';
type DeviceCategory = 'class_I' | 'class_II' | 'class_III' | 'IIa' | 'IIb' | 'III';

interface ReportabilityDecision {
  fdaMdrRequired: boolean;
  fdaMdrDeadlineDays: number | null;
  euMdvRequired: boolean;
  euMdvDeadlineDays: number | null;
  fscaRequired: boolean;
  rationale: string;
}

interface ReportDraft {
  reportType: string;
  reportFormat: string;
  draftContent: Record<string, string>;
  submissionDeadline: string;
  reportId: string | null;
}

interface StreamResult {
  assessment: ReportabilityDecision | null;
  drafts: ReportDraft[];
  eventId: string | null;
  done: boolean;
}

const INPUT_CLASS = 'border border-ink-200 rounded-md px-3 py-2 text-sm w-full focus:outline-none focus:ring-1 focus:ring-brand-400';
const LABEL_CLASS = 'block text-sm font-medium text-ink-700 mb-1';
const PRIMARY_BTN =
  'bg-brand-700 text-white hover:bg-brand-800 rounded-md px-4 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-60';

const OUTCOME_OPTIONS: Array<{ value: PatientOutcome; label: string }> = [
  { value: 'death', label: '사망 (Death)' },
  { value: 'serious_injury', label: '중대 손상 (Serious Injury)' },
  { value: 'malfunction', label: '오작동 (Malfunction)' },
  { value: 'no_injury', label: '손상 없음 (No Injury)' },
  { value: 'other', label: '기타 (Other)' },
];

const DEVICE_CATEGORY_OPTIONS: Array<{ value: DeviceCategory; label: string }> = [
  { value: 'class_I', label: 'FDA Class I' },
  { value: 'class_II', label: 'FDA Class II' },
  { value: 'class_III', label: 'FDA Class III' },
  { value: 'IIa', label: 'EU MDR Class IIa' },
  { value: 'IIb', label: 'EU MDR Class IIb' },
  { value: 'III', label: 'EU MDR Class III' },
];

const REPORT_TYPE_LABELS: Record<string, string> = {
  fda_mdr: 'FDA MDR 3500A',
  eu_mdv: 'EU MDV 초기 보고서',
  fsca: 'FSCA 공지',
};

export function VigilanceForm() {
  // Form state
  const [deviceName, setDeviceName] = useState('');
  const [deviceModel, setDeviceModel] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [awarenessDate, setAwarenessDate] = useState('');
  const [patientOutcome, setPatientOutcome] = useState<PatientOutcome>('malfunction');
  const [deviceCategory, setDeviceCategory] = useState<DeviceCategory>('class_II');
  const [eventDescription, setEventDescription] = useState('');
  const [reporterName, setReporterName] = useState('');
  const [reporterRole, setReporterRole] = useState('');
  const [lotNumber, setLotNumber] = useState('');

  // Streaming state
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<StreamResult | null>(null);
  const [activeTab, setActiveTab] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStreaming(true);
    setError(null);
    setResult({ assessment: null, drafts: [], eventId: null, done: false });
    setActiveTab(null);

    try {
      const response = await fetch('/api/ra/vigilance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          adverseEventData: {
            deviceName,
            deviceModel: deviceModel || undefined,
            lotNumber: lotNumber || undefined,
            eventDate,
            awarenessDate,
            patientOutcome,
            deviceCategory,
            eventDescription,
            reporterName,
            reporterRole,
            isManufacturerAware: true,
          },
        }),
      });

      if (!response.ok || !response.body) {
        setError('보고서 생성에 실패했습니다. 입력 내용을 확인해 주세요.');
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n\n');
        buffer = lines.pop() ?? '';

        for (const chunk of lines) {
          const eventMatch = chunk.match(/^event: (\w+)\ndata: (.+)$/s);
          if (!eventMatch) continue;

          const eventName = eventMatch[1];
          const dataStr = eventMatch[2];
          if (!eventName || !dataStr) continue;
          try {
            const data = JSON.parse(dataStr) as Record<string, unknown>;

            if (eventName === 'assessment') {
              setResult((prev) => ({
                ...(prev ?? { assessment: null, drafts: [], eventId: null, done: false }),
                assessment: data['decision'] as ReportabilityDecision,
              }));
            } else if (
              eventName === 'draft_fda' ||
              eventName === 'draft_eu' ||
              eventName === 'draft_fsca'
            ) {
              const draft = data as unknown as ReportDraft;
              setResult((prev) => {
                const next = {
                  ...(prev ?? { assessment: null, drafts: [], eventId: null, done: false }),
                  drafts: [...(prev?.drafts ?? []), draft],
                };
                // Auto-select first draft tab
                if (!activeTab) setActiveTab(draft.reportType);
                return next;
              });
            } else if (eventName === 'done') {
              setResult((prev) => ({
                ...(prev ?? { assessment: null, drafts: [], eventId: null, done: false }),
                eventId: data['eventId'] as string,
                done: true,
              }));
            } else if (eventName === 'error') {
              setError(data['message'] as string);
            }
          } catch {
            // Ignore malformed SSE chunks
          }
        }
      }
    } catch {
      setError('네트워크 오류가 발생했습니다. 다시 시도해 주세요.');
    } finally {
      setStreaming(false);
    }
  }

  const activeDraft = result?.drafts.find((d) => d.reportType === activeTab);

  return (
    <div className="flex flex-col gap-6">
      <form onSubmit={handleSubmit} className="rounded-lg border border-ink-200 bg-surface p-6">
        <h2 className="font-serif text-lg text-ink-900 mb-4">유해사례 정보 입력</h2>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {/* Device info */}
          <div>
            <label className={LABEL_CLASS}>기기명 *</label>
            <input
              className={INPUT_CLASS}
              value={deviceName}
              onChange={(e) => setDeviceName(e.target.value)}
              placeholder="예: 혈당 측정기 XYZ-100"
              required
            />
          </div>
          <div>
            <label className={LABEL_CLASS}>모델번호</label>
            <input
              className={INPUT_CLASS}
              value={deviceModel}
              onChange={(e) => setDeviceModel(e.target.value)}
              placeholder="예: XYZ-100-v2"
            />
          </div>
          <div>
            <label className={LABEL_CLASS}>로트 번호</label>
            <input
              className={INPUT_CLASS}
              value={lotNumber}
              onChange={(e) => setLotNumber(e.target.value)}
              placeholder="예: LOT2024001"
            />
          </div>
          <div>
            <label className={LABEL_CLASS}>기기 분류 *</label>
            <select
              className={INPUT_CLASS}
              value={deviceCategory}
              onChange={(e) => setDeviceCategory(e.target.value as DeviceCategory)}
              required
            >
              {DEVICE_CATEGORY_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>

          {/* Event dates */}
          <div>
            <label className={LABEL_CLASS}>사고 발생일 *</label>
            <input
              type="date"
              className={INPUT_CLASS}
              value={eventDate}
              onChange={(e) => setEventDate(e.target.value)}
              required
            />
          </div>
          <div>
            <label className={LABEL_CLASS}>인지일 (Awareness Date) *</label>
            <input
              type="date"
              className={INPUT_CLASS}
              value={awarenessDate}
              onChange={(e) => setAwarenessDate(e.target.value)}
              required
            />
          </div>

          {/* Outcome */}
          <div>
            <label className={LABEL_CLASS}>환자 결과 *</label>
            <select
              className={INPUT_CLASS}
              value={patientOutcome}
              onChange={(e) => setPatientOutcome(e.target.value as PatientOutcome)}
              required
            >
              {OUTCOME_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>

          {/* Reporter */}
          <div>
            <label className={LABEL_CLASS}>보고자 이름 *</label>
            <input
              className={INPUT_CLASS}
              value={reporterName}
              onChange={(e) => setReporterName(e.target.value)}
              placeholder="예: 홍길동"
              required
            />
          </div>
          <div>
            <label className={LABEL_CLASS}>보고자 직책 *</label>
            <input
              className={INPUT_CLASS}
              value={reporterRole}
              onChange={(e) => setReporterRole(e.target.value)}
              placeholder="예: 의사 / RA Manager"
              required
            />
          </div>
        </div>

        {/* Event description */}
        <div className="mt-4">
          <label className={LABEL_CLASS}>사고 경위 *</label>
          <textarea
            className={`${INPUT_CLASS} min-h-[100px] resize-y`}
            value={eventDescription}
            onChange={(e) => setEventDescription(e.target.value)}
            placeholder="유해사례 발생 경위를 상세히 기술하세요 (10자 이상)..."
            required
            minLength={10}
          />
        </div>

        {error && (
          <p className="mt-3 text-sm text-red-600">{error}</p>
        )}

        <div className="mt-4">
          <button type="submit" className={PRIMARY_BTN} disabled={streaming}>
            {streaming ? '초안 생성 중...' : '초안 생성'}
          </button>
        </div>
      </form>

      {/* Results */}
      {result && (
        <div className="rounded-lg border border-ink-200 bg-surface p-6">
          <h2 className="font-serif text-lg text-ink-900 mb-4">분석 결과</h2>

          {/* Assessment */}
          {result.assessment && (
            <div className="mb-4 rounded-md border border-brand-200 bg-brand-50 p-4">
              <h3 className="text-sm font-semibold text-brand-800 mb-2">보고 의무 판단</h3>
              <ul className="text-sm text-ink-700 space-y-1">
                <li>
                  <span className="font-medium">FDA MDR:</span>{' '}
                  {result.assessment.fdaMdrRequired
                    ? `필요 (${result.assessment.fdaMdrDeadlineDays}일 이내)`
                    : '불필요'}
                </li>
                <li>
                  <span className="font-medium">EU MDV:</span>{' '}
                  {result.assessment.euMdvRequired
                    ? `필요 (${result.assessment.euMdvDeadlineDays}일 이내)`
                    : '불필요'}
                </li>
                <li>
                  <span className="font-medium">FSCA:</span>{' '}
                  {result.assessment.fscaRequired ? '필요' : '불필요'}
                </li>
              </ul>
              <p className="mt-2 text-xs text-ink-500">{result.assessment.rationale}</p>
            </div>
          )}

          {/* Loading indicator */}
          {streaming && !result.done && (
            <p className="text-sm text-ink-500 mb-4">보고서 초안 생성 중...</p>
          )}

          {/* Draft tabs */}
          {result.drafts.length > 0 && (
            <div>
              <div className="flex gap-2 border-b border-ink-200 mb-4">
                {result.drafts.map((d) => (
                  <button
                    key={d.reportType}
                    type="button"
                    onClick={() => setActiveTab(d.reportType)}
                    className={`px-3 py-2 text-sm border-b-2 -mb-px transition-colors ${
                      activeTab === d.reportType
                        ? 'border-brand-600 text-brand-700 font-medium'
                        : 'border-transparent text-ink-500 hover:text-ink-700'
                    }`}
                  >
                    {REPORT_TYPE_LABELS[d.reportType] ?? d.reportType}
                  </button>
                ))}
              </div>

              {activeDraft && (
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-xs text-ink-500">
                      형식: {activeDraft.reportFormat} · 제출 기한:{' '}
                      {activeDraft.submissionDeadline}
                    </p>
                  </div>
                  <div className="grid gap-3">
                    {Object.entries(activeDraft.draftContent).map(([field, value]) => (
                      <div key={field} className="rounded-md border border-ink-200 p-3">
                        <p className="text-xs font-medium text-ink-500 uppercase tracking-wide mb-1">
                          {field.replace(/_/g, ' ')}
                        </p>
                        <p className="text-sm text-ink-800 whitespace-pre-wrap">{value}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {result.done && result.eventId && (
            <p className="mt-4 text-xs text-ink-400">
              Event ID: {result.eventId}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
