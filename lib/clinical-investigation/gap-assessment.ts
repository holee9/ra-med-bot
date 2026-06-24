// @MX:ANCHOR [AUTO] assessNecessity — REQ-CLININV-001 gap-based necessity assessment.
// @MX:REASON Called by POST /api/clinical-investigation/assess route + integration
//           tests. fan_in >= 3. Produces the recommendation that drives the rest of
//           the CI lifecycle (pathway selection, IRB package, protocol).
// @MX:SPEC SPEC-REGULA-CLINICAL-INVESTIGATION-001 (Issue #69, REQ-CLININV-001, AC-01)
//
// REQ-CLININV-001: WHEN CER/literature evidence gap is input, THE SYSTEM SHALL
// produce a clinical-investigation necessity assessment. The output MUST include a
// recommendation, rationale, and regulatory basis citations (REQ-010).

import { enforceCitations } from './citation-enforcement';
import type { AssessInput, GapAssessmentResult, RegulatoryCitation } from './types';

// Regulatory anchors that justify necessity decisions (REQ-010). These are the
// canonical citations the gap-assessment emits; they are re-grounded against the
// RAG-retrieved source list via enforceCitations.
const CITATION_CER_GAP: RegulatoryCitation = {
  source: 'EU MDR',
  id: 'Annex XIV Part A',
  url: 'https://eur-lex.europa.eu/eli/reg/2017/745',
};
const CITATION_GCP: RegulatoryCitation = {
  source: 'ISO',
  id: '14155',
};
const CITATION_IDE: RegulatoryCitation = {
  source: '21 CFR',
  id: '812',
};

/**
 * REQ-CLININV-001 — assess clinical-investigation necessity from CER/literature gap.
 *
 * Deterministic rule-based assessment (no LLM call in tier1 — keeps the gate
 * auditable and testable). The rule set mirrors the regulatory decision logic:
 *
 *   - CER gap explicitly notes insufficient clinical evidence → 'required'
 *   - Literature gap present AND device class III / high-risk → 'required'
 *   - Literature gap present AND device class II / mid-risk → 'conditional'
 *   - Otherwise → 'not_required' (but still emit citations for traceability)
 *
 * The recommendation prose is human-readable; the audit row records the raw
 * `necessityStatus` and `confidence` for 21 CFR Part 11 traceability.
 *
 * @param input - CER/literature gap summary + device context.
 * @param retrievedSources - RAG-retrieved regulatory sources for citation grounding.
 */
export function assessNecessity(
  input: AssessInput,
  retrievedSources: ReadonlyArray<{ citation: string; title?: string }> = [],
): GapAssessmentResult {
  const cerGap = input.cerGapSummary.toLowerCase();
  const litGap = (input.literatureGapSummary ?? '').toLowerCase();
  const deviceClass = (input.deviceClass ?? '').toLowerCase();

  const cerGapExplicit = /insufficient|gap|inadequate|lacking/.test(cerGap);
  const litGapPresent = litGap.length > 0 && /gap|absent|no studies|no clinical data/.test(litGap);
  const isHighRisk = /class\s*iii|high\s*risk|implantable|life-sustaining|life-supporting/.test(
    deviceClass,
  );
  const isMidRisk = /class\s*ii|ii[a-b]|medium/.test(deviceClass);

  let necessityStatus: GapAssessmentResult['necessityStatus'];
  let recommendation: string;
  let rationale: string;
  let emitted: RegulatoryCitation[];

  if (cerGapExplicit || (litGapPresent && isHighRisk)) {
    necessityStatus = 'required';
    recommendation =
      'Clinical investigation is REQUIRED. The identified evidence gap cannot be ' +
      'closed by existing CER/literature data alone; a prospective clinical study ' +
      'is necessary to demonstrate conformity with safety and performance ' +
      'requirements (EU MDR Annex XIV Part A) or to support an IDE submission ' +
      '(21 CFR 812).';
    rationale = isHighRisk
      ? 'High-risk (Class III / implantable / life-sustaining) device with documented evidence gap.'
      : 'CER evidence gap explicitly noted as insufficient for conformity assessment.';
    emitted = [CITATION_CER_GAP, CITATION_GCP, CITATION_IDE];
  } else if (litGapPresent && isMidRisk) {
    necessityStatus = 'conditional';
    recommendation =
      'Clinical investigation MAY be required. Existing literature is insufficient ' +
      'to fully close the gap, but a well-designed PMCF study under EU MDR Article 83 ' +
      'may suffice if residual risk is acceptable. Escalate to RA-lead for pathway ' +
      'decision (IDE vs EU MDR Clinical Investigation vs PMCF-only).';
    rationale = 'Mid-risk device with partial literature gap; PMCF may suffice.';
    emitted = [CITATION_CER_GAP, CITATION_GCP];
  } else {
    necessityStatus = 'not_required';
    recommendation =
      'Clinical investigation is NOT required based on the provided gap summary. ' +
      'Existing CER/literature evidence appears adequate. Reassess if new risk ' +
      'data emerges during PMS surveillance.';
    rationale = 'No explicit evidence gap or high-risk signal detected.';
    emitted = [CITATION_CER_GAP];
  }

  const enforced = enforceCitations(emitted, retrievedSources);

  return {
    necessityStatus,
    recommendation,
    rationale,
    citations: enforced.citations,
    confidence: enforced.confidence,
  };
}
