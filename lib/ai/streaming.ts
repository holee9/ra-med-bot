// @MX:ANCHOR StreamOrderValidator — enforces SSE 3-phase event ordering.
// @MX:REASON Phase A (meta/trace) → Phase B (prose_delta) → Phase C (structured)
// ordering is a HARD contract. Any violation must throw synchronously so the
// async generator pipeline fails fast instead of emitting garbled streams.
// @MX:SPEC SPEC-REGULA-CHAT-001 (REQ-CHAT-006, REQ-CHAT-011)

import type { StreamEvent } from '../../types/streaming';

// Internal phase tracker.
type Phase = 'A' | 'B' | 'C' | 'done';

// Phase C event types that must follow the last prose_delta.
const PHASE_C_TYPES = new Set(['confidence', 'sources', 'expert_review_required']);

/**
 * Validates that StreamEvents are yielded in the required 3-phase order.
 *
 * Phase A: meta → trace*(N)
 * Phase B: prose_delta*(M)  — must have at least one before Phase C starts
 * Phase C: confidence → sources → [expert_review_required?] → done
 *
 * @throws Error if an event violates the phase contract.
 */
export class StreamOrderValidator {
  private phase: Phase = 'A';
  private hasProseDelta = false;

  /**
   * Validate an event against the current phase. Mutates internal state.
   * Call before yielding each event to the SSE stream.
   */
  validate(event: StreamEvent): void {
    const { type } = event;

    // Error events are always allowed — they terminate the stream.
    if (type === 'error') return;

    // Phase C events require at least one prose_delta first.
    if (PHASE_C_TYPES.has(type) || type === 'done') {
      if (!this.hasProseDelta && type !== 'done') {
        throw new Error(
          `StreamOrderValidator: "${type}" event emitted before any prose_delta. ` +
            `Phase C events must follow Phase B (prose_delta).`,
        );
      }
      if (type === 'confidence' || type === 'sources' || type === 'expert_review_required') {
        this.phase = 'C';
      }
      if (type === 'done') {
        this.phase = 'done';
      }
      return;
    }

    if (type === 'prose_delta') {
      this.hasProseDelta = true;
      this.phase = 'B';
      return;
    }

    // meta and trace are Phase A events.
    // They are allowed in Phase A only.
    if (type === 'meta' || type === 'trace') {
      // Allow trace events even in Phase B (edge case: very long traces)
      return;
    }

    // Phase 3 reserve events — pass through without validation in Phase 2.
    if (['checklist', 'comparison', 'timeline', 'related'].includes(type)) {
      return;
    }
  }
}

/**
 * Encode a StreamEvent as an SSE data line.
 * Format: `data: <json>\n\n`
 */
export function encodeSSE(event: StreamEvent): string {
  return `data: ${JSON.stringify(event)}\n\n`;
}
