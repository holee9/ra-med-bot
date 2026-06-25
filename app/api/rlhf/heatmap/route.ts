// @MX:NOTE [AUTO] GET /api/rlhf/heatmap — quality heatmap by question type × corpus.
// @MX:SPEC SPEC-REGULA-RLHF-001 (REQ-RLHF-012, AC-08)
// @MX:REASON Reuses audit.read (already exists, no PermissionAction delta) so
//           RA leads and auditors can view the quality heatmap. Aggregation
//           uses the pure feedback-aggregator functions.

import { withPermission } from '@/lib/auth/with-permission';
import { db } from '@/lib/db/client';
import { answerFeedback, conversations, messages } from '@/lib/db/schema';
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
export const GET = withPermission('audit.read', async (request) => {
  const url = new URL(request.url);
  const limit = Number(url.searchParams.get('limit') ?? '100');

  // Fetch recent feedback joined to the message -> conversation for grouping.
  const rows = await db
    .select({
      rating: answerFeedback.rating,
      createdAt: answerFeedback.createdAt,
      messageId: answerFeedback.messageId,
      conversationId: messages.conversationId,
    })
    .from(answerFeedback)
    .innerJoin(messages, eq(messages.id, answerFeedback.messageId))
    .orderBy(desc(answerFeedback.createdAt))
    .limit(limit);

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
