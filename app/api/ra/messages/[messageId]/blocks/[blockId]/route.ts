// @MX:NOTE [AUTO] PATCH /api/ra/messages/:messageId/blocks/:blockId
// Updates block_json for a message block. Ownership verified before update.
// Phase 5: writeAudit('checklist.toggle') wired after successful update.
// @MX:SPEC SPEC-REGULA-STRUCTURED-001 (REQ-STRUCT-021, REQ-STRUCT-037)
//         SPEC-REGULA-ENTERPRISE-001 (REQ-ENTERPRISE-028)

import { and, eq } from 'drizzle-orm';
import { ChecklistBlockSchema } from '../../../../../../../lib/ai/structured-schema';
import { writeAudit } from '../../../../../../../lib/kernel/audit';
import { withPermission } from '../../../../../../../lib/kernel/auth/with-permission';
import { db } from '../../../../../../../lib/kernel/db/client';
import { conversations, messageBlocks, messages } from '../../../../../../../lib/kernel/db/schema';
import { isAnswerLocked } from '../../../../../../../lib/signature/lock';

export const PATCH = withPermission('consult.create', async (req, ctx, session) => {
  // Next.js 15 passes params as a Promise. Resolve it safely.
  const rawParams = (
    ctx as {
      params:
        | Promise<{ messageId: string; blockId: string }>
        | { messageId: string; blockId: string };
    }
  ).params;
  const params = rawParams instanceof Promise ? await rawParams : rawParams;
  const { messageId, blockId } = params as { messageId: string; blockId: string };

  // REQ-ESIG-003: Reject modifications on signed (locked) answers (§11.70)
  const locked = await isAnswerLocked(messageId, db);
  if (locked) {
    return Response.json({ error: 'answer_locked' }, { status: 403 });
  }

  // Parse body
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Zod validation — Phase 3 only supports checklist block updates
  const parseResult = ChecklistBlockSchema.safeParse(body);
  if (!parseResult.success) {
    return new Response(
      JSON.stringify({ error: 'Invalid block data', issues: parseResult.error.issues }),
      { status: 400, headers: { 'Content-Type': 'application/json' } },
    );
  }

  // Find block and verify ownership
  const blockRows = await db
    .select({
      blockId: messageBlocks.id,
      messageId: messageBlocks.messageId,
      conversationId: messages.conversationId,
      userId: conversations.userId,
    })
    .from(messageBlocks)
    .innerJoin(messages, eq(messages.id, messageBlocks.messageId))
    .innerJoin(conversations, eq(conversations.id, messages.conversationId))
    .where(and(eq(messageBlocks.id, blockId), eq(messageBlocks.messageId, messageId)))
    .limit(1);

  if (blockRows.length === 0) {
    return new Response(JSON.stringify({ error: 'Block not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const blockRow = blockRows[0];

  // Ownership check — REQ-STRUCT-021
  if (blockRow?.userId !== session.user.id) {
    return new Response(JSON.stringify({ error: 'Forbidden' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Update block_json
  await db.transaction(async (tx) => {
    await tx
      .update(messageBlocks)
      .set({ blockJson: parseResult.data })
      .where(eq(messageBlocks.id, blockId));

    // REQ-ENTERPRISE-028: Audit the checklist toggle event.
    // REQ-ENTERPRISE-035: writeAudit errors propagate — fail closed if audit write fails.
    await writeAudit(
      {
        action: 'checklist.toggle',
        actor_id: session.user.id,
        resource_type: 'message_block',
        resource_id: blockId,
        conversation_id: blockRow.conversationId,
        meta_json: { messageId, blockId },
      },
      tx,
    );
  });

  return new Response(null, { status: 204 });
});
