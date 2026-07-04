// @MX:ANCHOR [AUTO] Promote inbox.ticket → approved_answers (atomic tx).
// @MX:REASON 21 CFR Part 11 atomicity: ticket closure + approved_answers creation
//            MUST ride the same transaction boundary. Partial failure = rollback.
//            Fan_in will reach 3+ (API route + potential batch ops + admin tools).
// @MX:SPEC SPEC-V3-INBOX-001 (REQ-V3-INBOX-028, Issue 320)

import { createHash } from 'node:crypto';
import { writeAudit } from '@/lib/audit';
import type { Database } from '@/lib/db/client';
import { approvedAnswers, inboxTickets } from '@/lib/db/schema';
import { and, eq } from 'drizzle-orm';
import { assertValidTransition } from './state-machine';
import type { PromotionInput } from './types';

/**
 * Citation extraction helper.
 *
 * Parses auto_answer JSON and extracts citations array.
 * Returns empty array if parsing fails or citations missing.
 *
 * Charter [지양-2] citation enforcement: citation absence is a business rule
 * violation that must block promotion (validated before calling promote).
 */
function extractCitations(autoAnswerJson: string | null): { source: string; quote?: string }[] {
  if (!autoAnswerJson) {
    return [];
  }

  try {
    const parsed = JSON.parse(autoAnswerJson);
    // auto_answer structure: { answer: string, citations: [...] }
    if (parsed.citations && Array.isArray(parsed.citations)) {
      return parsed.citations;
    }
    return [];
  } catch {
    // Invalid JSON — treat as no citations
    return [];
  }
}

/**
 * Promote an inbox ticket to an approved answer.
 *
 * REQ-V3-INBOX-028: Atomic transaction with 21 CFR Part 11 compliance.
 *
 * Transaction steps (all-or-nothing):
 * 1. Verify ticket state is valid for promotion (finalAnswer exists)
 * 2. Verify ESIG signature (esigSignature non-empty)
 * 3. Update ticket: triage_state → closed, approved_by, approved_at = NOW()
 * 4. Create approved_answers row with:
 *    - from_ticket FK
 *    - state = 'published'
 *    - question/answer copied from ticket
 *    - citations extracted from ticket.auto_answer
 *    - published_by, published_at = NOW()
 * 5. Write audit row (inbox.approved) in same transaction
 *
 * Charter [지양-4] RA Lead ESIG: NO auto-promotion. esigSignature is MANDATORY.
 * Charter [지양-2] citation: citations extracted from auto_answer (citation contract).
 *
 * @throws Error if ticket not found, final_answer missing, or ESIG invalid
 * @throws Error on any DB failure (transaction rolls back)
 */
export async function promoteToApproved(db: Database, input: PromotionInput): Promise<void> {
  // Step 1: Fetch current ticket state (outside transaction for validation)
  const ticket = await db
    .select({
      id: inboxTickets.id,
      question: inboxTickets.question,
      finalAnswer: inboxTickets.finalAnswer,
      autoAnswer: inboxTickets.autoAnswer,
      triageState: inboxTickets.triageState,
      orgId: inboxTickets.orgId,
    })
    .from(inboxTickets)
    .where(eq(inboxTickets.id, input.ticketId))
    .limit(1);

  if (!ticket[0]) {
    throw new Error('Ticket not found');
  }

  const current = ticket[0];

  // Step 2: Validate promotion prerequisites
  if (!current.finalAnswer) {
    throw new Error('Cannot promote ticket without final_answer');
  }

  // Type guard: finalAnswer is now confirmed non-null
  const finalAnswer: string = current.finalAnswer;

  if (!input.esigSignature || input.esigSignature.trim().length === 0) {
    // Charter [지양-4]: ESIG is MANDATORY for promotion
    throw new Error('ESIG signature required for promotion');
  }

  // Validate state transition (current → closed)
  assertValidTransition(current.triageState, 'closed');

  // Step 3: Extract citations from auto_answer
  const citations = extractCitations(current.autoAnswer);

  // C-1 (#321): §11.70 signature-record binding — SHA-256 over the canonical
  // approved record. Binds the approved_answer to the ESIG act (approver +
  // content). Verification recomputes the digest; any post-signature mutation
  // of the canonical fields invalidates it.
  const signatureRecord = JSON.stringify({
    ticketId: current.id,
    approverId: input.approverId,
    finalAnswer,
    citations,
  });
  const esigSignature = createHash('sha256').update(signatureRecord).digest('hex');

  // Step 4: Execute atomic transaction
  await db.transaction(async (tx) => {
    // H-1 TOCTOU (#321): re-verify org_id inside the transaction with a row
    // lock (SELECT ... FOR UPDATE) so the ticket cannot change ownership
    // between the outer read (line ~66) and this UPDATE. The outer
    // assertTicketInOrg check in the route plus this in-tx re-check close the
    // time-of-check / time-of-use window.
    const locked = await tx
      .select({ orgId: inboxTickets.orgId })
      .from(inboxTickets)
      .where(and(eq(inboxTickets.id, input.ticketId), eq(inboxTickets.orgId, current.orgId)))
      .for('update')
      .limit(1);
    if (!locked[0]) {
      throw new Error('Ticket not found in organization (TOCTOU check failed)');
    }

    // 4a. Update ticket to closed state (org_id re-checked in WHERE)
    await tx
      .update(inboxTickets)
      .set({
        triageState: 'closed',
        approvedBy: input.approverId,
        approvedAt: new Date(),
        closedAt: new Date(),
      })
      .where(and(eq(inboxTickets.id, input.ticketId), eq(inboxTickets.orgId, current.orgId)));

    // 4b. Create approved_answers row
    const approvedAnswerId = `aa_${current.id}`; // Derive ID from ticket ID
    await tx.insert(approvedAnswers).values({
      id: approvedAnswerId,
      orgId: current.orgId,
      question: current.question,
      answer: finalAnswer, // Type-guarded non-null
      // biome-ignore lint/suspicious/noExplicitAny: Drizzle JSONB type requires any cast for citation array
      citations: citations as any, // JSONB cast
      esigSignature, // §11.70 signature-record binding (Issue 321, C-1)
      state: 'published',
      fromTicket: current.id,
      publishedBy: input.approverId, // UUID or null (schema allows null)
      publishedAt: new Date(), // timestamp or null (schema allows null)
      updatedAt: new Date(), // notNull with defaultNow()
    });

    // 4c. Write audit row (same transaction)
    await writeAudit(
      {
        actor_id: input.approverId,
        action: 'inbox.approved',
        resource_type: 'inbox_ticket',
        resource_id: input.ticketId,
        meta_json: {
          approved_answer_id: approvedAnswerId,
          esig_signature_provided: true,
          citations_count: citations.length,
        },
      },
      // biome-ignore lint/suspicious/noExplicitAny: Drizzle tx type satisfies AuditDbHandle interface
      tx as any, // tx satisfies AuditDbHandle interface
    );
  });
}
