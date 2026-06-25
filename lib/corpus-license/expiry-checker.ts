// @MX:ANCHOR [AUTO] filterExpiredSources — corpus search license-status filter.
// @MX:REASON fan_in >= 3: lib/ai/retrievers/hybrid-search.ts, internal-sops.ts,
//   and integration tests all call this. REQ-008 compliance gate — expired or
//   revoked-entitlement sources MUST be excluded from RAG retrieval results.
//   A dead-code definition without a call site is a SPEC violation.
// @MX:SPEC SPEC-REGULA-CORPUS-LICENSE-001 (REQ-CORPUSLIC-008, REQ-CORPUSLIC-014)
import { db } from '@/lib/db/client';
import { entitlement, sourceLicense } from '@/lib/db/schema';
import { and, eq, inArray } from 'drizzle-orm';

/**
 * REQ-008 — given a set of sourceIds, return the subset that are LICENSED and
 * SEARCH-ELIGIBLE (not expired, not entitlement-revoked).
 *
 * Wired at:
 *   - lib/ai/retrievers/hybrid-search.ts (post-filter on retrieved sections)
 *   - lib/ai/retrievers/internal-sops.ts (post-filter on retrieved sections)
 *
 * Sources with NO source_license row are considered unlicensed and excluded
 * from the eligible set (REQ-003 strict mode: ingestion gate prevents such
 * sources from entering source_sections, but defense-in-depth here too).
 */
export async function filterExpiredSources(
  sourceIds: string[],
  orgId: string,
): Promise<Set<string>> {
  if (sourceIds.length === 0) return new Set();

  // Fetch all licenses for the candidate set, then filter in-app by date.
  // Drizzle date comparison on text columns is simpler in JS than SQL here.
  const candidates = await db
    .select({
      sourceId: sourceLicense.sourceId,
      id: sourceLicense.id,
      expiryDate: sourceLicense.expiryDate,
    })
    .from(sourceLicense)
    .where(and(eq(sourceLicense.orgId, orgId), inArray(sourceLicense.sourceId, sourceIds)));

  const today = new Date().toISOString().slice(0, 10);
  const activeLicenses = candidates.filter((r) => r.expiryDate === null || r.expiryDate >= today);

  // Among active licenses, drop any whose entitlement is revoked or expired.
  const licenseIds = activeLicenses.map((r) => r.id);
  if (licenseIds.length === 0) return new Set();

  const revoked = await db
    .select({ sourceLicenseId: entitlement.sourceLicenseId })
    .from(entitlement)
    .where(
      and(
        eq(entitlement.orgId, orgId),
        inArray(entitlement.sourceLicenseId, licenseIds),
        inArray(entitlement.status, ['revoked', 'expired']),
      ),
    );
  const revokedLicenseIds = new Set(revoked.map((r) => r.sourceLicenseId));

  const eligible = new Set<string>();
  for (const row of activeLicenses) {
    if (!revokedLicenseIds.has(row.id)) {
      eligible.add(row.sourceId);
    }
  }
  return eligible;
}

/**
 * REQ-014 — return source_licenses expiring within `withinDays` (default 30),
 * for the admin expiry-warning dashboard. PII-free.
 */
export async function getExpiryWarnings(
  orgId: string,
  withinDays = 30,
): Promise<
  Array<{ sourceLicenseId: string; sourceId: string; licenseType: string; expiryDate: string }>
> {
  const today = new Date();
  const horizon = new Date(today.getTime() + withinDays * 24 * 60 * 60 * 1000);
  const todayStr = today.toISOString().slice(0, 10);
  const horizonStr = horizon.toISOString().slice(0, 10);

  // Fetch all org licenses and filter in-app: upcoming expiries (>= today, <= horizon).
  // NULL expiry_date rows are excluded (they never expire).
  const rows = await db
    .select({
      sourceLicenseId: sourceLicense.id,
      sourceId: sourceLicense.sourceId,
      licenseType: sourceLicense.licenseType,
      expiryDate: sourceLicense.expiryDate,
    })
    .from(sourceLicense)
    .where(eq(sourceLicense.orgId, orgId));

  return rows
    .filter((r) => r.expiryDate !== null && r.expiryDate >= todayStr && r.expiryDate <= horizonStr)
    .map((r) => ({
      sourceLicenseId: r.sourceLicenseId,
      sourceId: r.sourceId,
      licenseType: r.licenseType,
      expiryDate: r.expiryDate as string,
    }));
}
