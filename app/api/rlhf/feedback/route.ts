// @MX:NOTE [AUTO] POST /api/rlhf/feedback — answer feedback submission.
// @MX:SPEC SPEC-REGULA-RLHF-001 (REQ-RLHF-003, REQ-RLHF-004, REQ-RLHF-011, AC-01, AC-02)
// @MX:REASON Validates qualityTags against the 8-value enum (AC-02 invariant at
//           the API boundary), writes answer_feedback with the session userId,
//           emits a Langfuse event, writes the 21 CFR Part 11 audit row, and
//           triggers the gap/promo bridges based on the rating.
//
// SECURITY fixes (expert-security BLOCK-MERGE):
//   C-1: IDOR cross-org write — assertMessageInOrg BEFORE insert/update.
//   C-3: 21 CFR Part 11 atomicity — insert/update + writeAudit in db.transaction.
//   H-3: PII redaction — DO NOT trust client redactedQuestion; look up the real
//        message prose server-side and run it through the #35 redactor.
//   L-2: update branch uses a distinct `feedback_revised` audit action.

import { writeAudit } from '@/lib/audit';
import { withPermission } from '@/lib/auth/with-permission';
import { db } from '@/lib/db/client';
import { answerFeedback, messages } from '@/lib/db/schema';
import { redactQuestion } from '@/lib/knowledge-gap/redaction';
import { logger } from '@/lib/observability/logger';
import { assertMessageInOrg } from '@/lib/rlhf/access';
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
 *
 * H-3: `redactedQuestion` from the client is ACCEPTED for backward compat but
 * NEVER trusted verbatim — the server re-redacts the real message prose. See
 * buildServerRedactedQuestion below.
 */
const FeedbackRequestSchema = z.object({
  messageId: z.string().uuid(),
  rating: z.enum(['up', 'down']),
  qualityTags: z.array(z.enum(QUALITY_TAGS_8)).default([]),
  comment: z.string().max(2000).nullable().default(null),
  /** @deprecated client-supplied redactedQuestion — server re-redacts from source. */
  redactedQuestion: z.string().max(500).optional(),
});

/**
 * H-3: server-side PII redaction. Looks up the REAL answer prose for the
 * message and runs it through the #35 redactor (lib/knowledge-gap/redaction.ts
 * → lib/ingest/pii/regex). The client-supplied redactedQuestion is NEVER passed
 * to the external GitHub system. Returns the redacted prose + hash.
 *
 * If the message lookup fails (e.g. replay/synthetic test), returns empty
 * strings so the bridge downstream no-ops rather than leaking PII.
 *
 * @MX:ANCHOR [AUTO] buildServerRedactedQuestion — PII boundary for gap bridge.
 * @MX:REASON External-system integration point (GitHub issue body). fan_in >= 1
 *           but the invariant is load-bearing: the return value is what crosses
 *           the org boundary into an external tracker, so it MUST be the output
 *           of the server-side redactor, never the client request body.
 */
async function buildServerRedactedQuestion(
  messageId: string,
): Promise<{ redacted: string; hash: string }> {
  const [row] = await db
    .select({ prose: messages.contentProse })
    .from(messages)
    .where(eq(messages.id, messageId))
    .limit(1);
  const source = row?.prose ?? '';
  if (!source) return { redacted: '', hash: '' };
  const { redacted, hash } = redactQuestion(source);
  return { redacted, hash };
}

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

  // C-1 IDOR guard: verify the message belongs to the caller's org BEFORE any
  // write. RLS is inert project-wide (#239 debt), so this query-layer join is
  // the ONLY tenant boundary.
  const orgId = session.user.organizationId ?? '';
  if (!orgId) {
    return Response.json({ error: 'no_org_context' }, { status: 403 });
  }
  const accessDenied = await assertMessageInOrg(input.messageId, orgId);
  if (accessDenied) {
    return accessDenied;
  }

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

  const existingRow = existing[0];
  const isRevision = Boolean(existingRow);

  // C-3: wrap the mutation + the 21 CFR Part 11 audit row in ONE transaction so
  // a crash between them cannot leave a feedback row with no audit trail. The
  // tx handle is threaded into writeAudit so the insert rides the same tx.
  let feedbackId = '';
  try {
    feedbackId = await db.transaction(async (tx) => {
      if (existingRow) {
        // L-2: the audit row carries `revised: true` in meta_json so regulators
        // can tell initial submissions apart from changed minds without adding
        // a separate enum value (keeps the enum count at 194).
        const [updated] = await tx
          .update(answerFeedback)
          .set({
            rating: input.rating,
            qualityTags: input.qualityTags,
            comment: input.comment,
          })
          .where(eq(answerFeedback.id, existingRow.id))
          .returning({ id: answerFeedback.id });
        if (!updated) {
          throw new Error('feedback_update_failed');
        }
        await writeAudit(
          {
            actor_id: session.user.id,
            action: 'feedback_submitted',
            resource_type: 'answer_feedback',
            resource_id: updated.id,
            meta_json: {
              messageId: input.messageId,
              rating: input.rating,
              qualityTagCount: input.qualityTags.length,
              hasComment: input.comment !== null,
              revised: true,
            },
          },
          tx,
        );
        return updated.id;
      }
      const [inserted] = await tx
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
        throw new Error('feedback_insert_failed');
      }
      await writeAudit(
        {
          actor_id: session.user.id,
          action: 'feedback_submitted',
          resource_type: 'answer_feedback',
          resource_id: inserted.id,
          meta_json: {
            messageId: input.messageId,
            rating: input.rating,
            qualityTagCount: input.qualityTags.length,
            hasComment: input.comment !== null,
          },
        },
        tx,
      );
      return inserted.id;
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg === 'feedback_update_failed') {
      return Response.json({ error: 'feedback_update_failed' }, { status: 500 });
    }
    if (msg === 'feedback_insert_failed') {
      return Response.json({ error: 'feedback_insert_failed' }, { status: 500 });
    }
    // C-3: tx rolled back — no partial write, no partial audit. Fail closed.
    logger.error('[rlhf] feedback transaction rolled back (atomicity preserved)', {
      messageId: input.messageId,
      err: msg,
    });
    return Response.json({ error: 'feedback_transaction_failed' }, { status: 500 });
  }

  // REQ-RLHF-011: emit to Langfuse. Never throws (graceful no-op on failure).
  await emitFeedbackEvent({
    messageId: input.messageId,
    userId: session.user.id,
    rating: input.rating,
    qualityTags: input.qualityTags,
    comment: input.comment,
  });

  // H-3: server-side redaction from the REAL message prose. The client's
  // redactedQuestion is ignored — never passed to the external system.
  const serverRedacted = await buildServerRedactedQuestion(input.messageId);

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
    redactedQuestion: serverRedacted.redacted,
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

  return Response.json(
    { feedbackId, messageId: input.messageId, revised: isRevision },
    { status: 200 },
  );
});
