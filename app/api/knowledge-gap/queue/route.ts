// @MX:ANCHOR [AUTO] Knowledge Gap Queue Route — GET /api/knowledge-gap/queue.
// @MX:REASON Public API boundary for RA operators browsing the unanswered queue.
// @MX:SPEC SPEC-REGULA-KNOWLEDGE-GAP-001 (REQ-KNOWLEDGE-GAP-008 context, AC-08 RBAC, Issue #35)
//
// Returns a paginated, filterable list of unanswered_queue rows.
//   - Permission: knowledgegap.view (ra-member+) — broader visibility than classify/replay
//     so the whole RA team can see what the bot could NOT answer.
//   - Filters: status (open|classified|resolved), reason (gap_reason), classification.
//   - Pagination: ?page=1&pageSize=50 (capped at 50).
//
// The redacted_question is the ONLY user-originated field returned; it was already
// PII-redacted at capture time (detector.ts → redaction.ts). No new redaction here.

export const runtime = 'nodejs';

import { withPermission } from '@/lib/auth/with-permission';
import { db } from '@/lib/db/client';
import { unansweredQueue } from '@/lib/db/schema';
import { type SQL, and, desc, eq } from 'drizzle-orm';
import { z } from 'zod';

const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 50;

const QuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(DEFAULT_PAGE_SIZE),
  status: z.enum(['open', 'classified', 'resolved']).optional(),
  reason: z.enum(['low_confidence', 'low_citation', 'no_results', 'policy_blocked']).optional(),
  classification: z
    .enum(['ra_project_gap', 'md_process_gap', 'external_regulation_needed', 'bug'])
    .optional(),
});

export const GET = withPermission('knowledgegap.view', async (req, _ctx, session) => {
  const url = new URL(req.url);
  const parsed = QuerySchema.safeParse({
    page: url.searchParams.get('page') ?? undefined,
    pageSize: url.searchParams.get('pageSize') ?? undefined,
    status: url.searchParams.get('status') ?? undefined,
    reason: url.searchParams.get('reason') ?? undefined,
    classification: url.searchParams.get('classification') ?? undefined,
  });

  if (!parsed.success) {
    return Response.json(
      { error: 'invalid_query', issues: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const filters: SQL[] = [];
  // Org scoping: only rows from the caller's org. RLS also enforces this at the DB,
  // but we add the filter explicitly so the query plan is cheap and unambiguous.
  if (session.user.organizationId) {
    filters.push(eq(unansweredQueue.orgId, session.user.organizationId));
  }
  if (parsed.data.status) filters.push(eq(unansweredQueue.status, parsed.data.status));
  if (parsed.data.reason) filters.push(eq(unansweredQueue.gapReason, parsed.data.reason));
  if (parsed.data.classification) {
    filters.push(eq(unansweredQueue.classification, parsed.data.classification));
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
    .where(filters.length > 0 ? and(...filters) : undefined)
    .orderBy(desc(unansweredQueue.createdAt))
    .limit(parsed.data.pageSize)
    .offset((parsed.data.page - 1) * parsed.data.pageSize);

  return Response.json({
    page: parsed.data.page,
    pageSize: parsed.data.pageSize,
    items: rows.map((r) => ({
      ...r,
      createdAt: r.createdAt.toISOString(),
      resolvedAt: r.resolvedAt ? r.resolvedAt.toISOString() : null,
    })),
  });
});
