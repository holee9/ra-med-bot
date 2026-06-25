// @MX:ANCHOR [AUTO] Source review workflow — pending_review on ingest + approval lifecycle.
// @MX:REASON fan_in >= 3: upload route (app/api/ra/admin/documents/upload/route.ts),
//   Inngest docingest worker (lib/inngest/docingest/upload-processed.ts), and
//   the approve API route all call setPendingReviewOnIngest / approveSource.
//   REQ-SOURCE-GOV-009/010/015 compliance gate — new sources enter pending_review
//   until RA-owner approval; approval/reject events are audit-material.
//   A dead-code definition without a call site is a SPEC violation.
// @MX:SPEC SPEC-REGULA-SOURCE-GOVERNANCE-001 (REQ-SOURCE-GOV-009/010/015, AC-04/05)

import { db } from '@/lib/db/client';
import { messageSources, sources, unansweredQueue } from '@/lib/db/schema';
import { logger } from '@/lib/observability/logger';
import { eq, inArray } from 'drizzle-orm';
import { getSourceInOrg } from './access';
import { auditSourceApproval } from './audit';
import type { ApprovalStatus, SourceChangeImpact } from './types';

/**
 * REQ-SOURCE-GOV-009/AC-04 — set a newly-ingested source to pending_review.
 * Called at the upload route + Inngest ingest worker AFTER the license gate.
 *
 * REQ-SOURCE-GOV-003: internal SOP sources require owner_department. When the
 * source type is internal-sop and owner_department is null/empty, the source
 * remains pending_review AND a structured flag is recorded so the dashboard
 * can surface the missing-owner gap. The flag is metadata-only — we do not
 * reject the ingest (license-gate already passed; governance is a follow-up).
 *
 * @param sourceId  Pre-registered, licensed source (REQ-CORPUSLIC-003).
 * @param isInternalSop  True when source type === 'internal-sop'.
 * @param ownerDepartment  Optional owner department (REQ-003 for internal SOP).
 */
export async function setPendingReviewOnIngest(params: {
  sourceId: string;
  isInternalSop: boolean;
  ownerDepartment?: string | null;
}): Promise<{ approvalStatus: ApprovalStatus; missingOwner: boolean }> {
  const missingOwner =
    params.isInternalSop && (!params.ownerDepartment || params.ownerDepartment.trim() === '');

  await db
    .update(sources)
    .set({
      approvalStatus: 'pending_review',
      ownerDepartment: params.ownerDepartment ?? null,
    })
    .where(eq(sources.id, params.sourceId));

  if (missingOwner) {
    logger.warn('[source-governance] internal SOP ingested without owner_department', {
      sourceId: params.sourceId,
    });
  }

  return { approvalStatus: 'pending_review', missingOwner };
}

/**
 * REQ-SOURCE-GOV-015/AC-05 — approve or reject a pending_review source.
 * Audit + state update run in one transaction (21 CFR Part 11 atomicity — H2).
 * Returns the post-decision approval status, or null on IDOR miss.
 */
export async function approveSource(params: {
  sourceId: string;
  orgId: string;
  decision: Exclude<ApprovalStatus, 'pending_review'>;
  userId: string;
  notes?: string;
}): Promise<{ approvalStatus: ApprovalStatus } | null> {
  const existing = await getSourceInOrg(params.sourceId, params.orgId);
  if (!existing) return null; // IDOR → caller returns 404.

  await db.transaction(async (tx) => {
    await tx
      .update(sources)
      .set({ approvalStatus: params.decision, lastReviewedAt: new Date() })
      .where(eq(sources.id, params.sourceId));

    await auditSourceApproval({
      userId: params.userId,
      sourceId: params.sourceId,
      decision: params.decision,
      notes: params.notes,
      tx,
    });
  });

  return { approvalStatus: params.decision };
}

