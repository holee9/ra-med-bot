// SPEC-V3-IMPACT-001 M5: Layer 3 ticket creation via inbox domain.
// @MX:ANCHOR [AUTO] Ticket creation for low-confidence impacts.
// @MX:REASON Called by API route when confidence < 80%. fan_in >= 2.
// @MX:SPEC SPEC-V3-IMPACT-001 (AC-IMP-07)

import { randomUUID } from 'node:crypto';
import type { Database } from '@/lib/kernel/db/client';
import { inboxTickets } from '@/lib/kernel/db/schema';

export interface TicketInput {
  orgId: string;
  title: string;
  description: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  assigneeId: string;
  productId?: string;
  signal?: 'green' | 'yellow' | 'red';
  classification?: {
    category: string;
    confidence: number;
    reason: string;
  };
}

/**
 * Creates a ticket via direct DB insert for impact assessment follow-up.
 * Must be called within a transaction for atomicity with audit (21 CFR Part 11).
 * Returns the ticket ID on success.
 */
export async function createImpactTicket(db: Database, input: TicketInput): Promise<string> {
  const ticketId = `it_${randomUUID()}`;

  await db
    .insert(inboxTickets)
    .values({
      id: ticketId,
      orgId: input.orgId,
      fromUser: input.assigneeId, // Creator is the assignee in self-check flow
      question: input.title,
      productId: input.productId || null,
      triageState: 'needs-review', // Initial state for manual review
      raAssignee: input.assigneeId,
    })
    .returning({ id: inboxTickets.id });

  return ticketId;
}
