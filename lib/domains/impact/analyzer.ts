// SPEC-REGULA-IMPACT-001 — orchestrates portfolio scan → DB persist → audit.
// @MX:ANCHOR [AUTO] Top-level impact analysis orchestrator.
// @MX:REASON Called by admin API route and (future) radar notifier webhook. fan_in >= 2.
// @MX:SPEC SPEC-REGULA-IMPACT-001

import type { Database } from '@/lib/db/client';
import {
  impactActionItems,
  projects,
  regulatoryImpactAssessments,
  regulatoryUpdates,
} from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { enqueueActionItems } from './action-queue';
import {
  auditActionItemCreated,
  auditAssessmentCreated,
  auditCriticalDetected,
} from './audit-wiring';
import { scanPortfolio } from './portfolio-scanner';
import type { ImpactAssessment } from './types';

export interface AnalysisRequest {
  regulatory_update_id: string;
  org_id: string;
  actor_id: string;
}

export interface AnalysisResult {
  assessments_created: number;
  action_items_created: number;
  critical_count: number;
}

/**
 * Run full impact analysis for one regulatory update against an org's portfolio.
 * Idempotent: UNIQUE(regulatory_update_id, project_id) prevents duplicates.
 */
export async function analyzeImpact(req: AnalysisRequest, db: Database): Promise<AnalysisResult> {
  const [update] = await db
    .select({
      id: regulatoryUpdates.id,
      title: regulatoryUpdates.title,
      region: regulatoryUpdates.region,
      severity: regulatoryUpdates.severity,
      affectedProductTypes: regulatoryUpdates.affectedProductTypes,
      impactTypeHint: regulatoryUpdates.impactTypeHint,
      impactAnalysisText: regulatoryUpdates.impactAnalysisText,
    })
    .from(regulatoryUpdates)
    .where(eq(regulatoryUpdates.id, req.regulatory_update_id))
    .limit(1);

  if (!update) throw new Error(`Regulatory update ${req.regulatory_update_id} not found`);

  const scanResults = await scanPortfolio(update, req.org_id, db);

  let assessmentsCreated = 0;
  let actionItemsCreated = 0;
  let criticalCount = 0;

  for (const result of scanResults) {
    // 21 CFR Part 11 §11.10(e) — Issue #366: the assessment INSERT and the
    // audit rows that record it ride the SAME db.transaction so a transient
    // failure between them rolls back both. The audit trail can never be
    // orphaned relative to the data it describes.
    const inserted = await db.transaction(async (tx) => {
      const [row] = await tx
        .insert(regulatoryImpactAssessments)
        .values({
          regulatoryUpdateId: req.regulatory_update_id,
          projectId: result.project_id,
          impactLevel: result.impact_level,
          affectedSections: result.affected_sections,
          analysisSummary: result.analysis_summary,
          confidence: String(result.confidence),
          createdBy: req.actor_id,
        })
        .onConflictDoNothing()
        .returning({ id: regulatoryImpactAssessments.id });

      if (!row) return null; // already existed — skip

      await auditAssessmentCreated(
        {
          actor_id: req.actor_id,
          assessment_id: row.id,
          project_id: result.project_id,
          regulatory_update_id: req.regulatory_update_id,
          impact_level: result.impact_level,
        },
        tx,
      );

      if (result.impact_level === 'critical') {
        await auditCriticalDetected(
          {
            actor_id: req.actor_id,
            assessment_id: row.id,
            project_id: result.project_id,
            regulatory_update_id: req.regulatory_update_id,
          },
          tx,
        );
      }

      return row;
    });

    if (!inserted) continue; // already existed — skip

    assessmentsCreated++;
    const isCritical = result.impact_level === 'critical';
    if (isCritical) criticalCount++;

    // 21 CFR Part 11 §11.10(e) — Issue #378 PR-E: action-item INSERTs + their
    // audit rows ride ONE db.transaction. enqueueActionItems now accepts a tx
    // handle (PR-E ② AuditDbHandle duck-type — PgTransaction & db both
    // assignable without cast). The SELECT-back +
    // auditActionItemCreated use the same tx so a failure between INSERT and
    // audit can never orphan an action item without its audit row. (Action
    // items stay on a separate boundary from the assessment INSERT above — an
    // action-item failure does not roll back the durable assessment + its audit.)
    await db.transaction(async (tx) => {
      await enqueueActionItems(
        {
          assessment_id: inserted.id,
          project_id: result.project_id,
          priority: result.impact_level,
          sections: result.affected_sections,
          summary: result.analysis_summary,
        },
        db,
        tx,
      );

      // Count created action items for reporting
      const items = await tx
        .select({ id: impactActionItems.id })
        .from(impactActionItems)
        .where(eq(impactActionItems.assessmentId, inserted.id));

      for (const item of items) {
        actionItemsCreated++;
        await auditActionItemCreated(
          {
            actor_id: req.actor_id,
            action_item_id: item.id,
            assessment_id: inserted.id,
            project_id: result.project_id,
          },
          tx,
        );
      }
    });
  }

  return {
    assessments_created: assessmentsCreated,
    action_items_created: actionItemsCreated,
    critical_count: criticalCount,
  };
}

/** List all assessments for a given org (via project membership). */
export async function listAssessmentsForOrg(
  orgId: string,
  db: Database,
): Promise<ImpactAssessment[]> {
  const rows = await db
    .select({
      id: regulatoryImpactAssessments.id,
      regulatory_update_id: regulatoryImpactAssessments.regulatoryUpdateId,
      project_id: regulatoryImpactAssessments.projectId,
      project_name: projects.name,
      impact_level: regulatoryImpactAssessments.impactLevel,
      affected_sections: regulatoryImpactAssessments.affectedSections,
      analysis_summary: regulatoryImpactAssessments.analysisSummary,
      confidence: regulatoryImpactAssessments.confidence,
      created_by: regulatoryImpactAssessments.createdBy,
      created_at: regulatoryImpactAssessments.createdAt,
    })
    .from(regulatoryImpactAssessments)
    .innerJoin(projects, eq(projects.id, regulatoryImpactAssessments.projectId))
    .where(eq(projects.organizationId, orgId))
    .orderBy(regulatoryImpactAssessments.createdAt)
    .limit(200);

  return rows as unknown as ImpactAssessment[];
}
