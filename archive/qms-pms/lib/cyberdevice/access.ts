// @MX:ANCHOR [AUTO] Entitlement + IDOR guard for cybersecurity resources.
// @MX:REASON REQ-CYBERDEVICE-013: every cyber evidence access MUST be

// @MX:LEGACY archived from lib
//           project-scoped + org-member-checked; cross-tenant access returns
//           404 (not 403) to avoid leaking existence. Denials are audited.
// @MX:SPEC SPEC-REGULA-CYBERDEVICE-001 (REQ-013, AC-07)

import { db } from '@/lib/db/client';
import { cveImpact, cyberEvidenceBundle, sbom, threatModel } from '@/lib/db/schema';
import { and, eq } from 'drizzle-orm';
import { auditCyberAccessDenied } from './audit';

export interface CyberAccessCtx {
  userId: string;
  orgId: string;
  projectId: string;
}

/**
 * REQ-013 / AC-07: verify the requester's org owns the project AND the cyber
 * resource belongs to that project. Returns {ok:true} on success; on mismatch
 * returns {ok:false} and the caller responds 404 (existence hidden).
 *
 * `resource` is one of 'threatModel' | 'sbom' | 'cveImpact' | 'evidenceBundle'.
 */
export async function assertCyberResourceAccess(
  resource: 'threatModel' | 'sbom' | 'cveImpact' | 'evidenceBundle',
  resourceId: string,
  ctx: CyberAccessCtx,
): Promise<{ ok: true } | { ok: false; reason: string }> {
  let resourceProjectId: string | null = null;
  try {
    if (resource === 'threatModel') {
      const rows = await db
        .select({ projectId: threatModel.projectId })
        .from(threatModel)
        .where(and(eq(threatModel.orgId, ctx.orgId), eq(threatModel.id, resourceId)))
        .limit(1);
      resourceProjectId = rows[0]?.projectId ?? null;
    } else if (resource === 'sbom') {
      const rows = await db
        .select({ projectId: sbom.projectId })
        .from(sbom)
        .where(and(eq(sbom.orgId, ctx.orgId), eq(sbom.id, resourceId)))
        .limit(1);
      resourceProjectId = rows[0]?.projectId ?? null;
    } else if (resource === 'cveImpact') {
      const rows = await db
        .select({ projectId: cveImpact.projectId })
        .from(cveImpact)
        .where(and(eq(cveImpact.orgId, ctx.orgId), eq(cveImpact.id, resourceId)))
        .limit(1);
      resourceProjectId = rows[0]?.projectId ?? null;
    } else {
      const rows = await db
        .select({ projectId: cyberEvidenceBundle.projectId })
        .from(cyberEvidenceBundle)
        .where(
          and(eq(cyberEvidenceBundle.orgId, ctx.orgId), eq(cyberEvidenceBundle.id, resourceId)),
        )
        .limit(1);
      resourceProjectId = rows[0]?.projectId ?? null;
    }
  } catch {
    resourceProjectId = null;
  }

  if (resourceProjectId === null) {
    // Cross-tenant or non-existent — hide existence (404). Audit the denial.
    await auditCyberAccessDenied({
      userId: ctx.userId,
      projectId: ctx.projectId,
      reason: `${resource}_not_in_org_or_project`,
    });
    return { ok: false, reason: `${resource}_not_found` };
  }

  if (resourceProjectId !== ctx.projectId) {
    await auditCyberAccessDenied({
      userId: ctx.userId,
      projectId: ctx.projectId,
      reason: `${resource}_project_mismatch`,
    });
    return { ok: false, reason: `${resource}_not_found` };
  }

  return { ok: true };
}
