// @MX:NOTE [AUTO] Shared types for RA Inbox domain.
// @MX:SPEC SPEC-V3-INBOX-001 (Issue 320)

/**
 * Triage state machine states.
 *
 * State flow:
 *   auto → needs-review → escalated / waiting / closed / rejected
 *   escalated → waiting / closed / rejected
 *   waiting → needs-review / closed
 *   closed (terminal)
 *   rejected (terminal)
 *
 * Charter [지양-2] citation enforcement: auto_answer without citations
 * MUST force state to 'needs-review' (state-machine invariant).
 *
 * TRIAGE_STATES is the single source of truth consumed by zod schemas
 * (route input validation) and DB query helpers (#321 L-1).
 */
export const TRIAGE_STATES = [
  'auto',
  'needs-review',
  'escalated',
  'waiting',
  'closed',
  'rejected',
] as const;
export type TriageState = (typeof TRIAGE_STATES)[number];

/**
 * Approved answer lifecycle states.
 *
 * Published answers are visible to the entire org (KB material).
 * Draft answers are work-in-progress (ra-lead only).
 */
export type ApprovedAnswerState = 'draft' | 'published' | 'deprecated';

/**
 * Valid state transitions for triage_state.
 *
 * Charter [지양-2] enforcement: auto→needs-review is FORCED when
 * auto_answer lacks citations (citation contract validation).
 */
export const VALID_TRANSITIONS: Record<TriageState, TriageState[]> = {
  auto: ['needs-review'],
  'needs-review': ['escalated', 'waiting', 'closed', 'rejected'],
  escalated: ['waiting', 'closed', 'rejected'],
  waiting: ['needs-review', 'closed'],
  closed: [], // Terminal state
  rejected: [], // Terminal state
};

/**
 * Citation structure extracted from auto_answer JSON.
 *
 * Matches the schema definition: { source: string; quote?: string }[]
 */
export interface Citation {
  source: string;
  quote?: string;
}

/**
 * Promotion input for inbox.ticket → approved_answers.
 *
 * REQ-V3-INBOX-028: ESIG signature required for promotion.
 * Charter [지양-4]: NO auto-promotion — ra-lead/admin ESIG mandatory.
 */
export interface PromotionInput {
  ticketId: string;
  approverId: string;
  esigSignature: string;
}

/**
 * Triage transition audit input.
 */
export interface TriageTransitionInput {
  ticketId: string;
  from: TriageState;
  to: TriageState;
  actorId: string;
}
