'use client';

// @MX:NOTE [AUTO] LiteratureSearchPanel — PICO-driven clinical literature search UI.
// @MX:SPEC REQ-CLINLIT-001~025

import { type FormEvent, useRef, useState } from 'react';

interface PicoData {
  patient: string;
  intervention: string;
  comparator: string | null;
  outcome: string;
  meshTerms: string[];
  searchQuery: string;
}

interface GradeCounts {
  high: number;
  moderate: number;
  low: number;
  veryLow: number;
}

interface SearchResult {
  searchId: string;
  includedCount: number;
  totalCount: number;
  cerSection6Draft: string;
  cerSection7Draft: string;
  cerSection8Draft: string;
}

type PipelineStep = 'idle' | 'pico' | 'search' | 'screening' | 'synthesis' | 'done' | 'error';

const STEP_LABELS: Record<PipelineStep, string> = {
  idle: '대기 중',
  pico: 'PICO 프레임워크 생성 중...',
  search: 'PubMed 검색 중...',
  screening: '제목/초록 스크리닝 중...',
  synthesis: '근거 합성 중...',
  done: '완료',
  error: '오류 발생',
};

const INPUT_CLASS = 'border border-ink-200 rounded-md px-3 py-2 text-sm w-full';
const PRIMARY_BTN =
  'bg-brand-700 text-white hover:bg-brand-800 rounded-md px-4 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-60';

interface Props {
  cerRunId: string;
  initialDeviceDescription?: string;
}

export function LiteratureSearchPanel({ cerRunId, initialDeviceDescription = '' }: Props) {
  const [deviceDescription, setDeviceDescription] = useState(initialDeviceDescription);
  const [step, setStep] = useState<PipelineStep>('idle');
  const [pico, setPico] = useState<PicoData | null>(null);
  const [searchCount, setSearchCount] = useState<number | null>(null);
  const [screeningStats, setScreeningStats] = useState<{
    total: number;
    included: number;
    excluded: number;
    uncertain: number;
  } | null>(null);
  const [gradeCounts, setGradeCounts] = useState<GradeCounts | null>(null);
  const [result, setResult] = useState<SearchResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState<'6' | '7' | '8'>('6');
  const abortRef = useRef<AbortController | null>(null);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!deviceDescription.trim()) return;

    // Reset state.
    setStep('pico');
    setPico(null);
    setSearchCount(null);
    setScreeningStats(null);
    setGradeCounts(null);
    setResult(null);
    setErrorMessage(null);

    abortRef.current?.abort();
    const abort = new AbortController();
    abortRef.current = abort;

    try {
      const response = await fetch('/api/ra/workflows/cer/literature', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cerRunId, deviceDescription }),
        signal: abort.signal,
      });

      if (!response.ok || !response.body) {
        const text = await response.text().catch(() => 'Unknown error');
        setErrorMessage(`요청 실패: ${text}`);
        setStep('error');
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

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            const parsed = JSON.parse(line.slice(6)) as { event: string; data: unknown };
            handleSSEEvent(parsed.event, parsed.data);
          } catch {
            // Ignore malformed SSE lines.
          }
        }
      }
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return;
      setErrorMessage('네트워크 오류가 발생했습니다. 다시 시도해 주세요.');
      setStep('error');
    }
  }

  function handleSSEEvent(event: string, data: unknown) {
    const d = data as Record<string, unknown>;
    switch (event) {
      case 'pico':
        setPico(d.pico as PicoData);
        setStep('search');
        break;
      case 'search':
        setSearchCount(d.count as number);
        setStep('screening');
        break;
      case 'screening':
        setScreeningStats({
          total: d.total as number,
          included: d.included as number,
          excluded: d.excluded as number,
          uncertain: d.uncertain as number,
        });
        setStep('synthesis');
        break;
      case 'synthesis':
        setGradeCounts(d.gradeCounts as GradeCounts);
        break;
      case 'done':
        if (d.searchId) {
          setResult(d as unknown as SearchResult);
        }
        setStep('done');
        break;
      case 'error':
        setErrorMessage((d.message as string) ?? '알 수 없는 오류');
        setStep('error');
        break;
    }
  }

  const isRunning = ['pico', 'search', 'screening', 'synthesis'].includes(step);

  return (
    <div className="space-y-6">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label
            htmlFor="deviceDescription"
            className="block text-sm font-medium text-ink-700 mb-1"
          >
            의료기기 설명 (Clinical Literature Search)
          </label>
          <textarea
            id="deviceDescription"
            className={`${INPUT_CLASS} h-28 resize-none`}
            placeholder="의료기기의 종류, 적응증, 기술적 특성을 입력하세요. 예: 혈당 연속 모니터링 시스템 (CGM), 제2형 당뇨병 환자용, 효소 기반 전기화학 센서..."
            value={deviceDescription}
            onChange={(e) => setDeviceDescription(e.target.value)}
            disabled={isRunning}
          />
        </div>
        <button type="submit" className={PRIMARY_BTN} disabled={isRunning || !deviceDescription.trim()}>
          {isRunning ? '검색 중...' : '검색 시작'}
        </button>
      </form>

      {/* Pipeline progress indicator */}
      {step !== 'idle' && (
        <div className="space-y-3">
          <PipelineProgress step={step} />

          {pico && (
            <div className="rounded-md border border-brand-200 bg-brand-50 p-3 text-sm space-y-1">
              <p className="font-medium text-brand-800">PICO 프레임워크</p>
              <p>
                <span className="text-ink-500">P (환자군):</span> {pico.patient}
              </p>
              <p>
                <span className="text-ink-500">I (중재):</span> {pico.intervention}
              </p>
              {pico.comparator && (
                <p>
                  <span className="text-ink-500">C (비교군):</span> {pico.comparator}
                </p>
              )}
              <p>
                <span className="text-ink-500">O (결과):</span> {pico.outcome}
              </p>
              <p className="text-xs text-ink-400 truncate">검색어: {pico.searchQuery}</p>
            </div>
          )}

          {searchCount !== null && (
            <p className="text-sm text-ink-600">
              PubMed 검색 결과: <span className="font-medium">{searchCount}개</span> 논문
            </p>
          )}

          {screeningStats && (
            <div className="text-sm text-ink-600 space-y-1">
              <p>스크리닝 결과:</p>
              <div className="flex gap-4">
                <span className="text-green-700">포함 {screeningStats.included}편</span>
                <span className="text-red-600">제외 {screeningStats.excluded}편</span>
                <span className="text-yellow-600">불확실 {screeningStats.uncertain}편</span>
              </div>
            </div>
          )}

          {gradeCounts && (
            <div className="space-y-1">
              <p className="text-sm font-medium text-ink-700">GRADE 근거 수준</p>
              <GradeBar counts={gradeCounts} />
            </div>
          )}
        </div>
      )}

      {/* CER section drafts */}
      {result && (
        <div className="space-y-3">
          <p className="text-sm font-medium text-ink-700">
            CER 섹션 초안 (포함 논문: {result.includedCount}편 / 전체 {result.totalCount}편)
          </p>
          <div className="flex gap-2 text-sm">
            {(['6', '7', '8'] as const).map((sec) => (
              <button
                key={sec}
                type="button"
                onClick={() => setActiveSection(sec)}
                className={`px-3 py-1 rounded-md border transition-colors ${
                  activeSection === sec
                    ? 'border-brand-500 bg-brand-50 text-brand-700 font-medium'
                    : 'border-ink-200 text-ink-600 hover:bg-ink-50'
                }`}
              >
                Section {sec}
              </button>
            ))}
          </div>
          <div className="rounded-md border border-ink-200 bg-white p-4 text-sm whitespace-pre-wrap font-mono text-ink-700 max-h-96 overflow-y-auto">
            {activeSection === '6' && result.cerSection6Draft}
            {activeSection === '7' && result.cerSection7Draft}
            {activeSection === '8' && result.cerSection8Draft}
          </div>
        </div>
      )}

      {errorMessage && (
        <p className="text-sm text-red-600 rounded-md border border-red-200 bg-red-50 px-3 py-2">
          {errorMessage}
        </p>
      )}
    </div>
  );
}