/**
 * REQ-SOURCE-GOV-005/006 — mark a source superseded by another. Writes the
 * supersession link + audit in one transaction.
 *
 * Live call site: POST /api/source-governance/[id]/supersede route (RBAC
 * sourcegov.manage + IDOR via getSourceInOrg). REQ-006 retrieval-gate reads
 * superseded_by to exclude superseded sources from default search — a dead
 * markSuperseded makes REQ-005/006 inert (column always NULL).
 *
 * M-1 (cycle/self-ref prevention): rejects `sourceId === supersededBy`
 * (self-cycle) and verifies `supersededBy` belongs to the same org via
 * getSourceInOrg (cross-org supersede is an IDOR-style data-integrity bug).
 */
export async function markSuperseded(params: {
  sourceId: string;
  supersededBy: string;
  orgId: string;
  userId: string;
}): Promise<{ ok: boolean } | null> {
  // M-1: self-cycle prevention — a source cannot supersede itself.
  if (params.sourceId === params.supersededBy) {
    return { ok: false };
  }

  const existing = await getSourceInOrg(params.sourceId, params.orgId);
  if (!existing) return null;

  // M-1: supersededBy MUST belong to the same org. Cross-org supersede would
  // orphan the historical-lookup traversal (REQ-006 points to a foreign row).
  const successor = await getSourceInOrg(params.supersededBy, params.orgId);
  if (!successor) return null;

  const { auditSourceSuperseded } = await import('./audit');
  await db.transaction(async (tx) => {
    await tx
      .update(sources)
      .set({ supersededBy: params.supersededBy })
      .where(eq(sources.id, params.sourceId));

    await auditSourceSuperseded({
      userId: params.userId,
      sourceId: params.sourceId,
      supersededBy: params.supersededBy,
      tx,
    });
  });

  // H-2 (REQ-SOURCE-GOV-010): wire assessSourceChangeImpact into the supersede
  // flow so the dashboard surfaces knowledge gaps referencing this source.
  // Best-effort: impact assessment failure never fails the supersede (the
  // state change already succeeded + audited).
  try {
    await assessSourceChangeImpact({ sourceId: params.sourceId });
  } catch (err) {
    logger.warn('[source-governance] assessSourceChangeImpact failed post-supersede', {
      sourceId: params.sourceId,
      error: err instanceof Error ? err.message : String(err),
    });
  }

  return { ok: true };
}

/**
 * REQ-SOURCE-GOV-004/008 — set governance fields (authorityGrade, jurisdiction,
 * effectiveDate, sunsetDate, ownerDepartment, reviewCycleDays) on a source.
 *
 * Live call site: PATCH /api/source-governance/[id] route (RBAC sourcegov.manage
 * + IDOR via getSourceInOrg). authorityGrade had NO setter before this — every
 * source was null-grade, making assessLowAuthority (REQ-008) meaningless.
 *
 * Audit: source.governance_updated, written inside the same transaction as the
 * UPDATE (21 CFR Part 11 atomicity — H2). Wires the previously-dead
 * {@link auditSourceGovernanceUpdated} helper.
 *
 * Returns the refreshed impact (knowledge gaps referencing the source), or null
 * on IDOR miss. Impact is best-effort.
 */
