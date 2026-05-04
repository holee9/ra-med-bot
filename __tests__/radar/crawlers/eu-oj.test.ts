/**
 * Tests for EU Official Journal / EUR-Lex crawler (REQ-RADAR-007)
 * TDD: RED phase — tests written before implementation
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { CrawlerContext } from '../../../lib/radar/crawlers/_types';

const euOjFixture = JSON.parse(
  readFileSync(join(__dirname, '../../fixtures/radar/eu-oj.json'), 'utf-8'),
);

const mockFetch = vi.fn();

vi.mock('../../../lib/radar/crawlers/_base', () => ({
  runCrawler: vi.fn(async (_name: string, ctx: CrawlerContext, fn: () => Promise<unknown>) => {
    return fn();
  }),
}));

describe('EU Official Journal / EUR-Lex Crawler', () => {
  beforeEach(() => {
    mockFetch.mockReset();
    vi.stubGlobal('fetch', mockFetch);
  });

  it('should return RawUpdate records with region EU', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => euOjFixture,
    });

    const { crawlEuOj } = await import('../../../lib/radar/crawlers/eu-oj');

    const ctx: CrawlerContext = {
      env: { ROBOTS_KV: { get: vi.fn().mockResolvedValue(null), put: vi.fn() } } as unknown as CrawlerContext['env'],
      db: {} as CrawlerContext['db'],
      lastRun: new Date('2024-01-01'),
    };

    const result = await crawlEuOj(ctx);

    expect(result.errors).toHaveLength(0);
    expect(result.records).toHaveLength(2);
    expect(result.records[0]).toMatchObject({
      region: 'EU',
      source_crawler: 'eu-oj',
      external_id: expect.stringContaining('32024R'),
    });
  });

  it('should filter for MDR/IVDR relevant documents', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => euOjFixture,
    });

    const { crawlEuOj } = await import('../../../lib/radar/crawlers/eu-oj');

    const ctx: CrawlerContext = {
      env: { ROBOTS_KV: { get: vi.fn().mockResolvedValue(null), put: vi.fn() } } as unknown as CrawlerContext['env'],
      db: {} as CrawlerContext['db'],
      lastRun: new Date('2024-01-01'),
    };

    const result = await crawlEuOj(ctx);
    // Both fixtures contain MDR/IVDR related content
    expect(result.records.length).toBeGreaterThan(0);
    result.records.forEach(record => {
      expect(record.region).toBe('EU');
      expect(record.source_crawler).toBe('eu-oj');
    });
  });

  it('should use sector=3 (legislation) in API request', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ results: { result: [] } }),
    });

    const { crawlEuOj } = await import('../../../lib/radar/crawlers/eu-oj');

    const ctx: CrawlerContext = {
      env: { ROBOTS_KV: { get: vi.fn().mockResolvedValue(null), put: vi.fn() } } as unknown as CrawlerContext['env'],
      db: {} as CrawlerContext['db'],
      lastRun: new Date('2024-01-01'),
    };

    await crawlEuOj(ctx);

    const calledUrl = mockFetch.mock.calls[0][0] as string;
    expect(calledUrl).toContain('sector=3');
  });
});
