// @MX:ANCHOR [AUTO] Webhook authentication tests
// @MX:REASON Verify timing-safe compare prevents timing attacks and correctly validates API keys
// @MX:SPEC Issue #188 (hybrid-ra-saas inbound webhook)

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from '../route';
import { getEnv } from '@/lib/env';

// Mock timing-safe module
vi.mock('@/lib/webauth/timing-safe', () => ({
  timingSafeEqual: vi.fn(),
}));

// Mock env module
vi.mock('@/lib/env', () => ({
  getEnv: vi.fn(),
}));

import { timingSafeEqual } from '@/lib/webauth/timing-safe';

describe('POST /api/webhooks/ifu', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return 401 when X-Regula-API-Key header is missing', async () => {
    vi.mocked(getEnv).mockReturnValue({
      REGULA_API_KEY: 'test-key',
    } as Awaited<ReturnType<typeof getEnv>>);

    const req = new Request('http://localhost:3000/api/webhooks/ifu', {
      method: 'POST',
      body: JSON.stringify({
        tenant_id: 'test',
        job_id: 'test',
        doc_id: 'test',
        doc_type: 'test',
        confidence: 0.9,
        field_candidates: {},
        required_missing: [],
      }),
    });

    const response = await POST(req);
    expect(response.status).toBe(401);
    expect(await response.text()).toBe('Unauthorized');
  });

  it('should return 401 when REGULA_API_KEY is not configured', async () => {
    vi.mocked(getEnv).mockReturnValue({} as Awaited<ReturnType<typeof getEnv>>);

    const req = new Request('http://localhost:3000/api/webhooks/ifu', {
      method: 'POST',
      headers: {
        'X-Regula-API-Key': 'test-key',
      },
      body: JSON.stringify({
        tenant_id: 'test',
        job_id: 'test',
        doc_id: 'test',
        doc_type: 'test',
        confidence: 0.9,
        field_candidates: {},
        required_missing: [],
      }),
    });

    const response = await POST(req);
    expect(response.status).toBe(401);
    expect(await response.text()).toBe('Unauthorized');
  });

  it('should return 401 when API key does not match (timing-safe compare)', async () => {
    vi.mocked(getEnv).mockReturnValue({
      REGULA_API_KEY: 'correct-key',
    } as Awaited<ReturnType<typeof getEnv>>);
    vi.mocked(timingSafeEqual).mockReturnValue(false);

    const req = new Request('http://localhost:3000/api/webhooks/ifu', {
      method: 'POST',
      headers: {
        'X-Regula-API-Key': 'wrong-key',
      },
      body: JSON.stringify({
        tenant_id: 'test',
        job_id: 'test',
        doc_id: 'test',
        doc_type: 'test',
        confidence: 0.9,
        field_candidates: {},
        required_missing: [],
      }),
    });

    const response = await POST(req);
    expect(response.status).toBe(401);
    expect(await response.text()).toBe('Unauthorized');
  });

  it('should return 202 when authentication succeeds', async () => {
    vi.mocked(getEnv).mockReturnValue({
      REGULA_API_KEY: 'correct-key',
    } as Awaited<ReturnType<typeof getEnv>>);
    vi.mocked(timingSafeEqual).mockReturnValue(true);

    const req = new Request('http://localhost:3000/api/webhooks/ifu', {
      method: 'POST',
      headers: {
        'X-Regula-API-Key': 'correct-key',
      },
      body: JSON.stringify({
        tenant_id: 'tenant-123',
        job_id: 'job-456',
        doc_id: 'doc-789',
        doc_type: 'ifu',
        confidence: 0.95,
        field_candidates: { section1: 'value1' },
        required_missing: [],
      }),
    });

    const response = await POST(req);
    expect(response.status).toBe(202);
  });

  it('should return 400 for invalid JSON', async () => {
    vi.mocked(getEnv).mockReturnValue({
      REGULA_API_KEY: 'correct-key',
    } as Awaited<ReturnType<typeof getEnv>>);
    vi.mocked(timingSafeEqual).mockReturnValue(true);

    const req = new Request('http://localhost:3000/api/webhooks/ifu', {
      method: 'POST',
      headers: {
        'X-Regula-API-Key': 'correct-key',
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
      REGULA_API_KEY: 'correct-key',
    } as Awaited<ReturnType<typeof getEnv>>);
    vi.mocked(timingSafeEqual).mockReturnValue(true);

    const req = new Request('http://localhost:3000/api/webhooks/ifu', {
      method: 'POST',
      headers: {
        'X-Regula-API-Key': 'correct-key',
      },
      body: JSON.stringify({ invalid_field: 'test' }),
    });

    const response = await POST(req);
    expect(response.status).toBe(400);
    const json = await response.json();
    expect(json).toHaveProperty('error', 'Invalid payload');
    expect(json).toHaveProperty('issues');
  });
});
