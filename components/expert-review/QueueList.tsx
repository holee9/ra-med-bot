'use client';

// @MX:NOTE [AUTO] QueueList — T-007 (REQ-ENTERPRISE-025).
// Renders a list of ExpertReview items as ReviewCard components.
// Shows empty state when no items.
// @MX:SPEC SPEC-REGULA-ENTERPRISE-001 (REQ-ENTERPRISE-025)

import type { ExpertReview } from '@/types/expert-review';
import { ReviewCard } from './ReviewCard';

interface QueueListProps {
  items: ExpertReview[];
}

export function QueueList({ items }: QueueListProps) {
  if (items.length === 0) {
    return (
      <div data-testid="queue-list" className="py-8 text-center text-sm text-ink-400">
        대기 중인 검토 항목이 없습니다
      </div>
    );
  }

  return (
    <ul data-testid="queue-list" className="flex flex-col gap-3">
      {items.map((item) => (
        <li key={item.id}>
          <ReviewCard item={item} />
        </li>
      ))}
    </ul>
  );
}
