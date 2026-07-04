// @MX:NOTE [AUTO] POST /api/ask — create inbox ticket + TRIAGE RAG auto-answer hook.
// @MX:SPEC SPEC-V3-INBOX-001 (REQ-V3-INBOX-001, Issue 320, #321 H-4/L-3)
// @MX:SPEC SPEC-V3-TRIAGE-001 (REQ-TRI-001..008, Issue 339)
// @MX:REASON RA employees ask regulatory questions via /api/ask. Entry point for
//            inbox_tickets. Requires ask.create (viewer+) because question
//            submission is a CREATE activity, not read-only consult (H-4 fix).
//            TRIAGE hook (C-2) injects RAG auto_answer + AC-06 citation gate +
//            auto transition auto → needs-review.

import { randomUUID } from 'node:crypto';
import { writeAudit } from '@/lib/audit';
import { withPermission } from '@/lib/auth/with-permission';
import { db } from '@/lib/db/client';
import { inboxTickets } from '@/lib/db/schema';
import { assertValidTransition } from '@/lib/domains/inbox/state-machine';
import { runTriage } from '@/lib/domains/triage';
import { and, eq } from 'drizzle-orm';
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

/**
 * @MX:WARN [AUTO] TRIAGE auto-transition + AC-06 citation gate (21 CFR Part 11).
 * @MX:REASON tx1 (ticket insert) commits BEFORE TRIAGE so a slow or failed RAG
 *          call cannot roll back the ticket. tx2 (auto_answer inject + state
 *          transition) rides a separate transaction. assertValidTransition
 *          defends the state machine; writeAudit records both the success
 *          transition and the AC-06 rejection (Charter [지양-2]).
 * @MX:SPEC SPEC-V3-TRIAGE-001 (REQ-TRI-001..008, AC-TRI-01..07)
 */
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
  const ticketId = `it_${randomUUID()}`;
  const actorId = session.user.id;

  // tx1: ticket insert + inbox.created audit (21 CFR Part 11 atomicity).
  // REQ-V3-INBOX-001: triageState starts at 'auto'. Commits before TRIAGE so a
  // slow/failed RAG call cannot roll back the ticket (REQ-TRI-005 fallback base).
  await db.transaction(async (tx) => {
    await tx.insert(inboxTickets).values({
      id: ticketId,
      orgId: organizationId,
      fromUser: actorId,
      question,
      triageState: 'auto',
      autoAnswer: null,
      autoConfidence: null,
    });

    await writeAudit(
      {
        actor_id: actorId,
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

  // TRIAGE RAG hook (SPEC-V3-TRIAGE-001). Bounded by TRIAGE_TIMEOUT_MS internally;
  // never throws — returns TriageResult with error field on failure.
  const triage = await runTriage({ question, orgId: organizationId, actorId });

  // AC-06 (REQ-TRI-002): citation-less answer rejected. Ticket stays in 'auto'
  // so manual review remains possible. Audit the rejection (21 CFR Part 11).
  if (triage.error === 'no_citations') {
    await db.transaction(async (tx) => {
      await writeAudit(
        {
          actor_id: actorId,
          action: 'inbox.triaged',
          resource_type: 'inbox_ticket',
          resource_id: ticketId,
          meta_json: {
            from: 'auto',
            to: 'auto',
            auto_triage_rejected: true,
            reason: 'no_citations',
          },
        },
        // biome-ignore lint/suspicious/noExplicitAny: Drizzle tx type satisfies AuditDbHandle interface
        tx as any,
      );
    });
    return Response.json({ error: 'no_citations' }, { status: 400 });
  }

  // REQ-TRI-005: timeout / runtime_error → keep ticket in 'auto', return 201 fallback.
  if (triage.error !== undefined) {
    return Response.json(
      {
        ticketId,
        triageState: 'auto',
        autoAnswer: null,
        autoConfidence: null,
      },
      { status: 201 },
    );
  }

  // Normal path: inject auto_answer + transition auto → needs-review (tx2).
  // assertValidTransition defends the state machine (Charter [지양-4] — TRIAGE
  // never auto-transitions to escalated/closed/rejected).
  assertValidTransition('auto', 'needs-review');
  await db.transaction(async (tx) => {
    await tx
      .update(inboxTickets)
      .set({
        autoAnswer: JSON.stringify(triage.autoAnswer),
        autoConfidence:
          triage.autoConfidence !== null && triage.autoConfidence !== undefined
            ? triage.autoConfidence.toFixed(2)
            : null,
        triageState: 'needs-review',
      })
      .where(and(eq(inboxTickets.id, ticketId), eq(inboxTickets.orgId, organizationId)));

    // GAP-TRI-02: writeAudit directly (not auditTransition) to extend meta with
    // auto_triage / confidence_score / citations_count beyond the {from, to} shape.
    await writeAudit(
      {
        actor_id: actorId,
        action: 'inbox.triaged',
        resource_type: 'inbox_ticket',
        resource_id: ticketId,
        meta_json: {
          from: 'auto',
          to: 'needs-review',
          auto_triage: true,
          confidence_score: triage.autoConfidence,
          citations_count: triage.autoAnswer?.citations.length ?? 0,
        },
      },
      // biome-ignore lint/suspicious/noExplicitAny: Drizzle tx type satisfies AuditDbHandle interface
      tx as any,
    );
  });

  return Response.json(
    {
      ticketId,
      triageState: 'needs-review',
      autoAnswer: triage.autoAnswer,
      autoConfidence: triage.autoConfidence,
    },
    { status: 201 },
  );
});
