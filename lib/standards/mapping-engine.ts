// @MX:ANCHOR: [AUTO] Standards mapping engine — DB-aware wrapper over applicability-engine.
// @MX:REASON: Public API boundary; fan_in >= 3 (applicability route, cron, tests).
// @MX:SPEC SPEC-REGULA-STANDARDS-001 (REQ-STANDARDS-001/004/005/006/021, AC-03)
//
// Charter [지양-2] citation provenance: every ApplicableStandardResult carries
// catalogRowId + source. The pure applicability-engine.ts returns bare
// ApplicableStandard[]; this module joins DB catalog rows (org-scoped) so
// downstream API responses are citation-complete.

import { type DrizzleClient, db, withTenantScope } from '@/lib/db/client';
import { standardsOrgCatalog as standardsCatalog } from '@/lib/db/schema';
import { and, eq } from 'drizzle-orm';
import {
  type ApplicableStandard,
  type DeviceProfile,
  getApplicableStandards,
} from './applicability-engine';

/**
 * Applicable standard with citation provenance (Charter [지양-2]).
 * - catalogRowId: standards_catalog PK (nullable when no DB row — pure seed).
 * - source: 'seed' | 'catalog' — where the citation was resolved from.
 * - catalogVersion / catalogBody: denormalized for audit trail without a second join.
 */
export interface ApplicableStandardResult extends ApplicableStandard {
  catalogRowId: string | null;
  source: 'seed' | 'catalog';
  catalogVersion: string | null;
  catalogBody: string | null;
}

export interface MappingOutcome {
  results: ApplicableStandardResult[];
  deviceProfileKey: string;
  /** Engine processing time in ms (AC-03 ≤ 5000ms budget tracking). */
  durationMs: number;
}

/**
 * Map a DeviceProfile to applicable standards with citation provenance.
 *
 * Reuses getApplicableStandards() from applicability-engine.ts (REQ-001/004/005/006)
 * and enriches each entry with the org-scoped standards_catalog row. Standards
 * absent from the catalog still appear with source='seed' and catalogRowId=null
 * — the seed catalog in applicability-engine is the fallback citation.
 *
 * @MX:TODO #62-G — RAG-assist mapping layer (currently rule-based only).
 */
export async function mapApplicableStandards(
  profile: DeviceProfile,
  orgId: string,
): Promise<MappingOutcome> {
  const start = Date.now();
  // Call the reused rule engine (dead-code proof: this is the call-site).
  const raw = getApplicableStandards(profile);

  if (raw.length === 0) {
    return {
      results: [],
      deviceProfileKey: profile.deviceTypeKey,
      durationMs: Date.now() - start,
    };
  }

  return withTenantScope(orgId, async (tx) => {
    const numbers = raw.map((r) => r.standardNumber);
    const rows = await tx
      .select({
        id: standardsCatalog.id,
        standardNumber: standardsCatalog.standardNumber,
        version: standardsCatalog.version,
        body: standardsCatalog.body,
        source: standardsCatalog.source,
      })
      .from(standardsCatalog)
      .where(and(eq(standardsCatalog.orgId, orgId)));

    // Filter to the candidate numbers post-select (small result set).
    const candidateNumbers = new Set(numbers);
    const byNumber = new Map(
      rows.filter((r) => candidateNumbers.has(r.standardNumber)).map((r) => [r.standardNumber, r]),
    );

    const results: ApplicableStandardResult[] = raw.map((r) => {
      const catalog = byNumber.get(r.standardNumber);
      return {
        ...r,
        catalogRowId: catalog?.id ?? null,
        source: catalog ? 'catalog' : 'seed',
        catalogVersion: catalog?.version ?? null,
        catalogBody: catalog?.body ?? null,
      };
    });

    return {
      results,
      deviceProfileKey: profile.deviceTypeKey,
      durationMs: Date.now() - start,
    };
  });
}

/** Internal helper for tests: resolve catalog metadata for a standard number. */
export async function _resolveCatalogMeta(
  orgId: string,
  standardNumber: string,
  client: DrizzleClient = db,
): Promise<{ id: string; version: string; body: string } | null> {
  const [row] = await client
    .select({
      id: standardsCatalog.id,
      version: standardsCatalog.version,
      body: standardsCatalog.body,
    })
    .from(standardsCatalog)
    .where(
      and(eq(standardsCatalog.orgId, orgId), eq(standardsCatalog.standardNumber, standardNumber)),
    )
    .limit(1);
  return row ?? null;
}
