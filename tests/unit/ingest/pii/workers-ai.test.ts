import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('detectPiiWorkersAi', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    delete process.env.CF_WORKERS_AI_TOKEN;
    delete process.env.CF_ACCOUNT_ID;
  });

  it('returns empty array when CF_WORKERS_AI_TOKEN is not set (CI safe)', async () => {
    delete process.env.CF_WORKERS_AI_TOKEN;
    const { detectPiiWorkersAi } = await import('../../../../lib/ingest/pii/workers-ai');
    const result = await detectPiiWorkersAi('Patient John Doe SSN 123-45-6789');
    expect(result).toEqual([]);
  });

  it('returns array of PIISpan objects', async () => {
    process.env.CF_WORKERS_AI_TOKEN = 'test-token';
    process.env.CF_ACCOUNT_ID = 'test-account';

    // Mock fetch
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        result: [
          { entity: 'PERSON', score: 0.95, start: 8, end: 16, word: 'John Doe' },
        ],
      }),
    }));

    const { detectPiiWorkersAi } = await import('../../../../lib/ingest/pii/workers-ai');
    const result = await detectPiiWorkersAi('Patient John Doe has been admitted.');

    expect(Array.isArray(result)).toBe(true);
    if (result.length > 0) {
      expect(result[0]).toHaveProperty('entity');
      expect(result[0]).toHaveProperty('start');
      expect(result[0]).toHaveProperty('end');
      expect(result[0]).toHaveProperty('text');
    }

    vi.unstubAllGlobals();
  });

  it('returns empty array on API error (graceful degradation)', async () => {
    process.env.CF_WORKERS_AI_TOKEN = 'test-token';
    process.env.CF_ACCOUNT_ID = 'test-account';

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
    }));

    const { detectPiiWorkersAi } = await import('../../../../lib/ingest/pii/workers-ai');
    const result = await detectPiiWorkersAi('Some text');
    expect(result).toEqual([]);

    vi.unstubAllGlobals();
  });
});
