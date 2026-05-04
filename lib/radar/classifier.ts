// @MX:ANCHOR [AUTO] 3-tier LLM classifier for regulatory update relevance.
// @MX:REASON Called by radar-classify-consumer worker and classifyUpdate pipeline.
// fan_in >= 3 expected (worker, tests, relevance-scorer).
// @MX:SPEC SPEC-REGULA-RADAR-001 (REQ-RADAR-004..009)

import { sharedAnthropicClient } from '@/lib/ai/anthropic-client';
import {
  TIER1_SYSTEM_PROMPT,
  TIER2_SYSTEM_PROMPT,
  TIER3_SYSTEM_PROMPT,
} from './classifier-prompts';
import {
  Tier1Schema,
  Tier2Schema,
  Tier3Schema,
  type Tier1Result,
  type Tier2Result,
  type Tier3Result,
} from './classifier-schemas';

// Recall keywords that force tier1.relevant = true regardless of LLM output.
// @MX:NOTE Safety net: REQ-RADAR spec mandates recall keywords always surface.
const RECALL_KEYWORDS = ['recall', '리콜', '回收', 'リコール'];

function containsRecallKeyword(text: string): boolean {
  const lower = text.toLowerCase();
  return RECALL_KEYWORDS.some((kw) => lower.includes(kw.toLowerCase()));
}

export interface RawUpdateInput {
  title: string;
  raw_content?: string;
}

export interface Tier1ClassificationResult extends Tier1Result {
  forced_by_keyword?: boolean;
}

/**
 * Tier 1: Binary relevance check — is this document about medical devices?
 *
 * CRITICAL safety net: if title or raw_content contains recall keywords,
 * forces relevant=true regardless of LLM output.
 */
export async function classifyTier1(input: RawUpdateInput): Promise<Tier1ClassificationResult> {
  const combinedText = `${input.title}\n${input.raw_content ?? ''}`;
  const keywordMatch = containsRecallKeyword(combinedText);

  const response = await sharedAnthropicClient.messages.create({
    model: 'claude-haiku-4-5',
    max_tokens: 256,
    system: TIER1_SYSTEM_PROMPT,
    messages: [
      {
        role: 'user',
        content: `Title: ${input.title}\n\nContent excerpt: ${(input.raw_content ?? '').slice(0, 500)}`,
      },
    ],
  });

  const rawBlock = response.content[0];
  if (!rawBlock || rawBlock.type !== 'text') {
    throw new Error('Unexpected response type from Tier 1 classifier');
  }

  const parsed = Tier1Schema.parse(JSON.parse(rawBlock.text));

  if (keywordMatch && !parsed.relevant) {
    return { ...parsed, relevant: true, forced_by_keyword: true };
  }

  return parsed;
}

/**
 * Tier 2: Device class × product category classification.
 * Only called when Tier 1 returns relevant=true.
 */
export async function classifyTier2(input: RawUpdateInput): Promise<Tier2Result> {
  const response = await sharedAnthropicClient.messages.create({
    model: 'claude-haiku-4-5',
    max_tokens: 256,
    system: TIER2_SYSTEM_PROMPT,
    messages: [
      {
        role: 'user',
        content: `Title: ${input.title}\n\nContent excerpt: ${(input.raw_content ?? '').slice(0, 500)}`,
      },
    ],
  });

  const rawBlock = response.content[0];
  if (!rawBlock || rawBlock.type !== 'text') {
    throw new Error('Unexpected response type from Tier 2 classifier');
  }

  return Tier2Schema.parse(JSON.parse(rawBlock.text));
}

/**
 * Tier 3: Impact type classification (guidance/recall/legislation/etc.)
 * Only called when Tier 1 returns relevant=true.
 */
export async function classifyTier3(input: RawUpdateInput): Promise<Tier3Result> {
  const response = await sharedAnthropicClient.messages.create({
    model: 'claude-haiku-4-5',
    max_tokens: 256,
    system: TIER3_SYSTEM_PROMPT,
    messages: [
      {
        role: 'user',
        content: `Title: ${input.title}\n\nContent excerpt: ${(input.raw_content ?? '').slice(0, 500)}`,
      },
    ],
  });

  const rawBlock = response.content[0];
  if (!rawBlock || rawBlock.type !== 'text') {
    throw new Error('Unexpected response type from Tier 3 classifier');
  }

  return Tier3Schema.parse(JSON.parse(rawBlock.text));
}

export interface ClassificationResult {
  tier1: Tier1ClassificationResult;
  tier2?: Tier2Result;
  tier3?: Tier3Result;
}

/**
 * Full 3-tier classification pipeline.
 * Runs Tier 2 and Tier 3 only when Tier 1 returns relevant=true (cost optimization).
 */
export async function classifyUpdate(input: RawUpdateInput): Promise<ClassificationResult> {
  const tier1 = await classifyTier1(input);

  if (!tier1.relevant) {
    return { tier1 };
  }

  const [tier2, tier3] = await Promise.all([classifyTier2(input), classifyTier3(input)]);

  return { tier1, tier2, tier3 };
}
