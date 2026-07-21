// @MX:ANCHOR [AUTO] IDOR defense for inbox_tickets.
// @MX:REASON inbox_tickets.org_id is the direct tenant key. Cross-org access
//            MUST return 404 (information leak prevention) or 403 + denial audit.
//            Fan_in will reach 3+ (API routes + promote + queries).
// @MX:SPEC SPEC-V3-INBOX-001 (REQ-V3-INBOX-008, Issue 320)

import type { Database } from '@/lib/kernel/db/client';
import { inboxTickets } from '@/lib/kernel/db/schema';
import { and, eq } from 'drizzle-orm';

/**
 * Assert that a ticket belongs to the specified organization.
 *
 * IDOR defense pattern from capa-idor-runtime.test.ts:
 * - Direct org_id comparison (inbox_tickets has org_id column, 1-hop)
 * - Returns 404 for cross-org access (information leak prevention)
 * - Alternative: 403 + denial audit (explicit denial)
 *
 * #321 M-1 — team-transparency policy: inbox_tickets are org-scoped (NOT
 * per-author). ra-member+ see ALL tickets in their org (Kanban triage).
 * viewer/employee own-ticket access (REQ-V3-UI-034) is gated separately by
 * the ViewerTicketSummary path, which filters on from_user = session.user.id
 * at the query layer. This function intentionally does NOT check from_user.
 *
 * @throws Error with message "Ticket not found" if cross-org access detected
 * @returns void if access is valid
 */
export async function assertTicketInOrg(
  db: Database,
  ticketId: string,
  orgId: string,
): Promise<void> {
  const ticket = await db
    .select({ orgId: inboxTickets.orgId })
    .from(inboxTickets)
    .where(eq(inboxTickets.id, ticketId))
    .limit(1);

  if (!ticket[0]) {
    // Ticket not found (could be cross-org or genuinely missing)
    throw new Error('Ticket not found');
  }

  if (ticket[0].orgId !== orgId) {
    // Cross-org access attempt — return 404 to prevent information leak
    throw new Error('Ticket not found');
  }
}

/**
 * Check if a ticket belongs to an organization (non-throwing variant).
 *
 * Returns true if the ticket exists and belongs to the org, false otherwise.
 */
export async function isTicketInOrg(
  db: Database,
  ticketId: string,
  orgId: string,
): Promise<boolean> {
  try {
    await assertTicketInOrg(db, ticketId, orgId);
    return true;
  } catch {
    return false;
  }
}
