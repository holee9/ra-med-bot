/**
 * Gate 4 — Domain UAT (RA Domain Experts)
 *
 * Activates AFTER the first RC when RA domain experts are available.
 * Requires structured UAT sessions with at least 3 RA domain experts.
 *
 * SPEC: SPEC-REGULA-QA-DOMAIN-UAT-001
 */

/**
 * Returns the structured UAT scenario script markdown.
 * Covers: query -> answer -> citation -> audit trail -> expert review.
 */
export function getUatScenarioScript(): string {
  return `# Gate 4 — RA Domain Expert UAT Scenario Script

## Overview
This script guides RA domain experts through structured UAT sessions.
Requires: >=3 RA domain experts, post-RC release build.

---

## Scenario 1: Query -> Answer Validation
1. Navigate to the RA Med Bot interface.
2. Enter a representative RA clinical query (e.g., "What are the current ACR guidelines for methotrexate dosing in RA?").
3. Verify the answer is clinically accurate and up to date.
4. Rate answer quality: Excellent / Acceptable / Needs Improvement / Unacceptable.

## Scenario 2: Citation Verification
1. Inspect each citation provided in the answer.
2. Confirm citations link to the correct source document.
3. Verify citation content matches the answer text.
4. Record: citation accurate (Y/N), source accessible (Y/N).

## Scenario 3: Audit Trail Review
1. Open the audit trail for the query session.
2. Verify the query, answer, model version, and timestamp are logged.
3. Confirm PII is not stored in audit logs.
4. Rate completeness: Complete / Partial / Missing.

## Scenario 4: Expert Review Sign-off
1. Complete all scenarios above.
2. Discuss findings with fellow RA expert reviewers.
3. Reach consensus on UAT decision: Accept / Reject.
4. Complete the UAT sign-off document.

---

## Scoring Thresholds
- Citation accuracy: >=95% on 50-sample audit (MANDATORY)
- Source license reviewed: Yes (MANDATORY)
- Expert consensus: >=2 of 3 experts must Accept

## Notes
- If any MANDATORY threshold fails, Gate 4 result is REJECT.
- Document all defects with severity: Critical / Major / Minor.
`;
}

export interface UatSignoffOptions {
  testers: string[];
  date: string;
  scenariosRun: string[];
  defectsFound: string[];
  citationAccuracy: number;
  sourceLicenseReviewed: boolean;
  decision: 'accept' | 'reject';
}

/**
 * Generates a formatted UAT sign-off document from the given options.
 */
export function generateUatSignoffDocument(opts: UatSignoffOptions): string {
  const {
    testers,
    date,
    scenariosRun,
    defectsFound,
    citationAccuracy,
    sourceLicenseReviewed,
    decision,
  } = opts;

  const decisionLabel = decision === 'accept' ? 'ACCEPT' : 'REJECT';
  const testerList = testers.map((t) => `- ${t}`).join('\n');
  const scenarioList = scenariosRun.map((s) => `- [x] ${s}`).join('\n');
  const defectList =
    defectsFound.length > 0 ? defectsFound.map((d) => `- ${d}`).join('\n') : '- None';

  return `# Gate 4 — RA Domain UAT Sign-off Document

**Date:** ${date}
**Decision:** ${decisionLabel}

---

## RA Domain Expert Testers
${testerList}

---

## Scenarios Executed
${scenarioList}

---

## Defects Found
${defectList}

---

## Quality Metrics
| Metric | Value | Threshold | Pass |
|---|---|---|---|
| Citation Accuracy | ${(citationAccuracy * 100).toFixed(1)}% | >=95% | ${citationAccuracy >= 0.95 ? 'YES' : 'NO'} |
| Source License Reviewed | ${sourceLicenseReviewed ? 'Yes' : 'No'} | Yes | ${sourceLicenseReviewed ? 'YES' : 'NO'} |

---

## Final Decision
**${decisionLabel}**

All signatories confirm this UAT session was conducted per SPEC-REGULA-QA-DOMAIN-UAT-001.

${testers.map((t) => `Signed: ${t}`).join('\n')}
`;
}

export interface CitationAccuracyResult {
  accuracy: number;
  meetsThreshold: boolean;
}

/**
 * Checks citation accuracy against the >=95% threshold on a 50-sample audit.
 *
 * @param totalSamples - Total number of citation samples reviewed (should be 50)
 * @param correctSamples - Number of citations verified as correct
 */
export function checkUatCitationAccuracy(
  totalSamples: number,
  correctSamples: number,
): CitationAccuracyResult {
  const accuracy = correctSamples / totalSamples;
  const meetsThreshold = accuracy >= 0.95;
  return { accuracy, meetsThreshold };
}
