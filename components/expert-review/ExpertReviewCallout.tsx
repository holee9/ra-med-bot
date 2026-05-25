'use client';

// @MX:NOTE [AUTO] ExpertReviewCallout — T-007 (REQ-ENTERPRISE-027).
// Shown when a message has expert_review_required=true.
// Amber background callout with reason text + send-review action button.
// @MX:SPEC SPEC-REGULA-ENTERPRISE-001 (REQ-ENTERPRISE-027)

import { useState } from 'react';

interface ExpertReviewCalloutProps {
  conversationId: string;
  messageId: string;
  reason: string;
}

export function ExpertReviewCallout({
  conversationId,
  messageId,
  reason,
}: ExpertReviewCalloutProps) {
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

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
