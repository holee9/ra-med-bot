// @MX:NOTE [AUTO] REQ-003/004 — claim ↔ citation enforcement.
// @MX:SPEC SPEC-REGULA-LABELING-001 (REQ-003, REQ-004, AC-02)

// @MX:LEGACY archived from lib
//
// Mirrors the change-control validateVerdictCitations pattern (REQ-006 dual
// defense): application-level validation + DB NOT NULL excerpt. A claim
// without a grounded citation forces expertReviewRequired=true (REQ-004).

import type { ClaimCitation, ClaimValidationResult } from './types';

/**
 * REQ-003: validate a claim's citations.
 *
 * - Citations with empty/whitespace excerpts are REJECTED (DB CHECK mirrors this).
 * - If ZERO grounded citations remain → expertReviewRequired=true (REQ-004).
 * - The caller persists expertReviewRequired on the labeling_claims row.
 */
export function validateClaimCitations(
  citations: ReadonlyArray<ClaimCitation>,
): ClaimValidationResult {
  let rejectedCitationCount = 0;
  const groundedCitations: ClaimCitation[] = [];

  for (const c of citations) {
    const excerptOk = typeof c.excerpt === 'string' && c.excerpt.trim().length > 0;
    if (!excerptOk) {
      rejectedCitationCount++;
      continue;
    }
    const sourceOk = typeof c.source === 'string' && c.source.trim().length > 0;
    if (!sourceOk) {
      rejectedCitationCount++;
      continue;
    }
    groundedCitations.push({
      source: c.source,
      section: c.section,
      excerpt: c.excerpt,
    });
  }

  const hasGroundedCitation = groundedCitations.length > 0;

  return {
    hasGroundedCitation,
    // REQ-004: no grounded citation → forces expert review.
    expertReviewRequired: !hasGroundedCitation,
    groundedCitations,
    rejectedCitationCount,
  };
}

/**
 * REQ-003/004: classify whether a claim is "unsupported" (zero citations) for
 * export-gating purposes (REQ-006). This is separate from the comparative/
 * superiority detection (comparable-detector.ts) — a claim can be "supported"
 * in citation terms but still "comparative" in type.
 *
 * Returns true when the claim has no grounded citation backing it.
 */
export function isUnsupportedClaim(citationCount: number, rejectedCitationCount: number): boolean {
  const groundedCount = citationCount - rejectedCitationCount;
  return groundedCount <= 0;
}
