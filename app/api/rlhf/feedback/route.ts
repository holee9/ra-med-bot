// @MX:NOTE [AUTO] POST /api/rlhf/feedback — answer feedback submission.
// @MX:SPEC SPEC-REGULA-RLHF-001 (REQ-RLHF-003, REQ-RLHF-004, REQ-RLHF-011, AC-01, AC-02)
// @MX:REASON Validates qualityTags against the 8-value enum (AC-02 invariant at
//           the API boundary), writes answer_feedback with the session userId,
//           emits a Langfuse event, writes the 21 CFR Part 11 audit row, and
//           triggers the gap/promo bridges based on the rating.

import { writeAudit } from '@/lib/audit';
import { withPermission } from '@/lib/auth/with-permission';
import { db } from '@/lib/db/client';
import { answerFeedback } from '@/lib/db/schema';
import { logger } from '@/lib/observability/logger';
import {
  createGapIssueForLowRatedAnswer,
  proposePromotionCandidateForHighRatedAnswer,
} from '@/lib/rlhf/gap-promo-bridge';
import { emitFeedbackEvent } from '@/lib/rlhf/langfuse-emitter';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';

/** REQ-RLHF-002 / AC-02: EXACTLY 8 quality tag values. */
const QUALITY_TAGS_8 = [
  'citation_missing',
  'citation_wrong',
  'answer_incomplete',
  'answer_wrong',
  'outdated_info',
  'jurisdiction_mismatch',
  'helpful',
  'excellent',
] as const;

/**
 * AC-02 invariant: the zod schema rejects any tag outside the 8-value enum.
 * The literal tuple (not a string[]) keeps the type narrow so TypeScript also
 * enforces exhaustiveness at compile time.
 */
const FeedbackRequestSchema = z.object({
  messageId: z.string().uuid(),
  rating: z.enum(['up', 'down']),
  qualityTags: z.array(z.enum(QUALITY_TAGS_8)).default([]),
  comment: z.string().max(2000).nullable().default(null),
  /**
   * PII-free snippet of the question (for the gap-issue bridge). The client
   * MUST redact before sending; the server does not redact.
   */
  redactedQuestion: z.string().max(500).optional(),
});

export const POST = withPermission('rlhf.feedback', async (request, _ctx, session) => {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'invalid_json' }, { status: 400 });
  }

  const parsed = FeedbackRequestSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: 'validation_failed', issues: parsed.error.issues },
      { status: 400 },
    );
  }
  const input = parsed.data;

  // Upsert: one feedback row per (messageId, userId). If the user already left
  // feedback on this message, replace it. This matches the UNIQUE constraint.
  const existing = await db
    .select({ id: answerFeedback.id })
    .from(answerFeedback)
    .where(
      and(
        eq(answerFeedback.messageId, input.messageId),
        eq(answerFeedback.userId, session.user.id),
      ),
    )
    .limit(1);

  let feedbackId: string;
  const existingRow = existing[0];
  if (existingRow) {
    const [updated] = await db
      .update(answerFeedback)
      .set({
        rating: input.rating,
        qualityTags: input.qualityTags,
        comment: input.comment,
      })
      .where(eq(answerFeedback.id, existingRow.id))
      .returning({ id: answerFeedback.id });
    if (!updated) {
      return Response.json({ error: 'feedback_update_failed' }, { status: 500 });
    }
    feedbackId = updated.id;
  } else {
    const [inserted] = await db
      .insert(answerFeedback)
      .values({
        messageId: input.messageId,
        userId: session.user.id,
        rating: input.rating,
        qualityTags: input.qualityTags,
        comment: input.comment,
      })
      .returning({ id: answerFeedback.id });
    if (!inserted) {
      return Response.json({ error: 'feedback_insert_failed' }, { status: 500 });
    }
    feedbackId = inserted.id;
  }

  // REQ-RLHF-004 / 21 CFR Part 11: audit the feedback write.
  await writeAudit({
    actor_id: session.user.id,
    action: 'feedback_submitted',
    resource_type: 'answer_feedback',
    resource_id: feedbackId,
    meta_json: {
      messageId: input.messageId,
      rating: input.rating,
      // Store tag COUNTS, not PII. Tags are enum values, safe to include.
      qualityTagCount: input.qualityTags.length,
      hasComment: input.comment !== null,
    },
  });

  // REQ-RLHF-011: emit to Langfuse. Never throws (graceful no-op on failure).
  await emitFeedbackEvent({
    messageId: input.messageId,
    userId: session.user.id,
    rating: input.rating,
    qualityTags: input.qualityTags,
    comment: input.comment,
  });

  // REQ-RLHF-007 / REQ-RLHF-008: trigger the gap/promo bridges. These are
  // best-effort and MUST NOT fail the request. The promo bridge is a pure
  // descriptor (REQ-RLHF-015 HARD — no auto-confirm).
  const bridgeInput = {
    messageId: input.messageId,
    conversationId: '', // not needed for the bridge decision logic
    userId: session.user.id,
    rating: input.rating,
    qualityTags: input.qualityTags,
    comment: input.comment,
    redactedQuestion: input.redactedQuestion ?? '',
  };

  try {
    if (input.rating === 'down') {
      await createGapIssueForLowRatedAnswer(bridgeInput);
    } else if (input.rating === 'up') {
      // Descriptor only — no DB write, no side effect.
      proposePromotionCandidateForHighRatedAnswer(bridgeInput);
    }
  } catch (err) {
    // Bridges are best-effort; a GitHub/Langfuse hiccup must not fail feedback.
    logger.warn('[rlhf] gap/promo bridge failed (best-effort)', {
      messageId: input.messageId,
      err: err instanceof Error ? err.message : String(err),
    });
  }

  return Response.json({ feedbackId, messageId: input.messageId }, { status: 200 });
});
