// In-app toast notification channel — queues pending toast IDs in KV.
// Client polls GET /api/ra/radar/notifications to retrieve queued toasts.
// @MX:SPEC SPEC-REGULA-RADAR-001

// In-memory fallback for dev/test environments
const toastStore = new Map<string, string[]>();

let kvNamespace: {
  get(key: string): Promise<string | null>;
  put(key: string, value: string): Promise<void>;
} | null = null;

export function setToastKV(kv: {
  get(key: string): Promise<string | null>;
  put(key: string, value: string): Promise<void>;
}): void {
  kvNamespace = kv;
}

/**
 * Queue an update ID as a pending in-app toast for the given org.
 * Writes to KV key `toast:{orgId}` as a JSON array of update IDs.
 */
export async function queueToast(orgId: string, updateId: string): Promise<void> {
  const key = `toast:${orgId}`;

  if (kvNamespace) {
    const existing = await kvNamespace.get(key);
    const ids: string[] = existing ? (JSON.parse(existing) as string[]) : [];
    if (!ids.includes(updateId)) ids.push(updateId);
    await kvNamespace.put(key, JSON.stringify(ids));
  } else {
    const ids = toastStore.get(key) ?? [];
    if (!ids.includes(updateId)) ids.push(updateId);
    toastStore.set(key, ids);
  }
}

/** Get pending toast update IDs for an org (for polling endpoint). */
export async function getPendingToasts(orgId: string): Promise<string[]> {
  const key = `toast:${orgId}`;

  if (kvNamespace) {
    const val = await kvNamespace.get(key);
    return val ? (JSON.parse(val) as string[]) : [];
  }

  return toastStore.get(key) ?? [];
}

/** Clear toasts after acknowledgement. */
export async function clearToasts(orgId: string): Promise<void> {
  const key = `toast:${orgId}`;

  if (kvNamespace) {
    await kvNamespace.put(key, JSON.stringify([]));
  } else {
    toastStore.delete(key);
  }
}

export function clearToastStore(): void {
  toastStore.clear();
}
