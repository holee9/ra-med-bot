// SPEC-REGULA-WORKFLOWS-LLM-002 M0-2 — citation-enforcer unit tests.
// REQ-WFLLM-006 / AC-05: citation coverage >= 80% per section.

import { describe, expect, it } from 'vitest';
import {
  CITATION_COVERAGE_THRESHOLD,
  aggregateCoverage,
  computeCoverage,
  countCitedSup,
  countSentences,
  enforceSectionCitations,
} from '../citation-enforcer';

describe('citation-enforcer: countSentences', () => {
  it('counts prose sentences after stripping HTML tags', () => {
    expect(countSentences('<p>Hello world. Foo bar.</p>')).toBe(2);
  });

  it('strips <sup class="cite"> markers before counting (H-3 pattern)', () => {
    // Without the sup strip, "1" and "2" inside the marker would be split
    // into extra sentences, inflating the denominator.
    const html = 'Claim one.<sup class="cite">1</sup> Claim two.<sup class="cite">2</sup>';
    expect(countSentences(html)).toBe(2);
  });

  it('handles CJK sentence terminators', () => {
    expect(countSentences('文です。二つ目です。')).toBe(2);
  });

  it('returns 0 for empty or tag-only strings', () => {
    expect(countSentences('')).toBe(0);
    expect(countSentences('<p></p>')).toBe(0);
  });
});

describe('citation-enforcer: countCitedSup', () => {
  it('counts <sup class="cite"> markers', () => {
    const html =
      'A.<sup class="cite">1</sup> B.<sup class="cite">2</sup> C.<sup class="cite">3</sup>';
    expect(countCitedSup(html)).toBe(3);
  });

  it('returns 0 when no cite markers present', () => {
    expect(countCitedSup('Plain text. No markers.')).toBe(0);
  });

  it('ignores <sup> without class="cite"', () => {
    expect(countCitedSup('A.<sup>footnote</sup>')).toBe(0);
  });
});

describe('citation-enforcer: computeCoverage', () => {
  it('passes when coverage >= 80% threshold', () => {
    // 4 sentences, 4 citations → 100% coverage.
    const html =
      'S1.<sup class="cite">1</sup> S2.<sup class="cite">2</sup> S3.<sup class="cite">3</sup> S4.<sup class="cite">4</sup>';
    const result = computeCoverage(html);
    expect(result.coverage).toBe(1);
    expect(result.passes).toBe(true);
    expect(result.totalSentences).toBe(4);
    expect(result.citedSentences).toBe(4);
  });

  it('passes at exactly 80% boundary', () => {
    // 5 sentences, 4 citations → 0.8 exactly.
    const html =
      'S1.<sup class="cite">1</sup> S2.<sup class="cite">2</sup> S3.<sup class="cite">3</sup> S4.<sup class="cite">4</sup> S5.';
    const result = computeCoverage(html);
    expect(result.coverage).toBe(0.8);
    expect(result.passes).toBe(true);
  });

  it('fails when coverage below 80%', () => {
    // 5 sentences, 3 citations → 0.6.
    const html =
      'S1.<sup class="cite">1</sup> S2.<sup class="cite">2</sup> S3.<sup class="cite">3</sup> S4. S5.';
    const result = computeCoverage(html);
    expect(result.coverage).toBe(0.6);
    expect(result.passes).toBe(false);
  });

  it('returns coverage=1 for zero-sentence sections (no uncited claims)', () => {
    // Empty string has no sentences.
    const result = computeCoverage('');
    expect(result.totalSentences).toBe(0);
    expect(result.coverage).toBe(1);
    expect(result.passes).toBe(true);
  });

  it('threshold is exactly 0.8', () => {
    expect(CITATION_COVERAGE_THRESHOLD).toBe(0.8);
  });
});

describe('citation-enforcer: aggregateCoverage', () => {
  it('sums citations and sentences across sections', () => {
    const sections = [
      'A.<sup class="cite">1</sup> B.<sup class="cite">2</sup>',
      'C.<sup class="cite">3</sup> D.<sup class="cite">4</sup>',
    ];
    const result = aggregateCoverage(sections);
    expect(result.totalSentences).toBe(4);
    expect(result.citedSentences).toBe(4);
    expect(result.coverage).toBe(1);
    expect(result.passes).toBe(true);
  });

  it('blends under-cited and well-cited sections', () => {
    const sections = [
      'A.<sup class="cite">1</sup> B.', // 50% — would fail alone
      'C.<sup class="cite">2</sup> D.<sup class="cite">3</sup>', // 100%
    ];
    const result = aggregateCoverage(sections);
    expect(result.totalSentences).toBe(4);
    expect(result.citedSentences).toBe(3);
    expect(result.coverage).toBe(0.75);
    expect(result.passes).toBe(false);
  });
});

describe('citation-enforcer: enforceSectionCitations', () => {
  it('returns the stepName alongside the coverage result', () => {
    const result = enforceSectionCitations('predicate_search', 'A.<sup class="cite">1</sup>');
    expect(result.stepName).toBe('predicate_search');
    expect(result.passes).toBe(true);
  });
});
