// @MX:NOTE [AUTO] Shared types for the labeling engine — SPEC-REGULA-LABELING-001.
// @MX:SPEC SPEC-REGULA-LABELING-001 (REQ-001~012)

/**
 * REQ-001: 5 structured labeling section types.
 * Mirrors the labelingSectionTypeEnum in lib/db/schema.ts.
 */
export type LabelingSectionType =
  | 'intended_use'
  | 'indication'
  | 'contraindication'
  | 'warning'
  | 'precaution';

/**
 * REQ-002/011: jurisdictions covered by the labeling required-elements checklist.
 * Mirrors the Jurisdiction union in lib/change-control/types.ts.
 */
export type LabelingJurisdiction = 'FDA' | 'EU_MDR' | 'MFDS' | 'NMPA' | 'PMDA';

/**
 * REQ-005: claim classification — supported / comparative / superiority / unsupported.
 * Mirrors the labelingClaimTypeEnum in lib/db/schema.ts.
 */
export type LabelingClaimType = 'supported' | 'comparative' | 'superiority' | 'unsupported';

/**
 * REQ-006: document lifecycle status.
 */
export type LabelingDocumentStatus = 'draft' | 'in_review' | 'approved' | 'rejected';

/**
 * REQ-007: translation semantic-diff status (MVP heuristic).
 */
export type SemanticDiffStatus = 'match' | 'minor_diff' | 'major_diff' | 'review_required';

/**
 * REQ-007: translation approval gate.
 */
export type TranslationApprovalStatus = 'pending' | 'approved' | 'rejected';

/**
 * REQ-001: structured section record.
 */
export interface LabelingSection {
  id: string;
  documentId: string;
  sectionType: LabelingSectionType;
  content: string;
  locale: string;
}

/**
 * REQ-003: citation backing a claim. excerpt is NOT NULL — mirrors the
 * change-control VerdictCitation pattern (REQ-006 dual defense).
 */
export interface ClaimCitation {
  /** Regulatory/clinical document identifier (e.g. '21 CFR 801.109'). */
  source: string;
  /** Section / clause identifier within the source. */
  section?: string;
  /** Grounded text excerpt — must be non-empty. */
  excerpt: string;
}

/**
 * REQ-003/004/005: claim validation result returned by validateClaimCitations.
 */
export interface ClaimValidationResult {
  /** True when ≥1 grounded citation is present. */
  hasGroundedCitation: boolean;
  /** REQ-004: forces expert_review when no grounded citation. */
  expertReviewRequired: boolean;
  /** Validated (non-empty excerpt) citations. */
  groundedCitations: ClaimCitation[];
  /** REQ-004: citations rejected for empty/missing excerpt. */
  rejectedCitationCount: number;
}

/**
 * REQ-005: comparative/superiority detection result.
 */
export interface ComparableDetectionResult {
  isComparative: boolean;
  isSuperiority: boolean;
  matchedKeywords: string[];
  /** Resolved claim_type for DB persistence. */
  claimType: LabelingClaimType;
}

/**
 * REQ-002/011: checklist element required by a jurisdiction.
 */
export interface RequiredLabelElement {
  /** Stable identifier (e.g. 'device_name', 'udi'). */
  id: string;
  /** Human-readable label. */
  title: string;
  /** Regulatory reference (e.g. '21 CFR 801.61(a)'). */
  ref?: string;
  /** Section type this element maps to (for content-based detection). */
  sectionType?: LabelingSectionType;
}

/**
 * REQ-002/011: checklist evaluation result.
 */
export interface ChecklistEvaluation {
  jurisdiction: LabelingJurisdiction;
  total: number;
  satisfied: number;
  missing: RequiredLabelElement[];
  coveragePercent: number;
}

/**
 * REQ-007: semantic diff result.
 */
export interface SemanticDiffResult {
  status: SemanticDiffStatus;
  /** Details of detected divergences (keyword/number/structure mismatches). */
  details: Array<{ type: string; description: string }>;
}

/**
 * REQ-008: change-control linkage input.
 */
export interface LabelingChangeLinkInput {
  documentId: string;
  projectId: string;
  /** Free-form description of the labeling change. */
  changeDescription: string;
  /** Target markets for jurisdiction resolution. */
  targetMarkets: ReadonlyArray<string>;
}

/**
 * REQ-006: export gate result.
 */
export interface ExportGateResult {
  allowed: boolean;
  /** Claim IDs blocking export (unsupported or expert-review-required). */
  blockingClaims: string[];
  /** Human-readable reason for denial. */
  reason?: string;
}
