// REQ-RADAR-007: EU Official Journal / EUR-Lex crawler
// @MX:SPEC SPEC-REGULA-RADAR-001 (REQ-RADAR-007)

import { runCrawler, RADAR_USER_AGENT, fetchWithRetry } from './_base';
import type { CrawlerContext, CrawlerResult, RawUpdate } from './_types';

// EUR-Lex REST API endpoint
const EURLEX_BASE = 'https://eur-lex.europa.eu/search-result/api/json';

// MDR/IVDR relevant keywords for filtering
const MDR_IVDR_KEYWORDS = [
  'medical device',
  'MDR',
  'IVDR',
  '2017/745',
  '2017/746',
  'in vitro diagnostic',
  'dispositif médical',
  'Medizinprodukt',
];

interface EurLexDocument {
  id: string;
  title: string;
  date: string;
  url: string;
  content?: string;
}

interface EurLexApiResponse {
  results?: {
    result?: EurLexDocument[];
  };
}

function isMdrIvdrRelevant(doc: EurLexDocument): boolean {
  const text = `${doc.title} ${doc.content ?? ''}`.toLowerCase();
  return MDR_IVDR_KEYWORDS.some(kw => text.toLowerCase().includes(kw.toLowerCase()));
}

/**
 * Crawl EU Official Journal / EUR-Lex for MDR/IVDR legislative documents.
 * Uses sector=3 (legislation) filter and MDR/IVDR keyword filtering.
 */
export async function crawlEuOj(ctx: CrawlerContext): Promise<CrawlerResult> {
  return runCrawler('eu-oj', ctx, async (ctx) => {
    const lastRunDate = ctx.lastRun.toISOString().split('T')[0];

    const params = new URLSearchParams({
      sector: '3', // legislation sector
      type: 'regulation,decision',
      date_from: lastRunDate,
      language: 'EN',
      page_size: '50',
    });

    const url = `${EURLEX_BASE}?${params.toString()}`;

    let resp: Response;
    try {
      resp = await fetchWithRetry(url, {
        headers: {
          'User-Agent': RADAR_USER_AGENT,
          Accept: 'application/json',
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
        errors: [new Error(`EUR-Lex API returned HTTP ${resp.status}`)],
      };
    }

    let data: EurLexApiResponse;
    try {
      data = (await resp.json()) as EurLexApiResponse;
    } catch (err) {
      return {
        records: [],
        errors: [new Error('Failed to parse EUR-Lex API response')],
      };
    }

    const allDocs = data.results?.result ?? [];

    // Filter for MDR/IVDR relevance
    const relevantDocs = allDocs.filter(isMdrIvdrRelevant);

    const records: RawUpdate[] = relevantDocs.map((doc): RawUpdate => ({
      external_id: doc.id,
      title: doc.title,
      published_at: new Date(doc.date),
      source_url: doc.url,
      raw_content: doc.content ?? doc.title,
      region: 'EU',
      source_crawler: 'eu-oj',
    }));

    return { records, errors: [] };
  });
}
