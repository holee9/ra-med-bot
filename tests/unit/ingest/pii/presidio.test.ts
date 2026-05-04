import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('detectPiiPresidio', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    Reflect.deleteProperty(process.env, 'PRESIDIO_URL');
  });

  it('returns empty array when PRESIDIO_URL is not set (CI safe)', async () => {
    Reflect.deleteProperty(process.env, 'PRESIDIO_URL');
    const { detectPiiPresidio } = await import('../../../../lib/ingest/pii/presidio');
    const result = await detectPiiPresidio('Patient SSN 123-45-6789');
    expect(result).toEqual([]);
  });

  it('returns PIISpan array from Presidio response', async () => {
    process.env.PRESIDIO_URL = 'http://localhost:5002';

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve([
            { entity_type: 'PERSON', start: 0, end: 7, score: 0.85 },
            { entity_type: 'US_SSN', start: 15, end: 26, score: 0.99 },
          ]),
      }),
    );

    const { detectPiiPresidio } = await import('../../../../lib/ingest/pii/presidio');
    const result = await detectPiiPresidio('Patient with SSN 123-45-6789');

    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBe(2);
    expect(result[0]).toHaveProperty('entity');
    expect(result[0]).toHaveProperty('start');
    expect(result[0]).toHaveProperty('end');
    expect(result[0]).toHaveProperty('text');

    vi.unstubAllGlobals();
  });

  it('returns empty array on HTTP error (graceful degradation)', async () => {
    process.env.PRESIDIO_URL = 'http://localhost:5002';

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 503,
      }),
    );

    const { detectPiiPresidio } = await import('../../../../lib/ingest/pii/presidio');
    const result = await detectPiiPresidio('Some text');
    expect(result).toEqual([]);

    vi.unstubAllGlobals();
  });
});
