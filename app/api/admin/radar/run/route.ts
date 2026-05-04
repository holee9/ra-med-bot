// POST /api/admin/radar/run — manual crawler trigger (admin only).
// @MX:SPEC SPEC-REGULA-RADAR-001

import { z } from 'zod';
import { withPermission } from '../../../../../lib/auth/with-permission';
import { runCrawler } from '../../../../../lib/radar/crawlers/_base';
import { crawlFdaFederalRegister } from '../../../../../lib/radar/crawlers/fda-federal-register';
import { crawlEuOj } from '../../../../../lib/radar/crawlers/eu-oj';
import { crawlMfdsNotice } from '../../../../../lib/radar/crawlers/mfds-notice';
import { writeAudit } from '../../../../../lib/audit';
import { db } from '../../../../../lib/db/client';
import type { CrawlerContext } from '../../../../../lib/radar/crawlers/_types';

const RunSchema = z.object({
  crawler: z.enum(['fda-federal-register', 'eu-oj', 'mfds-notice']),
});

type CrawlerFn = (ctx: CrawlerContext) => Promise<{ records: unknown[]; errors: Error[] }>;

const CRAWLERS: Record<string, CrawlerFn> = {
  'fda-federal-register': crawlFdaFederalRegister as CrawlerFn,
  'eu-oj': crawlEuOj as CrawlerFn,
  'mfds-notice': crawlMfdsNotice as CrawlerFn,
};

export const POST = withPermission(
  'dashboard.view',
  async (req, _ctx, session) => {
    if (session.user.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    const body = await req.json() as unknown;
    const parsed = RunSchema.safeParse(body);

    if (!parsed.success) {
      return Response.json({ error: 'Invalid crawler name' }, { status: 422 });
    }

    const { crawler } = parsed.data;
    const crawlerFn = CRAWLERS[crawler];

    if (!crawlerFn) {
      return Response.json({ error: 'Unknown crawler' }, { status: 400 });
    }

    const stubCtx: CrawlerContext = {
      env: {
        ROBOTS_KV: {
          get: async () => null,
          put: async () => undefined,
        },
      },
      db,
      lastRun: new Date(Date.now() - 24 * 60 * 60 * 1000),
    };

    let result: { records: unknown[]; errors: Error[] };
    try {
      result = await runCrawler(crawler, stubCtx, crawlerFn as Parameters<typeof runCrawler>[2]);
    } catch (err) {
      return Response.json({ error: String(err) }, { status: 500 });
    }

    await writeAudit({
      actor_id: session.user.id,
      action: 'radar.crawler_run',
      resource_type: 'crawler',
      resource_id: crawler,
      meta_json: { records_added: result.records.length, errors: result.errors.length },
    });

    return Response.json({
      crawler,
      records_added: result.records.length,
      errors: result.errors.map((e) => e.message),
    });
  },
);
