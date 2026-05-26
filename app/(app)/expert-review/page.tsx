// @MX:NOTE [AUTO] Expert Review Queue Page — T-007 (REQ-ENTERPRISE-024).
// Server component with RBAC check. Only ra-lead and above can access.
// Fetches pending reviews from API and passes to QueueList.
// @MX:SPEC SPEC-REGULA-ENTERPRISE-001 (REQ-ENTERPRISE-024)

import { QueueList } from '@/components/expert-review/QueueList';
import { auth } from '@/lib/auth';
import { hasRole } from '@/lib/auth/rbac';
import type { Role } from '@/lib/auth/rbac';
import type { ExpertReview } from '@/types/expert-review';
import { redirect } from 'next/navigation';

// Server-side fetch with no-store cache (always fresh data).
async function fetchPendingReviews(): Promise<ExpertReview[]> {
  try {
    const res = await fetch(
      `${process.env.NEXTAUTH_URL ?? 'http://localhost:3000'}/api/ra/expert-review?status=pending`,
      { cache: 'no-store' },
    );
    if (!res.ok) return [];
    const data = (await res.json()) as { data: ExpertReview[] };
    return data.data ?? [];
  } catch {
    return [];
  }
}

export default async function ExpertReviewQueuePage() {
  const session = await auth();

  if (!session?.user) {
    redirect('/');
  }

  const userRole = (session.user as { role?: Role }).role;
  if (!userRole || !hasRole(userRole, 'ra-lead')) {
    redirect('/');
  }

  const items = await fetchPendingReviews();

  return (
    <section data-testid="review-queue-table" className="mx-auto max-w-content px-6 py-8">
      <h1 className="mb-6 font-serif text-2xl text-brand-800">전문가 검토 대기열</h1>
      <QueueList items={items} />
    </section>
  );
}
