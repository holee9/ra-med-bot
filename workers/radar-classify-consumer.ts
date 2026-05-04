// Radar Classify Consumer — processes raw updates through 3-tier LLM classifier.
// @MX:SPEC SPEC-REGULA-RADAR-001

import { classifyUpdate } from '../lib/radar/classifier';

interface RawUpdateMessage {
  external_id: string;
  title: string;
  raw_content: string;
  region: string;
  source_crawler: string;
}

interface ClassifiedMessage extends RawUpdateMessage {
  tier1_relevant: boolean;
  tier2?: {
    device_class?: string;
    product_categories?: string[];
  };
  tier3?: {
    impact_type?: string;
  };
}

interface RadarScoreQueue {
  send(msg: ClassifiedMessage): Promise<void>;
}

interface Env {
  RADAR_SCORE_QUEUE: RadarScoreQueue;
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

export default {
  async queue(batch: MessageBatch<RawUpdateMessage>, env: Env): Promise<void> {
    for (const msg of batch.messages) {
      try {
        const update = msg.body;

        const classification = await classifyUpdate({
          title: update.title,
          raw_content: update.raw_content,
        });

        const classified: ClassifiedMessage = {
          ...update,
          tier1_relevant: classification.tier1.relevant,
          tier2: classification.tier2
            ? {
                device_class: classification.tier2.device_class,
                product_categories: classification.tier2.product_categories,
              }
            : undefined,
          tier3: classification.tier3
            ? { impact_type: classification.tier3.impact_type }
            : undefined,
        };

        await env.RADAR_SCORE_QUEUE.send(classified);
        msg.ack();
      } catch (err) {
        console.error('[radar-classify] Failed to classify message:', err);
        msg.retry();
      }
    }
  },
};
