// @MX:NOTE [AUTO] POST /api/rlhf/feedback — answer feedback submission.
// @MX:SPEC SPEC-REGULA-RLHF-001 (REQ-RLHF-003, REQ-RLHF-004, REQ-RLHF-005,
//           REQ-RLHF-009, REQ-RLHF-011, REQ-RLHF-015, AC-01, AC-02)
// @MX:REASON Validates qualityTags against the 12-value enum (AC-02 invariant at
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
//
// Issue #264 sub-PR 3/3 — implicit feedback (alternate answers):
//   The route now accepts optional `source` ('explicit' default | 'implicit_regenerate')
//   and optional `variationDimensions`. When source='implicit_regenerate', the
//   route records rating='down' with feedback_source='implicit_regenerate' and
//   a DISTINCT audit action (rlhf.implicit_feedback_recorded) so implicit
//   signals are auditable separately from explicit thumbs-up/down. The UNIQUE
//   constraint (message_id, user_id, feedback_source) lets one explicit + one
//   implicit row per (message, user) coexist without 409.

import { writeAudit } from '@/lib/kernel/audit';
import { withPermission } from '@/lib/kernel/auth/with-permission';
import { db } from '@/lib/kernel/db/client';
import { withTenantScope } from '@/lib/kernel/db/client';
import { answerFeedback, messages } from '@/lib/kernel/db/schema';
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

/** REQ-RLHF-002 / AC-02: 12 quality tag values (8 original + 4 Issue-264 breakdown). */
const QUALITY_TAGS_12 = [
  'citation_missing',
  'citation_wrong',
  'answer_incomplete',
  'answer_wrong',
  'outdated_info',
  'jurisdiction_mismatch',
  'helpful',
  'excellent',
  'citation_coverage_low',
  'source_recency_stale',
  'source_authority_weak',
  'source_agreement_conflict',
] as const;

/**
 * AC-02 invariant: the zod schema rejects any tag outside the 12-value enum.
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
  qualityTags: z.array(z.enum(QUALITY_TAGS_12)).default([]),
  comment: z.string().max(2000).nullable().default(null),
  /** @deprecated client-supplied redactedQuestion — server re-redacts from source. */
  redactedQuestion: z.string().max(500).optional(),
  /**
   * Issue #264 sub-PR 3/3: origin channel of the feedback.
   *   'explicit' (default) — thumbs up/down submitted by the user.
   *   'implicit_regenerate' — user clicked "Regenerate answer". The route
   *     FORCES rating='down' on this path (the regeneration IS the implicit
   *     downvote; the client does NOT send an explicit thumbs-down).
   */
  source: z.enum(['explicit', 'implicit_regenerate']).default('explicit'),
  /**
   * Issue #264 sub-PR 3/3: optional client metadata describing which retrieval
   * /generation dimension differed on the regenerated attempt. All fields
   * optional. Persisted as jsonb; NULL for explicit feedback without context.
   */
  variationDimensions: z
    .object({
      region: z.string().max(64).optional(),
      corpus: z.string().max(64).optional(),
      model: z.string().max(64).optional(),
    })
    .strict()
    .optional()
    .nullable()
    .default(null),
});

