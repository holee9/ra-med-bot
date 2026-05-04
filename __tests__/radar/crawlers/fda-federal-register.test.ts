/**
 * Tests for FDA Federal Register crawler (REQ-RADAR-004)
 * TDD: RED phase — tests written before implementation
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { CrawlerContext, CrawlerResult } from '../../../lib/radar/crawlers/_types';

// Load fixture
const fdaFixture = JSON.parse(
  readFileSync(join(__dirname, '../../fixtures/radar/fda-federal-register.json'), 'utf-8'),
);

// We mock fetch to return fixture data
const mockFetch = vi.fn();

vi.mock('../../../lib/radar/crawlers/_base', () => ({
  runCrawler: vi.fn(async (_name: string, ctx: CrawlerContext, fn: () => Promise<CrawlerResult>) => {
    return fn();
  }),
}));

describe('FDA Federal Register Crawler', () => {
  beforeEach(() => {
    mockFetch.mockReset();
    vi.stubGlobal('fetch', mockFetch);
  });

  it('should return RawUpdate records from Federal Register API', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => fdaFixture,
    });

    const { crawlFdaFederalRegister } = await import(
      '../../../lib/radar/crawlers/fda-federal-register'
    );

    const ctx: CrawlerContext = {
      env: { ROBOTS_KV: { get: vi.fn().mockResolvedValue(null), put: vi.fn() } } as unknown as CrawlerContext['env'],
      db: {} as CrawlerContext['db'],
      lastRun: new Date('2024-01-01'),
    };

    const result = await crawlFdaFederalRegister(ctx);

    expect(result.errors).toHaveLength(0);
    expect(result.records).toHaveLength(2);
    expect(result.records[0]).toMatchObject({
      external_id: '2024-01234',
      title: expect.stringContaining('Software as a Medical Device'),
      region: 'US',
      source_crawler: 'fda-federal-register',
      source_url: expect.stringContaining('federalregister.gov'),
    });
    expect(result.records[0].published_at).toBeInstanceOf(Date);
  });

  it('should include correct User-Agent header in requests', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ count: 0, results: [] }),
    });

    const { crawlFdaFederalRegister } = await import(
      '../../../lib/radar/crawlers/fda-federal-register'
    );

    const ctx: CrawlerContext = {
      env: { ROBOTS_KV: { get: vi.fn().mockResolvedValue(null), put: vi.fn() } } as unknown as CrawlerContext['env'],
      db: {} as CrawlerContext['db'],
      lastRun: new Date('2024-01-01'),
    };

    await crawlFdaFederalRegister(ctx);

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('federalregister.gov'),
      expect.objectContaining({
        headers: expect.objectContaining({
          'User-Agent': 'Regula-Radar/1.0 (+https://regula.app/crawlers; contact=compliance@regula.app)',
        }),
      }),
    );
  });

  it('should use lastRun date as publication_date filter', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ count: 0, results: [] }),
    });

    const { crawlFdaFederalRegister } = await import(
      '../../../lib/radar/crawlers/fda-federal-register'
    );

    const lastRun = new Date('2024-01-10');
    const ctx: CrawlerContext = {
      env: { ROBOTS_KV: { get: vi.fn().mockResolvedValue(null), put: vi.fn() } } as unknown as CrawlerContext['env'],
      db: {} as CrawlerContext['db'],
      lastRun,
    };

    await crawlFdaFederalRegister(ctx);

    const calledUrl = mockFetch.mock.calls[0][0] as string;
    expect(calledUrl).toContain('2024-01-10');
  });

  it('should return errors when API returns non-ok response', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 503,
    });

    const { crawlFdaFederalRegister } = await import(
      '../../../lib/radar/crawlers/fda-federal-register'
    );

    const ctx: CrawlerContext = {
      env: { ROBOTS_KV: { get: vi.fn().mockResolvedValue(null), put: vi.fn() } } as unknown as CrawlerContext['env'],
      db: {} as CrawlerContext['db'],
      lastRun: new Date('2024-01-01'),
    };

    const result = await crawlFdaFederalRegister(ctx);
    expect(result.errors).toHaveLength(1);
    expect(result.records).toHaveLength(0);
  });
});
