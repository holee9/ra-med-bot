// @MX:ANCHOR [AUTO] Anthropic SDK client singleton with Zero Data Retention.
// @MX:REASON Called by structured-blocks.ts and any future LLM pipeline that
// must guarantee PHI/PII is not retained by Anthropic. fan_in >= 3 expected
// as every consult pathway will migrate to this shared client.
// @MX:SPEC SPEC-REGULA-LAUNCH-001 (REQ-LAUNCH-035)

import Anthropic from '@anthropic-ai/sdk';

/**
 * Shared Anthropic SDK client configured for Zero Data Retention (ZDR).
 *
 * The `anthropic-beta: "zero-data-retention"` header instructs Anthropic's API
 * to discard request and response data after the API call completes — no prompt
 * or completion is stored on Anthropic infrastructure. Required by REQ-LAUNCH-035
 * for any endpoint that processes patient or regulatory data.
 *
 * Usage: import { anthropicClient } from '@/lib/ai/anthropic-client';
 *        const client = anthropicClient();
 */
export function anthropicClient(): Anthropic {
  return new Anthropic({
    defaultHeaders: {
      'anthropic-beta': 'zero-data-retention',
    },
  });
}

/**
 * Pre-constructed singleton for hot paths where creating a new client object
 * per request would add unnecessary GC pressure. Use this in route handlers
 * and streaming pipelines.
 */
export const sharedAnthropicClient: Anthropic = anthropicClient();
