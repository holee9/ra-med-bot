// @MX:NOTE [AUTO] Shared types for the classification engine — SPEC-REGULA-CLASSIFY-001.
// @MX:SPEC SPEC-REGULA-CLASSIFY-001 (REQ-CLASSIFY-005~013, REQ-CLASSIFY-017)

/** Jurisdictions covered by the classification wizard. */
export type Jurisdiction = 'FDA' | 'EU_MDR' | 'MFDS' | 'NMPA' | 'PMDA';

/** Wizard answers collected from the user before classification runs. */
export interface WizardAnswers {
  /** Free-form intended-use description (natural language). */
  deviceDescription: string;
  /** 'active' | 'non_active' | 'software_only' | 'ivd' | 'implantable'. */
  deviceType: string;
  /** 'no_contact' | 'external' | 'internal' | 'implant'. */
  contactType: string;
  hasSoftware: boolean;
  hasAiMl: boolean;
  isSterile: boolean;
}

/** One regulatory citation backing a classification decision. */
export interface ClassificationCitation {
  /** Source document or corpus identifier (e.g. '21 CFR 880.2900'). */
  source: string;
  /** Section / rule / clause identifier (e.g. 'Annex VIII Rule 10'). */
  id: string;
}

/** Result for a single jurisdiction. `path` / `grade` naming varies by jurisdiction. */
export interface JurisdictionResult {
  /** Headline class/grade string, e.g. 'Class II', 'Class IIb', '2등급'. */
  class: string;
  /** Regulatory pathway, e.g. '510(k)', 'notified_body', '등가심사'. */
  path?: string;
  /** Rule numbers applied (EU MDR Annex VIII, FDA regulation, etc.). */
  ruleNumbers?: string[];
  /** Citations supporting this classification (REQ-CLASSIFY-017). */
  citations: ClassificationCitation[];
  /** Short rationale tying the device characteristics to the class/path. */
  rationale: string;
  /** Suggested next-step workflow entry points for this jurisdiction. */
  nextSteps: string[];
}

/** Aggregated output across all 5 jurisdictions. */
export interface ClassificationOutput {
  fda: JurisdictionResult;
  euMdr: JurisdictionResult;
  mfds: JurisdictionResult;
  nmpa: JurisdictionResult;
  pmda: JurisdictionResult;
  /**
   * Noted when an AI/ML component is detected. Per MVP scope decision (Q4),
   * SaMD linkage is out of scope — we record the flag without branching.
   */
  samdFlag: 'detected' | 'none';
}
