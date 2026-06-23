// @MX:ANCHOR [AUTO] Citation grounding + heuristic guardrail for LLM classification.
// @MX:REASON Patient-safety critical (C1/C2): prevents hallucinated rule numbers and
//           prompt-injection-driven impossible classes from reaching the operator.
//           Called by classifyDevice for every jurisdiction result.
// @MX:SPEC SPEC-REGULA-CLASSIFY-001 (REQ-CLASSIFY-017, citation integrity)

import type { Jurisdiction, JurisdictionResult, RetrievedSourceRef, WizardAnswers } from './types';

/**
 * Normalize an identifier for case-insensitive, whitespace-insensitive matching.
 * Lowercases, collapses internal whitespace, strips leading/trailing space.
 */
function normalizeId(value: string): string {
  return value.toLowerCase().replace(/\s+/g, ' ').trim();
}

/**
 * Test whether an emitted identifier (ruleNumber, citation.source, citation.id)
 * is grounded in the retrieved sources. A match is a normalized substring OR
 * token-set overlap so that e.g. '21 CFR 880.2900' matches a retrieved source
 * '21 CFR' + section '880.2900', and 'Rule 5' matches 'Annex VIII Rule 5'.
 */
function identifierMatches(
  emitted: string,
  candidates: ReadonlyArray<{ source: string; section: string }>,
): boolean {
  const e = normalizeId(emitted);
  if (!e) return false;
  for (const c of candidates) {
    const src = normalizeId(c.source);
    const sec = normalizeId(c.section);
    const combined = src && sec ? `${src} ${sec}` : src || sec;
    if (!combined) continue;
    // Substring either direction — covers "Rule 5" ⊂ "Annex VIII Rule 5".
    if (combined.includes(e) || e.includes(combined)) return true;
    // Token-set overlap (>= 60% of emitted tokens) — covers reorderings.
    const emittedTokens = new Set(e.split(' ').filter((t) => t.length > 1));
    const candidateTokens = new Set(combined.split(' ').filter((t) => t.length > 1));
    if (emittedTokens.size > 0) {
      let overlap = 0;
      for (const t of emittedTokens) if (candidateTokens.has(t)) overlap++;
      if (overlap / emittedTokens.size >= 0.6) return true;
    }
  }
  return false;
}

export interface CitationValidation {
  /** Result with unmatched identifiers stripped and confidence set. */
  result: JurisdictionResult;
  /** True when at least one emitted identifier was ungrounded. */
  hadUnmatched: boolean;
  /** True when ALL identifiers were ungrounded (or zero valid citations remain). */
  allUnmatched: boolean;
}

/**
 * Validate an LLM-emitted JurisdictionResult against retrieved sources (C1).
 *
 * - ruleNumbers[i] / citations[i].source / citations[i].id that cannot be matched
 *   against `retrievedSources` are STRIPPED from the result.
 * - If any identifier was stripped, `confidence` is set to 'unverified'.
 * - If ALL identifiers are unmatched (or the result ends up with zero valid
 *   citations), the jurisdiction is downgraded to class='pending' with a
 *   citation-failure rationale and confidence='unverified'.
 *
 * If `retrievedSources` is empty (retrieval returned nothing), the result is
 * left structurally intact but marked confidence='unverified' — the caller
 * (engine) is responsible for setting 'pending' BEFORE calling this function
 * so that the no-sources path never reaches here with an LLM-hallucinated
 * result.
 */