function PipelineProgress({ step }: { step: PipelineStep }) {
  const steps: PipelineStep[] = ['pico', 'search', 'screening', 'synthesis', 'done'];
  const currentIndex = steps.indexOf(step);

  return (
    <div className="flex items-center gap-2 text-sm">
      {steps.map((s, i) => {
        const isDone = i < currentIndex || step === 'done';
        const isActive = s === step && step !== 'done';
        return (
          <div key={s} className="flex items-center gap-1">
            <span
              className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-medium ${
                isDone
                  ? 'bg-brand-600 text-white'
                  : isActive
                    ? 'bg-brand-200 text-brand-800 animate-pulse'
                    : 'bg-ink-100 text-ink-400'
              }`}
            >
              {isDone ? '✓' : i + 1}
            </span>
            {i < steps.length - 1 && (
              <span className={`w-6 h-px ${i < currentIndex ? 'bg-brand-400' : 'bg-ink-200'}`} />
            )}
          </div>
        );
      })}
      <span className="text-ink-500 ml-2">{STEP_LABELS[step]}</span>
    </div>
  );
}

function GradeBar({ counts }: { counts: GradeCounts }) {
  const total = counts.high + counts.moderate + counts.low + counts.veryLow;
  if (total === 0) return null;

  const bars = [
    { label: '고', count: counts.high, color: 'bg-green-500' },
    { label: '중', count: counts.moderate, color: 'bg-blue-400' },
    { label: '저', count: counts.low, color: 'bg-yellow-400' },
    { label: '매우낮음', count: counts.veryLow, color: 'bg-red-400' },
  ];

  return (
    <div className="space-y-1">
      <div className="flex h-4 rounded overflow-hidden gap-px">
        {bars.map(
          (b) =>
            b.count > 0 && (
              <div
                key={b.label}
                className={`${b.color}`}
                style={{ width: `${(b.count / total) * 100}%` }}
                title={`${b.label}: ${b.count}편`}
              />
            ),
        )}
      </div>
      <div className="flex gap-3 text-xs text-ink-500">
        {bars.map(
          (b) =>
            b.count > 0 && (
              <span key={b.label}>
                <span className={`inline-block w-2 h-2 rounded-sm ${b.color} mr-1`} />
                {b.label} {b.count}
              </span>
            ),
        )}
      </div>
    </div>
  );
}
