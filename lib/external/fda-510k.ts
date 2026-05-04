// @MX:ANCHOR: [AUTO] FDA 510(k) lookup — external integration point called by external-enrichment.ts.
// @MX:REASON: Public API boundary for openFDA 510(k) queries; fan_in includes enrichment, tests, and future batch jobs.
// @MX:SPEC: SPEC-REGULA-NETWORK-001 (REQ-EXT-001, REQ-EXT-002)

import { z } from 'zod';
import { withCache } from './cache';

const FDA_510K_BASE = 'https://api.fda.gov/device/510k.json';

// Zod schema for a single 510(k) result from openFDA.
const Fda510kResultSchema = z.object({
  k_number: z.string(),
  device_name: z.string(),
  applicant: z.string().optional().default(''),
  decision_date: z.string().optional().default(''),
  decision_description: z.string().optional().default(''),
  product_code: z.string().optional().default(''),
  device_class: z.string().optional().default(''),
  submission_type: z.string().optional().default(''),
});

export type Fda510kResult = z.infer<typeof Fda510kResultSchema>;

const FdaResponseSchema = z.object({
  results: z.array(Fda510kResultSchema).optional().default([]),
});

interface Lookup510kParams {
  deviceName?: string;
  productCode?: string;
  limit?: number;
}

/**
 * Exponential backoff retry with jitter for 429 and 5xx responses.
 * Max 3 attempts. Respects openFDA 4 req/s guideline via backoff.
 */
async function fetchWithRetry(url: string, maxAttempts = 3): Promise<Response> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    if (attempt > 0) {
      // Exponential backoff: 250ms, 500ms (plus jitter)
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

async function fetchFda510k(params: Lookup510kParams): Promise<Fda510kResult[]> {
  const { deviceName, productCode, limit = 10 } = params;

  // Return empty array when no searchable params provided.
  if (!deviceName && !productCode) return [];

  const searchTerms: string[] = [];
  if (productCode) searchTerms.push(`product_code:"${productCode}"`);
  if (deviceName) searchTerms.push(`device_name:"${deviceName}"`);

  const searchQuery = searchTerms.join('+AND+');
  const url = `${FDA_510K_BASE}?search=${encodeURIComponent(searchQuery)}&limit=${limit}`;

  try {
    const response = await fetchWithRetry(url);

    if (!response.ok) return [];

    const json = await response.json();
    const parsed = FdaResponseSchema.safeParse(json);

    if (!parsed.success) return [];

    return parsed.data.results;
  } catch {
    return [];
  }
}

/**
 * Looks up FDA 510(k) premarket notifications by device name or product code.
 * Returns an empty array when no params are provided or on any error.
 */
export async function lookup510k(params: Lookup510kParams): Promise<Fda510kResult[]> {
  if (!params.deviceName && !params.productCode) return [];

  return withCache(() => fetchFda510k(params), params, 'fda-510k');
}
