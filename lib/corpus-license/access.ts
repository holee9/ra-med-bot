// @MX:NOTE [AUTO] IDOR guard for source_license rows (REQ-CORPUSLIC-012).
// @MX:SPEC SPEC-REGULA-CORPUS-LICENSE-001 (REQ-CORPUSLIC-012)
//
// Cross-org access to a source_license returns 404 (not 403) to avoid leaking
// the existence of rows outside the caller's org. Denials are audited.

import { db } from '@/lib/kernel/db/client';
import { sourceLicense } from '@/lib/kernel/db/schema';
import { and, eq } from 'drizzle-orm';
import { auditCorpusAccessDenied } from './audit';

/**
 * REQ-012 — verify the source_license belongs to `orgId`. Returns null if the
 * row does not exist OR exists in a different org (404 in both cases).
 *
 * Side-effect: when the row exists but is cross-org, a `corpus.access_denied`
 * audit row is written so inspectors can see the attempted trespass.
 */
export async function assertSourceLicenseInOrg(params: {
  sourceLicenseId: string;
  orgId: string;
  userId: string;
}): Promise<{ id: string; sourceId: string } | null> {
  const [row] = await db
    .select({ id: sourceLicense.id, sourceId: sourceLicense.sourceId, orgId: sourceLicense.orgId })
    .from(sourceLicense)
    .where(eq(sourceLicense.id, params.sourceLicenseId))
    .limit(1);

  if (!row) return null;
  if (row.orgId !== params.orgId) {
    await auditCorpusAccessDenied({
      userId: params.userId,
      sourceId: row.sourceId,
      reason: 'source_license_cross_org',
    });
    return null;
  }
  return { id: row.id, sourceId: row.sourceId };
}

/**
 * REQ-012 — variant: verify a sourceId is owned by the org before any license
 * operation. Mirrors the sources.organization_id scoping.
 */
export async function assertSourceInOrg(params: {
  sourceId: string;
  orgId: string;
  userId: string;
}): Promise<boolean> {
  const { sources } = await import('../kernel/db/schema');
  const [row] = await db
    .select({ id: sources.id, orgId: sources.organizationId })
    .from(sources)
    .where(and(eq(sources.id, params.sourceId)))
    .limit(1);
  if (!row) return false;
  if (row.orgId !== params.orgId) {
    await auditCorpusAccessDenied({
      userId: params.userId,
      sourceId: params.sourceId,
      reason: 'source_cross_org',
    });
    return false;
  }
  return true;
}
