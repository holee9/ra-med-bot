// @MX:NOTE [AUTO] POST /api/ask — create new inbox ticket from employee question.
// @MX:SPEC SPEC-V3-INBOX-001 (REQ-V3-INBOX-001, Issue #320)
// @MX:REASON RA employees ask regulatory questions via /api/ask. Entry point for
//            inbox_tickets. Requires inbox.view (ra-member+) because question
//            submission is a read-only consult activity, not a management decision.

import { writeAudit } from '@/lib/audit';
import { withPermission } from '@/lib/auth/with-permission';
import { db } from '@/lib/db/client';
import { inboxTickets } from '@/lib/db/schema';
import { z } from 'zod';

// Zod schema for question input
const createTicketInputSchema = z.object({
  question: z.string().min(1).max(5000, 'Question must be between 1 and 5000 characters'),
});

// POST /api/ask — create new inbox ticket
export const POST = withPermission('inbox.view', async (req, _ctx, session) => {
  const organizationId = session.user.organizationId;
  if (!organizationId) {
    return Response.json({ error: 'Organization context required' }, { status: 403 });
  }

  const parsed = createTicketInputSchema.safeParse(await req.json());
  if (!parsed.success) {
    return Response.json(
      { error: 'Invalid input', issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { question } = parsed.data;

  // Generate ticket ID
  const ticketId = `it_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

  // Insert ticket with auto_answer=null (C-5 consult will RAG-generate)
  // REQ-V3-INBOX-001: triageState starts at 'auto' (initial state)
  await db.transaction(async (tx) => {
    await tx.insert(inboxTickets).values({
      id: ticketId,
      orgId: organizationId,
      fromUser: session.user.id,
      question,
      triageState: 'auto',
      autoAnswer: null, // RAG generation in C-5 consult
      autoConfidence: null,
    });

    // Audit row in same transaction (21 CFR Part 11 atomicity)
    await writeAudit(
      {
        actor_id: session.user.id,
        action: 'inbox.created',
        resource_type: 'inbox_ticket',
        resource_id: ticketId,
        meta_json: {
          question_length: question.length,
          source: 'api_ask',
        },
      },
      // biome-ignore lint/suspicious/noExplicitAny: Drizzle tx type satisfies AuditDbHandle interface
      tx as any,
    );
  });

  return Response.json({ ticketId }, { status: 201 });
});
