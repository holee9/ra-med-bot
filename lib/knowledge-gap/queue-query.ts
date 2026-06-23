// @MX:ANCHOR [AUTO] Shared queue query — used by GET /api/knowledge-gap/queue
// @MX:REASON Single source of truth for the unanswered_queue SELECT shape so the
//          Route Handler and the Server Component page never drift apart. Two
//          callers today (route + page); ANCHOR retained for future fan-out.
// @MX:SPEC SPEC-REGULA-KNOWLEDGE-GAP-001 (REQ-KNOWLEDGE-GAP-008, AC-04, Issue #35)
//
// Factored out of app/api/knowledge-gap/queue/route.ts so the page can read the
// queue directly from the DB without self-fetching its own URL. The route keeps
// its own Zod parsing and `withPermission` gate; this helper is the pure query.

import { db } from '@/lib/db/client';
import { unansweredQueue } from '@/lib/db/schema';
import { type SQL, and, desc, eq } from 'drizzle-orm';

export type GapStatus = 'open' | 'classified' | 'resolved';
export type GapReason = 'low_confidence' | 'low_citation' | 'no_results' | 'policy_blocked';
export type GapClassification =
  | 'ra_project_gap'
  | 'md_process_gap'
  | 'external_regulation_needed'
  | 'bug';

export interface QueueItem {
  id: string;
  conversationId: string;
  messageId: string;
  redactedQuestion: string;
  gapReason: GapReason;
  clusterId: string | null;
  githubIssueNumber: number | null;
  classification: GapClassification | null;
  status: GapStatus;
  createdAt: string;
  resolvedAt: string | null;
}

export interface QueueFilters {
  orgId?: string;
  status?: GapStatus;
  reason?: GapReason;
  classification?: GapClassification;
  page?: number;
  pageSize?: number;
}

const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 50;

/**
 * List unanswered_queue rows matching the given filters, newest first.
 * Pure DB read — callers are responsible for RBAC (route) or are already
 * authenticated server-side (page).
 */
export async function listQueueItems(filters: QueueFilters = {}): Promise<QueueItem[]> {
  const page = filters.page ?? 1;
  const pageSize = Math.min(filters.pageSize ?? DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE);

  const clauses: SQL[] = [];
  if (filters.orgId) clauses.push(eq(unansweredQueue.orgId, filters.orgId));
  if (filters.status) clauses.push(eq(unansweredQueue.status, filters.status));
  if (filters.reason) clauses.push(eq(unansweredQueue.gapReason, filters.reason));
  if (filters.classification) {
    clauses.push(eq(unansweredQueue.classification, filters.classification));
  }

  const rows = await db
    .select({
      id: unansweredQueue.id,
      conversationId: unansweredQueue.conversationId,
      messageId: unansweredQueue.messageId,
      redactedQuestion: unansweredQueue.redactedQuestion,
      gapReason: unansweredQueue.gapReason,
      clusterId: unansweredQueue.clusterId,
      githubIssueNumber: unansweredQueue.githubIssueNumber,
      classification: unansweredQueue.classification,
      status: unansweredQueue.status,
      createdAt: unansweredQueue.createdAt,
      resolvedAt: unansweredQueue.resolvedAt,
    })
    .from(unansweredQueue)
    .where(clauses.length > 0 ? and(...clauses) : undefined)
    .orderBy(desc(unansweredQueue.createdAt))
    .limit(pageSize)
    .offset((page - 1) * pageSize);

  return rows.map((r) => ({
    ...r,
    createdAt: r.createdAt.toISOString(),
    resolvedAt: r.resolvedAt ? r.resolvedAt.toISOString() : null,
  }));
}
