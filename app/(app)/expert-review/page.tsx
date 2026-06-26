// @MX:NOTE [AUTO] Expert Review Queue Page — T-007 (REQ-ENTERPRISE-024).
// Server component with RBAC check. Only ra-lead and above can access.
// Queries DB directly (RSC pattern) for fresh pending reviews.
// @MX:SPEC SPEC-REGULA-ENTERPRISE-001 (REQ-ENTERPRISE-024)
// @MX:SPEC Issue #158 (Group B3 - Expert Review triage/SLA header, pre-review warning, status update failure feedback)

import { PreReviewWarning } from '@/components/expert-review/PreReviewWarning';
import { QueueList } from '@/components/expert-review/QueueList';
import { TriageHeader } from '@/components/expert-review/TriageHeader';
import { auth } from '@/lib/auth';
import { hasRole } from '@/lib/auth/rbac';
import type { Role } from '@/lib/auth/rbac';
import { db } from '@/lib/db/client';
import { expertReviews } from '@/lib/db/schema';
import type { ExpertReview } from '@/types/expert-review';
import { desc, eq } from 'drizzle-orm';
import { redirect } from 'next/navigation';

// Direct DB query — avoids unauthenticated server-side API fetch.
async function fetchPendingReviews(): Promise<ExpertReview[]> {
  try {
    const rows = await db
      .select()
      .from(expertReviews)
      .where(eq(expertReviews.status, 'pending'))
      .orderBy(desc(expertReviews.createdAt));
    return rows as unknown as ExpertReview[];
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

  // Calculate stats
  const pending = items.filter((i) => i.status === 'pending').length;
  const inProgress = items.filter((i) => i.status === 'in_progress').length;
  const overdue = items.filter((i) => {
    if (!i.createdAt) return false;
    const created = new Date(i.createdAt);
    const now = new Date();
    const daysSinceCreation = (now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24);
    return daysSinceCreation > 7 && i.status === 'pending'; // 7-day SLA
  }).length;

  return (
    <section data-testid="review-queue-table" className="mx-auto max-w-content px-6 py-8">
      <h1 className="mb-6 font-serif text-2xl text-brand-800">전문가 검토 대기열</h1>

      <PreReviewWarning />

      <TriageHeader stats={{ pending, inProgress, overdue }} reviewerReady={true} />

      <QueueList items={items} />
    </section>
  );
}
