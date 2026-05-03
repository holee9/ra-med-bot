'use client';

// @MX:NOTE [AUTO] ExpertReviewCallout — T-007 (REQ-ENTERPRISE-027).
// Shown when a message has expert_review_required=true.
// Amber background callout with reason text.
// @MX:SPEC SPEC-REGULA-ENTERPRISE-001 (REQ-ENTERPRISE-027)

interface ExpertReviewCalloutProps {
  conversationId: string;
  messageId: string;
  reason: string;
}

export function ExpertReviewCallout({ reason }: ExpertReviewCalloutProps) {
  return (
    <div
      data-testid="expert-review-callout"
      className="rounded-lg border border-accent-400 bg-accent-50 px-4 py-3 text-sm"
      role="alert"
    >
      <p className="mb-1 font-semibold text-accent-800">이 답변은 전문가 검토가 필요합니다</p>
      <p className="text-ink-700">{reason}</p>
    </div>
  );
}
