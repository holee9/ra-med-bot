'use client';

// @MX:NOTE [AUTO] ReviewCard — T-007 (REQ-ENTERPRISE-026).
// Shows expert review item with status badge and action buttons.
// State machine: pending → in_progress → resolved.
// @MX:SPEC SPEC-REGULA-ENTERPRISE-001 (REQ-ENTERPRISE-026)

import type { ExpertReview } from '@/types/expert-review';

const STATUS_BADGE: Record<ExpertReview['status'], string> = {
  pending: 'bg-yellow-100 text-yellow-800 border-yellow-300',
  in_progress: 'bg-blue-100 text-blue-800 border-blue-300',
  resolved: 'bg-green-100 text-green-800 border-green-300',
};

const STATUS_LABEL: Record<ExpertReview['status'], string> = {
  pending: '대기 중',
  in_progress: '검토 중',
  resolved: '완료됨',
};

interface ReviewCardProps {
  item: ExpertReview;
  onStatusChange?: (id: string, status: string) => void;
}

export function ReviewCard({ item, onStatusChange }: ReviewCardProps) {
  const shortConvId = `${item.conversationId.slice(0, 8)}…`;
  const createdDate = item.createdAt.toLocaleDateString('ko-KR');

  return (
    <div data-testid="review-card" className="rounded-lg border border-ink-200 bg-surface p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          {item.notes && <p className="mb-1 text-sm text-ink-700">{item.notes}</p>}
          <p className="text-xs text-ink-400">대화 ID: {shortConvId}</p>
          <p className="text-xs text-ink-400">{createdDate}</p>
        </div>
        <span
          data-status={item.status}
          className={`shrink-0 rounded border px-2 py-0.5 text-xs font-medium ${STATUS_BADGE[item.status]}`}
        >
          {STATUS_LABEL[item.status]}
        </span>
      </div>

      <div className="mt-3 flex gap-2">
        {item.status === 'pending' && (
          <button
            type="button"
            onClick={() => onStatusChange?.(item.id, 'in_progress')}
            className="rounded-md border border-brand-300 px-3 py-1.5 text-sm text-brand-700 hover:bg-brand-50"
          >
            검토 시작
          </button>
        )}
        {item.status === 'in_progress' && (
          <button
            type="button"
            onClick={() => onStatusChange?.(item.id, 'resolved')}
            className="rounded-md border border-green-300 px-3 py-1.5 text-sm text-green-700 hover:bg-green-50"
          >
            완료
          </button>
        )}
      </div>
    </div>
  );
}
