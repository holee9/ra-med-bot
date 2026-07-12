// @vitest-environment node
// @MX:NOTE [AUTO] Execution tests for GET /api/locale (cookie-based locale switch).
// @MX:SPEC SPEC-REGULA-I18N-001

import { NextRequest } from 'next/server';
import { describe, expect, it } from 'vitest';

const { GET } = await import('@/app/api/locale/route');

function getReq(query: string): NextRequest {
  return new NextRequest(`http://localhost/api/locale?${query}`);
}

describe('GET /api/locale (cookie-based locale switch)', () => {
  it('returns 307 with en locale cookie + redirect to returnTo', async () => {
    const res = await GET(getReq('locale=en&returnTo=/dashboard'));
    expect(res.status).toBe(307);
    expect(res.headers.get('Location')).toBe('http://localhost/dashboard');
    const cookie = res.headers.get('Set-Cookie') ?? '';
    expect(cookie).toContain('regula-locale=en');
    expect(cookie).toContain('SameSite=Lax');
  });

  it('defaults to ko for a non-en locale param', async () => {
    const res = await GET(getReq('locale=ja&returnTo=/'));
    expect(res.status).toBe(307);
    expect(res.headers.get('Set-Cookie')).toContain('regula-locale=ko');
  });

  it('sanitizes a non-relative returnTo to /', async () => {
    const res = await GET(getReq('locale=en&returnTo=http://evil.example'));
    expect(res.headers.get('Location')).toBe('http://localhost/');
  });

  it('defaults returnTo to / when absent', async () => {
    const res = await GET(getReq('locale=en'));
    expect(res.headers.get('Location')).toBe('http://localhost/');
  });
});
