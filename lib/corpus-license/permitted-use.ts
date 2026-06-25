// @MX:NOTE [AUTO] permitted_use policy evaluation (REQ-CORPUSLIC-005/013).
// @MX:SPEC SPEC-REGULA-CORPUS-LICENSE-001 (REQ-CORPUSLIC-005, REQ-CORPUSLIC-013)
//
// REQ-005: PubMed/Embase journals distinguish abstract-only vs full-text rights.
// REQ-013: abstract-only sources block full-text search/summarize, allow abstract.

import { db } from '@/lib/db/client';
import { entitlement, sourceLicense } from '@/lib/db/schema';
import { and, eq } from 'drizzle-orm';
import type { LicenseType, PermittedUse } from './runtime-types';

export interface PermittedUseRow {
  sourceId: string;
  licenseType: LicenseType;
  permittedUse: PermittedUse;
  fullTextAllowed: boolean;
  abstractOnly: boolean;
  hasActiveEntitlement: boolean;
}

/**
 * REQ-005/013 — Fetch the effective permitted-use policy for a source.
 *
 * A `standard_paid` source requires an active entitlement for any permitted_use
 * (REQ-004). Journal/internal_sop/open derive rights from the license row itself.
 */
export async function fetchPermittedUse(
  sourceId: string,
  orgId: string,
): Promise<PermittedUseRow | null> {
  const [row] = await db
    .select({
      id: sourceLicense.id,
      licenseType: sourceLicense.licenseType,
      permittedUse: sourceLicense.permittedUse,
      fullTextAllowed: sourceLicense.fullTextAllowed,
      abstractOnly: sourceLicense.abstractOnly,
    })
    .from(sourceLicense)
    .where(and(eq(sourceLicense.sourceId, sourceId), eq(sourceLicense.orgId, orgId)))
    .limit(1);
  if (!row) return null;

  const [activeEntitlement] = await db
    .select({ id: entitlement.id })
    .from(entitlement)
    .where(
      and(
        eq(entitlement.sourceLicenseId, row.id),
        eq(entitlement.orgId, orgId),
        eq(entitlement.status, 'active'),
      ),
    )
    .limit(1);

  const pu = (row.permittedUse ?? {}) as PermittedUse;
  const hasActiveEntitlement = Boolean(activeEntitlement);

  // REQ-004: paid-standard sources are gated by entitlement. Without an active
  // grant, permitted_use collapses to nothing (no ingest/embed/search/summarize/export).
  if (row.licenseType === 'standard_paid' && !hasActiveEntitlement) {
    return {
      sourceId,
      licenseType: row.licenseType,
      permittedUse: {
        ingest: false,
        embed: false,
        search: false,
        summarize: false,
        export: false,
      },
      fullTextAllowed: false,
      abstractOnly: true,
      hasActiveEntitlement: false,
    };
  }

  return {
    sourceId,
    licenseType: row.licenseType,
    permittedUse: {
      ingest: pu.ingest ?? true,
      embed: pu.embed ?? true,
      search: pu.search ?? true,
      summarize: pu.summarize ?? true,
      export: pu.export ?? true,
    },
    fullTextAllowed: row.fullTextAllowed,
    abstractOnly: row.abstractOnly,
    hasActiveEntitlement,
  };
}

/**
 * REQ-013 — returns true if a full-text operation is forbidden on this source.
 * Fires when abstract_only is set OR full_text_allowed is false.
 */
export function isFullTextBlocked(policy: PermittedUseRow): boolean {
  return policy.abstractOnly || !policy.fullTextAllowed;
}
