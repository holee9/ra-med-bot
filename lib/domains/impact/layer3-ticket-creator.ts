// SPEC-V3-IMPACT-001 M5: Layer 3 ticket creation via inbox domain.
// @MX:ANCHOR [AUTO] Ticket creation for low-confidence impacts.
// @MX:REASON Called by API route when confidence < 80%. fan_in >= 2.
// @MX:SPEC SPEC-V3-IMPACT-001 (AC-IMP-07)

import { createTicket as createInboxTicket } from '@/lib/domains/inbox';

export interface TicketInput {
  title: string;
  description: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  assigneeId: string;
  impactAssessmentId?: string;
  regulatoryUpdateId?: string;
}

/**
 * Creates a ticket via the inbox domain for impact assessment follow-up.
 * Returns the ticket ID on success.
 */
export async function createImpactTicket(input: TicketInput): Promise<string> {
  const metadata: Record<string, string> = {};
  if (input.impactAssessmentId) {
    metadata.impactAssessmentId = input.impactAssessmentId;
  }
  if (input.regulatoryUpdateId) {
    metadata.regulatoryUpdateId = input.regulatoryUpdateId;
  }

  const ticketId = await createInboxTicket({
    title: input.title,
    description: input.description,
    priority: input.priority,
    assigneeId: input.assigneeId,
    source: 'impact-wizard',
    ...(Object.keys(metadata).length > 0 && { metadata }),
  });

  return ticketId;
}
