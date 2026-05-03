// @MX:ANCHOR [AUTO] Expert review queue — idempotent enqueue for reviewer assignment.
// @MX:REASON Called from consult.ts Phase C and future API endpoints. fan_in >= 3 expected.
// @MX:SPEC SPEC-REGULA-ENTERPRISE-001 (REQ-ENTERPRISE-009)

import { db } from '@/lib/db/client';
import { expertReviews } from '@/lib/db/schema';

/**
 * Parameters required to enqueue a message for expert review.
 */
export interface EnqueueParams {
  conversationId: string;
  messageId: string;
  reason: string;
  requestedBy: string;
}

/**
 * Inserts an expert review request into the queue.
 * Idempotent: ON CONFLICT DO NOTHING prevents duplicate rows
 * for the same (conversation_id, message_id) pair.
 *
 * REQ-ENTERPRISE-009: auto-enqueue with status = 'pending'.
 */
export async function enqueueExpertReview(params: EnqueueParams): Promise<void> {
  await db
    .insert(expertReviews)
    .values({
      conversationId: params.conversationId,
      messageId: params.messageId,
      notes: params.reason,
      requestedBy: params.requestedBy,
      status: 'pending',
    })
    .onConflictDoNothing();
}
