// @MX:NOTE PATCH /api/ra/messages/:messageId/blocks/:blockId
// Updates block_json for a message block. Ownership verified before update.
// Phase 3 scope: checklist toggle only. writeAudit deferred to Phase 5.
// @MX:SPEC SPEC-REGULA-STRUCTURED-001 (REQ-STRUCT-021, REQ-STRUCT-037)

import { and, eq } from 'drizzle-orm';
import type { NextRequest } from 'next/server';
import { ChecklistBlockSchema } from '../../../../../../../lib/ai/structured-schema';
import { auth } from '../../../../../../../lib/auth';
import { db } from '../../../../../../../lib/db/client';
import { conversations, messageBlocks, messages } from '../../../../../../../lib/db/schema';

interface RouteParams {
  params: Promise<{ messageId: string; blockId: string }>;
}

export async function PATCH(req: NextRequest, { params }: RouteParams): Promise<Response> {
  // Auth guard
  const session = await auth();
  if (!session?.user?.id) {
    return new Response('Unauthorized', { status: 401 });
  }

  const { messageId, blockId } = await params;

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
  await db
    .update(messageBlocks)
    .set({ blockJson: parseResult.data })
    .where(eq(messageBlocks.id, blockId));

  // REQ-STRUCT-037: writeAudit NOT called here (Phase 5 scope)

  return new Response(null, { status: 204 });
}
