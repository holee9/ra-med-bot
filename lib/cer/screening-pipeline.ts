// @MX:ANCHOR [AUTO] Screening pipeline — LLM-based title/abstract relevance filter.
// @MX:REASON Called per-batch in literature search; manages rate limits and token budgets.
// @MX:SPEC REQ-CLINLIT-011~014

import { generateObject } from 'ai';
import { z } from 'zod';
import { getLlmModel } from '../ai/llm-provider';
import type { PicoFramework } from './pico-generator';
import type { PubMedArticle } from './pubmed-client';

export interface ScreeningResult {
  pmid: string;
  decision: 'include' | 'exclude' | 'uncertain';
  reason: string;
}

const BATCH_SIZE = 10;

const ScreeningBatchSchema = z.object({
  decisions: z.array(
    z.object({
      pmid: z.string(),
      decision: z.enum(['include', 'exclude', 'uncertain']),
      reason: z.string(),
    }),
  ),
});

function buildBatchPrompt(
  articles: PubMedArticle[],
  pico: PicoFramework,
  deviceDescription: string,
): string {
  const articleList = articles
    .map(
      (a, i) =>
        `[${i + 1}] PMID: ${a.pmid}\nTitle: ${a.title}\nAbstract: ${a.abstract?.slice(0, 500) ?? 'N/A'}`,
    )
    .join('\n\n');

  return `You are a systematic review screener for an EU MDR Clinical Evaluation Report (CER).

Device: ${deviceDescription}

PICO Framework:
- Population: ${pico.patient}
- Intervention: ${pico.intervention}
- Comparator: ${pico.comparator ?? 'N/A'}
- Outcome: ${pico.outcome}

Screen the following articles based on their title and abstract. For each article, decide:
- include: directly relevant to device safety/performance for the PICO population
- exclude: clearly irrelevant (different device type, population, or outcome)
- uncertain: insufficient information to decide; would need full-text review

Articles:
${articleList}

Return a JSON object with a "decisions" array containing one entry per article with pmid, decision, and reason fields.`;
}

/**
 * Screen articles in batches of 10 using the main LLM model.
 *
 * Returns include/exclude/uncertain decisions with brief reasoning.
 * In E2E_TEST_MODE, returns deterministic mock decisions.
 */
export async function screenArticles(
  articles: PubMedArticle[],
  picoFramework: PicoFramework,
  deviceDescription: string,
): Promise<ScreeningResult[]> {
  if (articles.length === 0) return [];

  // E2E_TEST_MODE: return deterministic mock without LLM call.
  const isE2EMode = process.env.E2E_TEST_MODE === 'true' && process.env.NODE_ENV !== 'production';
  if (isE2EMode) {
    return articles.map((a, i) => ({
      pmid: a.pmid,
      decision: i % 3 === 0 ? 'exclude' : ('include' as 'include' | 'exclude' | 'uncertain'),
      reason: i % 3 === 0 ? 'E2E mock: excluded' : 'E2E mock: included as relevant',
    }));
  }

  const model = getLlmModel();
  const results: ScreeningResult[] = [];

  // Process in batches of BATCH_SIZE to manage token limits.
  for (let offset = 0; offset < articles.length; offset += BATCH_SIZE) {
    const batch = articles.slice(offset, offset + BATCH_SIZE);
    const prompt = buildBatchPrompt(batch, picoFramework, deviceDescription);

    try {
      const result = await generateObject({
        model,
        schema: ScreeningBatchSchema,
        prompt,
      });

      for (const decision of result.object.decisions) {
        results.push({
          pmid: decision.pmid,
          decision: decision.decision,
          reason: decision.reason,
        });
      }
    } catch (err) {
      // On LLM failure for a batch, mark all articles as uncertain.
      console.error('[screening-pipeline] batch screening failed:', err);
      for (const article of batch) {
        results.push({
          pmid: article.pmid,
          decision: 'uncertain',
          reason: 'Screening error — manual review required.',
        });
      }
    }
  }

  return results;
}
