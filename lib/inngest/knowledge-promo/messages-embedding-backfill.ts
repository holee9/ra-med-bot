// @MX:NOTE [AUTO] Inngest backfill job for messages.embedding (Issue #275).
// @MX:SPEC SPEC-REGULA-KNOWLEDGE-PROMO-001 (REQ-002 — general conversation semantic search)
// @MX:REASON Cursor-based batch backfill of embedding for existing assistant
//           messages. Idempotent (WHERE embedding IS NULL). Step.retry for
//           transient OpenAI failures. Job execution only — actual backfill
//           of thousands of rows is ops decision (cost/time).

import { eq, sql } from 'drizzle-orm';
import { messages } from '../../db/schema';
import { embedForMessage } from '../../knowledge-promo/embedding';
import { logger } from '../../observability/logger';
import { inngest } from '../client';

/**
 * Batch size per step — balances OpenAI rate limits (RPM/TPM) with job throughput.
 * text-embedding-3-small: ~100 RPM, 200K TPM limit per org.
 * 100 rows/batch × ~150 tokens/row ≈ 15K tokens → safe headroom.
 */
const BATCH_SIZE = 100;

/**
 * Inngest backfill job for messages.embedding.
 *
 * Processes assistant messages without embeddings in batches of BATCH_SIZE.
 * Each step computes embedding via text-embedding-3-small and updates the row.
 * Retry policy handles transient OpenAI failures (429/5xx).
 *
 * USAGE: This job is registered in lib/inngest/functions.ts but requires
 * manual triggering via Inngest dashboard or CLI for production backfill:
 *   npx inngest trigger 'messages-embedding-backfill/run'
 *
 * DEV NOTE: Do NOT auto-trigger this job on startup — backfilling thousands
 * of rows incurs significant OpenAI cost and time.
 */
export const messagesEmbeddingBackfillJob = inngest.createFunction(
  {
    id: 'messages-embedding-backfill',
    name: 'Messages Embedding Backfill',
    triggers: [{ event: 'messages-embedding-backfill/run' }],
    retries: 3, // Retry on transient OpenAI failures (429/5xx).
  },
  async ({ step, logger: jobLogger }) => {
    // Lazy import — avoids top-level db client init (parseEnv side-effect) breaking
    // functions.test.ts which imports the Inngest registry at load time (#50 pattern).
    const { db } = await import('../../db/client');
    jobLogger.info('Starting messages embedding backfill');

    // Step 1: Count remaining messages (idempotency check).
    const remainingCount = await step.run('count-remaining', async () => {
      const result = await db.execute<{ count: bigint }>(
        sql`SELECT COUNT(*) as count FROM messages WHERE role = 'assistant' AND embedding IS NULL`,
      );
      return Number(result[0]?.count ?? 0);
    });

    jobLogger.info(`Remaining messages without embedding: ${remainingCount}`);

    if (remainingCount === 0) {
      jobLogger.info('No messages to backfill — job complete');
      return { status: 'complete', processed: 0 };
    }

    // Step 2: Process batch (cursor-based iteration).
    const processed = await step.run('process-batch', async () => {
      // Fetch BATCH_SIZE messages without embedding (assistant role only).
      const rows = await db.execute<{ id: string; content_prose: string }>(
        sql`SELECT id, content_prose FROM messages WHERE role = 'assistant' AND embedding IS NULL LIMIT ${BATCH_SIZE}`,
      );

      jobLogger.info(`Processing batch of ${rows.length} messages`);

      // Compute embeddings in parallel (OpenAI handles batching internally).
      const embeddings = await Promise.all(
        rows.map(async (row) => {
          const embedding = await embedForMessage(row.content_prose);
          return { messageId: row.id, embedding };
        }),
      );

      // Update rows with embeddings (null embeddings are skipped).
      let updatedCount = 0;
      for (const { messageId, embedding } of embeddings) {
        if (!embedding) {
          logger.warn(`Skipping message ${messageId} — embedding generation failed`);
          continue;
        }

        await db.update(messages).set({ embedding }).where(eq(messages.id, messageId));

        updatedCount++;
      }

      return updatedCount;
    });

    jobLogger.info(`Batch processed: ${processed} messages updated`);

    // Step 3: Recursively trigger next batch if messages remain.
    // This self-trigger pattern continues until all messages are backfilled.
    if (remainingCount > BATCH_SIZE) {
      await step.sendEvent('messages-embedding-backfill/continue', {
        name: 'messages-embedding-backfill/run',
        data: {},
      });
      jobLogger.info('Triggered next batch');
    } else {
      jobLogger.info('All messages backfilled — job complete');
    }

    return { status: 'in-progress', processed };
  },
);
