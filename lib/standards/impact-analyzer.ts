// @MX:NOTE [AUTO] Standards revision impact analyzer (local query).
// @MX:SPEC SPEC-REGULA-STANDARDS-001 (REQ-STANDARDS-011)
//
// Given a standard_id, identify which products are affected by a revision.
// Uses product_standards_compliance (local org-scoped table). No external API.
// The cron caller uses this to populate standards_updates.impact_summary.

import { withTenantScope } from '@/lib/db/client';
import {
  productStandardsCompliance,
  standardsOrgCatalog as standardsCatalog,
} from '@/lib/db/schema';
import { and, eq } from 'drizzle-orm';

export interface AffectedProduct {
  productId: string;
  projectId: string | null;
  complianceStatus: 'compliant' | 'gap' | 'unknown' | 'not_applicable';
  lastAssessedAt: Date | null;
}

export interface ImpactAnalysisResult {
  standardId: string;
  standardNumber: string | null;
  affected: AffectedProduct[];
  /** Products in 'gap' or 'unknown' status — highest-priority for RA review. */
  pendingReview: AffectedProduct[];
}

/**
 * Identify products linked to a standard that may be impacted by a revision.
 *
 * @MX:TODO #62-F — LLM-summarized revision-diff gap report (current vs latest).
 *   For now the impact summary is a count + list; detailed diff is deferred.
 */
export async function identifyAffectedProducts(
  standardId: string,
  orgId: string,
): Promise<ImpactAnalysisResult> {
  return withTenantScope(orgId, async (tx) => {
    // Resolve standardNumber for the result (org-scoped, defense-in-depth).
    const [catalog] = await tx
      .select({ standardNumber: standardsCatalog.standardNumber })
      .from(standardsCatalog)
      .where(and(eq(standardsCatalog.id, standardId), eq(standardsCatalog.orgId, orgId)))
      .limit(1);

    // Org-scoped read of compliance rows for this standard.
    const rows = await tx
      .select({
        productId: productStandardsCompliance.productId,
        projectId: productStandardsCompliance.projectId,
        complianceStatus: productStandardsCompliance.complianceStatus,
        lastAssessedAt: productStandardsCompliance.lastAssessedAt,
      })
      .from(productStandardsCompliance)
      .where(
        and(
          eq(productStandardsCompliance.orgId, orgId),
          eq(productStandardsCompliance.standardId, standardId),
        ),
      );

    const affected: AffectedProduct[] = rows.map((r) => ({
      productId: r.productId,
      projectId: r.projectId,
      complianceStatus: r.complianceStatus,
      lastAssessedAt: r.lastAssessedAt,
    }));

    const pendingReview = affected.filter(
      (p) => p.complianceStatus === 'gap' || p.complianceStatus === 'unknown',
    );

    return {
      standardId,
      standardNumber: catalog?.standardNumber ?? null,
      affected,
      pendingReview,
    };
  });
}
