// @MX:NOTE [AUTO] Layer 3 PII detection — Microsoft Presidio external service.
// @MX:SPEC SPEC-REGULA-DOCINGEST-001 (REQ-DOC-028)
// Returns empty array if PRESIDIO_URL is not set (CI safe mode).
import { logger } from '@/lib/observability/logger';
import type { PIISpan } from './workers-ai';

/**
 * Detect PII entities using Microsoft Presidio analyzer service.
 * Returns empty array when PRESIDIO_URL is not set (CI safe).
 */
export async function detectPiiPresidio(text: string): Promise<PIISpan[]> {
  const presidioUrl = process.env.PRESIDIO_URL;

  if (!presidioUrl) {
    // CI safe: return no PII when Presidio is not configured
    return [];
  }

  let response: Response;
  try {
    response = await fetch(`${presidioUrl}/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text,
        language: 'en',
        entities: [
          'PERSON',
          'DATE_TIME',
          'LOCATION',
          'ORGANIZATION',
          'US_SSN',
          'US_ITIN',
          'MEDICAL_LICENSE',
          'NRP',
        ],
      }),
    });
  } catch {
    return [];
  }

  if (!response.ok) {
    logger.warn('[presidio] PII detection failed:', { status: response.status });
    return [];
  }

  let data: Array<{ entity_type: string; start: number; end: number; score: number }>;
  try {
    data = (await response.json()) as typeof data;
  } catch {
    return [];
  }

  return data.map((item) => ({
    entity: item.entity_type,
    start: item.start,
    end: item.end,
    text: text.slice(item.start, item.end),
    score: item.score,
  }));
}
