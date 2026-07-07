// @MX:NOTE [AUTO] POST /api/clinical-investigation/[id]/close — REQ-012 expert signoff gate.
// @MX:SPEC SPEC-REGULA-CLINICAL-INVESTIGATION-001 (Issue #69, REQ-CLININV-012, AC-07)

// @MX:LEGACY archived from app
// @MX:REASON Server-side SAFETY GATE. If the caller
//           supplies no expertSignoffId, Zod rejects (400). If the investigation
//           does not exist or is cross-org, assertInvestigationAccess returns null
//           → 404. If expertSignoffId is not a resolved expert review, the gate
//           returns 403 with an audited reason. The gate is the LAST line of
//           defense before the approval_status='closed' mutation.

import { writeAudit } from '@/lib/audit';
import { withPermission } from '@/lib/auth/with-permission';
import { assertInvestigationAccess, resolveRouteId } from '@/lib/clinical-investigation/access';
import { canCloseInvestigation } from '@/lib/clinical-investigation/close-gate';
import { closeInputSchema } from '@/lib/clinical-investigation/types';
import { db } from '@/lib/db/client';
import { clinicalInvestigations } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export const POST = withPermission('clinical_investigation.manage', async (req, ctx, session) => {
  const organizationId = session.user.organizationId;
  if (!organizationId) {
    return Response.json({ error: 'Organization context required' }, { status: 403 });
  }
  const investigationId = await resolveRouteId(ctx);

  const parsed = closeInputSchema.safeParse(await req.json());
  if (!parsed.success) {
    return Response.json(
      { error: 'Invalid input', issues: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const input = parsed.data;

  // IDOR gate.
  const investigation = await assertInvestigationAccess(investigationId, organizationId);
  if (!investigation) {
    return Response.json({ error: 'Investigation not found' }, { status: 404 });
  }

  // REQ-012 close gate.
  const gate = await canCloseInvestigation(investigationId, organizationId, input.expertSignoffId);
  if (!gate.allowed) {
    // H-3 fix: audit the denial in a transaction. A Part 11 denial audit row
    // is the ONLY durable evidence the gate fired — swallowing a write failure
    // would silently drop that evidence. If the audit insert fails the route
    // returns 500 (fail-closed) rather than a clean 403. Mirrors the
    // success-path atomicity (db.transaction). The previous implementation
    // wrote the audit outside any tx and `console.error`-swallowed failures.
    try {
      await db.transaction(async (tx) => {
        await writeAudit(
          {
            actor_id: session.user.id,
            action: 'ci.close_blocked_signoff_missing',
            resource_type: 'clinical_investigation',
            resource_id: investigationId,
            meta_json: {
              investigationId,
              reason: gate.reason,
              expertSignoffId: input.expertSignoffId,
            },
          },
          tx,
        );
      });
    } catch (auditErr) {
      console.error('ci.close_blocked denial audit write failed (fail-closed)', auditErr);
      return Response.json({ error: 'Failed to record close denial' }, { status: 500 });
    }
    return Response.json({ error: 'Close blocked', reason: gate.reason }, { status: 403 });
  }

  try {
    await db.transaction(async (tx) => {
      await tx
        .update(clinicalInvestigations)
        .set({ approvalStatus: 'closed', updatedAt: new Date() })
        .where(eq(clinicalInvestigations.id, investigationId));

      await writeAudit(
        {
          actor_id: session.user.id,
          action: 'ci.closed',
          resource_type: 'clinical_investigation',
          resource_id: investigationId,
          meta_json: {
            investigationId,
            expertSignoffId: input.expertSignoffId,
            ...(input.notes ? { notesLength: input.notes.length } : {}),
          },
        },
        tx,
      );
    });

    return Response.json({ id: investigationId, status: 'closed' });
  } catch (err) {
    console.error('ci.close failed (transaction rolled back)', err);
    return Response.json({ error: 'Failed to close investigation' }, { status: 500 });
  }
});
