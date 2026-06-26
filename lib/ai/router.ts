// @MX:ANCHOR [AUTO] RAG Router — intent classification + corpora selection for multi-market retrieval.
// @MX:REASON Entry point called by the consult pipeline for every user query.
// fan_in >= 3: consult.ts, merge.ts, future scheduled analysis tasks.
// @MX:SPEC SPEC-REGULA-BREADTH-001 (REQ-BREADTH-038)

import { type LanguageModel, generateText } from 'ai';
import { getLlmFastModel } from './llm-provider';

/**
 * Seven intent categories the router classifies user queries into.
 * Phase 8E adds past_submission_reuse and audit_response_drafting (REQ-DOC-068).
 */
export type RouterIntent =
  | 'regulation-lookup'
  | 'strategy'
  | 'comparison'
  | 'timeline'
  | 'general'
  | 'past_submission_reuse'
  | 'audit_response_drafting';

const ROUTER_INTENTS: readonly RouterIntent[] = [
  'regulation-lookup',
  'strategy',
  'comparison',
  'timeline',
  'general',
  'past_submission_reuse',
  'audit_response_drafting',
] as const;

/**
 * Maps each intent to the set of corpora that are most relevant.
 * `internal-sops` and `org_promoted` are always appended regardless of intent
 * (see `classifyAndRoute`). Phase 8E adds org-document corpora (REQ-DOC-068).
 *
 * SPEC-REGULA-KNOWLEDGE-PROMO-001 (REQ-KNOWLEDGE-PROMO-009/010): `org_promoted`
 * MUST be always-included — promoted answers are the team knowledge library
 * and participate in every RAG retrieval (boosted higher than internal docs
 * via PromotedAnswersRetriever.PROMOTED_BOOST_FACTOR). If `org_promoted` is
 * only conditionally attached, PromotedAnswersRetriever never fires and the
 * core value proposition of the knowledge-promo feature is silently absent
 * (this was the AC-04 dead-code defect — fixed 2026-06-26).
 */
export const intentToCorpora: Record<RouterIntent, string[]> = {
  'regulation-lookup': ['fda', 'eu-mdr', 'mfds', 'nmpa', 'pmda'],
  strategy: ['fda', 'eu-mdr', 'internal-sops'],
  comparison: ['fda', 'eu-mdr', 'mfds', 'nmpa', 'pmda'],
  timeline: ['fda', 'eu-mdr'],
  general: ['fda', 'internal-sops'],
  // Phase 8E: org-internal submission and audit document retrieval
  past_submission_reuse: ['org_fda_submissions', 'org_eu_cer', 'org_mfds_submissions'],
  audit_response_drafting: ['org_audit_responses'],
};

/** Market codes to corpus name map for filtering by target_markets. */
const marketToCorpora: Record<string, string[]> = {
  us: ['fda'],
  eu: ['eu-mdr'],
  kr: ['mfds'],
  cn: ['nmpa'],
  jp: ['pmda'],
};

const CLASSIFICATION_PROMPT = (q: string) =>
  `You are an intent classifier for a medical device regulatory affairs (RA) assistant.
Classify the user question with exactly one of these labels:
- regulation-lookup: looking up a specific regulation, clause, or requirement
- strategy: asking for regulatory strategy or approach advice
- comparison: comparing two or more regulations, markets, or requirements
- timeline: asking about review timelines, submission schedules, or deadlines
- general: any other question

Question: ${q}

Answer (one label only):`;

/**
 * Classify the user's query using Claude Haiku, then map the intent to the
 * relevant corpora filtered by the project's target markets.
 *
 * `internal-sops` and `org_promoted` are ALWAYS included in the returned
 * corpora list (deduplicated). `internal-sops` gives every query a baseline
 * of internal SOP coverage; `org_promoted` ensures the team knowledge library
 * (promoted answers) participates in every RAG retrieval so that
 * PromotedAnswersRetriever actually fires (REQ-KNOWLEDGE-PROMO-009/010, AC-04).
 *
 * @param query - The user's question.
 * @param projectTargetMarkets - Market codes from the project (e.g. ['us', 'eu']).
 * @returns Resolved intent label and deduplicated list of corpora to search.
 */
export async function classifyAndRoute(
  query: string,
  projectTargetMarkets: string[],
): Promise<{ intent: RouterIntent; corpora: string[] }> {
  let intent: RouterIntent = 'general';

  try {
    const { text } = await generateText({
      model: getLlmFastModel(),
      prompt: CLASSIFICATION_PROMPT(query),
      maxTokens: 50,
    });

    const normalized = text.toLowerCase().trim();
    for (const candidate of ROUTER_INTENTS) {
      if (normalized.includes(candidate)) {
        intent = candidate;
        break;
      }
    }
  } catch {
    // LLM unavailable (billing, network) — fall back to 'general' intent.
  }

  // Start with corpora relevant to the intent.
  const intentCorpora = intentToCorpora[intent];

  // Filter by the project's target markets to avoid searching irrelevant corpora.
  const marketCorpora = projectTargetMarkets.flatMap((m) => marketToCorpora[m] ?? []);

  // If no market filter applies (empty markets or unrecognized codes), use all intent corpora.
  const filtered =
    marketCorpora.length > 0
      ? intentCorpora.filter((c) => marketCorpora.includes(c) || c === 'internal-sops')
      : intentCorpora;

  // Deduplicate and always include internal-sops + org_promoted.
  // REQ-KNOWLEDGE-PROMO-009: org_promoted always included so team knowledge
  // participates in every RAG retrieval (boosted higher than internal docs
  // via PromotedAnswersRetriever.PROMOTED_BOOST_FACTOR). Without this,
  // PromotedAnswersRetriever is registered (merge.ts) but never selected,
  // making AC-04 dead code.
  const corpus = [...new Set([...filtered, 'internal-sops', 'org_promoted'])];

  return { intent, corpora: corpus };
}
