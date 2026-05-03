// @MX:NOTE [AUTO] useExpertReviewBadge — T-007 (REQ-ENTERPRISE-030).
// Polls /api/ra/expert-review?status=pending every 5000ms.
// Only polls if canView=true (role >= ra-lead).
// Returns { count } of pending reviews.
// @MX:SPEC SPEC-REGULA-ENTERPRISE-001 (REQ-ENTERPRISE-030)

import { useEffect, useState } from 'react';

interface UseExpertReviewBadgeOptions {
  canView: boolean;
}

interface UseExpertReviewBadgeResult {
  count: number;
}

const POLL_INTERVAL_MS = 5000;

export function useExpertReviewBadge({
  canView,
}: UseExpertReviewBadgeOptions): UseExpertReviewBadgeResult {
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!canView) return;

    const fetchCount = async () => {
      try {
        const res = await fetch('/api/ra/expert-review?status=pending');
        if (res.ok) {
          const data = (await res.json()) as { data: unknown[]; total: number };
          setCount(data.total ?? 0);
        }
      } catch {
        // Silently fail — badge is non-critical
      }
    };

    // Fetch immediately on mount
    void fetchCount();

    const interval = setInterval(() => {
      void fetchCount();
    }, POLL_INTERVAL_MS);

    return () => {
      clearInterval(interval);
    };
  }, [canView]);

  return { count };
}
