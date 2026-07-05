// @MX:ANCHOR [AUTO] POST /api/consult/sessions/:sessionId/turns — Power Chat turn creation.
// @MX:REASON fan_in >= 1 (this route) and the most complex CONSULT handler: RAG
//            pipeline + transactional persistence + 21 CFR Part 11 audit + citation
//            enforcement + timeout handling. Mirrors TRIAGE /api/ask pattern:
//            RAG runs OUTSIDE the tx (slow, 15s budget); the tx only does
//            turnNumber MAX+1 + INSERT turn + writeAudit (fast, atomic).
// @MX:SPEC SPEC-V3-CONSULT-001 (REQ-CONS-004, REQ-CONS-005, REQ-CONS-008, AC-CONS-03..07, Issue 341)

import { createHash } from 'node:crypto';
import { writeAudit } from '@/lib/audit';
import { withPermission } from '@/lib/auth/with-permission';
import { db } from '@/lib/db/client';
import { consultSessions, consultTurns } from '@/lib/db/schema';
import { runConsult } from '@/lib/domains/consult';
import { and, eq, isNull, max } from 'drizzle-orm';
import { z } from 'zod';

// REQ-CONS-004: question 1-5000 chars (mirrors /api/ask + /api/ra/consult).
const createTurnSchema = z.object({
  question: z.string().min(1).max(5000, 'Question must be between 1 and 5000 characters'),
});

export const POST = withPermission('consult.turn.create', async (req, ctx, session) => {
  const organizationId = session.user.organizationId;
  if (!organizationId) {
    return Response.json({ error: 'Organization context required' }, { status: 403 });
  }

  const params = ctx.params ? await ctx.params : {};
  const sessionId = params.sessionId;
  if (!sessionId) {
    return Response.json({ error: 'Missing sessionId' }, { status: 400 });
  }

  // Session ownership: org-bound + not-deleted (IDOR defense). ra-member: own only.
  const [sess] = await db
    .select()
    .from(consultSessions)
    .where(
      and(
        eq(consultSessions.id, sessionId),
        eq(consultSessions.orgId, organizationId),
        isNull(consultSessions.deletedAt),
      ),
    )
    .limit(1);
  if (!sess || (session.user.role === 'ra-member' && sess.userId !== session.user.id)) {
    return Response.json({ error: 'Session not found' }, { status: 404 });
  }

  const body = (await req.json().catch(() => null)) as unknown;
  const parsed = createTurnSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: 'Invalid input', issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  // RAG pipeline OUTSIDE the tx (15s timeout internal to runConsult via runTriage).
  // Citation 80% coverage enforced inside (H-3, AC-CONS-04).
  const result = await runConsult({
    question: parsed.data.question,
    orgId: organizationId,
    actorId: session.user.id,
  });

  // tx: turnNumber MAX+1 + INSERT turn + audit (atomic, fast).
  // UNIQUE(session_id, turn_number) defends concurrent races (R-05); the next
  // retry/SERIALIZABLE upgrade is tracked as a follow-up (plan-auditor M-7).
  const turn = await db.transaction(async (tx) => {
    const maxRow = await tx
      .select({ m: max(consultTurns.turnNumber) })
      .from(consultTurns)
      .where(eq(consultTurns.sessionId, sessionId));
    const turnNumber = (maxRow[0]?.m ?? 0) + 1;

    const [row] = await tx
      .insert(consultTurns)
      .values({
        sessionId,
        turnNumber,
        question: parsed.data.question,
        answer: result.answer,
        citations: result.citations,
        sources: result.sources,
        confidence: result.confidence,
        error: result.error,
      })
      .returning();
    if (!row) {
      throw new Error('consult_turn INSERT returned no row');
    }

    // REQ-CONS-008 (success) / REQ-CONS-010 (failure): audit action branches on result.error.
    // turn.failed covers timeout / runtime_error / citation_coverage (AC-CONS-05,
    // 21 CFR Part 11 §11.10(e) debugging audit). questionHash is non-PII question
    // fingerprint (REQ-CONS-008) — question text is never stored in audit.
    const questionHash = createHash('sha256')
      .update(parsed.data.question)
      .digest('hex')
      .slice(0, 16);
    await writeAudit(
      {
        actor_id: session.user.id,
        action: result.error ? 'consult.turn.failed' : 'consult.turn.create',
        resource_type: 'consult_turn',
        resource_id: row.id,
        meta_json: {
          sessionId,
          turnId: row.id,
          turnNumber,
          error: result.error,
          citationCount: result.citations.length,
          questionHash,
        },
      },
      tx,
    );

    return row;
  });

  // Response mapping (turn is ALWAYS persisted — RA member sees feedback).
  // AC-CONS-04 / AC-CONS-05: any error (citation / timeout / runtime) → 400
  // per SPEC §AC-CONS-05 + acceptance.md (single status code, error field carries kind).
  if (result.error) {
    return Response.json({ error: result.error, turn }, { status: 400 });
  }

  // AC-CONS-03: success → 201 + turn (answer + citations).
  return Response.json({ turn }, { status: 201 });
});
