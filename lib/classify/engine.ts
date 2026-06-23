// @MX:ANCHOR [AUTO] classifyDevice — 5-jurisdiction device classification entry point.
// @MX:REASON Entry point for BFF /classify/run route, report builder, and eval harness.
//           fan_in >= 3.
// @MX:WARN [AUTO] External RAG + LLM calls inside classifyDevice.
// @MX:REASON External network calls — latency and failure mode. Always inject a
//           mocked fetchFn / retrieveFn in unit tests; never hit the live network.
// @MX:SPEC SPEC-REGULA-CLASSIFY-001 (REQ-CLASSIFY-005~013, REQ-CLASSIFY-017, REQ-CLASSIFY-019)

import type { InternalDocsOptions, RetrieverResult } from '../ai/retrievers/internal-docs';
import { buildClassificationPrompt, parseJurisdictionResult } from './prompt';
import type {
  ClassificationOutput,
  Jurisdiction,
  JurisdictionResult,
  WizardAnswers,
} from './types';

/**
 * Injectable fetch function for the LLM endpoint. Mirrors the FetchFn pattern from
 * lib/risk/hazard-identification.ts so tests can stub the network without touching
 * internalDocsRetrieve.
 *
 * The endpoint is expected to return `{ result: <json-string> }`.
 */
export type ClassifyFetchFn = (
  endpoint: string,
  options?: RequestInit,
) => Promise<{ json: () => Promise<unknown> }>;

/** Injectable RAG retriever (defaults to the real internalDocsRetrieve). */
export type RuleRetriever = (
  query: string,
  options: InternalDocsOptions,
) => Promise<RetrieverResult>;

const JURISDICTIONS: Jurisdiction[] = ['FDA', 'EU_MDR', 'MFDS', 'NMPA', 'PMDA'];

/**
 * Rule-hint queries per jurisdiction. These are the search strings fed to the RAG
 * retriever to ground the LLM in the correct regulation text.
 */
const RULE_QUERIES: Record<Jurisdiction, string> = {
  FDA: 'FDA device classification 21 CFR 510(k) PMA De Novo product code regulation number',
  EU_MDR: 'EU MDR Annex VIII classification rules 1-22 Class I IIa IIb III notified body',
  MFDS: 'MFDS Korea medical device classification grade 1 2 3 4 equivalent review',
  NMPA: 'NMPA China medical device classification grade 1 2 3 equivalent submission',
  PMDA: 'PMDA Japan medical device classification Class I II III IV PMD Act',
};

export interface ClassifyDeviceOptions {
  /** Org ID used to scope RAG retrieval (org isolation). */
  orgId: string;
  /** User ID used to scope RAG retrieval. */
  userId: string;
  /** Injectable LLM fetch (tests pass a mock). */
  fetchFn?: ClassifyFetchFn;
  /**
   * RAG retriever. Required at the engine boundary to keep this module pure and
   * free of the db-client import graph (so unit tests never trigger env validation).
   * The BFF route passes the real internalDocsRetrieve; tests pass a mock.
   */
  retrieveFn: RuleRetriever;
}

/**
 * Classify a device across all 5 jurisdictions in parallel (REQ-CLASSIFY-019: 3s SLA).
 *
 * Flow per jurisdiction:
 *   1. RAG-retrieve jurisdiction-specific classification rules via internalDocsRetrieve.
 *   2. Build an LLM prompt with the device characteristics + retrieved rule hints.
 *   3. Call the LLM (fetchFn) and parse the structured JSON response.
 *
 * The LLM + retriever are injectable so tests never hit the network.
 */
export async function classifyDevice(
  answers: WizardAnswers,
  options: ClassifyDeviceOptions,
): Promise<ClassificationOutput> {
  const fetchFn = options.fetchFn;
  const retrieveFn = options.retrieveFn;

  const results = await Promise.all(
    JURISDICTIONS.map(async (jurisdiction) => {
      const ruleHints = await retrieveRuleHints(
        jurisdiction,
        options.orgId,
        options.userId,
        retrieveFn,
      );
      const result = fetchFn
        ? await classifyViaLLM(jurisdiction, answers, ruleHints, fetchFn)
        : stubResult(jurisdiction, answers, ruleHints);
      return [jurisdiction, result] as const;
    }),
  );

  const byJurisdiction = Object.fromEntries(results) as Record<Jurisdiction, JurisdictionResult>;

  return {
    fda: byJurisdiction.FDA,
    euMdr: byJurisdiction.EU_MDR,
    mfds: byJurisdiction.MFDS,
    nmpa: byJurisdiction.NMPA,
    pmda: byJurisdiction.PMDA,
    samdFlag: answers.hasAiMl ? 'detected' : 'none',
  };
}

/** Retrieve rule hints for a jurisdiction (empty string if retrieval yields nothing). */
async function retrieveRuleHints(
  jurisdiction: Jurisdiction,
  orgId: string,
  userId: string,
  retrieveFn: RuleRetriever,
): Promise<string> {
  try {
    const { results } = await retrieveFn(RULE_QUERIES[jurisdiction], {
      topK: 5,
      orgId,
      userId,
    });
    return results.map((r) => r.content).join('\n---\n');
  } catch {
    // Retrieval failure must not block classification — fall back to LLM general knowledge.
    return '';
  }
}

/** Call the LLM endpoint via fetchFn and parse the structured response. */
async function classifyViaLLM(
  jurisdiction: Jurisdiction,
  answers: WizardAnswers,
  ruleHints: string,
  fetchFn: ClassifyFetchFn,
): Promise<JurisdictionResult> {
  const prompt = buildClassificationPrompt(jurisdiction, answers, ruleHints);
  const resp = await fetchFn('/classify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jurisdiction, prompt }),
  });
  const body = (await resp.json()) as { result?: string };
  const raw = typeof body.result === 'string' ? body.result : JSON.stringify(body);
  return parseJurisdictionResult(raw);
}

/**
 * Deterministic stub used when no fetchFn is injected. This lets the engine run in
 * environments without an LLM endpoint (e.g. dev bootstrap) while still producing a
 * sensible 5-jurisdiction result derived from the wizard answers. The real LLM path
 * (classifyViaLLM) overrides this when fetchFn is provided.
 */
function stubResult(
  jurisdiction: Jurisdiction,
  answers: WizardAnswers,
  _ruleHints: string,
): JurisdictionResult {
  const invasive = answers.contactType === 'internal' || answers.contactType === 'implant';
  const base: JurisdictionResult = {
    class: 'pending',
    citations: [],
    rationale: `No LLM endpoint configured; stub classification for ${jurisdiction}.`,
    nextSteps: [],
  };
  // Very rough heuristic so the stub returns distinct values per jurisdiction.
  if (jurisdiction === 'FDA') {
    base.class = invasive || answers.hasAiMl ? 'Class III' : 'Class II';
    base.path = base.class === 'Class III' ? 'PMA' : '510(k)';
  } else if (jurisdiction === 'EU_MDR') {
    base.class = invasive ? 'Class IIb' : 'Class IIa';
    base.ruleNumbers = ['Rule 5', 'Rule 12'];
    base.path = 'notified_body';
  } else if (jurisdiction === 'MFDS') {
    base.class = invasive ? '3등급' : '2등급';
    base.path = '등가심사';
  } else if (jurisdiction === 'NMPA') {
    base.class = invasive ? 'III' : 'II';
    base.path = '비교 인증';
  } else if (jurisdiction === 'PMDA') {
    base.class = invasive ? 'Class III' : 'Class II';
  }
  return base;
}
