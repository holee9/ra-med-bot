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
  RetrievedSourceRef,
  WizardAnswers,
} from './types';
import { applyHeuristicGuardrail, validateCitations } from './validate';

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

/** Pending result returned when retrieval yields no sources (C2 — no general-knowledge path). */
function pendingNoSources(jurisdiction: Jurisdiction): JurisdictionResult {
  return {
    class: 'pending',
    citations: [],
    rationale: `no regulatory sources retrieved — cannot classify (${jurisdiction})`,
    nextSteps: ['expert_review'],
    confidence: 'unverified',
  };
}

/**
 * Classify a device across all 5 jurisdictions in parallel (REQ-CLASSIFY-019: 3s SLA).
 *
 * Flow per jurisdiction:
 *   1. RAG-retrieve jurisdiction-specific classification rules via internalDocsRetrieve.
 *   2. If retrieval yields NO sources → class='pending', confidence='unverified'
 *      (C2: the LLM is NOT asked to reason from general knowledge).
 *   3. Otherwise build an LLM prompt with the device characteristics + retrieved rule hints.
 *   4. Call the LLM (fetchFn) and parse the structured JSON response.
 *   5. validateCitations (C1): strip hallucinated ruleNumbers/citations; set confidence.
 *   6. applyHeuristicGuardrail (C2): downgrade implausible class/contact combinations.
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
      const { ruleHints, sources } = await retrieveRuleHints(
        jurisdiction,
        options.orgId,
        options.userId,
        retrieveFn,
      );

      // C2: retrieval-empty → pending. Never ask the LLM to hallucinate.
      if (sources.length === 0) {
        return [jurisdiction, pendingNoSources(jurisdiction)] as const;
      }

      const result = fetchFn
        ? await classifyViaLLM(jurisdiction, answers, ruleHints, fetchFn)
        : stubResult(jurisdiction, answers);

      // C1: ground emitted citations/ruleNumbers against retrieved sources.
      const { result: validated } = validateCitations(jurisdiction, result, sources);

      // C2: heuristic guardrail — block impossible class/contact combinations.
      const guarded = applyHeuristicGuardrail(jurisdiction, validated, answers);

      return [jurisdiction, guarded] as const;
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

/**
 * Retrieve rule hints for a jurisdiction. Returns BOTH the joined-string prompt
 * body AND a structured per-chunk `{ source, section }[]` list for post-LLM
 * citation validation (C1). Empty arrays on retrieval failure (C2: that path
 * routes to pending, never to general-knowledge hallucination).
 */
async function retrieveRuleHints(
  jurisdiction: Jurisdiction,
  orgId: string,
  userId: string,
  retrieveFn: RuleRetriever,
): Promise<{ ruleHints: string; sources: RetrievedSourceRef[] }> {
  try {
    const { results } = await retrieveFn(RULE_QUERIES[jurisdiction], {
      topK: 5,
      orgId,
      userId,
    });
    const sources: RetrievedSourceRef[] = results.map((r) => {
      const meta = (r.metadata ?? {}) as Record<string, unknown>;
      const source =
        typeof meta.source === 'string'
          ? meta.source
          : typeof meta.documentId === 'string'
            ? meta.documentId
            : r.docClass || r.documentId || 'unknown';
      const section =
        typeof meta.section === 'string'
          ? meta.section
          : typeof meta.sectionId === 'string'
            ? meta.sectionId
            : '';
      return { source, section };
    });
    return {
      ruleHints: results.map((r) => r.content).join('\n---\n'),
      sources,
    };
  } catch {
    // Retrieval failure → no sources. The caller routes to pending (C2).
    return { ruleHints: '', sources: [] };
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
 * Deterministic stub used when no fetchFn is injected. Returns class='pending'
 * for every jurisdiction (L1) so the stub output can never be mistaken for a
 * grounded classification. The real LLM path (classifyViaLLM) overrides this.
 */
function stubResult(jurisdiction: Jurisdiction, _answers: WizardAnswers): JurisdictionResult {
  return {
    class: 'pending',
    citations: [],
    rationale: `stub — no LLM configured (${jurisdiction})`,
    nextSteps: [],
    confidence: 'unverified',
  };
}
