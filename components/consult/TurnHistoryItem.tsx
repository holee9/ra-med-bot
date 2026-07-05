// @MX:NOTE [AUTO] TurnHistoryItem — single turn renderer with citations.
// @MX:SPEC SPEC-V3-UI-001 (REQ-V3-UI-058/059/061, AC-CONS-UI-003/004/005)

import type { ConsultTurn } from '@/lib/queries/useConsult';

interface TurnHistoryItemProps {
  turn: ConsultTurn;
}

export function TurnHistoryItem({ turn }: TurnHistoryItemProps) {
  const hasError = !!turn.error;
  const hasCitations = turn.citations && turn.citations.length > 0;

  return (
    <div data-testid="turn-item" className="rounded border p-4 space-y-3">
      {/* Question */}
      <div data-testid="turn-question" className="font-medium">
        Q: {turn.question}
      </div>

      {/* Error (if any) — REQ-V3-UI-059 */}
      {hasError ? (
        <div data-testid="turn-error" className="rounded bg-red-50 p-3 text-sm text-red-700">
          답변 생성 실패: {turn.error}
        </div>
      ) : (
        <>
          {/* Answer */}
          {turn.answer && (
            <div data-testid="turn-answer" className="text-sm whitespace-pre-wrap">
              A: {turn.answer}
            </div>
          )}

          {/* Citations (REQ-V3-UI-061) */}
          {hasCitations && turn.sources && turn.sources.length > 0 && (
            <div className="space-y-2">
              <div className="text-xs text-gray-600">출처:</div>
              {turn.sources.map((source, idx) => (
                <div key={source.id} data-testid={`source-${idx}`} className="text-sm">
                  • {source.title}
                </div>
              ))}
              <div className="text-xs text-gray-600">인용: {turn.citations.length}건</div>
            </div>
          )}

          {/* Confidence Badge */}
          {turn.confidence !== null && turn.confidence !== undefined && (
            <div
              data-testid="confidence-badge"
              className={`inline-flex items-center gap-1 rounded px-2 py-1 text-xs ${
                turn.confidence >= 0.8
                  ? 'bg-green-50 text-green-700'
                  : turn.confidence >= 0.5
                    ? 'bg-amber-50 text-amber-700'
                    : 'bg-red-50 text-red-700'
              }`}
            >
              <span>신뢰도: {(turn.confidence * 100).toFixed(0)}%</span>
            </div>
          )}
        </>
      )}

      {/* Timestamp */}
      <div data-testid="turn-timestamp" className="text-xs text-gray-500">
        {new Date(turn.createdAt).toLocaleString()}
      </div>
    </div>
  );
}
