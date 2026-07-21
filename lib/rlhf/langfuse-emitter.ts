// @MX:NOTE [AUTO] langfuse-emitter.ts — REQ-RLHF-011 Langfuse feedback event emitter.
// @MX:SPEC SPEC-REGULA-RLHF-001 (REQ-RLHF-011, AC-08)
// @MX:REASON Thin wrapper around lib/observability/langfuse.ts. MUST NOT throw
//           into the feedback flow — Langfuse is observability (21 CFR Part 11
//           audit is handled separately via audit_logs). Graceful no-op when
//           the Langfuse SDK is unconfigured (matches existing traceLlmCall).

import type { qualityTagEnum } from '@/lib/kernel/db/schema';
import { getLangfuseClient } from '@/lib/observability/langfuse';
import { logger } from '@/lib/observability/logger';

/** Feedback event payload sent to Langfuse (REQ-RLHF-011, AC-08 shape). */
export interface FeedbackLangfuseEvent {
  messageId: string;
  userId: string;
  rating: 'up' | 'down';
  qualityTags: (typeof qualityTagEnum.enumValues)[number][];
  comment: string | null;
}

/**
 * REQ-RLHF-011: emit a feedback event to Langfuse. Links the feedback to the
 * LLM trace quality tracking. No-op (graceful) when Langfuse is unavailable.
 *
 * This function NEVER throws — observability failures must not break the
 * regulated feedback write path.
 */
export async function emitFeedbackEvent(event: FeedbackLangfuseEvent): Promise<void> {
  try {
    const lf = getLangfuseClient();
    if (!lf) return; // Langfuse unconfigured — graceful no-op (matches traceLlmCall)

    const trace = lf.trace({ name: 'feedback', id: event.messageId });
    trace.event({
      name: 'user_feedback',
      metadata: {
        messageId: event.messageId,
        userId: event.userId,
        rating: event.rating,
        qualityTags: event.qualityTags,
        hasComment: event.comment !== null,
      },
    });
    await lf.flushAsync();
  } catch (err) {
    // Observability-only: never propagate. Log so the ops dashboard can see drops.
    logger.warn('[rlhf] Langfuse feedback emit failed (graceful no-op)', {
      messageId: event.messageId,
      err: err instanceof Error ? err.message : String(err),
    });
  }
}
