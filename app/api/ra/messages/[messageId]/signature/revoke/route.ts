// @MX:NOTE [AUTO] Signature Revoke Route — POST /api/ra/messages/[messageId]/signature/revoke
// @MX:SPEC SPEC-REGULA-ESIG-001 (REQ-ESIG-005)
//
// Revocation soft-deletes the active signature row and emits an audit event.
// The answer is unlocked after revocation — a new signature can be applied.
export const runtime = 'nodejs';

import { writeAudit } from '@/lib/audit';
import { withPermission } from '@/lib/auth/with-permission';
import { db } from '@/lib/db/client';
import { getAuthorizedSignatureMessage } from '@/lib/signature/authorization';
import { type DbClient, getActiveSignature, revokeSignature } from '@/lib/signature/queries';

type RouteCtx = { params: Promise<{ messageId: string }> };

/**
 * POST /api/ra/messages/[messageId]/signature/revoke
 * Revokes the active electronic signature on an answer.
 *
 * Guards: signature.sign permission (only the privileged roles can also revoke)
 * Returns 404 if no active signature, 200 with revoked record on success.
 */
export const POST = withPermission('signature.sign', async (_req, ctx, session) => {
  const rawParams = ctx.params;
  const resolvedParams = rawParams && 'then' in rawParams ? await rawParams : rawParams;
  const messageId = resolvedParams?.messageId ?? '';

  const message = await getAuthorizedSignatureMessage(messageId, session, db);
  if (!message) {
    return Response.json({ error: 'Message not found' }, { status: 404 });
  }

  // Verify active signature exists
  const existing = await getActiveSignature(messageId, db);
  if (!existing) {
    return Response.json({ error: 'no_active_signature' }, { status: 404 });
  }

  // 21 CFR Part 11 §11.10(e) — revoke UPDATE + audit in same db.transaction (Issue #378)
  const revoked = await db.transaction(async (tx) => {
    const rev = await revokeSignature(existing.id, session.user.id, db, tx as DbClient);

    // Append-only audit entry (REQ-ESIG-007)
    await writeAudit(
      {
        action: 'signature.revoked',
        actor_id: session.user.id,
        resource_type: 'signature',
        resource_id: existing.id,
        meta_json: { messageId, originalSignerId: existing.signerId },
      },
      tx,
    );

    return rev;
  });

  return Response.json(revoked, { status: 200 });
}) as (req: Request, ctx: RouteCtx) => Promise<Response>;
