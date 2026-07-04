// @MX:ANCHOR [AUTO] POST /api/inbox/[id]/approve — ESIG promote to approved_answers.
// @MX:SPEC SPEC-V3-INBOX-001 (REQ-V3-INBOX-028, REQ-V3-INBOX-012, Issue 320)
// @MX:REASON REQ-V3-INBOX-028: ESIG signature mandatory (Charter [지양-4]).
//            REQ-V3-INBOX-012: password re-auth required before ESIG approval.
//            Atomic transaction: ticket closure + approved_answers creation + audit.
//            Requires inbox.manage (ra-lead ONLY) — 21 CFR Part 11 regulatory signoff.

import { writeAudit } from '@/lib/audit';
import { withPermission } from '@/lib/auth/with-permission';
import { db } from '@/lib/db/client';
import { users } from '@/lib/db/schema';
import { assertTicketInOrg, promoteToApproved } from '@/lib/domains/inbox';
import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

// Zod schema for approval input
// REQ-V3-INBOX-012: password re-auth is mandatory for ESIG approval (21 CFR Part 11)
const approveTicketInputSchema = z.object({
  password: z.string().min(1, 'Password is required for re-authentication'),
  esigSignature: z.string().min(1, 'ESIG signature is required'),
});

// POST /api/inbox/[id]/approve — promote to approved_answers with ESIG
export const POST = withPermission('inbox.manage', async (req, ctx, session) => {
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

  const parsed = approveTicketInputSchema.safeParse(await req.json());
  if (!parsed.success) {
    return Response.json(
      { error: 'Invalid input', issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { password, esigSignature } = parsed.data;

  // REQ-V3-INBOX-012: Re-authenticate password before ESIG approval (21 CFR Part 11)
  // Fetch approver's password_hash for bcrypt comparison
  const [approver] = await db
    .select({ passwordHash: users.password_hash })
    .from(users)
    .where(eq(users.id, session.user.id))
    .limit(1);

  if (!approver || !approver.passwordHash) {
    return Response.json({ error: 'User not found or no password set' }, { status: 400 });
  }

  const passwordValid = await bcrypt.compare(password, approver.passwordHash);
  if (!passwordValid) {
    // C-1 fix: Write audit on ESIG re-auth failure (suspicious activity indicator)
    try {
      await writeAudit({
        actor_id: session.user.id,
        action: 'inbox.approve_failed',
        resource_type: 'inbox_ticket',
        resource_id: ticketId,
        meta_json: {
          reason: 'Invalid password during ESIG re-authentication',
          esig_failure: true,
        },
      });
    } catch (auditError) {
      // Audit write failure should not mask the original error
      console.error('Failed to write audit for ESIG re-auth failure:', auditError);
    }
    return Response.json({ error: 'Invalid password' }, { status: 401 });
  }

  // IDOR defense: verify ticket belongs to this org (404 on cross-org)
  try {
    await assertTicketInOrg(db, ticketId, organizationId);
  } catch {
    return Response.json({ error: 'Ticket not found' }, { status: 404 });
  }

  // Execute promotion (atomic transaction inside promoteToApproved)
  try {
    await promoteToApproved(db, {
      ticketId,
      approverId: session.user.id,
      esigSignature,
    });

    return Response.json({
      ticketId,
      approved: true,
      message: 'Ticket promoted to approved answers',
    });
  } catch (err) {
    // Map domain errors to HTTP status codes
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';

    // H-2 fix: Write audit-on-failure before returning error
    try {
      await writeAudit({
        actor_id: session.user.id,
        action: 'inbox.approve_failed',
        resource_type: 'inbox_ticket',
        resource_id: ticketId,
        meta_json: {
          reason: errorMessage,
          esig_failure: false, // Non-ESIG failure (e.g., missing final_answer)
        },
      });
    } catch (auditError) {
      // Audit write failure should not mask the original error
      console.error('Failed to write audit for promote failure:', auditError);
    }

    if (errorMessage.includes('Ticket not found')) {
      return Response.json({ error: 'Ticket not found' }, { status: 404 });
    }

    if (errorMessage.includes('ESIG signature required')) {
      return Response.json({ error: 'ESIG signature required' }, { status: 400 });
    }

    if (errorMessage.includes('Cannot promote')) {
      return Response.json({ error: errorMessage }, { status: 400 });
    }

    // Generic 500 for unexpected errors
    return Response.json(
      { error: 'Failed to promote ticket', details: errorMessage },
      { status: 500 },
    );
  }
});
