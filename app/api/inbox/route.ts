// @MX:NOTE [AUTO] GET /api/inbox — Kanban board list (grouped by triage state).
// @MX:SPEC SPEC-V3-INBOX-001 (REQ-V3-INBOX-007, Issue 320)
// @MX:REASON REQ-V3-INBOX-007: Kanban board query with state filter + pagination.
//            Requires inbox.view (ra-member+) for team transparency.

import { withPermission } from '@/lib/auth/with-permission';
import { db } from '@/lib/db/client';
import { listByTriageState } from '@/lib/domains/inbox';
import { TRIAGE_STATES, type TriageState } from '@/lib/domains/inbox/types';
import { z } from 'zod';

// Zod schema for query parameters. TRIAGE_STATES = single source (#321 L-1).
// offset capped at 10000 (#321 L-4) to bound pagination cost.
const listTicketsInputSchema = z.object({
  state: z.enum(TRIAGE_STATES).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional().default(50),
  offset: z.coerce.number().int().min(0).max(10000).optional().default(0),
});

// GET /api/inbox — list inbox tickets (Kanban view)
export const GET = withPermission('inbox.view', async (_req, _ctx, session) => {
  const organizationId = session.user.organizationId;
  if (!organizationId) {
    return Response.json({ error: 'Organization context required' }, { status: 403 });
  }

  // Parse query parameters from URL
  const url = new URL(_req.url);
  const queryParams = Object.fromEntries(url.searchParams);

  const parsed = listTicketsInputSchema.safeParse(queryParams);
  if (!parsed.success) {
    return Response.json(
      { error: 'Invalid query parameters', issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { state, limit, offset } = parsed.data;

  // Query tickets by state
  const tickets = await listByTriageState(db, organizationId, {
    state: state as TriageState | undefined,
    limit,
    offset,
  });

  return Response.json({
    tickets,
    pagination: {
      limit,
      offset,
      count: tickets.length,
    },
  });
});
