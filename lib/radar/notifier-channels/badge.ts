// Dashboard badge channel — stores unread high-impact count in KV.
// @MX:SPEC SPEC-REGULA-RADAR-001

/**
 * Set the unread radar badge count for an org.
 * In production: writes to Cloudflare KV (BADGE_KV binding).
 * In dev/test: writes to module-level in-memory store.
 */

// In-memory fallback for dev/test environments
const badgeStore = new Map<string, number>();

/**
 * KV interface — injected in production via Cloudflare Worker env.
 * Kept as a module-level optional to allow server-side usage without Workers runtime.
 */
let kvNamespace: { put(key: string, value: string): Promise<void> } | null = null;

export function setBadgeKV(kv: { put(key: string, value: string): Promise<void> }): void {
  kvNamespace = kv;
}

export async function setBadge(orgId: string, count: number): Promise<void> {
  const key = `badge:${orgId}`;

  if (kvNamespace) {
    await kvNamespace.put(key, String(count));
  } else {
    badgeStore.set(key, count);
  }
}

export async function getBadge(orgId: string): Promise<number> {
  const key = `badge:${orgId}`;
  if (kvNamespace) {
    // KV get not exposed here — caller uses their own env binding
    return badgeStore.get(key) ?? 0;
  }
  return badgeStore.get(key) ?? 0;
}

export function clearBadgeStore(): void {
  badgeStore.clear();
}
