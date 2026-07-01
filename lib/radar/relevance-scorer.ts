// @MX:ANCHOR [AUTO] 2-step impact scorer for regulatory updates per org portfolio.
// @MX:REASON Called by radar-score-consumer worker and tests. fan_in >= 3.
// @MX:SPEC SPEC-REGULA-RADAR-001

import { getLlmFastModel } from '@/lib/ai/llm-provider';
import { generateText } from 'ai';
import type { OrgPortfolio } from './portfolio-loader';

export interface UpdateForScoring {
  region: string;
  product_categories?: string[];
  device_class?: string;
  impact_type?: string;
}

export interface ScoreResult {
  impact_score: number;
  reasoning?: string;
}

// Target market / region normalization map
const REGION_MAP: Record<string, string[]> = {
  US: ['US', 'FDA', 'UNITED STATES'],
  EU: ['EU', 'EEA', 'EUROPE', 'CE'],
  KR: ['KR', 'KOREA', 'MFDS', 'KFDA'],
  JP: ['JP', 'JAPAN', 'PMDA'],
  CN: ['CN', 'CHINA', 'NMPA', 'CFDA'],
};

function normalizeRegion(region: string): string {
  const upper = region.toUpperCase();
  for (const [key, aliases] of Object.entries(REGION_MAP)) {
    if (aliases.some((alias) => upper.includes(alias))) return key;
  }
  return upper;
}

function hasRegionOverlap(updateRegion: string, portfolioMarkets: string[]): boolean {
  if (!portfolioMarkets.length) return true; // no restriction = all markets
  const norm = normalizeRegion(updateRegion);
  return portfolioMarkets.some((m) => normalizeRegion(m) === norm);
}

function hasCategoryOverlap(
  updateCategories: string[] | undefined,
  portfolioCategories: string[],
): boolean {
  if (!portfolioCategories.length) return true; // no restriction = all categories
  if (!updateCategories?.length) return true; // no category info = pass through
  return updateCategories.some((uc) =>
    portfolioCategories.some(
      (pc) => pc.toLowerCase() === uc.toLowerCase() || uc.toLowerCase().includes(pc.toLowerCase()),
    ),
  );
}

/**
 * Step 1: Rule-based pre-filter.
 * Returns 0.0 if no region or category overlap with org portfolio.
 */
function ruleBasedFilter(update: UpdateForScoring, portfolio: OrgPortfolio): number | null {
  const regionOk = hasRegionOverlap(update.region, portfolio.target_markets);
  const categoryOk = hasCategoryOverlap(update.product_categories, portfolio.product_categories);

  if (!regionOk && !categoryOk) return 0.0;
  if (!regionOk && portfolio.target_markets.length > 0) return 0.1;

  return null; // proceed to LLM scoring
}

/**
 * Step 2: LLM fine-scoring via Haiku.
 */
async function llmScore(update: UpdateForScoring, portfolio: OrgPortfolio): Promise<ScoreResult> {
  const prompt = `Rate the impact of this regulatory update on a medical device company's portfolio.

Regulatory Update:
- Region: ${update.region}
- Product Categories: ${update.product_categories?.join(', ') || 'unspecified'}
- Device Class: ${update.device_class || 'unspecified'}
- Impact Type: ${update.impact_type || 'unspecified'}

Company Portfolio:
- Device Classes: ${portfolio.device_classes.join(', ') || 'all'}
- Product Categories: ${portfolio.product_categories.join(', ') || 'all'}
- Target Markets: ${portfolio.target_markets.join(', ') || 'all'}

Respond ONLY with JSON: {"score": number (0.0-1.0), "reasoning": "brief explanation"}`;

  const response = await generateText({
    model: getLlmFastModel(),
    maxTokens: 256,
    messages: [{ role: 'user', content: prompt }],
  });

  const rawText = response.text?.trim() ?? '';
  if (!rawText) throw new Error('Unexpected LLM response');

  const parsed = JSON.parse(rawText) as { score: number; reasoning?: string };
  return {
    impact_score: Math.min(1, Math.max(0, parsed.score)),
    reasoning: parsed.reasoning,
  };
}

/**
 * Score regulatory update relevance for a specific org portfolio.
 * Step 1: rule-based pre-filter (fast, cheap).
 * Step 2: LLM fine-scoring (Haiku, accurate).
 */
export async function scoreRelevance(params: {
  update: UpdateForScoring;
  portfolio: OrgPortfolio;
}): Promise<ScoreResult> {
  const { update, portfolio } = params;

  const prefilterScore = ruleBasedFilter(update, portfolio);
  if (prefilterScore !== null) {
    return { impact_score: prefilterScore, reasoning: 'Rule-based pre-filter: no overlap' };
  }

  return llmScore(update, portfolio);
}

export interface AlertFatigueInput {
  source_crawler: string;
  product_category: string;
  recentAlerts: Array<{
    source_crawler: string;
    product_category: string;
    created_at: Date;
  }>;
}

/**
 * Detect alert fatigue: same source+category appearing 3+ times within 7 days.
 * Returns true if alerts should be bundled into a digest.
 */
export function shouldBundleAsDigest(input: AlertFatigueInput): boolean {
  // Find the most recent alert's date to set the window relative to
  const mostRecent = input.recentAlerts.reduce<Date | null>((max, a) => {
    return max === null || a.created_at > max ? a.created_at : max;
  }, null);

  if (!mostRecent) return false;

  // Look back 7 days from the most recent alert
  const cutoff = new Date(mostRecent);
  cutoff.setDate(cutoff.getDate() - 7);

  const matching = input.recentAlerts.filter(
    (a) =>
      a.source_crawler === input.source_crawler &&
      a.product_category === input.product_category &&
      a.created_at >= cutoff,
  );

  return matching.length >= 3;
}
