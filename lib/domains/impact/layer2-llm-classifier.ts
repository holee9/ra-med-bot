// SPEC-V3-IMPACT-001 M4: LLM-based change category classification.
// @MX:ANCHOR [AUTO] LLM classifier for impact categorization.
// @MX:REASON Called by Layer 4 RAG and API route orchestration. fan_in >= 2.
// @MX:SPEC SPEC-V3-IMPACT-001 (AC-IMP-06)

import { getLlmModel } from '@/lib/ai/llm-provider';
import { generateText } from 'ai';

export interface ClassificationResult {
  category: string;
  confidence: number;
  reason: string;
}

// Categories MUST match retest-matrix-data.ts changeTypes (7 categories)
const ALLOWED_CATEGORIES = [
  'bom',
  'sw',
  'sw-minor',
  'label',
  'warn',
  'process',
  'sterile',
];

const MAX_RETRIES = 3;

/**
 * Classifies a regulatory change detail into a category using LLM.
 * Uses Vercel AI SDK generateText with gx10 gpt-oss:120b model.
 * Implements retry logic (×3) on failure.
 */
export async function classifyChangeCategory(
  changeDetail: string,
): Promise<ClassificationResult> {
  const prompt = `Classify the following regulatory change detail into one of these categories: ${ALLOWED_CATEGORIES.join(', ')}.

Change detail: "${changeDetail}"

Respond in JSON format:
{
  "category": "category_name",
  "confidence": 0.0-1.0,
  "reason": "brief explanation"
}`;

  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const { text } = await generateText({
        model: getLlmModel(),
        prompt,
      });

      const parsed = JSON.parse(text.trim());

      // Validate category
      if (!ALLOWED_CATEGORIES.includes(parsed.category)) {
        return {
          category: 'error',
          confidence: 0,
          reason: `Invalid category: ${parsed.category}. Must be one of: ${ALLOWED_CATEGORIES.join(', ')}`,
        };
      }

      return {
        category: parsed.category,
        confidence: parsed.confidence || 0,
        reason: parsed.reason || 'No reason provided',
      };
    } catch (error) {
      lastError = error as Error;
      // Fall through to retry (loop continues)
    }
  }

  // All retries exhausted
  return {
    category: 'error',
    confidence: 0,
    reason: `Failed after ${MAX_RETRIES} retries: ${lastError?.message || 'Unknown error'}`,
  };
}
