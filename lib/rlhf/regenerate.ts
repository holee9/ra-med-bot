'use client';

// @MX:NOTE #264 sub-PR 3/3 — alternate answers implicit-feedback helper.
// @MX:SPEC SPEC-REGULA-RLHF-001 (REQ-RLHF-003, alternate-answer implicit signal)
//
// Charter [지양-2] no fake trust: the implicit downvote is telemetry only —
// it never changes what the user sees (no confidence badge manipulation, no
// "marked bad" UI). The new answer is just a fresh RAG run.
//
// Fire-and-forget: if the feedback POST fails (network/403/404), the re-ask
// MUST still proceed. The downvote is best-effort telemetry; the user expects
// a new answer immediately. variationDimensions omitted — region/corpus/model
// context is not trivially available at the ChatShell layer; the server falls
// back to defaults. (Do NOT build pickers — scope guard.)

/** Body shape for the implicit_regenerate feedback signal. */
export interface ImplicitRegenerateFeedback {
  messageId: string;
  rating: 'down';
  source: 'implicit_regenerate';
}

/**
 * Fire the implicit_regenerate downvote to /api/rlhf/feedback.
 * Returns the fetch promise (always resolves — swallows network errors so
 * callers can ignore it). Dev-only console warning on failure.
 */
export function fireImplicitRegenerateFeedback(messageId: string): Promise<void> {
  const body: ImplicitRegenerateFeedback = {
    messageId,
    rating: 'down',
    source: 'implicit_regenerate',
  };
  return fetch('/api/rlhf/feedback', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
    .then(() => undefined)
    .catch((err: unknown) => {
      if (process.env.NODE_ENV !== 'production') {
        const warn = console.warn;
        warn('[regenerate] implicit feedback failed (non-blocking)', err);
      }
    });
}
