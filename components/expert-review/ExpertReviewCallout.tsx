'use client';

// @MX:NOTE [AUTO] ExpertReviewCallout — T-007 (REQ-ENTERPRISE-027).
// Shown when a message has expert_review_required=true.
// Amber background callout with reason text + send-review action button.
// Includes optional confidence breakdown panel (REQ-CONFIDENCE-001..004).
// @MX:SPEC SPEC-REGULA-ENTERPRISE-001 (REQ-ENTERPRISE-027)
// @MX:SPEC SPEC-REGULA-CONFIDENCE-EXPLAIN-001 (REQ-CONFIDENCE-001..004)

import type { ConfidenceBreakdown } from '@/types/streaming';
import { useState } from 'react';

interface ExpertReviewCalloutProps {
  conversationId: string;
  messageId: string;
  reason: string;
  score?: number;
  breakdown?: ConfidenceBreakdown;
}

interface BreakdownBarProps {
  label: string;
  value: number;
  testId: string;
}

function BreakdownBar({ label, value, testId }: BreakdownBarProps) {
  const pct = Math.round(value * 100);
  const color = value >= 0.7 ? 'bg-green-400' : value >= 0.5 ? 'bg-yellow-400' : 'bg-red-400';

  return (
    <div className="flex items-center gap-2" data-testid={testId}>
      <span className="w-32 shrink-0 text-xs text-ink-500">{label}</span>
      <div className="h-1.5 flex-1 rounded-full bg-accent-100">
        <div
          className={`h-full rounded-full transition-all ${color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="w-8 text-right text-xs font-mono text-ink-600">{pct}%</span>
    </div>
  );
}

export function ExpertReviewCallout({
  conversationId,
  messageId,
  reason,
  score,
  breakdown,
}: ExpertReviewCalloutProps) {
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showBreakdown, setShowBreakdown] = useState(false);

  async function handleSend() {
    setLoading(true);
    try {
      const res = await fetch('/api/ra/expert-review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversationId, messageId, reason }),
      });
      if (!res.ok) return;
      setSent(true);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      data-testid="expert-review-callout"
      className="rounded-lg border border-accent-400 bg-accent-50 px-4 py-3 text-sm"
      role="alert"
    >
      <p className="mb-1 font-semibold text-accent-800">이 답변은 전문가 검토가 필요합니다</p>
      {score !== undefined && (
        <div className="mb-1 flex items-center gap-2">
          <p data-testid="confidence-score" className="text-xs text-accent-600">
            신뢰도 {Math.round(score * 100)}%
          </p>
          {breakdown && (
            <button
              type="button"
              data-testid="breakdown-toggle"
              className="text-xs text-accent-500 underline hover:text-accent-700"
              onClick={() => setShowBreakdown((v) => !v)}
            >
              {showBreakdown ? '접기' : '근거 보기'}
            </button>
          )}
        </div>
      )}

      {/* Confidence breakdown panel */}
      {breakdown && showBreakdown && (
        <div
          data-testid="confidence-breakdown"
          className="mb-3 rounded-md border border-accent-200 bg-white px-3 py-2 space-y-2"
        >
          <p className="text-xs font-semibold text-ink-600">신뢰도 구성 요소</p>
          <BreakdownBar
            label="인용 커버리지"
            value={breakdown.citationCoverage}
            testId="breakdown-citation-coverage"
          />
          <BreakdownBar
            label="출처 일관성"
            value={breakdown.sourceAgreement}
            testId="breakdown-source-agreement"
          />
          <BreakdownBar
            label="출처 최신성"
            value={breakdown.sourceRecency}
            testId="breakdown-source-recency"
          />
          <BreakdownBar
            label="검색 관련도"
            value={breakdown.retrievalScore}
            testId="breakdown-retrieval-score"
          />
        </div>
      )}

      <p className="text-ink-700">{reason}</p>
      <button
        type="button"
        data-testid="send-review-btn"
        disabled={sent || loading}
        onClick={handleSend}
        className="mt-2 rounded-md border border-accent-400 px-3 py-1.5 text-sm text-accent-700 hover:bg-accent-100 disabled:opacity-50"
      >
        {sent ? '검토 요청됨' : loading ? '처리 중…' : '전문가에게 검토 요청'}
      </button>
    </div>
  );
}
