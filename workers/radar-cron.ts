// Radar Cron Worker — dispatches 3 regulatory crawlers and seeds classify queue.
// @MX:SPEC SPEC-REGULA-RADAR-001
//
// Cron schedule (see wrangler.toml triggers):
//   18:15 UTC → FDA Federal Register
//   18:45 UTC → EU OJ
//   19:15 UTC → MFDS 고시
//   21:00 UTC → Post-processing pipeline

import { runCrawler } from '../lib/radar/crawlers/_base';
import type { CrawlerContext } from '../lib/radar/crawlers/_types';
import { crawlEuOj } from '../lib/radar/crawlers/eu-oj';
import { crawlFdaFederalRegister } from '../lib/radar/crawlers/fda-federal-register';
import { crawlMfdsNotice } from '../lib/radar/crawlers/mfds-notice';

interface RadarEnv {
  ROBOTS_KV: KVNamespace;
  RADAR_CLASSIFY_QUEUE: {
    send(msg: {
      external_id: string;
      title: string;
      raw_content: string;
      region: string;
      source_crawler: string;
    }): Promise<void>;
  };
  [key: string]: unknown;
}

interface KVNamespace {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>;
}

export default {
  async scheduled(event: { scheduledTime: number }, env: RadarEnv, _ctx: unknown): Promise<void> {
    const scheduledDate = new Date(event.scheduledTime);
    const hour = scheduledDate.getUTCHours();
    const minute = scheduledDate.getUTCMinutes();

    const baseCtx: CrawlerContext = {
      env: env as CrawlerContext['env'],
      db: null as unknown as CrawlerContext['db'],
      lastRun: new Date(Date.now() - 24 * 60 * 60 * 1000), // last 24h
    };

    let result:
      | {
          records: {
            external_id: string;
            title: string;
            raw_content: string;
            region: string;
            source_crawler: string;
          }[];
          errors: Error[];
        }
      | undefined;

    // Route by cron time
    if (hour === 18 && minute === 15) {
      result = await runCrawler('fda-federal-register', baseCtx, crawlFdaFederalRegister);
    } else if (hour === 18 && minute === 45) {
      result = await runCrawler('eu-oj', baseCtx, crawlEuOj);
    } else if (hour === 19 && minute === 15) {
      result = await runCrawler('mfds-notice', baseCtx, crawlMfdsNotice);
    } else if (hour === 21 && minute === 0) {
      return;
    } else {
      return;
    }

    if (!result) return;

    // Send raw records to classify queue in batches
    const BATCH_SIZE = 50;
    for (let i = 0; i < result.records.length; i += BATCH_SIZE) {
      const batch = result.records.slice(i, i + BATCH_SIZE);
      await Promise.all(
        batch.map((record) =>
          env.RADAR_CLASSIFY_QUEUE.send({
            external_id: record.external_id,
            title: record.title,
            raw_content: record.raw_content,
            region: record.region,
            source_crawler: record.source_crawler,
          }),
        ),
      );
    }
  },
};
