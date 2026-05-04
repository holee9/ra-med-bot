// REQ-RADAR-004: FDA Federal Register crawler
// @MX:SPEC SPEC-REGULA-RADAR-001 (REQ-RADAR-004)

import { RADAR_USER_AGENT, fetchWithRetry, runCrawler } from './_base';
import type { CrawlerContext, CrawlerResult, RawUpdate } from './_types';

const FEDERAL_REGISTER_BASE = 'https://www.federalregister.gov/api/v1/documents.json';

interface FRDocument {
  document_number: string;
  title: string;
  publication_date: string;
  html_url: string;
  abstract?: string;
}

interface FRApiResponse {
  count: number;
  results: FRDocument[];
}

/**
 * Crawl FDA Federal Register for medical device related documents.
 * Filters by FDA agency and uses lastRun date as publication_date[gte] filter.
 */
export async function crawlFdaFederalRegister(ctx: CrawlerContext): Promise<CrawlerResult> {
  return runCrawler('fda-federal-register', ctx, async () => {
    const lastRunDate = ctx.lastRun.toISOString().slice(0, 10); // YYYY-MM-DD

    const params = new URLSearchParams({
      'conditions[agencies][]': 'food-and-drug-administration',
      'conditions[publication_date][gte]': lastRunDate,
      per_page: '100',
      order: 'newest',
    });

    const url = `${FEDERAL_REGISTER_BASE}?${params.toString()}`;

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
        errors: [new Error(`FDA Federal Register API returned HTTP ${resp.status}`)],
      };
    }

    let data: FRApiResponse;
    try {
      data = (await resp.json()) as FRApiResponse;
    } catch {
      return {
        records: [],
        errors: [new Error('Failed to parse FDA Federal Register API response')],
      };
    }

    const records: RawUpdate[] = (data.results ?? []).map(
      (doc): RawUpdate => ({
        external_id: doc.document_number,
        title: doc.title,
        published_at: new Date(doc.publication_date),
        source_url: doc.html_url,
        raw_content: doc.abstract ?? doc.title,
        region: 'US',
        source_crawler: 'fda-federal-register',
      }),
    );

    return { records, errors: [] };
  });
}
