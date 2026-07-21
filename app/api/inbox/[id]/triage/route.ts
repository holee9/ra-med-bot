// @MX:NOTE [AUTO] PATCH /api/inbox/[id]/triage — transition triage state.
// @MX:SPEC SPEC-V3-INBOX-001 (REQ-V3-INBOX-015/021, Issue 320)
// @MX:REASON REQ-V3-INBOX-015: state transition validation (assertValidTransition).
//            REQ-V3-INBOX-021: audit trail for every transition.
//            Requires inbox.manage (ra-lead ONLY) — regulatory decision.

import { assertTicketInOrg, assertValidTransition, auditTransition } from '@/lib/domains/inbox';
import { TRIAGE_STATES, type TriageState } from '@/lib/domains/inbox/types';
import { writeAudit } from '@/lib/kernel/audit';
import { withPermission } from '@/lib/kernel/auth/with-permission';
import { db } from '@/lib/kernel/db/client';
import { inboxTickets } from '@/lib/kernel/db/schema';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';

// Zod schema for triage transition input. TRIAGE_STATES = single source (#321 L-1).
const triageTransitionInputSchema = z.object({
  toState: z.enum(TRIAGE_STATES),
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
  const transitioned = await db.transaction(async (tx) => {
    // L-2 (#321): in-tx SELECT FOR UPDATE re-verifies org_id (TOCTOU defense,
    // mirrors promote.ts H-1). The outer assertTicketInOrg + this in-tx check
    // close the time-of-check / time-of-use window.
    const locked = await tx
      .select({ orgId: inboxTickets.orgId })
      .from(inboxTickets)
      .where(and(eq(inboxTickets.id, ticketId), eq(inboxTickets.orgId, organizationId)))
      .for('update')
      .limit(1);
    if (!locked[0]) {
      return false;
    }

    // Update ticket state (org_id re-checked in WHERE)
    await tx
      .update(inboxTickets)
      .set({
        triageState: toState,
      })
      .where(and(eq(inboxTickets.id, ticketId), eq(inboxTickets.orgId, organizationId)));

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
    return true;
  });

  if (!transitioned) {
    return Response.json({ error: 'Ticket not found' }, { status: 404 });
  }

  return Response.json({
    ticketId,
    previousState: currentState,
    newState: toState,
  });
});
