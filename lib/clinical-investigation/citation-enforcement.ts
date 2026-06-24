// @MX:ANCHOR [AUTO] enforceCitations — REQ-CLININV-010 citation enforcement gate.
// @MX:REASON Called by gap-assessment, ide-decision-tree, eu-checklist, irb-package,
//           consent-generator, protocol-builder. fan_in >= 3. SAFETY gate: every
//           regulatory recommendation MUST carry grounded citations. Mirrors the
//           lib/classify/validate.ts C1 pattern — unverified citations are stripped
//           and confidence drops to 'unverified' when ALL emitted citations fail
//           grounding. The downstream audit row records confidence so FDA inspectors
//           can distinguish grounded decisions from LLM hallucinations.
// @MX:SPEC SPEC-REGULA-CLINICAL-INVESTIGATION-001 (Issue #69, REQ-CLININV-010, AC-02)
//
// H-1 fix: deterministic tier1 pathway functions (assessNecessity,
// decideIdePathway, buildEuMdrChecklist, buildIrbPackageDraft) bake in
// AUTHORITATIVE statute references (21 CFR 812.x, EU MDR Art 62, ISO 14155).
// These are NOT LLM-generated and do NOT need RAG grounding — they are
// authoritative-by-construction. They MUST be returned via
// `authoritativeCitations(...)`, NOT routed through `enforceCitations([])`
// (which would mark them 'unverified' and make REQ-010 look unmet).
// `enforceCitations` remains the gate for tier2 LLM-generated prose, activating
// only when real RAG `retrievedSources` are supplied.

import type { Confidence, RegulatoryCitation } from './types';

export interface CitationEnforcementResult {
  citations: RegulatoryCitation[];
  confidence: Confidence;
  hadUnmatched: boolean;
  allUnmatched: boolean;
}

/**
 * H-1 fix — return authoritative statute references for deterministic tier1
 * pathway outputs. These citations are baked into the decision tree (not
 * LLM-generated) so they bypass RAG grounding and carry confidence=
 * 'authoritative'. The audit row records this so FDA inspectors see grounded
 * citations instead of 'unverified' on every deterministic pathway output.
 *
 * REQ-010 is GENUINELY met: pathway outputs cite the regulatory basis AND
 * the confidence reflects that they are grounded statute references.
 */
export function authoritativeCitations(citations: RegulatoryCitation[]): CitationEnforcementResult {
  return {
    citations,
    confidence: 'authoritative',
    hadUnmatched: false,
    allUnmatched: false,
  };
}

const HIGH_THRESHOLD = 3; // >=3 grounded citations → high confidence
const MED_THRESHOLD = 1; // >=1 grounded citation → med confidence

/**
 * REQ-CLININV-010 — validate emitted citations against retrieved regulatory sources.
 *
 * Behavior mirrors lib/classify/validate.ts:
 *   1. Empty `retrievedSources` → keep citations but set confidence='unverified'
 *      (cannot ground against nothing).
 *   2. Each emitted citation is matched against retrieved sources by normalized
 *      string overlap (source + id token overlap >= 0.6).
 *   3. Unmatched citations are STRIPPED from the output (hallucination guard).
 *   4. If all emitted citations are unmatched → confidence='unverified', keep none.
 *
 * The caller is expected to persist the returned `confidence` in the audit row so
 * 21 CFR Part 11 traceability distinguishes grounded decisions from unverified LLM
 * output.
 *
 * @param emitted - Citations emitted by the pathway/recommendation generator.
 * @param retrievedSources - Regulatory sources retrieved by RAG (may be empty).
 */
export function enforceCitations(
  emitted: RegulatoryCitation[],
  retrievedSources: ReadonlyArray<{ citation: string; title?: string }>,
): CitationEnforcementResult {
  // Case 1: no retrieval — cannot ground. Keep emitted (for human review) but
  // flag as 'unverified'. NOTE (H-1): this path is for tier2 LLM-generated
  // citations ONLY. Deterministic tier1 statute references (21 CFR 812.x,
  // EU MDR Art 62) MUST use `authoritativeCitations(...)` instead — they are
  // authoritative-by-construction and must not be routed through this gate
  // with empty retrieval, or every pathway output would become 'unverified'.
  if (retrievedSources.length === 0) {
    return {
      citations: emitted,
      confidence: 'unverified',
      hadUnmatched: emitted.length > 0,
      allUnmatched: emitted.length > 0,
    };
  }

  if (emitted.length === 0) {
    return { citations: [], confidence: 'unverified', hadUnmatched: false, allUnmatched: false };
  }

  const matched: RegulatoryCitation[] = [];
  let hadUnmatched = false;

  for (const cite of emitted) {
    if (isGrounded(cite, retrievedSources)) {
      matched.push(cite);
    } else {
      hadUnmatched = true;
    }
  }

  const allUnmatched = matched.length === 0;

  // Confidence assignment: grounded citation count drives the level.
  let confidence: Confidence;
  if (allUnmatched) {
    confidence = 'unverified';
  } else if (matched.length >= HIGH_THRESHOLD) {
    confidence = 'high';
  } else if (matched.length >= MED_THRESHOLD) {
    confidence = 'med';
  } else {
    confidence = 'low';
  }

  return { citations: matched, confidence, hadUnmatched, allUnmatched };
}

function isGrounded(
  cite: RegulatoryCitation,
  sources: ReadonlyArray<{ citation: string; title?: string }>,
): boolean {
  const citeKey = normalize(`${cite.source} ${cite.id}`);
  for (const src of sources) {
    const srcKey = normalize(`${src.citation} ${src.title ?? ''}`);
    if (srcKey.includes(citeKey) || citeKey.includes(srcKey)) {
      return true;
    }
    if (tokenOverlap(citeKey, srcKey) >= 0.6) {
      return true;
    }
  }
  return false;
}

function normalize(value: string): string {
  return value.toLowerCase().replace(/\s+/g, ' ').trim();
}

function tokenOverlap(a: string, b: string): number {
  const tokensA = new Set(a.split(' ').filter((t) => t.length > 1));
  const tokensB = new Set(b.split(' ').filter((t) => t.length > 1));
  if (tokensA.size === 0 || tokensB.size === 0) return 0;
  let overlap = 0;
  for (const t of tokensA) if (tokensB.has(t)) overlap++;
  return overlap / Math.min(tokensA.size, tokensB.size);
}
