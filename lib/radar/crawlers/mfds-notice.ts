// REQ-RADAR-009: MFDS 식약처 고시 crawler (Browser Rendering API)
// @MX:SPEC SPEC-REGULA-RADAR-001 (REQ-RADAR-009)

import { runCrawler, RADAR_USER_AGENT } from './_base';
import type { CrawlerContext, CrawlerResult, RawUpdate } from './_types';

const MFDS_BASE_URL = 'https://www.mfds.go.kr/brd/m_99';

/** Korean/Chinese/Japanese recall keywords that trigger forced relevance */
const RECALL_KEYWORDS = ['리콜', '회수', '回收', 'リコール', 'recall'];

function detectImpactTypeHint(text: string): string | undefined {
  const lower = text.toLowerCase();
  if (RECALL_KEYWORDS.some(kw => text.includes(kw) || lower.includes(kw.toLowerCase()))) {
    return 'recall';
  }
  return undefined;
}

/**
 * Simple HTML parser to extract notice list items.
 * Uses regex since we don't have DOM access in Workers.
 */
function parseNoticeListFromHtml(html: string): Array<{ title: string; href: string; date: string }> {
  const notices: Array<{ title: string; href: string; date: string }> = [];

  // Match table rows in the notice list
  const rowPattern = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  const tdPattern = /<td[^>]*class="subject"[^>]*>[\s\S]*?<a[^>]*href="([^"]*)"[^>]*>\s*([\s\S]*?)\s*<\/a>/i;
  const datePattern = /<td[^>]*class="date"[^>]*>([^<]*)<\/td>/i;

  let rowMatch: RegExpExecArray | null;
  while ((rowMatch = rowPattern.exec(html)) !== null) {
    const rowHtml = rowMatch[1];
    const subjectMatch = tdPattern.exec(rowHtml);
    const dateMatch = datePattern.exec(rowHtml);

    if (subjectMatch) {
      const href = subjectMatch[1];
      // Strip HTML tags from title
      const titleRaw = subjectMatch[2].replace(/<[^>]+>/g, '').trim();
      const date = dateMatch ? dateMatch[1].trim() : new Date().toISOString().split('T')[0];

      if (titleRaw.length > 0) {
        notices.push({ title: titleRaw, href, date });
      }
    }
  }

  return notices;
}

/**
 * Crawl MFDS (식약처) official notices using Cloudflare Browser Rendering API.
 * Uses env.BROWSER.fetch() to load the JavaScript-rendered page.
 */
export async function crawlMfdsNotice(ctx: CrawlerContext): Promise<CrawlerResult> {
  return runCrawler('mfds-notice', ctx, async (ctx) => {
    const browser = ctx.env.BROWSER;
    if (!browser) {
      return {
        records: [],
        errors: [new Error('BROWSER binding not available in CrawlerContext')],
      };
    }

    let resp: Response;
    try {
      resp = await browser.fetch(MFDS_BASE_URL, {
        headers: {
          'User-Agent': RADAR_USER_AGENT,
          'Accept-Language': 'ko-KR,ko;q=0.9,en;q=0.8',
        },
      });
    } catch (err) {
      return {
        records: [],
        errors: [err instanceof Error ? err : new Error(String(err))],
      };
    }

    if (!resp.ok) {
      return {
        records: [],
        errors: [new Error(`MFDS page returned HTTP ${resp.status}`)],
      };
    }

    let html: string;
    try {
      html = await resp.text();
    } catch (err) {
      return {
        records: [],
        errors: [new Error('Failed to read MFDS page content')],
      };
    }

    const notices = parseNoticeListFromHtml(html);
    const lastRun = ctx.lastRun;

    const records: RawUpdate[] = notices
      .filter(n => {
        // Filter notices published after lastRun
        const noticeDate = new Date(n.date);
        return noticeDate >= lastRun;
      })
      .map((n): RawUpdate => {
        const sourceUrl = n.href.startsWith('http')
          ? n.href
          : `https://www.mfds.go.kr${n.href}`;

        const impactHint = detectImpactTypeHint(n.title);

        return {
          external_id: `mfds-${n.href.replace(/[^a-zA-Z0-9]/g, '-')}`,
          title: n.title,
          published_at: new Date(n.date),
          source_url: sourceUrl,
          raw_content: n.title,
          region: 'KR',
          source_crawler: 'mfds-notice',
          ...(impactHint ? { impact_type_hint: impactHint } : {}),
        };
      });

    return { records, errors: [] };
  });
}
