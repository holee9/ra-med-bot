// @MX:ANCHOR Message persistence — atomic insert of message + sources + blocks.
// @MX:REASON A consult that streams successfully but fails to persist is a
// regulatory record gap; we keep the three inserts in one transaction so the
// audit trail and the user-visible answer never diverge.
// @MX:SPEC SPEC-REGULA-CHAT-001 (REQ-CHAT-018, REQ-CHAT-023, REQ-CHAT-028)

import { db } from '../db/client';
import { messageBlocks, messageSources, messages } from '../db/schema';
import type { Violation } from './citation-enforce';
import type { RetrievedChunk } from './retrievers/hybrid-search';

export interface PersistMessageParams {
  conversationId: string;
  messageId: string;
  userQuestion: string;
  cleanedProse: string;
  confidenceLevel: 'high' | 'med' | 'low';
  confidenceScore: number;
  durationMs: number;
  expertReviewRequired: boolean;
  tokensIn: number | null;
  tokensOut: number | null;
  model: string;
  violations: Violation[];
  /** Only chunks actually cited in the prose (1-based citeIndex preserved). */
  citedChunks: Array<RetrievedChunk & { citeIndex: number }>;
}

export async function persistMessage(params: PersistMessageParams): Promise<void> {
  await db.transaction(async (tx) => {
    // 1. messages row — assistant turn.
    await tx.insert(messages).values({
      id: params.messageId,
      conversationId: params.conversationId,
      role: 'assistant',
      contentProse: params.cleanedProse,
      confidenceLevel: params.confidenceLevel,
      // numeric(4,3) requires a string when written via Drizzle.
      confidenceScore: params.confidenceScore.toFixed(3),
      durationMs: params.durationMs,
      expertReviewRequired: params.expertReviewRequired,
      tokensIn: params.tokensIn,
      tokensOut: params.tokensOut,
      model: params.model,
      metaJson: { violations: params.violations },
    });

    // 2. message_sources rows — one per cited chunk (citeIndex preserved).
    if (params.citedChunks.length > 0) {
      await tx.insert(messageSources).values(
        params.citedChunks.map((c) => ({
          messageId: params.messageId,
          sourceId: c.sourceId,
          relevanceScore: c.combined_score.toFixed(3),
          quotedOffset: c.offset,
          quotedLength: c.text.length,
          citeIndex: c.citeIndex,
        })),
      );
    }

    // 3. message_blocks — Phase 2 only emits prose + sources blocks.
    await tx.insert(messageBlocks).values([
      {
        messageId: params.messageId,
        blockType: 'prose',
        blockJson: { content: params.cleanedProse },
        orderIndex: 0,
      },
      {
        messageId: params.messageId,
        blockType: 'sources',
        blockJson: {
          sources: params.citedChunks.map((c) => ({
            sourceId: c.sourceId,
            citeIndex: c.citeIndex,
          })),
        },
        orderIndex: 1,
      },
    ]);
  });
}
