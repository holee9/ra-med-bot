// @MX:NOTE [AUTO] GET /api/inbox/[id] — get single inbox ticket by ID.
// @MX:SPEC SPEC-V3-INBOX-001 (REQ-V3-INBOX-008, Issue #320)
// @MX:REASON REQ-V3-INBOX-008: IDOR defense via assertTicketInOrg (404 on cross-org).
//            Requires inbox.view (ra-member+) for team transparency.

import { withPermission } from '@/lib/auth/with-permission';
import { db } from '@/lib/db/client';
import { assertTicketInOrg, getTicket } from '@/lib/domains/inbox';

// GET /api/inbox/[id] — get single ticket
export const GET = withPermission('inbox.view', async (_req, ctx, session) => {
  const organizationId = session.user.organizationId;
  if (!organizationId) {
    return Response.json({ error: 'Organization context required' }, { status: 403 });
  }

  // Next.js 15 Promise params
  const params =
    typeof ctx.params === 'object' && ctx.params !== null
      ? await ctx.params
      : ({} as Record<string, string>);
  const ticketId = params.id;

  if (!ticketId) {
    return Response.json({ error: 'missing_ticket_id' }, { status: 400 });
  }

  // IDOR defense: verify ticket belongs to this org (404 on cross-org)
  try {
    await assertTicketInOrg(db, ticketId, organizationId);
  } catch {
    return Response.json({ error: 'Ticket not found' }, { status: 404 });
  }

  // Fetch ticket
  const tickets = await getTicket(db, organizationId, ticketId);

  if (!tickets || tickets.length === 0) {
    return Response.json({ error: 'Ticket not found' }, { status: 404 });
  }

  return Response.json({ ticket: tickets[0] });
});
