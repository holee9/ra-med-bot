// SPEC-V3-IMPACT-001 M4: LLM-based change category classification.
// @MX:ANCHOR [AUTO] LLM classifier for impact categorization.
// @MX:REASON Called by Layer 4 RAG and API route orchestration. fan_in >= 2.
// @MX:SPEC SPEC-V3-IMPACT-001 (AC-IMP-06)

import { getLlmModel } from '@/lib/ai/llm-provider';

export interface ClassificationResult {
  category: string;
  confidence: number;
  reason: string;
}

const ALLOWED_CATEGORIES = [
  'labeling',
  'software',
  'clinical',
  'cybersecurity',
  'qms',
  'bom',
  'process',
];

const MAX_RETRIES = 3;

/**
 * Classifies a regulatory change detail into a category using LLM.
 * Uses gx10 Ollama via getLlmModel() with gpt-oss:120b model.
 * Implements retry logic (×3) on failure.
 */
export async function classifyChangeCategory(
  changeDetail: string,
): Promise<ClassificationResult> {
  const llm = getLlmModel('gpt-oss:120b');

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
      const response = await llm.complete(prompt);
      const parsed = JSON.parse(response.text);

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
      // Retry on failure
      continue;
    }
  }

  // All retries exhausted
  return {
    category: 'error',
    confidence: 0,
    reason: `Failed after ${MAX_RETRIES} retries: ${lastError?.message || 'Unknown error'}`,
  };
}
