// @MX:NOTE [AUTO] KV-backed sliding-window rate limiter for Cloudflare Workers.
// @MX:SPEC SPEC-REGULA-CLOUDFLARE-001 (REQ-CF-035)
//
// Key pattern: ratelimit:<endpoint>:<userId>:<windowStart>
// Each window stores a counter; TTL = windowSeconds ensures automatic cleanup.

export interface KVRateLimiterOptions {
  /** Maximum requests allowed per window */
  limit: number;
  /** Window duration in seconds */
  windowSeconds: number;
}

export interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  /** Unix timestamp (ms) when the current window resets */
  reset: number;
}

export interface KVRateLimiter {
  limit(endpoint: string, userId: string): Promise<RateLimitResult>;
}

/**
 * Factory that creates a sliding-window rate limiter backed by Workers KV.
 *
 * @param kv - The RATELIMIT_KV namespace binding from CloudflareEnv
 * @param opts - Rate limit options (limit + windowSeconds)
 */
export function createKVRateLimiter(
  kv: KVNamespace,
  opts: KVRateLimiterOptions,
): KVRateLimiter {
  const { limit, windowSeconds } = opts;

  return {
    async limit(endpoint: string, userId: string): Promise<RateLimitResult> {
      const nowMs = Date.now();
      const windowStart = Math.floor(nowMs / 1000 / windowSeconds);
      const resetMs = (windowStart + 1) * windowSeconds * 1000;

      // Key pattern: ratelimit:<endpoint>:<userId>:<windowStart>
      const key = `ratelimit:${endpoint}:${userId}:${windowStart}`;

      const raw = await kv.get(key);
      const current = raw ? Number.parseInt(raw, 10) : 0;

      if (current >= limit) {
        return { success: false, limit, remaining: 0, reset: resetMs };
      }

      const next = current + 1;
      await kv.put(key, String(next), { expirationTtl: windowSeconds * 2 });

      return {
        success: true,
        limit,
        remaining: limit - next,
        reset: resetMs,
      };
    },
  };
}
