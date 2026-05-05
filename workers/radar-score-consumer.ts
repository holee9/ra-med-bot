// Radar Score Consumer — scores classified updates per org and stores in org_update_relevance.
// @MX:SPEC SPEC-REGULA-RADAR-001

import { logger } from '../lib/observability/logger';
import { scoreRelevance } from '../lib/radar/relevance-scorer';

interface ClassifiedMessage {
  external_id: string;
  title: string;
  raw_content: string;
  region: string;
  source_crawler: string;
  tier1_relevant: boolean;
  tier2?: {
    device_class?: string;
    product_categories?: string[];
  };
  tier3?: {
    impact_type?: string;
  };
}

interface ScoredMessage extends ClassifiedMessage {
  org_id: string;
  update_id: string;
  impact_score: number;
  matched_product_categories: string[];
}

interface RadarNotifyQueue {
  send(msg: ScoredMessage): Promise<void>;
}

interface Env {
  RADAR_NOTIFY_QUEUE: RadarNotifyQueue;
  [key: string]: unknown;
}

interface Message<T> {
  body: T;
  ack(): void;
  retry(): void;
}

interface MessageBatch<T> {
  messages: Message<T>[];
}

async function getActiveOrgIds(): Promise<string[]> {
  return [];
}

export default {
  async queue(batch: MessageBatch<ClassifiedMessage>, env: Env): Promise<void> {
    const orgIds = await getActiveOrgIds();

    for (const msg of batch.messages) {
      try {
        const update = msg.body;

        if (!update.tier1_relevant) {
          msg.ack();
          continue;
        }

        for (const orgId of orgIds) {
          try {
            const portfolio = {
              device_classes: [] as string[],
              product_categories: [] as string[],
              target_markets: [] as string[],
            };

            const scoreResult = await scoreRelevance({
              update: {
                region: update.region,
                product_categories: update.tier2?.product_categories,
                device_class: update.tier2?.device_class,
                impact_type: update.tier3?.impact_type,
              },
              portfolio,
            });

            const scored: ScoredMessage = {
              ...update,
              org_id: orgId,
              update_id: update.external_id,
              impact_score: scoreResult.impact_score,
              matched_product_categories: update.tier2?.product_categories ?? [],
            };

            await env.RADAR_NOTIFY_QUEUE.send(scored);
          } catch (orgErr) {
            logger.error(`[radar-score] Scoring failed for org ${orgId}:`, orgErr);
          }
        }

        msg.ack();
      } catch (err) {
        logger.error('[radar-score] Failed to process message:', err);
        msg.retry();
      }
    }
  },
};
