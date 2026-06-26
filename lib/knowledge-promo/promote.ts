// @MX:NOTE [AUTO] Promote / unpromote logic for team knowledge library.
// @MX:SPEC SPEC-REGULA-KNOWLEDGE-PROMO-001 (REQ-006, REQ-007, REQ-013, REQ-014, AC-02, AC-07)
// @MX:REASON Charter [지양-4] no auto-finalize — promotion requires explicit
//           ra-lead/admin RBAC (knowledgepromo.promote, enforced at the route
//           layer via withPermission). 21 CFR Part 11 atomicity: every promote
//           / unpromote wraps mutation + writeAudit in ONE db.transaction so a
//           crash between them cannot leave a promoted row without an audit
//           trail (C-3 defect class). RLS GUC set via withTenantScope (#239).

import { writeAudit } from '@/lib/audit';
import { db, withTenantScope } from '@/lib/db/client';
import { messages, promotedAnswers } from '@/lib/db/schema';
import { logger } from '@/lib/observability/logger';
import { and, eq } from 'drizzle-orm';
import { findExistingPromotion, messageBelongsToOrg } from './access';
import { embedForPromotion } from './embedding';

export interface PromoteParams {
  messageId: string;
  title: string;
  tags: string[];
  userId: string;
  orgId: string;
}

export interface PromoteResult {
  promotedId: string;
  status: 'created' | 'reactivated';
}

/**
 * REQ-006 / REQ-013 / AC-02 / AC-07: promote a message answer into the team
 * knowledge library. Atomic: insert/update + writeAudit in ONE transaction.
 *
 * Preconditions (enforced by the route layer):
 *   - Caller has knowledgepromo.promote RBAC (withPermission).
 *   - `messageId` belongs to `orgId` (assertMessageInOrg IDOR guard).
 *
 * Idempotency: UNIQUE(source_message_id) — if a promoted row already exists
 * for this message, re-activate it (status='active') and refresh title/tags/
 * embedding. The audit row records every promote click (REQ-013).
 *
 * Returns the promoted row id and whether it was a fresh create or a
 * re-activation. Throws on transaction failure (caller surfaces 500).
 */
export async function promoteAnswer(params: PromoteParams): Promise<PromoteResult> {
  const { messageId, title, tags, userId, orgId } = params;

  // Defense-in-depth: the route already ran assertMessageInOrg, but the lib
  // function is also called from tests / future batch paths — re-check.
  const inOrg = await messageBelongsToOrg(messageId, orgId);
  if (!inOrg) {
    throw new Error('message_not_in_org');
  }

  // Compute embedding from the source message prose at promotion time
  // (design decision #1). Best-effort: null when OpenAI is unavailable.
  const [msg] = await db
    .select({ prose: messages.contentProse })
    .from(messages)
    .where(eq(messages.id, messageId))
    .limit(1);
  const prose = msg?.prose ?? '';
  const embedding = await embedForPromotion(prose);
  // embedding is number[] | null — Drizzle binds the array via the vector
  // customType. null means OpenAI was unavailable; the row is still created.

  const existing = await findExistingPromotion(messageId, orgId);
  const isReactivation = existing !== null;

  let promotedId = '';

  try {
    promotedId = await withTenantScope(orgId, async (tx) => {
      if (existing) {
        const [updated] = await tx
          .update(promotedAnswers)
          .set({
            title,
            tags,
            status: 'active',
            // Only overwrite embedding when we computed a fresh one; preserve
            // an existing embedding if OpenAI was unavailable this time.
            ...(embedding ? { embedding } : {}),
          })
          // M-1 fix: in-tx org_id guard closes the TOCTOU window between the
          // route's IDOR check and the UPDATE (RLS is inert #239). existing was
          // resolved via findExistingPromotion(messageId, orgId), but a
          // concurrent org transfer could move the row — pin the UPDATE to orgId.
          .where(and(eq(promotedAnswers.id, existing.id), eq(promotedAnswers.orgId, orgId)))
          .returning({ id: promotedAnswers.id });
        if (!updated) throw new Error('promote_update_failed');
        await writeAudit(
          {
            actor_id: userId,
            action: 'answer_promoted',
            resource_type: 'promotedAnswer',
            resource_id: updated.id,
            meta_json: {
              sourceMessageId: messageId,
              title,
              tagCount: tags.length,
              reactivated: true,
              hasEmbedding: embedding !== null,
            },
          },
          tx,
        );
        return updated.id;
      }

      const [inserted] = await tx
        .insert(promotedAnswers)
        .values({
          orgId,
          sourceMessageId: messageId,
          title,
          tags,
          promotedBy: userId,
          status: 'active',
          embedding: embedding ?? null,
        })
        .returning({ id: promotedAnswers.id });
      if (!inserted) throw new Error('promote_insert_failed');
      await writeAudit(
        {
          actor_id: userId,
          action: 'answer_promoted',
          resource_type: 'promotedAnswer',
          resource_id: inserted.id,
          meta_json: {
            sourceMessageId: messageId,
            title,
            tagCount: tags.length,
            hasEmbedding: embedding !== null,
          },
        },
        tx,
      );
      return inserted.id;
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error('[knowledge-promo] promote transaction rolled back (atomicity preserved)', {
      messageId,
      err: msg,
    });
    throw err;
  }

  return {
    promotedId,
    status: isReactivation ? 'reactivated' : 'created',
  };
}

export interface UnpromoteParams {
  promotedId: string;
  userId: string;
  orgId: string;
}

/**
 * REQ-014 / AC-07 / AC-08: unpromote a promoted answer. Sets status to
 * 'unpromoted' (soft delete — RAG retriever excludes non-active rows). Atomic
 * with the audit row (C-3 defect class).
 */
export async function unpromoteAnswer(params: UnpromoteParams): Promise<void> {
  const { promotedId, userId, orgId } = params;

  try {
    await withTenantScope(orgId, async (tx) => {
      const [updated] = await tx
        .update(promotedAnswers)
        .set({ status: 'unpromoted' })
        // M-1 fix: in-tx org_id guard. The route ran assertPromotedAnswerInOrg,
        // but RLS is inert (#239) — without orgId in the UPDATE WHERE clause a
        // concurrent org transfer creates a TOCTOU window. Pin to orgId.
        .where(and(eq(promotedAnswers.id, promotedId), eq(promotedAnswers.orgId, orgId)))
        .returning({ id: promotedAnswers.id, sourceMessageId: promotedAnswers.sourceMessageId });
      if (!updated) throw new Error('promoted_not_found');

      await writeAudit(
        {
          actor_id: userId,
          action: 'answer_unpromoted',
          resource_type: 'promotedAnswer',
          resource_id: updated.id,
          meta_json: {
            sourceMessageId: (updated as { sourceMessageId: string }).sourceMessageId,
          },
        },
        tx,
      );
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error('[knowledge-promo] unpromote transaction rolled back (atomicity preserved)', {
      promotedId,
      err: msg,
    });
    throw err;
  }
}
