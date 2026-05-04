// @MX:ANCHOR: [AUTO] Eudamed device lookup — external integration point called by external-enrichment.ts.
// @MX:REASON: Public API boundary for EU Eudamed queries; fan_in includes enrichment, tests, and future compliance checks.
// @MX:SPEC: SPEC-REGULA-NETWORK-001 (REQ-EXT-007, REQ-EXT-008)

import { z } from 'zod';
import { withCache } from './cache';

const EUDAMED_BASE = 'https://ec.europa.eu/tools/eudamed/api/';

// Zod schema for a single Eudamed device record.
const EudamedDeviceSchema = z.object({
  basicUdiDi: z.string().optional().default(''),
  deviceName: z.string().optional().default(''),
  riskClass: z.string().optional().default(''),
  intendedPurpose: z.string().optional().default(''),
  certificateStatus: z.string().optional().default(''),
  notifiedBody: z.string().optional().default(''),
  country: z.string().optional().default(''),
});

export type EudamedDevice = z.infer<typeof EudamedDeviceSchema>;

const EudamedResponseSchema = z.object({
  data: z.array(EudamedDeviceSchema).optional().default([]),
});

interface LookupDeviceParams {
  basicUdiDi?: string;
  deviceName?: string;
  limit?: number;
}

/**
 * Exponential backoff retry with jitter for 429 and 5xx responses.
 */
async function fetchWithRetry(url: string, maxAttempts = 3): Promise<Response> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    if (attempt > 0) {
      const baseDelay = 250 * 2 ** (attempt - 1);
      const jitter = Math.floor(Math.random() * 100);
      await new Promise((resolve) => setTimeout(resolve, baseDelay + jitter));
    }

    const response = await fetch(url);

    if (response.status === 429 || response.status >= 500) {
      lastError = new Error(`HTTP ${response.status}`);
      continue;
    }

    return response;
  }

  throw lastError ?? new Error('Max retry attempts reached');
}

async function fetchEudamedDevices(params: LookupDeviceParams): Promise<EudamedDevice[]> {
  const { basicUdiDi, deviceName, limit = 10 } = params;
  const resolvedDeviceName = deviceName ?? '';

  if (!basicUdiDi && !resolvedDeviceName) return [];

  let url: string;

  // basicUdiDi takes precedence over deviceName (REQ-EXT-007).
  if (basicUdiDi) {
    url = `${EUDAMED_BASE}udi/devices?basicUdiDi=${encodeURIComponent(basicUdiDi)}&size=${limit}`;
  } else {
    const encodedDeviceName = encodeURIComponent(resolvedDeviceName);
    url = `${EUDAMED_BASE}udi/devices?deviceName=${encodedDeviceName}&size=${limit}`;
  }

  try {
    const response = await fetchWithRetry(url);

    if (!response.ok) return [];

    const json = await response.json();
    const parsed = EudamedResponseSchema.safeParse(json);

    if (!parsed.success) return [];

    return parsed.data.data;
  } catch {
    // Network error → return empty array (typed error, no throw per REQ-EXT-008).
    return [];
  }
}

/**
 * Looks up EU Eudamed medical device registry by UDI-DI or device name.
 * basicUdiDi takes precedence when both params are provided.
 * Returns empty array on network error or missing params — never throws.
 */
export async function lookupDevice(params: LookupDeviceParams): Promise<EudamedDevice[]> {
  if (!params.basicUdiDi && !params.deviceName) return [];

  return withCache(() => fetchEudamedDevices(params), params, 'eudamed');
}
