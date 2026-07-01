// @MX:NOTE [AUTO] Source governance Zod schemas + shared types.
// @MX:SPEC SPEC-REGULA-SOURCE-GOVERNANCE-001 (Issue #48, REQ-SOURCE-GOV-001~016)
//
// Request/response shapes shared between API routes (/api/source-governance/*),
// the retrieval-gate, stale-check, review-workflow, and dashboard query layer.
// Mirrors the schema enum values lock-step (source_authority_grade,
// source_approval_status).

import { z } from 'zod';

/** 6-tier authority grade. Mirror of source_authority_grade SQL enum. */
export const authorityGradeSchema = z.enum([
  'regulator_official',
  'harmonized_standard',
  'internal_sop',
  'prior_submission',
  'public_database',
  'secondary_reference',
]);
export type AuthorityGrade = z.infer<typeof authorityGradeSchema>;

/**
 * Approval lifecycle. Mirror of source_approval_status SQL enum.
 * 'sunset' is set by the daily orphan-cleanup cron (Issue 313, migration 0101)
 * when all source_sections are superseded — permanently excluded from RAG
 * retrieval via the governance gate (approvalStatus !== 'approved').
 */
export const approvalStatusSchema = z.enum(['pending_review', 'approved', 'rejected', 'sunset']);
export type ApprovalStatus = z.infer<typeof approvalStatusSchema>;

/** REQ-SOURCE-GOV-001/002/003 — governance fields on a source row. */
export const sourceGovernanceFieldsSchema = z.object({
  authorityGrade: authorityGradeSchema.nullable(),
  jurisdiction: z.string().nullable(),
  effectiveDate: z.string().nullable(),
  sunsetDate: z.string().nullable(),
  supersededBy: z.string().uuid().nullable(),
  ownerDepartment: z.string().nullable(),
  approvalStatus: approvalStatusSchema,
  reviewCycleDays: z.number().int().positive().nullable(),
  lastReviewedAt: z.string().nullable(),
});
export type SourceGovernanceFields = z.infer<typeof sourceGovernanceFieldsSchema>;

/** REQ-SOURCE-GOV-015 — POST /api/source-governance/approve body. */
export const approveRequestSchema = z.object({
  sourceId: z.string().uuid(),
  decision: z.enum(['approved', 'rejected']),
  notes: z.string().max(2000).optional(),
});
export type ApproveRequest = z.infer<typeof approveRequestSchema>;

/** REQ-SOURCE-GOV-005/006 — POST /api/source-governance/[id]/supersede body. */
export const supersedeRequestSchema = z.object({
  supersededBy: z.string().uuid(),
});
export type SupersedeRequest = z.infer<typeof supersedeRequestSchema>;

/** REQ-SOURCE-GOV-004/008 — PATCH /api/source-governance/[id] body. */
export const updateGovernanceRequestSchema = z
  .object({
    authorityGrade: authorityGradeSchema.nullable().optional(),
    jurisdiction: z.string().max(200).nullable().optional(),
    effectiveDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .nullable()
      .optional(),
    sunsetDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .nullable()
      .optional(),
    ownerDepartment: z.string().max(200).nullable().optional(),
    reviewCycleDays: z.number().int().positive().max(3650).nullable().optional(),
  })
  .refine((d) => Object.keys(d).length > 0, {
    message: 'at least one governance field is required',
  });
export type UpdateGovernanceRequest = z.infer<typeof updateGovernanceRequestSchema>;

/** REQ-SOURCE-GOV-010 — impact payload returned by review-workflow. */
export interface SourceChangeImpact {
  knowledgeGapIds: string[];
  evalScenarioIds: string[];
  submissionPackageIds: string[];
}

/** REQ-SOURCE-GOV-004/005/006/008 — retrieval-gate options. */
export interface RetrievalGateOptions {
  orgId: string;
  /** When true, superseded/approval-excluded sources are NOT filtered (REQ-006). */
  historical?: boolean;
}

/** REQ-SOURCE-GOV-008 — low-authority flag result. */
export interface LowAuthorityAssessment {
  /** True when every candidate is a non-primary grade (secondary_reference / public_database). */
  lowAuthorityOnly: boolean;
  /** Highest grade among the candidates (null if empty). */
  highestGrade: AuthorityGrade | null;
  /** Reason text for the expert_review_required event / audit meta. */
  reason: string | null;
}

/** REQ-SOURCE-GOV-007/AC-03 — stale-citation check result at draft/export. */
export interface StaleCitationGateResult {
  allowed: boolean;
  /** Blocked source ids with a human-readable reason per id. */
  blockedSources: Array<{ sourceId: string; title: string | null; reason: string }>;
}
