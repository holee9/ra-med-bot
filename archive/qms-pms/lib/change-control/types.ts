// @MX:NOTE [AUTO] Shared types for the change-control engine — SPEC-REGULA-CHANGE-CONTROL-001.
// @MX:SPEC SPEC-REGULA-CHANGE-CONTROL-001 (REQ-003, REQ-004, REQ-005, REQ-010)

// @MX:LEGACY archived from lib

/** REQ-003: 6 change classification types. */
export type ChangeType =
  | 'design'
  | 'material'
  | 'manufacturing_process'
  | 'software'
  | 'labeling'
  | 'intended_use';

/** REQ-004: 4 verdicts produced per jurisdiction. */
export type ChangeVerdict =
  | 'new_submission_required'
  | 'change_notification'
  | 'internal_record_only'
  | 'not_applicable';

/** REQ-005: 5 jurisdictions evaluated based on project target_markets. */
export type Jurisdiction = 'FDA' | 'EU_MDR' | 'MFDS' | 'NMPA' | 'PMDA';

/** REQ-009/REQ-011: assessment lifecycle status. */
export type AssessmentStatus = 'provisional' | 'reviewed' | 'final';

/** Citation verification state (mirrors CLASSIFY JurisdictionConfidence). */
export type VerdictConfidence = 'verified' | 'unverified';

/** REQ-002: structured change input captured from the form. */
export interface ChangeInput {
  changeType: ChangeType;
  description: string;
  impactScope: string;
  /**
   * Project target markets used to filter which jurisdictions to evaluate.
   * Free-form strings (e.g. 'FDA', 'US', 'EU', 'KR') — resolveJurisdictions
   * normalizes them to the canonical Jurisdiction union.
   */
  targetMarkets: ReadonlyArray<string>;
}

/** REQ-010: version metadata recorded for rollback. */
export interface VersionMetadata {
  modelVersion: string;
  promptVersion: string;
  templateVersion: string;
}

/** A regulatory citation backing a verdict (REQ-006). */
export interface VerdictCitation {
  /** Document / corpus identifier (e.g. '21 CFR 807.81(a)(3)'). */
  source: string;
  /** Section / clause identifier within the source. */
  section: string;
  /** Grounded regulatory text excerpt — REQ-006 NOT NULL defense. */
  excerpt: string;
}

/** Retrieved source reference used for post-LLM citation grounding (C1). */
export interface RetrievedSourceRef {
  source: string;
  section: string;
  excerpt?: string;
}

/** REQ-004: per-jurisdiction verdict result. */
export interface JurisdictionVerdict {
  jurisdiction: Jurisdiction;
  verdict: ChangeVerdict;
  rationale: string;
  citations: VerdictCitation[];
  confidence: VerdictConfidence;
  /**
   * True when the verdict was REJECTED by REQ-006 citation enforcement.
   * When rejected, verdict is downgraded to 'internal_record_only' with
   * a citation-required rationale so the operator is forced to re-run or
   * supply a grounded citation.
   */
  citationRejected: boolean;
}

/** Aggregated assessment output across all target-market jurisdictions. */
export interface AssessmentOutput {
  verdicts: JurisdictionVerdict[];
  changeType: ChangeType;
}