export async function updateGovernanceFields(params: {
  sourceId: string;
  orgId: string;
  userId: string;
  fields: {
    authorityGrade?:
      | 'regulator_official'
      | 'harmonized_standard'
      | 'internal_sop'
      | 'prior_submission'
      | 'public_database'
      | 'secondary_reference'
      | null;
    jurisdiction?: string | null;
    effectiveDate?: string | null;
    sunsetDate?: string | null;
    ownerDepartment?: string | null;
    reviewCycleDays?: number | null;
  };
}): Promise<{ updatedFields: string[] } | null> {
  const existing = await getSourceInOrg(params.sourceId, params.orgId);
  if (!existing) return null;

  const setClause: Record<string, unknown> = {};
  const updatedFields: string[] = [];
  if (params.fields.authorityGrade !== undefined) {
    setClause.authorityGrade = params.fields.authorityGrade;
    updatedFields.push('authority_grade');
  }
  if (params.fields.jurisdiction !== undefined) {
    setClause.jurisdiction = params.fields.jurisdiction;
    updatedFields.push('jurisdiction');
  }
  if (params.fields.effectiveDate !== undefined) {
    setClause.effectiveDate = params.fields.effectiveDate;
    updatedFields.push('effective_date');
  }
  if (params.fields.sunsetDate !== undefined) {
    setClause.sunsetDate = params.fields.sunsetDate;
    updatedFields.push('sunset_date');
  }
  if (params.fields.ownerDepartment !== undefined) {
    setClause.ownerDepartment = params.fields.ownerDepartment;
    updatedFields.push('owner_department');
  }
  if (params.fields.reviewCycleDays !== undefined) {
    setClause.reviewCycleDays = params.fields.reviewCycleDays;
    updatedFields.push('review_cycle_days');
  }

  if (updatedFields.length === 0) {
    return { updatedFields: [] };
  }

  const { auditSourceGovernanceUpdated } = await import('./audit');
  await db.transaction(async (tx) => {
    await tx.update(sources).set(setClause).where(eq(sources.id, params.sourceId));
    await auditSourceGovernanceUpdated({
      userId: params.userId,
      sourceId: params.sourceId,
      fields: setClause,
      tx,
    });
  });

  // H-2 (REQ-SOURCE-GOV-010): wire assessSourceChangeImpact into the governance
  // change flow so downstream knowledge gaps surface on the dashboard.
  try {
    await assessSourceChangeImpact({ sourceId: params.sourceId });
  } catch (err) {
    logger.warn('[source-governance] assessSourceChangeImpact failed post-governance-update', {
      sourceId: params.sourceId,
      error: err instanceof Error ? err.message : String(err),
    });
  }

  return { updatedFields };
}

/**
 * REQ-SOURCE-GOV-010 — compute the downstream impact of a source change.
 * Returns the IDs of knowledge gaps / eval scenarios / submission packages
 * that reference this source so the dashboard can surface them for review.
 *
 * Implementation note: this is a read-only query function. The actual
 * invalidation/marking is a separate, owner-driven step (RA lead decides
 * whether to re-run evals or re-issue submission packages) — kept out of
 * the auto-path to avoid surprise bulk mutations.
 *
 * Best-effort: any join failure returns empty arrays so the dashboard degrades
 * gracefully rather than 500-ing.
 */
export async function assessSourceChangeImpact(params: {
  sourceId: string;
}): Promise<SourceChangeImpact> {
  try {
    const rows = (await db
      .select({ messageId: messageSources.messageId })
      .from(messageSources)
      .where(eq(messageSources.sourceId, params.sourceId))) as Array<{
      messageId: string;
    }>;

    if (rows.length === 0) {
      return { knowledgeGapIds: [], evalScenarioIds: [], submissionPackageIds: [] };
    }

    const messageIds = rows.map((r) => r.messageId);
    const gapRows = (await db
      .select({ id: unansweredQueue.id })
      .from(unansweredQueue)
      .where(inArray(unansweredQueue.messageId, messageIds))) as Array<{ id: string }>;

    return {
      knowledgeGapIds: gapRows.map((r) => r.id),
      // @MX:TODO [AUTO] REQ-SOURCE-GOV-010 follow-up: eval-scenario + submission-package
      //   impact joins (depends on eval/submission tables not yet finalised in
      //   this tier). Knowledge-gap impact is the highest-priority signal and is
      //   wired now; the remaining two are surfaced as empty until those tables land.
      evalScenarioIds: [],
      submissionPackageIds: [],
    };
  } catch (err) {
    logger.warn('[source-governance] assessSourceChangeImpact failed, returning empty', {
      sourceId: params.sourceId,
      error: err instanceof Error ? err.message : String(err),
    });
    return { knowledgeGapIds: [], evalScenarioIds: [], submissionPackageIds: [] };
  }
}
