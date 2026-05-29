// @MX:NOTE [AUTO] Expert Review Queue Page — T-007 (REQ-ENTERPRISE-024).
// Server component with RBAC check. Only ra-lead and above can access.
// Queries DB directly (RSC pattern) for fresh pending reviews.
// @MX:SPEC SPEC-REGULA-ENTERPRISE-001 (REQ-ENTERPRISE-024)

import { QueueList } from '@/components/expert-review/QueueList';
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

  return (
    <section data-testid="review-queue-table" className="mx-auto max-w-content px-6 py-8">
      <h1 className="mb-6 font-serif text-2xl text-brand-800">전문가 검토 대기열</h1>
      <QueueList items={items} />
    </section>
  );
}
