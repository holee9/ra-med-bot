// @MX:ANCHOR StreamOrderValidator - enforces SSE 3-phase event ordering.
// @MX:REASON Phase A (meta/trace), Phase B (prose_delta), and Phase C
// (confidence/sources/structured blocks/terminal) ordering is a HARD contract.
// @MX:SPEC SPEC-REGULA-CHAT-001 (REQ-CHAT-006, REQ-CHAT-011)
// @MX:SPEC SPEC-REGULA-STRUCTURED-001 (REQ-STRUCT-002, REQ-STRUCT-007)

import type { StreamEvent } from '../../types/streaming';

type Phase = 'A' | 'B' | 'C' | 'done';

const PHASE_C_ORDER = [
  'confidence',
  'sources',
  'checklist',
  'comparison',
  'timeline',
  'related',
  'expert_review_required',
  'done',
] as const;

const PHASE_C_INDEX = new Map<string, number>(
  PHASE_C_ORDER.map((eventType, index) => [eventType, index]),
);

/**
 * Validates that StreamEvents are yielded in the required order.
 *
 * Phase A: meta, trace*
 * Phase B: prose_delta*
 * Phase C: confidence, sources, checklist?, comparison?, timeline?, related?,
 * optional expert_review_required, done.
 *
 * Phase C events may be skipped, but emitted events cannot move backward.
 */
export class StreamOrderValidator {
  private phase: Phase = 'A';
  private hasProseDelta = false;
  private phaseCIndex = -1;

  validate(event: StreamEvent): void {
    const { type } = event;

    if (type === 'error') {
      this.phase = 'done';
      return;
    }

    if (this.phase === 'done') {
      throw new Error(`StreamOrderValidator: "${type}" event emitted after terminal event.`);
    }

    const nextPhaseCIndex = PHASE_C_INDEX.get(type);
    if (nextPhaseCIndex !== undefined) {
      if (!this.hasProseDelta && type !== 'done') {
        throw new Error(
          `StreamOrderValidator: "${type}" event emitted before any prose_delta. Phase C events must follow Phase B (prose_delta).`,
        );
      }

      if (nextPhaseCIndex <= this.phaseCIndex) {
        throw new Error(`StreamOrderValidator: "${type}" event emitted out of Phase C order.`);
      }

      this.phaseCIndex = nextPhaseCIndex;
      this.phase = type === 'done' ? 'done' : 'C';
      return;
    }

    if (type === 'prose_delta') {
      if (this.phase === 'C') {
        throw new Error('StreamOrderValidator: "prose_delta" event emitted after Phase C started.');
      }
      this.hasProseDelta = true;
      this.phase = 'B';
      return;
    }

    if (type === 'meta' || type === 'trace') {
      if (this.phase === 'C') {
        throw new Error(`StreamOrderValidator: "${type}" event emitted after Phase C started.`);
      }
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