export function validateCitations(
  jurisdiction: Jurisdiction,
  raw: JurisdictionResult,
  retrievedSources: ReadonlyArray<RetrievedSourceRef>,
): CitationValidation {
  // No retrieved sources → cannot ground anything. Mark unverified, do not
  // attempt to strip (the engine should have already routed to pending).
  if (retrievedSources.length === 0) {
    return {
      result: { ...raw, confidence: 'unverified' },
      hadUnmatched: false,
      allUnmatched: true,
    };
  }

  let hadUnmatched = false;
  let matchedCount = 0;
  let totalIdentifiers = 0;

  // Filter ruleNumbers.
  const filteredRuleNumbers: string[] = [];
  for (const rn of raw.ruleNumbers ?? []) {
    totalIdentifiers++;
    if (identifierMatches(rn, retrievedSources)) {
      filteredRuleNumbers.push(rn);
      matchedCount++;
    } else {
      hadUnmatched = true;
    }
  }

  // Filter citations by source/id match.
  const filteredCitations = (raw.citations ?? []).filter((c) => {
    totalIdentifiers++;
    const sourceOk = identifierMatches(c.source, retrievedSources);
    const idOk = identifierMatches(c.id, retrievedSources);
    const matched = sourceOk || idOk;
    if (!matched) hadUnmatched = true;
    else matchedCount++;
    return matched;
  });

  const allUnmatched = totalIdentifiers > 0 && matchedCount === 0;

  // If everything was unmatched (or no citations remain), downgrade to pending.
  if (allUnmatched || filteredCitations.length === 0) {
    return {
      result: {
        class: 'pending',
        citations: [],
        ruleNumbers: [],
        rationale: `citation verification failed — expert review required (${jurisdiction})`,
        nextSteps: ['expert_review'],
        confidence: 'unverified',
      },
      hadUnmatched: true,
      allUnmatched: true,
    };
  }

  const next: JurisdictionResult = {
    ...raw,
    citations: filteredCitations,
    ruleNumbers: filteredRuleNumbers.length > 0 ? filteredRuleNumbers : raw.ruleNumbers,
    confidence: hadUnmatched ? 'unverified' : 'verified',
  };
  return { result: next, hadUnmatched, allUnmatched: false };
}

/**
 * Conservative heuristic guardrail (C2). Flags/blocks classifications that
 * contradict the wizard inputs. Intentionally a SMALL, defensible rule set —
 * over-broad rules would create false pendings and erode operator trust.
 *
 * When a contradiction fires, the result is downgraded to class='pending' with
 * confidence='unverified' so the operator is forced into expert review.
 */
export function applyHeuristicGuardrail(
  jurisdiction: Jurisdiction,
  result: JurisdictionResult,
  answers: WizardAnswers,
): JurisdictionResult {
  const cls = result.class.toLowerCase();

  // Rule 1: implantable / internal-implant contact cannot be FDA Class I.
  // (21 CFR ~860.3: implants are never Class I.)
  if (
    jurisdiction === 'FDA' &&
    answers.contactType === 'implant' &&
    /\bclass\s*i\b/.test(cls) &&
    !/class\s*i[a-z]/i.test(cls) // not Class Ia/Ib/II/III — bare "Class I"
  ) {
    return pending(
      result,
      'heuristic guardrail: implant contact inconsistent with FDA Class I — expert review required',
    );
  }

  // Rule 2: EU MDR — implantable devices are never Class I (Annex VIII Rule 8).
  if (
    jurisdiction === 'EU_MDR' &&
    answers.contactType === 'implant' &&
    /\bclass\s*i\b/.test(cls) &&
    !/class\s*i[a-z]/i.test(cls)
  ) {
    return pending(
      result,
      'heuristic guardrail: implant contact inconsistent with EU MDR Class I — expert review required',
    );
  }

  // Rule 3: IVD with embedded software claiming the lowest tier is suspicious
  // in MFDS/NMPA (IVD software is typically >= 2등급 / II). Conservative: only
  // fire for MFDS grade 1 IVD-software.
  if (
    jurisdiction === 'MFDS' &&
    answers.deviceType === 'ivd' &&
    answers.hasSoftware &&
    /1등급/.test(result.class)
  ) {
    return pending(
      result,
      'heuristic guardrail: IVD with software inconsistent with MFDS 1등급 — expert review required',
    );
  }

  return result;
}

function pending(prev: JurisdictionResult, rationale: string): JurisdictionResult {
  return {
    class: 'pending',
    citations: prev.citations,
    ruleNumbers: prev.ruleNumbers,
    path: prev.path,
    rationale,
    nextSteps: ['expert_review'],
    confidence: 'unverified',
  };
}
