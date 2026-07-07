// @MX:ANCHOR [AUTO] decideIdePathway — REQ-CLININV-002 FDA IDE decision tree.
// @MX:REASON Called by POST /api/clinical-investigation/[id]/ide-decision route +

// @MX:LEGACY archived from lib
//           integration tests. fan_in >= 3. Deterministic regulatory decision tree
//           grounded in 21 CFR 812. Every branch carries regulatory basis citations
//           (REQ-010) so the output is audit-defensible.
// @MX:SPEC SPEC-REGULA-CLINICAL-INVESTIGATION-001 (Issue #69, REQ-CLININV-002, AC-02)
//
// 21 CFR 812 decision logic:
//   - Exempt device (21 CFR 812.2(c)) → no IDE required, but IRB consent (21 CFR 50/56) still applies.
//   - Non-significant risk (NSR) device → abbreviated IDE (21 CFR 812.2(b)).
//   - Significant risk (SR) device → full IDE (21 CFR 812.20).
//   - NSR-eligible but risk reassessment pending → NSR pathway with escalation note.

import { authoritativeCitations } from './citation-enforcement';
import type { IdeDecisionInput, PathwayDecision, RegulatoryCitation } from './types';

const CITATION_812_2: RegulatoryCitation = { source: '21 CFR', id: '812.2' };
const CITATION_812_20: RegulatoryCitation = { source: '21 CFR', id: '812.20' };
const CITATION_812_2_C: RegulatoryCitation = { source: '21 CFR', id: '812.2(c)' };
const CITATION_50: RegulatoryCitation = { source: '21 CFR', id: '50' };
const CITATION_56: RegulatoryCitation = { source: '21 CFR', id: '56' };

/**
 * REQ-CLININV-002 — FDA IDE pathway decision tree.
 *
 * Deterministic rules (no LLM call in tier1). The output drives whether the
 * investigation proceeds via the FDA IDE path or routes to EU MDR (caller's job).
 *
 * Branches:
 *   - isExemptDevice → pathway decision 'ide_not_required_exempt' (still requires IRB consent)
 *   - riskLevel 'non_significant' → NSR abbreviated IDE
 *   - riskLevel 'significant' → full IDE (FDA approval required before study)
 *   - riskLevel 'nsr_eligible' → NSR with sponsor self-determination, IRB-overseeable
 *
 * Citations are AUTHORITATIVE statute references (21 CFR 812.x) baked into the
 * decision tree — NOT LLM-generated. They are grounded-by-construction and
 * carry confidence='authoritative' (H-1 fix). When a future tier2 LLM enhances
 * the decision prose, its citations MUST go through enforceCitations.
 */
export function decideIdePathway(
  input: IdeDecisionInput,
  _retrievedSources: ReadonlyArray<{ citation: string; title?: string }> = [],
): PathwayDecision {
  let decision: string;
  let regulatoryBasis: string;
  let emitted: RegulatoryCitation[];

  if (input.isExemptDevice) {
    decision =
      'IDE not required — device is exempt under 21 CFR 812.2(c). However, IRB ' +
      'approval (21 CFR 56) and informed consent (21 CFR 50) still apply to any ' +
      'human-subject interaction. Document the exemption rationale in the DHF.';
    regulatoryBasis =
      '21 CFR 812.2(c) enumerates categories of devices exempt from IDE requirements. ' +
      'Informed consent (21 CFR 50) and IRB oversight (21 CFR 56) remain mandatory.';
    emitted = [CITATION_812_2_C, CITATION_50, CITATION_56];
  } else if (input.riskLevel === 'non_significant') {
    decision =
      'Non-Significant Risk (NSR) device — abbreviated IDE applies. The sponsor ' +
      'self-determines NSR status, and the IRB at each site must review and concur ' +
      'before enrollment. No FDA IDE approval is required, but the abbreviated IDE ' +
      'obligations (21 CFR 812.2(b), 812.3, 812.5, 812.7, 812.10, 812.46, 812.52) ' +
      'must be observed.';
    regulatoryBasis =
      '21 CFR 812.2(b) defines the abbreviated IDE pathway for NSR devices. The ' +
      'sponsor makes the initial NSR determination; the reviewing IRB may disagree ' +
      'and require a full IDE (21 CFR 812.20).';
    emitted = [CITATION_812_2, CITATION_56];
  } else if (input.riskLevel === 'nsr_eligible') {
    decision =
      'NSR-eligible device — proceed with NSR self-determination, subject to IRB ' +
      'concurrence at each site. If any IRB determines the device is SR, escalate ' +
      'immediately to the full IDE pathway (21 CFR 812.20) and halt enrollment ' +
      'until FDA approval.';
    regulatoryBasis =
      '21 CFR 812.2(b) permits sponsor NSR self-determination; 21 CFR 812.2(b) ' +
      'obligates the sponsor to withdraw the NSR claim and submit a full IDE if ' +
      'the IRB or FDA determines the device is SR.';
    emitted = [CITATION_812_2, CITATION_812_20, CITATION_56];
  } else {
    // significant risk (default / fallthrough)
    decision =
      'Significant Risk (SR) device — full IDE required (21 CFR 812.20). FDA ' +
      'approval MUST be obtained before any human-subject enrollment. Submit the ' +
      'IDE application with protocol, investigator brochure, informed consent ' +
      'draft, and monitoring plan. Anticipate 30-day FDA review (21 CFR 812.30).';
    regulatoryBasis =
      '21 CFR 812.20 requires a full IDE application for SR devices. 21 CFR 812.30 ' +
      'mandates 30-day FDA review; the study may not begin until FDA issues an ' +
      'approval or the 30-day silent window lapses without objection.';
    emitted = [CITATION_812_20, CITATION_812_2, CITATION_50, CITATION_56];
  }

  // H-1 fix: emitted citations are AUTHORITATIVE 21 CFR 812.x statute
  // references baked into the decision tree — NOT LLM-generated. They are
  // grounded-by-construction and carry confidence='authoritative'. Do NOT
  // route through enforceCitations([]) (that would mark them 'unverified').
  const enforced = authoritativeCitations(emitted);

  return {
    pathway: 'fda_ide',
    decision,
    regulatoryBasis,
    citations: enforced.citations,
    confidence: enforced.confidence,
  };
}
