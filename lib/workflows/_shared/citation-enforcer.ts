// @MX:ANCHOR [AUTO] Citation enforcer — 80% coverage gate for workflow drafts.
// @MX:REASON fan_in >= 3: workflow-runner (M0-0) calls enforceSectionCitations
//          per section; M1-M3 executors call on each generated section; tests
//          assert the coverage math. This is the workflow-domain analog of
//          lib/domains/consult/run-consult.ts H-3 (citation coverage 80%).
// @MX:SPEC SPEC-REGULA-WORKFLOWS-LLM-002 (REQ-WFLLM-006, AC-05)

/**
 * Citation coverage threshold (80%). Draft sections with coverage below this
 * ratio are rejected (REQ-WFLLM-006) and surface a `citation_coverage_low`
 * audit action via the runner.
 */
export const CITATION_COVERAGE_THRESHOLD = 0.8;

export interface CitationCoverageResult {
  /** 0–1 ratio of cited sentences to total sentences. */
  coverage: number;
  /** Total prose sentences (HTML stripped, <sup> markers removed). */
  totalSentences: number;
  /** Count of `<sup class="cite">` citation markers found. */
  citedSentences: number;
  /** True when coverage >= CITATION_COVERAGE_THRESHOLD. */
  passes: boolean;
}

/**
 * Count prose sentences in an HTML string. Mirrors
 * lib/domains/consult/run-consult.ts:95 countSentences — strips `<sup>` citation
 * markers first (so "1"/"2" inside them don't inflate the denominator), then
 * strips remaining tags, then splits on sentence terminators (incl. CJK).
 */
export function countSentences(html: string): number {
  const withoutSup = html.replace(/<sup\b[^>]*>[\s\S]*?<\/sup>/gi, '');
  const text = withoutSup.replace(/<[^>]+>/g, '');
  return text.split(/[.!?。？！]+/).filter((segment) => segment.trim().length > 0).length;
}

/**
 * Count `<sup class="cite">` citation markers. Mirrors
 * lib/domains/consult/run-consult.ts:104 countCitedSup and
 * lib/domains/triage/run-triage.ts:213.
 */
export function countCitedSup(html: string): number {
  const matches = html.match(/<sup\b[^>]*\bclass\s*=\s*["'][^"']*\bcite\b[^"']*["'][^>]*>/gi);
  return matches ? matches.length : 0;
}

/**
 * Compute citation coverage for a single draft section.
 *
 * @MX:NOTE [AUTO] Edge case: zero-sentence sections (e.g. only a heading or
 *           table) return coverage=1.0 (passes) — there are no uncited claims
 *           to penalize. This matches consult H-3 which only enforces when
 *           totalSentences > 0.
 */
export function computeCoverage(sectionHtml: string): CitationCoverageResult {
  const totalSentences = countSentences(sectionHtml);
  const citedSentences = countCitedSup(sectionHtml);

  if (totalSentences === 0) {
    return { coverage: 1, totalSentences: 0, citedSentences, passes: true };
  }

  const coverage = citedSentences / totalSentences;
  return {
    coverage,
    totalSentences,
    citedSentences,
    passes: coverage >= CITATION_COVERAGE_THRESHOLD,
  };
}

/**
 * Aggregate coverage across multiple sections by summing citation markers and
 * sentences across the whole draft, then dividing. This is the ratio the
 * runner stores in `workflow_runs.citation_coverage` and emits to the audit
 * trail. A single under-cited section can be offset by a well-cited one — but
 * REQ-WFLLM-006 says "all draft sections", so `enforceSectionCitations`
 * rejects per-section. This aggregate is the overall signal for the run row.
 */
export function aggregateCoverage(sections: string[]): CitationCoverageResult {
  let totalSentences = 0;
  let citedSentences = 0;
  for (const section of sections) {
    totalSentences += countSentences(section);
    citedSentences += countCitedSup(section);
  }

  if (totalSentences === 0) {
    return { coverage: 1, totalSentences: 0, citedSentences, passes: true };
  }

  const coverage = citedSentences / totalSentences;
  return {
    coverage,
    totalSentences,
    citedSentences,
    passes: coverage >= CITATION_COVERAGE_THRESHOLD,
  };
}

/**
 * Enforce citation coverage on a single section. Returns the coverage result;
 * the caller (workflow-runner) decides whether to retry or audit-reject when
 * `passes` is false. Pure function — no side effects — so it is trivially
 * unit-testable.
 */
export function enforceSectionCitations(
  stepName: string,
  sectionHtml: string,
): CitationCoverageResult & { stepName: string } {
  const result = computeCoverage(sectionHtml);
  return { stepName, ...result };
}
