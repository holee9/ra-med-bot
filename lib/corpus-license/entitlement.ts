// @MX:NOTE [AUTO] Entitlement grant/revoke lifecycle helpers (REQ-CORPUSLIC-008).
// @MX:SPEC SPEC-REGULA-CORPUS-LICENSE-001 (REQ-CORPUSLIC-008)
import { db } from '@/lib/db/client';
import { entitlement, sourceLicense } from '@/lib/db/schema';
import { and, eq } from 'drizzle-orm';
import { auditEntitlementGranted, auditEntitlementRevoked } from './audit';

/**
 * REQ-008 — grant an entitlement for a source_license. Idempotent: if an active
 * entitlement already exists, returns it without creating a duplicate.
 *
 * The `tx` parameter infers its full Drizzle type from db.transaction; it
 * satisfies AuditDbHandle structurally (has `insert`) so it can be passed to
 * the audit helpers without a cast.
 */
export async function grantEntitlement(params: {
  sourceLicenseId: string;
  orgId: string;
  grantedBy: string;
}): Promise<{ entitlementId: string; created: boolean }> {
  return db.transaction(async (tx) => {
    // Verify the source_license belongs to this org (IDOR guard).
    const [lic] = await tx
      .select({ id: sourceLicense.id, orgId: sourceLicense.orgId })
      .from(sourceLicense)
      .where(eq(sourceLicense.id, params.sourceLicenseId))
      .limit(1);
    if (!lic || lic.orgId !== params.orgId) {
      return { entitlementId: '', created: false };
    }

    const [existing] = await tx
      .select({ id: entitlement.id })
      .from(entitlement)
      .where(
        and(
          eq(entitlement.sourceLicenseId, params.sourceLicenseId),
          eq(entitlement.orgId, params.orgId),
          eq(entitlement.status, 'active'),
        ),
      )
      .limit(1);
    if (existing) {
      return { entitlementId: existing.id, created: false };
    }

    const inserted = await tx
      .insert(entitlement)
      .values({
        orgId: params.orgId,
        sourceLicenseId: params.sourceLicenseId,
        status: 'active',
        grantedBy: params.grantedBy,
      })
      .returning({ id: entitlement.id });
    const created = inserted[0];
    if (!created) throw new Error('entitlement_insert_failed');

    await auditEntitlementGranted(
      {
        userId: params.grantedBy,
        entitlementId: created.id,
        sourceLicenseId: params.sourceLicenseId,
      },
      tx,
    );
    return { entitlementId: created.id, created: true };
  });
}

/**
 * REQ-008 — revoke an active entitlement. The source is immediately excluded
 * from corpus search (filterExpiredSources reads status 'revoked').
 */
export async function revokeEntitlement(params: {
  sourceLicenseId: string;
  orgId: string;
  revokedBy: string;
}): Promise<{ entitlementId: string; revoked: boolean }> {
  return db.transaction(async (tx) => {
    const [active] = await tx
      .select({ id: entitlement.id })
      .from(entitlement)
      .where(
        and(
          eq(entitlement.sourceLicenseId, params.sourceLicenseId),
          eq(entitlement.orgId, params.orgId),
          eq(entitlement.status, 'active'),
        ),
      )
      .limit(1);
    if (!active) {
      return { entitlementId: '', revoked: false };
    }

    await tx
      .update(entitlement)
      .set({ status: 'revoked', revokedBy: params.revokedBy, revokedAt: new Date() })
      .where(eq(entitlement.id, active.id));

    await auditEntitlementRevoked(
      {
        userId: params.revokedBy,
        entitlementId: active.id,
        sourceLicenseId: params.sourceLicenseId,
      },
      tx,
    );
    return { entitlementId: active.id, revoked: true };
  });
}
