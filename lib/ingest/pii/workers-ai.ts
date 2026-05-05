// @MX:NOTE [AUTO] Layer 2 PII detection — Cloudflare Workers AI GLiNER model.
// @MX:SPEC SPEC-REGULA-DOCINGEST-001 (REQ-DOC-027)
// Returns empty array if CF_WORKERS_AI_TOKEN is not set (CI safe mode).
import { logger } from '@/lib/observability/logger';

/** A detected PII span in the input text. */
export interface PIISpan {
  entity: string;
  start: number;
  end: number;
  text: string;
  score: number;
}

const ENTITY_TYPES = [
  'PERSON',
  'DATE',
  'LOCATION',
  'ORGANIZATION',
  'MEDICAL_RECORD_NUMBER',
  'HEALTH_PLAN_NUMBER',
  'LICENSE_NUMBER',
];

/**
 * Detect PII entities using Cloudflare Workers AI GLiNER model.
 * Returns empty array when CF_WORKERS_AI_TOKEN is not set (CI safe).
 */
export async function detectPiiWorkersAi(text: string): Promise<PIISpan[]> {
  const token = process.env.CF_WORKERS_AI_TOKEN;
  const accountId = process.env.CF_ACCOUNT_ID;

  if (!token || !accountId) {
    // CI safe: return no PII when credentials are absent
    return [];
  }

  const endpoint = `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/@cf/microsoft/piidetection-gliner-pii-base`;

  let response: Response;
  try {
    response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text, entity_types: ENTITY_TYPES }),
    });
  } catch {
    return [];
  }

  if (!response.ok) {
    logger.warn('[workers-ai] PII detection failed:', { status: response.status });
    return [];
  }

  let data: {
    result?: Array<{ entity: string; score: number; start: number; end: number; word: string }>;
  };
  try {
    data = (await response.json()) as typeof data;
  } catch {
    return [];
  }

  return (data.result ?? []).map((item) => ({
    entity: item.entity,
    start: item.start,
    end: item.end,
    text: item.word,
    score: item.score,
  }));
}
