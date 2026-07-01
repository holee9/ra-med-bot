// @MX:ANCHOR [AUTO] 3-tier LLM classifier for regulatory update relevance.
// @MX:REASON Called by radar-classify-consumer worker and classifyUpdate pipeline.
// fan_in >= 3 expected (worker, tests, relevance-scorer).
// @MX:SPEC SPEC-REGULA-RADAR-001 (REQ-RADAR-004..009)

import { getLlmFastModel } from '@/lib/ai/llm-provider';
import { generateText } from 'ai';
import {
  TIER1_SYSTEM_PROMPT,
  TIER2_SYSTEM_PROMPT,
  TIER3_SYSTEM_PROMPT,
} from './classifier-prompts';
import {
  type Tier1Result,
  Tier1Schema,
  type Tier2Result,
  Tier2Schema,
  type Tier3Result,
  Tier3Schema,
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
 * Shared tier call: runs the fast model with a tier-specific system prompt
 * and returns the raw text output. Throws on empty response.
 */
async function runTier(
  systemPrompt: string,
  input: RawUpdateInput,
  tierName: string,
): Promise<string> {
  const response = await generateText({
    model: getLlmFastModel(),
    maxTokens: 256,
    system: systemPrompt,
    messages: [
      {
        role: 'user',
        content: `Title: ${input.title}\n\nContent excerpt: ${(input.raw_content ?? '').slice(0, 500)}`,
      },
    ],
  });

  const text = response.text?.trim() ?? '';
  if (!text) {
    throw new Error(`Unexpected response type from ${tierName} classifier`);
  }
  return text;
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

  const rawText = await runTier(TIER1_SYSTEM_PROMPT, input, 'Tier 1');

  const parsed = Tier1Schema.parse(JSON.parse(rawText));

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
  const rawText = await runTier(TIER2_SYSTEM_PROMPT, input, 'Tier 2');
  return Tier2Schema.parse(JSON.parse(rawText));
}

/**
 * Tier 3: Impact type classification (guidance/recall/legislation/etc.)
 * Only called when Tier 1 returns relevant=true.
 */
export async function classifyTier3(input: RawUpdateInput): Promise<Tier3Result> {
  const rawText = await runTier(TIER3_SYSTEM_PROMPT, input, 'Tier 3');
  return Tier3Schema.parse(JSON.parse(rawText));
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
