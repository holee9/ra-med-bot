// Radar Notify Consumer — dispatches notifications based on impact score thresholds.
// @MX:SPEC SPEC-REGULA-RADAR-001

import { notifyUpdate } from '../lib/radar/notifier';

interface ScoredMessage {
  external_id: string;
  title: string;
  region: string;
  source_crawler: string;
  org_id: string;
  update_id: string;
  impact_score: number;
  matched_product_categories: string[];
  tier3?: { impact_type?: string };
  source_url?: string;
}

interface Env {
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

async function getOrgSettings(_orgId: string): Promise<{
  email_digest_enabled: boolean;
  slack_webhook_url: string | null;
}> {
  return { email_digest_enabled: true, slack_webhook_url: null };
}

export default {
  async queue(batch: MessageBatch<ScoredMessage>, _env: Env): Promise<void> {
    for (const msg of batch.messages) {
      try {
        const scored = msg.body;

        if (scored.impact_score < 0.7) {
          msg.ack();
          continue;
        }

        const orgSettings = await getOrgSettings(scored.org_id);

        await notifyUpdate(
          scored.org_id,
          scored.update_id,
          scored.impact_score,
          {
            id: scored.update_id,
            title: scored.title,
            region: scored.region,
            impact_score: scored.impact_score,
            impact_type: scored.tier3?.impact_type,
            source_url: scored.source_url ?? null,
          },
          orgSettings,
        );

        msg.ack();
      } catch (err) {
        console.error('[radar-notify] Failed to notify for message:', err);
        msg.retry();
      }
    }
  },
};
