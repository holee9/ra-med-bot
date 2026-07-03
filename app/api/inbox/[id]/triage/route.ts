// @MX:NOTE [AUTO] PATCH /api/inbox/[id]/triage — transition triage state.
// @MX:SPEC SPEC-V3-INBOX-001 (REQ-V3-INBOX-015/021, Issue #320)
// @MX:REASON REQ-V3-INBOX-015: state transition validation (assertValidTransition).
//            REQ-V3-INBOX-021: audit trail for every transition.
//            Requires inbox.manage (ra-lead ONLY) — regulatory decision.

import { writeAudit } from '@/lib/audit';
import { withPermission } from '@/lib/auth/with-permission';
import { db } from '@/lib/db/client';
import { inboxTickets } from '@/lib/db/schema';
import { assertTicketInOrg, assertValidTransition, auditTransition } from '@/lib/domains/inbox';
import type { TriageState } from '@/lib/domains/inbox/types';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

// Zod schema for triage transition input
const triageTransitionInputSchema = z.object({
  toState: z.enum(['auto', 'needs-review', 'escalated', 'waiting', 'closed', 'rejected']),
  reason: z.string().max(500).optional(),
});

// PATCH /api/inbox/[id]/triage — transition triage state
export const PATCH = withPermission('inbox.manage', async (req, ctx, session) => {
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

  const parsed = triageTransitionInputSchema.safeParse(await req.json());
  if (!parsed.success) {
    return Response.json(
      { error: 'Invalid input', issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { toState } = parsed.data;

  // IDOR defense: verify ticket belongs to this org (404 on cross-org)
  try {
    await assertTicketInOrg(db, ticketId, organizationId);
  } catch {
    return Response.json({ error: 'Ticket not found' }, { status: 404 });
  }

  // Fetch current state for validation
  const currentTicket = await db
    .select({ triageState: inboxTickets.triageState })
    .from(inboxTickets)
    .where(eq(inboxTickets.id, ticketId))
    .limit(1);

  if (!currentTicket || currentTicket.length === 0) {
    return Response.json({ error: 'Ticket not found' }, { status: 404 });
  }

  const currentState = currentTicket[0]?.triageState;
  if (!currentState) {
    return Response.json({ error: 'Ticket not found' }, { status: 404 });
  }

  // Validate state transition
  try {
    assertValidTransition(currentState, toState);
  } catch (err) {
    // H-2 fix: Write audit-on-failure for invalid transition attempts
    try {
      await writeAudit({
        actor_id: session.user.id,
        action: 'inbox.approve_failed', // Reuse inbox.approve_failed for audit consistency
        resource_type: 'inbox_ticket',
        resource_id: ticketId,
        meta_json: {
          reason: `Invalid state transition: ${currentState} → ${toState}`,
          from: currentState,
          to: toState,
        },
      });
    } catch (auditError) {
      // Audit write failure should not mask the original error
      console.error('Failed to write audit for invalid transition:', auditError);
    }
    return Response.json(
      {
        error: 'Invalid state transition',
        details: err instanceof Error ? err.message : 'Unknown error',
      },
      { status: 409 },
    );
  }

  // Execute transition
  await db.transaction(async (tx) => {
    // Update ticket state
    await tx
      .update(inboxTickets)
      .set({
        triageState: toState,
      })
      .where(eq(inboxTickets.id, ticketId));

    // Write audit row (inbox.triaged or inbox.escalated/inbox.closed etc.)
    await auditTransition(
      // biome-ignore lint/suspicious/noExplicitAny: Drizzle tx type satisfies AuditDbHandle interface
      tx as any,
      {
        ticketId,
        from: currentState,
        to: toState,
        actorId: session.user.id,
      },
    );
  });

  return Response.json({
    ticketId,
    previousState: currentState,
    newState: toState,
  });
});