/**
 * H-3: server-side question preparation. Looks up the REAL answer prose for the
 * message and hashes it via lib/knowledge-gap/redaction.ts. The client-supplied
 * redactedQuestion is NEVER passed to the external GitHub system — the server
 * re-derives the text. Returns the prose + hash.
 *
 * SPEC-REGULA-PHI-REMOVAL-001: PII redaction removed (Regula handles no patient
 * information). The text is passed through verbatim.
 *
 * If the message lookup fails (e.g. replay/synthetic test), returns empty
 * strings so the bridge downstream no-ops.
 *
 * @MX:ANCHOR [AUTO] buildServerRedactedQuestion — boundary for gap bridge.
 * @MX:REASON External-system integration point (GitHub issue body). fan_in >= 1
 *           but the invariant is load-bearing: the return value is what crosses
 *           the org boundary into an external tracker, so it MUST be the output
 *           of the server-side helper, never the client request body.
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

  // Issue #264 sub-PR 3/3: when source='implicit_regenerate', the regeneration
  // IS the implicit downvote — the client does NOT send an explicit
  // thumbs-down. Force rating='down' on this path so the implicit signal is
  // always captured as a negative rating regardless of the client payload.
  // Explicit feedback trusts the client rating as before.
  const isImplicit = input.source === 'implicit_regenerate';
  const effectiveRating = isImplicit ? 'down' : input.rating;

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

  // Upsert: one feedback row per (messageId, userId, feedback_source). The
  // existing-row lookup MUST scope by feedback_source so an explicit row and
  // an implicit row for the same (message, user) do not collide. Matches the
  // 3-column UNIQUE constraint added in migration 0096.
  const existing = await db
    .select({ id: answerFeedback.id })
    .from(answerFeedback)
    .where(
      and(
        eq(answerFeedback.messageId, input.messageId),
        eq(answerFeedback.userId, session.user.id),
        eq(answerFeedback.feedbackSource, input.source),
      ),
    )
    .limit(1);

  const existingRow = existing[0];
  const isRevision = Boolean(existingRow);

  // Issue #264 sub-PR 3/3: implicit feedback uses a DISTINCT audit action so
  // regulators can separate implicit-regenerate signals from explicit
  // thumbs-up/down submissions (21 CFR Part 11).
  const auditAction = isImplicit
    ? ('rlhf.implicit_feedback_recorded' as const)
    : ('feedback_submitted' as const);

  // C-3: wrap the mutation + the 21 CFR Part 11 audit row in ONE transaction so
  // a crash between them cannot leave a feedback row with no audit trail. The
  // tx handle is threaded into writeAudit so the insert rides the same tx.
  // #239 Phase 2: withTenantScope sets app.current_org_id GUC for RLS enforce.
  let feedbackId = '';
  try {
    feedbackId = await withTenantScope(orgId, async (tx) => {
      if (existingRow) {
        // L-2: the audit row carries `revised: true` in meta_json so regulators
        // can tell initial submissions apart from changed minds without adding
        // a separate enum value.
        const [updated] = await tx
          .update(answerFeedback)
          .set({
            rating: effectiveRating,
            qualityTags: input.qualityTags,
            comment: input.comment,
            variationDimensions: input.variationDimensions,
          })
          .where(eq(answerFeedback.id, existingRow.id))
          .returning({ id: answerFeedback.id });
        if (!updated) {
          throw new Error('feedback_update_failed');
        }
        await writeAudit(
          {
            actor_id: session.user.id,
            action: auditAction,
            resource_type: 'answer_feedback',
            resource_id: updated.id,
            meta_json: {
              messageId: input.messageId,
              rating: effectiveRating,
              feedbackSource: input.source,
              qualityTagCount: input.qualityTags.length,
              hasComment: input.comment !== null,
              hasVariationDimensions: input.variationDimensions !== null,
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
          rating: effectiveRating,
          qualityTags: input.qualityTags,
          comment: input.comment,
          feedbackSource: input.source,
          variationDimensions: input.variationDimensions,
        })
        .returning({ id: answerFeedback.id });
      if (!inserted) {
        throw new Error('feedback_insert_failed');
      }
      await writeAudit(
        {
          actor_id: session.user.id,
          action: auditAction,
          resource_type: 'answer_feedback',
          resource_id: inserted.id,
          meta_json: {
            messageId: input.messageId,
            rating: effectiveRating,
            feedbackSource: input.source,
            qualityTagCount: input.qualityTags.length,
            hasComment: input.comment !== null,
            hasVariationDimensions: input.variationDimensions !== null,
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
    rating: effectiveRating,
    qualityTags: input.qualityTags,
    comment: input.comment,
  });

  // H-3: server-side redaction from the REAL message prose. The client's
  // redactedQuestion is ignored — never passed to the external system.
  const serverRedacted = await buildServerRedactedQuestion(input.messageId);

  // REQ-RLHF-007 / REQ-RLHF-008: trigger the gap/promo bridges. These are
  // best-effort and MUST NOT fail the request. The promo bridge is a pure
  // descriptor (REQ-RLHF-015 HARD — no auto-confirm).
  // Charter [지양-2]: implicit feedback NEVER auto-triggers calibration or
  // promotion — it is a signal, not an action. The bridge input marks
  // `isImplicit` so downstream consumers (gap/promo) can choose to suppress
  // auto-actions for implicit rows. The promo bridge is descriptor-only for
  // explicit too, so the practical effect today is gap-bridge suppression for
  // implicit downvotes (regeneration is not a quality complaint).
  const bridgeInput = {
    messageId: input.messageId,
    conversationId: '', // not needed for the bridge decision logic
    userId: session.user.id,
    rating: effectiveRating,
    qualityTags: input.qualityTags,
    comment: input.comment,
    redactedQuestion: serverRedacted.redacted,
    isImplicit,
  };

  try {
    if (effectiveRating === 'down' && !isImplicit) {
      await createGapIssueForLowRatedAnswer(bridgeInput);
    } else if (effectiveRating === 'up' && !isImplicit) {
      // Descriptor only — no DB write, no side effect.
      proposePromotionCandidateForHighRatedAnswer(bridgeInput);
    }
    // Implicit feedback: no bridge action. The signal is captured in
    // answer_feedback + audit; downstream aggregation/calibration reads it
    // by virtue of rating='down'. Auto-triggering gap/promo from implicit
    // rows would violate Charter [지양-2] (no fake trust).
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
