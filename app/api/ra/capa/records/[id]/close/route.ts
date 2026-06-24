// @MX:NOTE [AUTO] POST /api/ra/capa/records/[id]/close — CAPA close (REQ-010/011/012).
// @MX:SPEC SPEC-REGULA-CAPA-001 (REQ-010, REQ-011, REQ-012, AC-04, AC-07, AC-08)
//
// This route enforces three interlocking gates:
//   1. REQ-012 RBAC: capa.close requires ra-lead (withPermission enforces).
//   2. REQ-011 vigilance gate: canCloseCapa blocks close when a reportable
//      complaint has no vigilance_ref. Server-side — clients cannot bypass.
//   3. REQ-010 ESIG: the closer MUST provide a signature payload (name +
//      meaning). The signature hash is recorded on capa_records for §11.70
//      record linking.
//
// H-1 fix (§11.70 signature binding): the ESIG hash now binds the signer
// identity (name + title), the meaning statement, the authenticated user id,
// and a fresh ISO timestamp into the hashed canonical input — not just the
// CAPA id + description. This prevents signature extraction/replay: the hash
// is unique per (signer, meaning, moment, user) tuple.
//
// H-2 fix (Part 11 atomicity): the close update + audit insert ride the same
// `db.transaction` boundary so a mid-write failure cannot leave a closed CAPA
// without an audit row (or vice versa). Mirrors the PMS close route pattern.

import { withPermission } from '@/lib/auth/with-permission';
import { auditCapaCloseBlockedVigilanceMissing, auditCapaClosed } from '@/lib/capa/audit';
import { canCloseCapa } from '@/lib/capa/close-gate';
import { closeCapaRecord, getCapaRecord } from '@/lib/capa/records';
import { db } from '@/lib/db/client';
import { computeAnswerHash } from '@/lib/signature/hash';
import { z } from 'zod';

const CloseCapaSchema = z.object({
  signerName: z.string().min(1).max(256),
  signerTitle: z.string().max(256).optional(),
  meaning: z.string().min(1).max(1000),
});

export const POST = withPermission('capa.close', async (req, ctx, session) => {
  const organizationId = session.user.organizationId;
  if (!organizationId) {
    return Response.json({ error: 'Organization context required' }, { status: 403 });
  }

  const rawParams = ctx.params;
  const resolvedParams = rawParams && 'then' in rawParams ? await rawParams : rawParams;
  const capaId = resolvedParams?.id ?? '';

  if (!capaId) {
    return Response.json({ error: 'capa id required' }, { status: 400 });
  }

  const parsed = CloseCapaSchema.safeParse(await req.json());
  if (!parsed.success) {
    return Response.json(
      { error: 'validation_failed', issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const body = parsed.data;

  // IDOR defense: CAPA must belong to the caller's org.
  const capa = await getCapaRecord(capaId, organizationId);
  if (!capa) {
    return Response.json({ error: 'CAPA not found' }, { status: 404 });
  }

  // REQ-011 gate: reportable + no vigilance_ref → block. Server-side, audited.
  const gate = await canCloseCapa(capaId, organizationId);
  if (!gate.allowed) {
    await auditCapaCloseBlockedVigilanceMissing({
      userId: session.user.id,
      capaId,
      complaintId: capa.complaintId,
    });
    return Response.json({ error: 'close_blocked', reason: gate.reason }, { status: 403 });
  }

  // REQ-010 ESIG (H-1 fix): compute the §11.70 record hash binding the
  // signature to the close decision. The canonical input now includes the
  // signer identity (name + title), the meaning statement, the authenticated
  // user id, and a fresh ISO timestamp — so the hash is unique per signing
  // act and cannot be replayed or extracted onto a different decision.
  // The CAPA id + description anchor the hash to the specific record.
  const signedAt = new Date().toISOString();
  const signatureHash = await computeAnswerHash(`capa:${capaId}:close`, [
    {
      id: capaId,
      content: capa.description ?? '',
      type: 'capaClose',
    },
    {
      // Signer-binding block — §11.50 / §11.70 required elements.
      id: `signer:${session.user.id}`,
      content: JSON.stringify({
        signerName: body.signerName,
        signerTitle: body.signerTitle ?? '',
        meaning: body.meaning,
        userId: session.user.id,
        signedAt,
      }),
      type: 'capaCloseSignature',
    },
  ]);

  // H-2 fix: close update + audit ride the same transaction (21 CFR Part 11
  // atomicity). Mirrors the PMS close route pattern.
  let closed = false;
  try {
    await db.transaction(async (tx) => {
      closed = await closeCapaRecord(
        {
          capaId,
          orgId: organizationId,
          closedBy: session.user.id,
          signatureHash,
        },
        tx,
      );
      if (!closed) return; // org/id mismatch — nothing to audit

      // REQ-010 / AC-04: audit the close with the signature hash prefix.
      await auditCapaClosed(
        {
          userId: session.user.id,
          capaId,
          signatureHash,
        },
        tx,
      );
    });
  } catch (err) {
    console.error('capa.closed failed (transaction rolled back)', err);
    return Response.json({ error: 'close_failed' }, { status: 500 });
  }

  if (!closed) {
    return Response.json({ error: 'close_failed' }, { status: 500 });
  }

  return Response.json({
    capaId,
    status: 'closed',
    closedBy: session.user.id,
    signerName: body.signerName,
  });
});
