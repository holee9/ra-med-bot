// @MX:ANCHOR [AUTO] validatePmsCitations — citation grounding for PMS report claims.
// @MX:REASON Patient-safety critical (REQ-PMS-008): prevents hallucinated EU MDR
//           article references from reaching the exported PMS report. Pattern
//           reused from lib/classify/validate.ts (SPEC-REGULA-CLASSIFY-001 C1).
// @MX:SPEC SPEC-REGULA-PMS-001 (REQ-PMS-008)

/** A citation emitted by the LLM, to be grounded against retrieved sources. */
export interface PmsCitation {
  /** e.g. "EU MDR Article 85" or "MDCG 2022-21 §4.2". */
  ref: string;
  /** Source document label. */
  source: string;
}

/** A retrieved source section that grounds citations. */
export interface PmsRetrievedSource {
  source: string;
  section: string;
}

/** Result of validating a PMS report body's citations. */
export interface PmsCitationValidation {
  /** Citations with unmatched refs stripped, confidence downgraded if needed. */
  citations: PmsCitation[];
  /** True when at least one emitted ref was ungrounded. */
  hadUnmatched: boolean;
  /** True when ALL refs were ungrounded — caller should set status to pending. */
  allUnmatched: boolean;
  /** Confidence level after grounding check. */
  confidence: 'verified' | 'unverified';
}

/** Normalize an identifier for case-insensitive matching. */
function normalizeId(value: string): string {
  return value.toLowerCase().replace(/\s+/g, ' ').trim();
}

/**
 * Test whether an emitted ref/source is grounded in retrieved sources. Uses
 * substring + token-set overlap (same approach as classify/validate.ts).
 */
function identifierMatches(
  emitted: string,
  candidates: ReadonlyArray<PmsRetrievedSource>,
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

/**
 * Validate LLM-emitted PMS citations against retrieved sources (REQ-PMS-008).
 *
 * - Citations whose ref AND source both fail grounding are STRIPPED.
 * - If any citation was stripped, confidence → 'unverified'.
 * - If ALL citations are unmatched (or zero remain), allUnmatched = true so
 *   the caller downgrades the document to compliance_status='pending'.
 *
 * Pattern: SPEC-REGULA-CLASSIFY-001 validateCitations (C1).
 */
export function validatePmsCitations(
  raw: ReadonlyArray<PmsCitation>,
  retrievedSources: ReadonlyArray<PmsRetrievedSource>,
): PmsCitationValidation {
  // No retrieved sources → cannot ground anything.
  if (retrievedSources.length === 0) {
    return {
      citations: [],
      hadUnmatched: false,
      allUnmatched: true,
      confidence: 'unverified',
    };
  }

  let hadUnmatched = false;
  let matchedCount = 0;

  const filtered = raw.filter((c) => {
    const refOk = identifierMatches(c.ref, retrievedSources);
    const sourceOk = identifierMatches(c.source, retrievedSources);
    const matched = refOk || sourceOk;
    if (!matched) hadUnmatched = true;
    else matchedCount++;
    return matched;
  });

  const allUnmatched = raw.length > 0 && matchedCount === 0;

  return {
    citations: filtered,
    hadUnmatched,
    allUnmatched,
    confidence: hadUnmatched || allUnmatched ? 'unverified' : 'verified',
  };
}
