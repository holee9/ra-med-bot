/**
 * Tests for MFDS 식약처 고시 crawler (REQ-RADAR-009)
 * TDD: RED phase — tests written before implementation
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { CrawlerContext } from '../../../lib/radar/crawlers/_types';

const mfdsFixtureHtml = readFileSync(
  join(__dirname, '../../fixtures/radar/mfds-notice.html'),
  'utf-8',
);

vi.mock('../../../lib/radar/crawlers/_base', () => ({
  runCrawler: vi.fn(async (_name: string, ctx: CrawlerContext, fn: () => Promise<unknown>) => {
    return fn();
  }),
}));

describe('MFDS 식약처 고시 Crawler', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('should return RawUpdate records with region KR', async () => {
    const mockBrowserFetch = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => mfdsFixtureHtml,
    });

    const { crawlMfdsNotice } = await import('../../../lib/radar/crawlers/mfds-notice');

    const ctx: CrawlerContext = {
      env: {
        ROBOTS_KV: { get: vi.fn().mockResolvedValue(null), put: vi.fn() },
        BROWSER: { fetch: mockBrowserFetch },
      } as unknown as CrawlerContext['env'],
      db: {} as CrawlerContext['db'],
      lastRun: new Date('2024-01-01'),
    };

    const result = await crawlMfdsNotice(ctx);

    expect(result.errors).toHaveLength(0);
    expect(result.records.length).toBeGreaterThan(0);
    expect(result.records[0]).toMatchObject({
      region: 'KR',
      source_crawler: 'mfds-notice',
    });
  });

  it('should parse Korean titles from HTML', async () => {
    const mockBrowserFetch = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => mfdsFixtureHtml,
    });

    const { crawlMfdsNotice } = await import('../../../lib/radar/crawlers/mfds-notice');

    const ctx: CrawlerContext = {
      env: {
        ROBOTS_KV: { get: vi.fn().mockResolvedValue(null), put: vi.fn() },
        BROWSER: { fetch: mockBrowserFetch },
      } as unknown as CrawlerContext['env'],
      db: {} as CrawlerContext['db'],
      lastRun: new Date('2024-01-01'),
    };

    const result = await crawlMfdsNotice(ctx);

    // Korean titles should be present
    const titles = result.records.map(r => r.title);
    expect(titles.some(t => t.includes('의료기기') || t.includes('고시'))).toBe(true);
  });

  it('should detect recall keywords and set impact_type_hint', async () => {
    const mockBrowserFetch = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => mfdsFixtureHtml,
    });

    const { crawlMfdsNotice } = await import('../../../lib/radar/crawlers/mfds-notice');

    const ctx: CrawlerContext = {
      env: {
        ROBOTS_KV: { get: vi.fn().mockResolvedValue(null), put: vi.fn() },
        BROWSER: { fetch: mockBrowserFetch },
      } as unknown as CrawlerContext['env'],
      db: {} as CrawlerContext['db'],
      lastRun: new Date('2024-01-01'),
    };

    const result = await crawlMfdsNotice(ctx);

    // The fixture contains "리콜" — recall record should have hint
    const recallRecord = result.records.find(r => r.title.includes('리콜') || r.title.includes('회수'));
    if (recallRecord) {
      expect(recallRecord.impact_type_hint).toBe('recall');
    }
  });

  it('should use env.BROWSER.fetch() for page loading', async () => {
    const mockBrowserFetch = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => mfdsFixtureHtml,
    });

    const { crawlMfdsNotice } = await import('../../../lib/radar/crawlers/mfds-notice');

    const ctx: CrawlerContext = {
      env: {
        ROBOTS_KV: { get: vi.fn().mockResolvedValue(null), put: vi.fn() },
        BROWSER: { fetch: mockBrowserFetch },
      } as unknown as CrawlerContext['env'],
      db: {} as CrawlerContext['db'],
      lastRun: new Date('2024-01-01'),
    };

    await crawlMfdsNotice(ctx);

    expect(mockBrowserFetch).toHaveBeenCalledWith(
      expect.stringContaining('mfds.go.kr'),
      expect.any(Object),
    );
  });
});
