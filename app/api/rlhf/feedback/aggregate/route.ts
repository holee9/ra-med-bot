// @MX:NOTE [AUTO] GET /api/rlhf/feedback/aggregate — per-message feedback aggregation.
// @MX:SPEC SPEC-REGULA-RLHF-001 (REQ-RLHF-005, REQ-RLHF-006)

import { withPermission } from '@/lib/auth/with-permission';
import { db } from '@/lib/db/client';
import { answerFeedback } from '@/lib/db/schema';
import { aggregateFeedback, detectDownwardTrend } from '@/lib/rlhf/feedback-aggregator';
import { eq } from 'drizzle-orm';

export const GET = withPermission('rlhf.feedback', async (request) => {
  const url = new URL(request.url);
  const messageId = url.searchParams.get('messageId');
  if (!messageId) {
    return Response.json({ error: 'messageId_required' }, { status: 400 });
  }

  const rows = await db
    .select({
      rating: answerFeedback.rating,
      createdAt: answerFeedback.createdAt,
    })
    .from(answerFeedback)
    .where(eq(answerFeedback.messageId, messageId));

  const agg = aggregateFeedback(rows);
  const trend = detectDownwardTrend(rows);

  return Response.json({
    messageId,
    aggregate: agg,
    trend,
  });
});
