// @MX:NOTE [AUTO] GET /api/rlhf/heatmap — quality heatmap by question type × corpus.
// @MX:SPEC SPEC-REGULA-RLHF-001 (REQ-RLHF-012, AC-08)
// @MX:REASON Reuses audit.read (already exists, no PermissionAction delta) so
//           RA leads and auditors can view the quality heatmap. Aggregation
//           uses the pure feedback-aggregator functions.
//
// C-2 IDOR fix (expert-security BLOCK-MERGE): the previous query selected ALL
// feedback across ALL orgs with NO org WHERE — the worst cross-tenant data
// disclosure. RLS is inert project-wide (#239 debt), so the org boundary MUST
// be enforced at the query layer. Now the select joins answer_feedback ->
// messages -> conversations -> projects and filters projects.organization_id
// = session.user.organizationId. A caller only ever sees their own org's
// heatmap.

import { withPermission } from '@/lib/kernel/auth/with-permission';
import { withTenantScope } from '@/lib/kernel/db/client';
import { answerFeedback, conversations, messages, projects } from '@/lib/kernel/db/schema';
import { computeMessageScore } from '@/lib/rlhf/feedback-aggregator';
import { desc, eq } from 'drizzle-orm';

/**
 * REQ-RLHF-012: return per-corpus mean feedback score + counts. The heatmap
 * shape is `{ corpus: { meanScore, total, upCount, downCount } }`.
 *
 * Corpus derivation: we join messages -> conversations (which carries the
 * corpus/project context in meta_json). For the v1 heatmap we group by the
 * conversation's project_id as the corpus proxy (a per-corpus breakdown by
 * source type would require joining message_sources; deferred to a follow-up).
 */
export const GET = withPermission('audit.read', async (request, _ctx, session) => {
  const url = new URL(request.url);
  const limit = Number(url.searchParams.get('limit') ?? '100');

  // C-2: scope to the caller's org. An empty/missing orgId is a 403 — no data
  // is returned for unauthenticated-org sessions.
  const orgId = session.user.organizationId ?? '';
  if (!orgId) {
    return Response.json({ error: 'no_org_context' }, { status: 403 });
  }

  // Fetch recent feedback joined to message -> conversation -> project, scoped
  // to the caller's org so NO cross-org feedback rows are returned.
  // #239 Phase 2: withTenantScope sets app.current_org_id GUC for RLS enforce.
  // App-level eq(projects.organizationId, orgId) retained as defense-in-depth
  // (RLS is inert project-wide until service-role bypass is dropped).
  const rows = await withTenantScope(orgId, async (dbs) =>
    dbs
      .select({
        rating: answerFeedback.rating,
        createdAt: answerFeedback.createdAt,
        messageId: answerFeedback.messageId,
        conversationId: messages.conversationId,
      })
      .from(answerFeedback)
      .innerJoin(messages, eq(messages.id, answerFeedback.messageId))
      .innerJoin(conversations, eq(conversations.id, messages.conversationId))
      .innerJoin(projects, eq(projects.id, conversations.projectId))
      .where(eq(projects.organizationId, orgId))
      .orderBy(desc(answerFeedback.createdAt))
      .limit(limit),
  );

  // Group by conversationId as the corpus proxy (v1). Each conversation tends
  // to be scoped to a single regulatory topic / corpus in practice.
  const byCorpus = new Map<string, { rating: 'up' | 'down'; createdAt: Date }[]>();
  for (const r of rows) {
    const key = r.conversationId ?? 'unknown';
    const arr = byCorpus.get(key) ?? [];
    arr.push({ rating: r.rating, createdAt: r.createdAt });
    byCorpus.set(key, arr);
  }

  const heatmap: Record<
    string,
    { meanScore: number; total: number; upCount: number; downCount: number }
  > = {};
  for (const [corpus, recs] of byCorpus) {
    const upCount = recs.filter((r) => r.rating === 'up').length;
    heatmap[corpus] = {
      meanScore: computeMessageScore(recs),
      total: recs.length,
      upCount,
      downCount: recs.length - upCount,
    };
  }

  return Response.json({ heatmap, sampledAt: new Date().toISOString() });
});
