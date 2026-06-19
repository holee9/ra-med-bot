import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/env', () => ({
  getEnv: () => ({
    REGULA_API_KEY: 'regula-secret',
    CRAWL_PUSH_SECRET: 'crawl-secret',
  }),
}));

const auditRoute = await import('@/app/api/webhooks/audit/route');
const ifuRoute = await import('@/app/api/webhooks/ifu/route');
const knowledgeSyncRoute = await import('@/app/api/webhooks/knowledge-sync/route');

function post(path: string, headers: Record<string, string>, body: string) {
  return new Request(`http://localhost${path}`, {
    method: 'POST',
    headers,
    body,
  });
}

describe('inbound webhook routes', () => {
  it('rejects audit webhook requests with invalid JSON as 400', async () => {
    const res = await auditRoute.POST(
      post('/api/webhooks/audit', { 'x-regula-api-key': 'regula-secret' }, '{invalid'),
    );

    expect(res.status).toBe(400);
  });

  it('rejects IFU webhook requests with invalid JSON as 400', async () => {
    const res = await ifuRoute.POST(
      post('/api/webhooks/ifu', { 'x-regula-api-key': 'regula-secret' }, '{invalid'),
    );

    expect(res.status).toBe(400);
  });

  it('rejects knowledge sync webhook requests with invalid JSON as 400', async () => {
    const res = await knowledgeSyncRoute.POST(
      post('/api/webhooks/knowledge-sync', { 'x-crawl-push-secret': 'crawl-secret' }, '{invalid'),
    );

    expect(res.status).toBe(400);
  });

  it('rejects requests with invalid webhook secrets', async () => {
    const res = await auditRoute.POST(
      post('/api/webhooks/audit', { 'x-regula-api-key': 'wrong-secret' }, '{}'),
    );

    expect(res.status).toBe(401);
  });
});
