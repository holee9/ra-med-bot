// @MX:NOTE [AUTO] Audit wrapper for triage state transitions.
// @MX:SPEC SPEC-V3-INBOX-001 (REQ-V3-INBOX-021, Issue 320)

import type { AuditDbHandle } from '@/lib/audit';
import { writeAudit } from '@/lib/audit';
import type { TriageTransitionInput } from './types';

/**
 * Write an audit row for a triage state transition.
 *
 * All inbox triage transitions MUST be audited for 21 CFR Part 11 compliance.
 * The action value 'inbox.triaged' covers all valid transitions (needs-review,
 * escalated, waiting, closed, rejected).
 *
 * This wrapper ensures audit consistency across all triage operations.
 */
export async function auditTransition(
  tx: AuditDbHandle,
  input: TriageTransitionInput,
): Promise<void> {
  await writeAudit(
    {
      actor_id: input.actorId,
      action: 'inbox.triaged',
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
