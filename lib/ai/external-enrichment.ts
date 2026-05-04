// @MX:ANCHOR: [AUTO] External data enrichment entry point — called by consult.ts before Phase C sources.
// @MX:REASON: Central fan_in point for all external API enrichment; consult.ts, tests, and future scheduled jobs all call this.
// @MX:SPEC: SPEC-REGULA-NETWORK-001 (REQ-EXT-003, REQ-EXT-006, REQ-EXT-010)

import type { SourceItem } from '../../types/streaming';
import { lookupDevice } from '../external/eudamed';
import { lookup510k } from '../external/fda-510k';
import { searchAdverseEvents } from '../external/fda-maude';
import type { Intent } from './intent';

// Regex patterns for query classification (REQ-EXT-003, 006, 010).
const REGEX_510K = /510\(k\)|predicate|device name|product code/i;
const REGEX_MAUDE = /adverse event|MAUDE|safety|recall|malfunction/i;
const REGEX_EUDAMED = /CE marking|Eudamed|UDI|EU registration|BASIC-UDI/i;

/**
 * Enriches a chat answer with external public data citations.
 * Silently swallows all errors — never propagates to break the chat flow.
 *
 * Returns up to 3 SourceItem entries per matching data source.
 */
export async function enrichWithExternalData(
  _intent: Intent,
  question: string,
): Promise<SourceItem[]> {
  const items: SourceItem[] = [];

  try {
    const enrichments = await Promise.allSettled([
      enrich510k(question),
      enrichMaude(question),
      enrichEudamed(question),
    ]);

    let citeIndex = 9000; // Start at high index to avoid collisions with RAG citations.

    for (const result of enrichments) {
      if (result.status === 'fulfilled') {
        for (const item of result.value) {
          items.push({ ...item, citeIndex: citeIndex++ });
        }
      }
      // rejected → silently swallow (graceful degradation)
    }
  } catch {
    // Top-level safety net — never let enrichment break the consult pipeline.
  }

  return items;
}

async function enrich510k(question: string): Promise<SourceItem[]> {
  if (!REGEX_510K.test(question)) return [];

  try {
    // Extract product code from question if present, else fall back to device name fragment.
    const productCodeMatch = question.match(/\b([A-Z]{2,3})\b/);
    const params = productCodeMatch
      ? { productCode: productCodeMatch[1], limit: 3 }
      : { deviceName: extractDeviceNameHint(question), limit: 3 };

    const results = await lookup510k(params);
    return results.slice(0, 3).map((r) => ({
      id: `fda-510k-${r.k_number}`,
      citeIndex: 0, // Will be overwritten by caller.
      orgLabel: 'FDA 510(k) Database',
      title: `${r.device_name} — ${r.k_number}`,
      year: r.decision_date ? Number.parseInt(r.decision_date.slice(0, 4), 10) : null,
      type: 'Guidance' as const,
      url: `https://www.accessdata.fda.gov/scripts/cdrh/cfdocs/cfpmn/pmn.cfm?ID=${r.k_number}`,
      anchor: r.k_number,
      offset: 0,
    }));
  } catch {
    return [];
  }
}

async function enrichMaude(question: string): Promise<SourceItem[]> {
  if (!REGEX_MAUDE.test(question)) return [];

  try {
    const productCodeMatch = question.match(/\b([A-Z]{2,3})\b/);
    const params = productCodeMatch ? { productCode: productCodeMatch[1], limit: 3 } : { limit: 3 };

    const results = await searchAdverseEvents(params);
    return results.slice(0, 3).map((r) => ({
      id: `fda-maude-${r.report_number}`,
      citeIndex: 0,
      orgLabel: 'FDA MAUDE Database',
      title: `${r.device_name || 'Device'} — ${r.event_type} (${r.report_number})`,
      year: r.date_received ? Number.parseInt(r.date_received.slice(0, 4), 10) : null,
      type: 'Industry' as const,
      url: `https://www.accessdata.fda.gov/scripts/cdrh/cfdocs/cfmaude/detail.cfm?mdrfoi__id=${r.report_number}`,
      anchor: r.report_number,
      offset: 0,
    }));
  } catch {
    return [];
  }
}

async function enrichEudamed(question: string): Promise<SourceItem[]> {
  if (!REGEX_EUDAMED.test(question)) return [];

  try {
    // Look for BASIC-UDI-DI pattern in question.
    const udiMatch = question.match(/\b([A-Z0-9]{8,20})\b/);
    const params = udiMatch
      ? { basicUdiDi: udiMatch[1], limit: 3 }
      : { deviceName: extractDeviceNameHint(question), limit: 3 };

    const results = await lookupDevice(params);
    return results.slice(0, 3).map((r) => ({
      id: `eudamed-${r.basicUdiDi || r.deviceName}`,
      citeIndex: 0,
      orgLabel: 'EU Eudamed Database',
      title: `${r.deviceName} — ${r.riskClass} (${r.country})`,
      year: null,
      type: 'Regulation' as const,
      url: `https://ec.europa.eu/tools/eudamed/#/screen/search-device?deviceBasicUdi=${encodeURIComponent(r.basicUdiDi)}`,
      anchor: r.basicUdiDi,
      offset: 0,
    }));
  } catch {
    return [];
  }
}

/** Extracts a short device name hint from a question for search fallback. */
function extractDeviceNameHint(question: string): string {
  // Take first 40 chars of question as a broad hint.
  return question.slice(0, 40).trim();
}
