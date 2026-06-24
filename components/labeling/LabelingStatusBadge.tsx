// @MX:NOTE [AUTO] LabelingStatusBadge — REQ-006/012 visual marker for document status.
// @MX:SPEC SPEC-REGULA-LABELING-001 (REQ-006, REQ-012, AC-03, AC-08)
//
// Mirrors the change-control ProvisionalBadge pattern: amber for draft/in_review,
// green for approved. WCAG 2.1 AA: amber-800 on amber-100 >= 4.5:1; success on
// success-bg >= 4.5:1. Icon is decorative (aria-hidden); text carries meaning.

import type { LabelingDocumentStatus } from '@/lib/labeling/types';
import { AlertTriangle, CheckCircle2 } from 'lucide-react';

interface LabelingStatusBadgeProps {
  status: LabelingDocumentStatus;
}

const STATUS_LABEL: Readonly<Record<LabelingDocumentStatus, string>> = {
  draft: '초안 (Draft)',
  in_review: '검토 중 (In Review)',
  approved: '승인 완료 (Approved)',
  rejected: '반려 (Rejected)',
};

export function LabelingStatusBadge({ status }: LabelingStatusBadgeProps) {
  if (status === 'approved') {
    return (
      <span
        className="inline-flex items-center gap-1.5 rounded-xs border border-success/30 bg-success-bg px-2.5 py-1 text-xs font-medium text-success"
        data-testid="labeling-status-approved"
      >
        <CheckCircle2 aria-hidden="true" size={14} className="shrink-0" />
        {STATUS_LABEL.approved}
      </span>
    );
  }

  if (status === 'rejected') {
    return (
      <span
        className="inline-flex items-center gap-1.5 rounded-xs border border-danger/30 bg-danger-bg px-2.5 py-1 text-xs font-medium text-danger"
        data-testid="labeling-status-rejected"
      >
        <AlertTriangle aria-hidden="true" size={14} className="shrink-0" />
        {STATUS_LABEL.rejected}
      </span>
    );
  }

  // draft or in_review — amber provisional marker.
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-xs border border-amber-400/40 bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-800"
      data-testid={`labeling-status-${status}`}
    >
      <AlertTriangle aria-hidden="true" size={14} className="shrink-0" />
      {STATUS_LABEL[status]}
    </span>
  );
}
