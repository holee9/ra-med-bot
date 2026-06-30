// @MX:NOTE [AUTO] Weekly cron function for knowledge sources sync.
// @MX:SPEC Issue #307 D-2 (Knowledge Sources API)

import { knowledgeSources } from '@/lib/db/schema';
import { syncKnowledgeSource } from '@/lib/knowledge-sources/sync';
import { and, eq } from 'drizzle-orm';
import { inngest } from '../client';

/** Cron schedule: every week on Monday at 00:00 UTC. */
export const KNOWLEDGE_SOURCES_CRON_SCHEDULE = '0 0 * * 1';

/**
 * Weekly knowledge sources sync cron function.
 * Enumerates all knowledge_sources and triggers sync for each.
 */
export const knowledgeSourcesWeeklySyncFn = inngest.createFunction(
  {
    id: 'knowledge-sources-weekly-sync',
    name: 'Weekly Knowledge Sources Sync',
    triggers: [{ cron: KNOWLEDGE_SOURCES_CRON_SCHEDULE }],
  },
  async ({ step, logger }) => {
    const { db } = await import('@/lib/db/client');

    // Fetch all knowledge sources
    const sources = await db
      .select()
      .from(knowledgeSources)
      .where(eq(knowledgeSources.syncStatus, 'synced'));

    let synced = 0;
    let failed = 0;

    for (const source of sources) {
      try {
        await step.run(`sync-source-${source.id}`, async () => {
          await syncKnowledgeSource({
            id: source.id,
            gitUrl: source.gitUrl,
            branch: source.branch,
            auth_token: source.authTokenEncrypted,
            orgId: source.organizationId,
          });
        });
        synced++;
      } catch (error) {
        logger.error(`[knowledge-sources-sync] Failed for source ${source.id}:`, error);
        failed++;
      }
    }

    return { synced, failed, total: sources.length };
  },
);
