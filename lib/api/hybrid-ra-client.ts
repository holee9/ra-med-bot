// @MX:NOTE [AUTO] Server-side HTTP client for hybrid-ra-saas integration.
// @MX:SPEC SPEC-INTEGRATION-001, Issue #156, Issue #170
// IMPORTANT: Never import this module from client components — it reads server-only env vars.

import { getEnv } from '@/lib/env';

export class HybridRaClientError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public endpoint: string,
  ) {
    super(message);
    this.name = 'HybridRaClientError';
  }
}

// @MX:ANCHOR [AUTO] createHybridRaFetch — entry point for all hybrid-ra-saas calls.
// @MX:REASON External system integration point: BFF proxy routes + future callers >= 3.
/**
 * Returns a typed fetch wrapper that injects Bearer + Tenant-ID headers.
 * Throws HybridRaClientError when hybrid-ra-saas is not configured or upstream returns non-2xx.
 */
export function createHybridRaFetch() {
  const env = getEnv();
  const baseUrl = env.HYBRID_RA_API_BASE_URL ?? '';
  const token = env.HYBRID_RA_API_TOKEN ?? '';
  const tenantId = env.HYBRID_RA_TENANT_ID ?? '';

  return async function hybridFetch(path: string, options: RequestInit = {}): Promise<Response> {
    if (!baseUrl || !token) {
      throw new HybridRaClientError('hybrid-ra-saas is not configured', 503, path);
    }
    const url = `${baseUrl}${path}`;
    const res = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        'X-Tenant-Id': tenantId,
        ...options.headers,
      },
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new HybridRaClientError(body || res.statusText, res.status, path);
    }
    return res;
  };
}
