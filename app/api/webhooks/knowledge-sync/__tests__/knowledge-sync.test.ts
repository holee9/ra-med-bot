// @MX:ANCHOR [AUTO] Webhook authentication tests
// @MX:REASON Verify timing-safe compare prevents timing attacks and correctly validates API keys
// @MX:SPEC Issue #188 (hybrid-ra-saas inbound webhook)

import { getEnv } from '@/lib/env';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { POST } from '../route';

// Mock timing-safe module
vi.mock('@/lib/webauth/timing-safe', () => ({
  timingSafeEqual: vi.fn(),
}));

// Mock env module
vi.mock('@/lib/env', () => ({
  getEnv: vi.fn(),
}));

import { timingSafeEqual } from '@/lib/webauth/timing-safe';

describe('POST /api/webhooks/knowledge-sync', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return 401 when X-Crawl-Push-Secret header is missing', async () => {
    vi.mocked(getEnv).mockReturnValue({
      CRAWL_PUSH_SECRET: 'test-secret',
    } as Awaited<ReturnType<typeof getEnv>>);

    const req = new Request('http://localhost:3000/api/webhooks/knowledge-sync', {
      method: 'POST',
      body: JSON.stringify({
        job_id: 'test',
        documents: [],
      }),
    });

    const response = await POST(req);
    expect(response.status).toBe(401);
    expect(await response.text()).toBe('Unauthorized');
  });

  it('should return 401 when CRAWL_PUSH_SECRET is not configured', async () => {
    vi.mocked(getEnv).mockReturnValue({} as Awaited<ReturnType<typeof getEnv>>);

    const req = new Request('http://localhost:3000/api/webhooks/knowledge-sync', {
      method: 'POST',
      headers: {
        'X-Crawl-Push-Secret': 'test-secret',
      },
      body: JSON.stringify({
        job_id: 'test',
        documents: [],
      }),
    });

    const response = await POST(req);
    expect(response.status).toBe(401);
    expect(await response.text()).toBe('Unauthorized');
  });

  it('should return 401 when secret does not match (timing-safe compare)', async () => {
    vi.mocked(getEnv).mockReturnValue({
      CRAWL_PUSH_SECRET: 'correct-secret',
    } as Awaited<ReturnType<typeof getEnv>>);
    vi.mocked(timingSafeEqual).mockReturnValue(false);

    const req = new Request('http://localhost:3000/api/webhooks/knowledge-sync', {
      method: 'POST',
      headers: {
        'X-Crawl-Push-Secret': 'wrong-secret',
      },
      body: JSON.stringify({
        job_id: 'test',
        documents: [],
      }),
    });

    const response = await POST(req);
    expect(response.status).toBe(401);
    expect(await response.text()).toBe('Unauthorized');
  });

  it('should return 200 when authentication succeeds', async () => {
    vi.mocked(getEnv).mockReturnValue({
      CRAWL_PUSH_SECRET: 'correct-secret',
    } as Awaited<ReturnType<typeof getEnv>>);
    vi.mocked(timingSafeEqual).mockReturnValue(true);

    const req = new Request('http://localhost:3000/api/webhooks/knowledge-sync', {
      method: 'POST',
      headers: {
        'X-Crawl-Push-Secret': 'correct-secret',
      },
      body: JSON.stringify({
        job_id: 'job-123',
        documents: [
          {
            id: 'doc-1',
            url: 'https://example.com/doc1',
            hash: 'abc123',
            source: 'fda',
            content: 'Document content',
          },
        ],
      }),
    });

    const response = await POST(req);
    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json).toEqual({ received: true });
  });

  it('should return 400 for invalid JSON', async () => {
    vi.mocked(getEnv).mockReturnValue({
      CRAWL_PUSH_SECRET: 'correct-secret',
    } as Awaited<ReturnType<typeof getEnv>>);
    vi.mocked(timingSafeEqual).mockReturnValue(true);

    const req = new Request('http://localhost:3000/api/webhooks/knowledge-sync', {
      method: 'POST',
      headers: {
        'X-Crawl-Push-Secret': 'correct-secret',
        'Content-Type': 'application/json',
      },
      body: 'invalid-json{',
    });

    const response = await POST(req);
    expect(response.status).toBe(400);
    const json = await response.json();
    expect(json).toHaveProperty('error', 'Invalid JSON');
  });

  it('should return 400 for invalid payload schema', async () => {
    vi.mocked(getEnv).mockReturnValue({
      CRAWL_PUSH_SECRET: 'correct-secret',
    } as Awaited<ReturnType<typeof getEnv>>);
    vi.mocked(timingSafeEqual).mockReturnValue(true);

    const req = new Request('http://localhost:3000/api/webhooks/knowledge-sync', {
      method: 'POST',
      headers: {
        'X-Crawl-Push-Secret': 'correct-secret',
      },
      body: JSON.stringify({ invalid_field: 'test' }),
    });

    const response = await POST(req);
    expect(response.status).toBe(400);
    const json = await response.json();
    expect(json).toHaveProperty('error', 'Invalid payload');
    expect(json).toHaveProperty('issues');
  });

  it('should validate document schema in array', async () => {
    vi.mocked(getEnv).mockReturnValue({
      CRAWL_PUSH_SECRET: 'correct-secret',
    } as Awaited<ReturnType<typeof getEnv>>);
    vi.mocked(timingSafeEqual).mockReturnValue(true);

    const req = new Request('http://localhost:3000/api/webhooks/knowledge-sync', {
      method: 'POST',
      headers: {
        'X-Crawl-Push-Secret': 'correct-secret',
      },
      body: JSON.stringify({
        job_id: 'job-123',
        documents: [
          {
            id: 'doc-1',
            url: 'not-a-valid-url', // Invalid URL
            hash: 'abc123',
            source: 'fda',
            content: 'Content',
          },
        ],
      }),
    });

    const response = await POST(req);
    expect(response.status).toBe(400);
    const json = await response.json();
    expect(json).toHaveProperty('error', 'Invalid payload');
  });
});
