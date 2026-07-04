// @MX:NOTE [AUTO] POST /api/ask — create new inbox ticket from employee question.
// @MX:SPEC SPEC-V3-INBOX-001 (REQ-V3-INBOX-001, Issue 320, #321 H-4/L-3)
// @MX:REASON RA employees ask regulatory questions via /api/ask. Entry point for
//            inbox_tickets. Requires ask.create (viewer+) because question
//            submission is a CREATE activity, not read-only consult (H-4 fix).

import { randomUUID } from 'node:crypto';
import { writeAudit } from '@/lib/audit';
import { withPermission } from '@/lib/auth/with-permission';
import { db } from '@/lib/db/client';
import { inboxTickets } from '@/lib/db/schema';
import { z } from 'zod';

// Zod schema for question input
const createTicketInputSchema = z.object({
  question: z.string().min(1).max(5000, 'Question must be between 1 and 5000 characters'),
});

// H-4 (#321): simple in-memory rate limit (30/min/user) to cap LLM cost and abuse.
// Mirrors app/api/ra/consult/route.ts pattern. Single-instance only (dev/staging);
// multi-instance production requires a Redis-backed limiter.
const askRateLimitMap = new Map<string, { count: number; resetAt: number }>();
const ASK_RATE_LIMIT_MAX = 30;
const ASK_RATE_LIMIT_WINDOW_MS = 60_000;

function checkAskRateLimit(userId: string): boolean {
  const now = Date.now();
  const entry = askRateLimitMap.get(userId);
  if (!entry || now >= entry.resetAt) {
    askRateLimitMap.set(userId, { count: 1, resetAt: now + ASK_RATE_LIMIT_WINDOW_MS });
    return true;
  }
  if (entry.count >= ASK_RATE_LIMIT_MAX) return false;
  entry.count++;
  return true;
}

// POST /api/ask — create new inbox ticket
export const POST = withPermission('ask.create', async (req, _ctx, session) => {
  const organizationId = session.user.organizationId;
  if (!organizationId) {
    return Response.json({ error: 'Organization context required' }, { status: 403 });
  }

  // H-4 (#321): per-user rate limit before any DB / LLM work.
  if (!checkAskRateLimit(session.user.id)) {
    return Response.json({ error: 'rate_limit_exceeded' }, { status: 429 });
  }

  const parsed = createTicketInputSchema.safeParse(await req.json());
  if (!parsed.success) {
    return Response.json(
      { error: 'Invalid input', issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { question } = parsed.data;

  // L-3 (#321): collision-resistant ticket id via crypto.randomUUID (was Date.now+Math.random).
  const ticketId = `it_${randomUUID()}`;

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
