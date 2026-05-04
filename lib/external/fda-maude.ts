// @MX:ANCHOR: [AUTO] FDA MAUDE adverse event search — external integration point called by external-enrichment.ts.
// @MX:REASON: Public API boundary for openFDA adverse event queries; fan_in includes enrichment, tests, and future analytics.
// @MX:SPEC: SPEC-REGULA-NETWORK-001 (REQ-EXT-004, REQ-EXT-005)

import { z } from 'zod';
import { withCache } from './cache';

const FDA_MAUDE_BASE = 'https://api.fda.gov/device/event.json';

// Schema for individual MDR text entry.
const MdrTextSchema = z.object({
  text: z.string().optional().default(''),
});

// Schema for device info embedded in a MAUDE event.
const MaudeDeviceSchema = z.object({
  device_class: z.string().optional().default(''),
  brand_name: z.string().optional().default(''),
  product_code: z.string().optional().default(''),
});

// Zod schema for a single MAUDE adverse event.
const MaudeEventSchema = z.object({
  report_number: z.string(),
  date_received: z.string().optional().default(''),
  device: z.array(MaudeDeviceSchema).optional().default([]),
  event_type: z.string().optional().default(''),
  mdr_text: z.array(MdrTextSchema).optional().default([]),
});

// Flattened output type after processing.
export interface MaudeEvent {
  report_number: string;
  date_received: string;
  device_class: string;
  device_name: string;
  event_type: string;
  product_code: string;
  mdr_text: Array<{ text: string }>;
}

const MaudeResponseSchema = z.object({
  results: z.array(MaudeEventSchema).optional().default([]),
});

interface SearchAdverseEventsParams {
  productCode?: string;
  deviceClass?: string;
  limit?: number;
  dateFrom?: string;
}

function getDefaultDateFrom(): string {
  const d = new Date();
  d.setFullYear(d.getFullYear() - 2);
  return d.toISOString().slice(0, 10).replace(/-/g, '');
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

async function fetchMaudeEvents(params: SearchAdverseEventsParams): Promise<MaudeEvent[]> {
  const { productCode, deviceClass, limit = 5, dateFrom = getDefaultDateFrom() } = params;

  const searchTerms: string[] = [];
  if (productCode) searchTerms.push(`device.product_code:"${productCode}"`);
  if (deviceClass) searchTerms.push(`device.device_class:"${deviceClass}"`);
  if (dateFrom) searchTerms.push(`date_received:[${dateFrom}+TO+9999-12-31]`);

  const searchQuery = searchTerms.join('+AND+');
  const url = `${FDA_MAUDE_BASE}?search=${encodeURIComponent(searchQuery)}&limit=${limit}`;

  try {
    const response = await fetchWithRetry(url);

    if (!response.ok) return [];

    const json = await response.json();
    const parsed = MaudeResponseSchema.safeParse(json);

    if (!parsed.success) return [];

    return parsed.data.results.slice(0, limit).map((event) => {
      const firstDevice = event.device[0];
      return {
        report_number: event.report_number,
        date_received: event.date_received,
        device_class: firstDevice?.device_class ?? '',
        device_name: firstDevice?.brand_name ?? '',
        event_type: event.event_type,
        product_code: firstDevice?.product_code ?? '',
        // Cap mdr_text at 2 entries per REQ-EXT-004.
        mdr_text: event.mdr_text.slice(0, 2).map((t) => ({ text: t.text })),
      };
    });
  } catch {
    return [];
  }
}

/**
 * Searches FDA MAUDE adverse event reports by product code, device class, and date range.
 * Defaults to limit=5 and dateFrom=2 years ago.
 * Returns empty array on any error.
 */
export async function searchAdverseEvents(
  params: SearchAdverseEventsParams,
): Promise<MaudeEvent[]> {
  return withCache(() => fetchMaudeEvents(params), params, 'fda-maude');
}
