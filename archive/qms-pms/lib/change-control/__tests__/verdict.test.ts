// @MX:NOTE [AUTO] Unit tests for REQ-006 citation enforcement.
// @MX:SPEC SPEC-REGULA-CHANGE-CONTROL-001 (REQ-006, AC-04)

// @MX:LEGACY archived from lib
//
// These exercise the DUAL defense: application-level validateVerdictCitations
// strips unmatched citations AND rejects verdicts with zero grounded citations.
// The DB-level NOT NULL defense is covered by the integration test (the
// migration CHECK constraint).

import { describe, expect, it } from 'vitest';
import type { RetrievedSourceRef, VerdictCitation } from '../types';
import { rejectedVerdict, validateVerdictCitations } from '../verdict';

const FDA_SOURCES: RetrievedSourceRef[] = [
  { source: '21 CFR 807.81(a)(3)', section: 'significant change' },
  { source: 'FDA Modifications Guidance 2019', section: 'When to Submit a 510(k)' },
];

describe('validateVerdictCitations (REQ-006 application-level defense)', () => {
  it('keeps citations grounded in retrieved sources', () => {
    const citations: VerdictCitation[] = [
      {
        source: '21 CFR 807.81(a)(3)',
        section: 'significant change',
        excerpt: 'A 510(k) is required for a significant change or modification.',
      },
    ];
    const result = validateVerdictCitations(citations, FDA_SOURCES);
    expect(result.hasGroundedCitation).toBe(true);
    expect(result.verifiedCitations).toHaveLength(1);
  });

  it('strips citations whose source/section do NOT match retrieved sources', () => {
    const citations: VerdictCitation[] = [
      {
        source: '21 CFR 807.81(a)(3)',
        section: 'significant change',
        excerpt: 'grounded excerpt',
      },
      {
        source: 'Hallucinated Regulation XYZ',
        section: 'fake section',
        excerpt: 'hallucinated excerpt',
      },
    ];
    const result = validateVerdictCitations(citations, FDA_SOURCES);
    expect(result.verifiedCitations).toHaveLength(1);
    expect(result.verifiedCitations[0]?.source).toBe('21 CFR 807.81(a)(3)');
  });

  it('rejects ALL citations when none are grounded (REQ-006 reject path)', () => {
    const citations: VerdictCitation[] = [
      {
        source: 'Hallucinated Source A',
        section: 'fake',
        excerpt: 'hallucinated excerpt A',
      },
      {
        source: 'Hallucinated Source B',
        section: 'fake',
        excerpt: 'hallucinated excerpt B',
      },
    ];
    const result = validateVerdictCitations(citations, FDA_SOURCES);
    expect(result.hasGroundedCitation).toBe(false);
    expect(result.verifiedCitations).toHaveLength(0);
  });

  it('returns no grounded citation when retrieved sources list is empty (C2 path)', () => {
    const citations: VerdictCitation[] = [
      {
        source: '21 CFR 807.81(a)(3)',
        section: 'significant change',
        excerpt: 'grounded excerpt',
      },
    ];
    const result = validateVerdictCitations(citations, []);
    expect(result.hasGroundedCitation).toBe(false);
    expect(result.verifiedCitations).toHaveLength(0);
  });

  it('strips citations with empty excerpts (REQ-006 excerpt NOT NULL defense)', () => {
    const citations: VerdictCitation[] = [
      {
        source: '21 CFR 807.81(a)(3)',
        section: 'significant change',
        excerpt: '', // empty — DB CHECK would reject this on persist
      },
    ];
    const result = validateVerdictCitations(citations, FDA_SOURCES);
    expect(result.hasGroundedCitation).toBe(false);
    expect(result.verifiedCitations).toHaveLength(0);
  });
});

describe('rejectedVerdict (REQ-006 reject shape)', () => {
  it('downgrades to internal_record_only and marks citationRejected', () => {
    const rejected = rejectedVerdict('FDA', 'the LLM said new submission is required');
    expect(rejected.verdict).toBe('internal_record_only');
    expect(rejected.citationRejected).toBe(true);
    expect(rejected.confidence).toBe('unverified');
    expect(rejected.citations).toHaveLength(0);
    expect(rejected.rationale).toContain('citation required');
    expect(rejected.rationale).toContain('the LLM said new submission is required');
  });
});
