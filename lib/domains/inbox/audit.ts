// @MX:NOTE [AUTO] Audit wrapper for triage state transitions.
// @MX:SPEC SPEC-V3-INBOX-001 (REQ-V3-INBOX-021, Issue 320, #321 H-3)

import type { AuditDbHandle } from '@/lib/kernel/audit';
import { writeAudit } from '@/lib/kernel/audit';
import type { TriageState, TriageTransitionInput } from './types';

/**
 * Map a triage `to` state to a granular audit_action (#321 H-3).
 *
 * Migration 0104 defines inbox.triaged / escalated / closed / rejected / approved.
 * Terminal and escalation transitions get a dedicated action for 21 CFR Part 11
 * audit precision (the action column alone identifies what happened, without
 * requiring meta_json inspection). The remaining states (needs-review, waiting,
 * auto) reuse the generic inbox.triaged action — no dedicated enum exists.
 */
function triageAuditAction(
  to: TriageState,
): 'inbox.triaged' | 'inbox.escalated' | 'inbox.closed' | 'inbox.rejected' {
  switch (to) {
    case 'escalated':
      return 'inbox.escalated';
    case 'closed':
      return 'inbox.closed';
    case 'rejected':
      return 'inbox.rejected';
    default:
      return 'inbox.triaged';
  }
}

/**
 * Write an audit row for a triage state transition.
 *
 * All inbox triage transitions MUST be audited for 21 CFR Part 11 compliance.
 * The action reflects the destination state (inbox.triaged for generic moves,
 * inbox.escalated / closed / rejected for escalation and terminal transitions).
 */
export async function auditTransition(
  tx: AuditDbHandle,
  input: TriageTransitionInput,
): Promise<void> {
  await writeAudit(
    {
      actor_id: input.actorId,
      action: triageAuditAction(input.to),
      resource_type: 'inbox_ticket',
      resource_id: input.ticketId,
      meta_json: {
        from: input.from,
        to: input.to,
      },
    },
    tx,
  );
}
