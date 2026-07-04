// @MX:ANCHOR [AUTO] Triage state machine — enforces valid transitions.
// @MX:REASON Fan_in will reach 3+ (promote + triage handlers + API routes).
//            State transitions are business-critical invariants.
// @MX:SPEC SPEC-V3-INBOX-001 (REQ-V3-INBOX-004, Issue 320)

import type { TriageState } from './types';
import { VALID_TRANSITIONS } from './types';

/**
 * Check if a state transition is valid.
 *
 * Returns false if:
 * - from === to (no-op transitions are invalid for audit)
 * - to is not in VALID_TRANSITIONS[from]
 *
 * Charter [지양-2] citation enforcement: auto→needs-review is FORCED
 * when auto_answer lacks citations (caller must validate before calling).
 */
export function canTransition(from: TriageState, to: TriageState): boolean {
  if (from === to) {
    // No-op transitions are invalid for audit trail purposes
    return false;
  }
  return VALID_TRANSITIONS[from].includes(to);
}

/**
 * Get all valid next states from a given state.
 *
 * Returns empty array for terminal states (closed, rejected).
 */
export function nextStates(from: TriageState): TriageState[] {
  return VALID_TRANSITIONS[from];
}

/**
 * Validate a transition and throw if invalid.
 *
 * Convenience function for handlers that need assertion-style validation.
 */
export function assertValidTransition(from: TriageState, to: TriageState): void {
  if (!canTransition(from, to)) {
    throw new Error(
      `Invalid triage state transition: ${from} → ${to}. ` +
        `Valid transitions from ${from}: ${nextStates(from).join(', ')}`,
    );
  }
}
