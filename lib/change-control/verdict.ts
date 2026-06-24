// @MX:ANCHOR [AUTO] REQ-006 citation enforcement for change-control verdicts.
// @MX:REASON Patient-safety critical (LLM hallucination defense): a verdict
//           without a grounded regulatory citation MUST be rejected. This is
//           the application-level defense; the DB-level defense is the
//           change_verdict_citations.excerpt NOT NULL constraint (0071 migration).
// @MX:SPEC SPEC-REGULA-CHANGE-CONTROL-001 (REQ-006, AC-04)
//
// Pattern reuse: the identifier-matching logic is deliberately mirrored from
// lib/classify/validate.ts (validateCitations) so both engines share the same
// grounding semantics. A change here SHOULD be mirrored there and vice versa.

import type {
  ChangeVerdict,
  JurisdictionVerdict,
  RetrievedSourceRef,
  VerdictCitation,
} from './types';

/**
 * Normalize an identifier for case-insensitive, whitespace-insensitive matching.
 * Lowercases, collapses internal whitespace, strips leading/trailing space.
 * Mirrors lib/classify/validate.ts normalizeId.
 */
function normalizeId(value: string): string {
  return value.toLowerCase().replace(/\s+/g, ' ').trim();
}

/**
 * Test whether an emitted identifier (citation.source, citation.section) is
 * grounded in the retrieved sources. Match = normalized substring either
 * direction OR token-set overlap (>= 60%). Mirrors CLASSIFY identifierMatches.
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
    if (combined.includes(e) || e.includes(combined)) return true;
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

export interface VerdictCitationValidation {
  /** Result with unmatched citations stripped. */
  verifiedCitations: VerdictCitation[];
  /** True if at least one citation was grounded. */
  hasGroundedCitation: boolean;
}

/**
 * REQ-006 citation enforcement. Validates an LLM-emitted set of citations
 * against retrieved sources.
 *
 * - Citations whose source/section cannot be matched against `retrievedSources`
 *   are STRIPPED (cannot persist).
 * - If ZERO grounded citations remain, the verdict is REJECTED — caller MUST
 *   downgrade the verdict and record a 'change.verdict_citation_rejected' audit.
 *
 * Mirrors lib/classify/validate.ts validateCitations semantics.
 */
export function validateVerdictCitations(
  citations: ReadonlyArray<VerdictCitation>,
  retrievedSources: ReadonlyArray<RetrievedSourceRef>,
): VerdictCitationValidation {
  if (retrievedSources.length === 0) {
    return { verifiedCitations: [], hasGroundedCitation: false };
  }

  const verified: VerdictCitation[] = [];
  for (const c of citations) {
    // An empty excerpt fails REQ-006 DB NOT NULL CHECK on persist anyway; strip
    // here so the caller never receives a citation that cannot be saved.
    if (!c.excerpt || c.excerpt.trim().length === 0) continue;
    const sourceOk = identifierMatches(c.source, retrievedSources);
    const sectionOk = identifierMatches(c.section, retrievedSources);
    if (sourceOk || sectionOk) {
      verified.push(c);
    }
  }

  return {
    verifiedCitations: verified,
    hasGroundedCitation: verified.length > 0,
  };
}

/**
 * REQ-006 reject path. Produces the canonical rejected verdict shape that
 * callers persist when citation enforcement fails. The verdict is downgraded
 * to 'internal_record_only' with a citation-required rationale so the operator
 * is forced into expert review / re-run.
 */
export function rejectedVerdict(
  jurisdiction: JurisdictionVerdict['jurisdiction'],
  rawRationale: string,
): JurisdictionVerdict {
  return {
    jurisdiction,
    verdict: 'internal_record_only' as ChangeVerdict,
    rationale: `citation required — verdict rejected by REQ-006 enforcement. Original rationale: ${rawRationale}`,
    citations: [],
    confidence: 'unverified',
    citationRejected: true,
  };
}
