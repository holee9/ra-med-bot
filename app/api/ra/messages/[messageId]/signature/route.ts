// @MX:ANCHOR [AUTO] Signature Route — POST/GET /api/ra/messages/[messageId]/signature
// @MX:REASON Entry point for 21 CFR Part 11 electronic signature application and manifestation.
//            fan_in will be >= 3 from AnswerBlock, PDF exporter, and audit queries.
// @MX:SPEC SPEC-REGULA-ESIG-001 (REQ-ESIG-001, REQ-ESIG-002, REQ-ESIG-004)
export const runtime = 'nodejs';

import { writeAudit } from '@/lib/audit';
import { withPermission } from '@/lib/auth/with-permission';
import { db } from '@/lib/db/client';
import { messageBlocks } from '@/lib/db/schema';
import { getAuthorizedSignatureMessage } from '@/lib/signature/authorization';
import { computeAnswerHash } from '@/lib/signature/hash';
import { getActiveSignature, insertSignature } from '@/lib/signature/queries';
import { asc, eq } from 'drizzle-orm';
import { z } from 'zod';

const SignBodySchema = z.object({
  meaning: z.string().min(1).max(500),
  signerTitle: z.string().max(200).optional(),
});

/**
 * POST /api/ra/messages/[messageId]/signature
 * Applies an electronic signature to an answer.
 *
 * Guards: signature.sign permission (ra-lead, qa-lead, admin)
 * Returns 409 if already signed, 201 with signature record on success.
 */
export const POST = withPermission('signature.sign', async (req, ctx, session) => {
  const rawParams = ctx.params;
  const resolvedParams = rawParams && 'then' in rawParams ? await rawParams : rawParams;
  const messageId = resolvedParams?.messageId ?? '';

  // Parse request body
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = SignBodySchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: 'Validation failed', issues: parsed.error.issues },
      { status: 400 },
    );
  }
  const { meaning, signerTitle } = parsed.data;

  const message = await getAuthorizedSignatureMessage(messageId, session, db);
  if (!message) {
    return Response.json({ error: 'Message not found' }, { status: 404 });
  }

  // Check for existing active signature (409 Conflict) after authorization to avoid UUID probing.
  const existing = await getActiveSignature(messageId, db);
  if (existing) {
    return Response.json(
      { error: 'answer_already_signed', signatureId: existing.id },
      { status: 409 },
    );
  }

  // Fetch ordered blocks for hash canonicalization (§11.70)
  const blocks = await db
    .select({
      id: messageBlocks.id,
      blockType: messageBlocks.blockType,
      blockJson: messageBlocks.blockJson,
      orderIndex: messageBlocks.orderIndex,
    })
    .from(messageBlocks)
    .where(eq(messageBlocks.messageId, messageId))
    .orderBy(asc(messageBlocks.orderIndex));

  // Compute SHA-256 hash linking signature to record (§11.70)
  const hashableBlocks = blocks.map((b) => ({
    id: b.id,
    content: JSON.stringify(b.blockJson),
    type: b.blockType,
  }));
  const recordHash = await computeAnswerHash(message.contentProse, hashableBlocks);

  // Insert signature — signerName from session email/id as display identifier
  const signerName =
    (session.user as { name?: string }).name ?? session.user.email ?? session.user.id;
  const signature = await insertSignature(
    {
      messageId,
      signerId: session.user.id,
      signerName,
      signerTitle: signerTitle ?? null,
      meaning,
      recordHash,
    },
    db,
  );

  // Append-only audit entry (fail-closed)
  await writeAudit({
    action: 'signature.applied',
    actor_id: session.user.id,
    resource_type: 'signature',
    resource_id: signature.id,
    meta_json: { messageId, hash: recordHash, meaning },
  });

  return Response.json(signature, { status: 201 });
});

/**
 * GET /api/ra/messages/[messageId]/signature
 * Returns the §11.50 signature manifestation for a signed answer.
 *
 * Returns 404 if no active signature exists, 200 with manifestation fields.
 */
export const GET = withPermission('conversation.view', async (_req, ctx, session) => {
  const rawParams = ctx.params;
  const resolvedParams = rawParams && 'then' in rawParams ? await rawParams : rawParams;
  const messageId = resolvedParams?.messageId ?? '';

  const message = await getAuthorizedSignatureMessage(messageId, session, db);
  if (!message) {
    return Response.json({ error: 'Message not found' }, { status: 404 });
  }

  const signature = await getActiveSignature(messageId, db);
  if (!signature) {
    return Response.json({ error: 'No signature found' }, { status: 404 });
  }

  // §11.50 manifestation: signer name, title, timestamp, meaning
  return Response.json({
    id: signature.id,
    signerName: signature.signerName,
    signerTitle: signature.signerTitle,
    meaning: signature.meaning,
    signedAt: signature.signedAt,
    recordHash: signature.recordHash,
    isRevoked: signature.revokedAt !== null,
    revokedAt: signature.revokedAt,
  });
});
