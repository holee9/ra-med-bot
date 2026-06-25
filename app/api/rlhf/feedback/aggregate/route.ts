// @MX:NOTE [AUTO] GET /api/rlhf/feedback/aggregate — per-message feedback aggregation.
// @MX:SPEC SPEC-REGULA-RLHF-001 (REQ-RLHF-005, REQ-RLHF-006)
// @MX:REASON C-2 IDOR fix: RLS is inert project-wide (#239 debt), so org
//           isolation MUST be enforced at the query layer. The previous query
//           selected feedback by messageId with NO org filter — a caller from
//           org-A could aggregate feedback on org-B's message. Now we assert
//           the message belongs to the caller's org first (assertMessageInOrg)
//           and the feedback select joins via messages->conversations->projects
//           scoped to the caller's org.

import { withPermission } from '@/lib/auth/with-permission';
import { withTenantScope } from '@/lib/db/client';
import { answerFeedback, conversations, messages, projects } from '@/lib/db/schema';
import { assertMessageInOrg } from '@/lib/rlhf/access';
import { aggregateFeedback, detectDownwardTrend } from '@/lib/rlhf/feedback-aggregator';
import { and, eq } from 'drizzle-orm';

export const GET = withPermission('rlhf.feedback', async (request, _ctx, session) => {
  const url = new URL(request.url);
  const messageId = url.searchParams.get('messageId');
  if (!messageId) {
    return Response.json({ error: 'messageId_required' }, { status: 400 });
  }

  const orgId = session.user.organizationId ?? '';
  if (!orgId) {
    return Response.json({ error: 'no_org_context' }, { status: 403 });
  }

  // C-2: verify the message belongs to the caller's org BEFORE aggregating.
  const accessDenied = await assertMessageInOrg(messageId, orgId);
  if (accessDenied) {
    return accessDenied;
  }

  // C-2 defense-in-depth: even though assertMessageInOrg passed, the feedback
  // select itself is org-scoped via the 3-hop join so a race (message moved
  // projects between the assert and the select) cannot leak cross-org rows.
  // #239 Phase 2: withTenantScope sets app.current_org_id GUC for RLS enforce.
  // App-level eq(projects.organizationId, orgId) retained as defense-in-depth.
  const rows = await withTenantScope(orgId, async (dbs) =>
    dbs
      .select({
        rating: answerFeedback.rating,
        createdAt: answerFeedback.createdAt,
      })
      .from(answerFeedback)
      .innerJoin(messages, eq(messages.id, answerFeedback.messageId))
      .innerJoin(conversations, eq(conversations.id, messages.conversationId))
      .innerJoin(projects, eq(projects.id, conversations.projectId))
      .where(and(eq(answerFeedback.messageId, messageId), eq(projects.organizationId, orgId))),
  );

  const agg = aggregateFeedback(rows);
  const trend = detectDownwardTrend(rows);

  return Response.json({
    messageId,
    aggregate: agg,
    trend,
  });
});
