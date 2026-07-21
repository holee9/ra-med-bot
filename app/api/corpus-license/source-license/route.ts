import { assertSourceInOrg } from '@/lib/corpus-license/access';
import { auditCorpusAccessDenied, auditLicenseSet } from '@/lib/corpus-license/audit';
import { sourceLicenseInputSchema } from '@/lib/corpus-license/types';
// @MX:NOTE [AUTO] POST/GET/PUT /api/corpus-license/source-license — license metadata CRUD.
// @MX:SPEC SPEC-REGULA-CORPUS-LICENSE-001 (REQ-CORPUSLIC-001, REQ-CORPUSLIC-010, REQ-CORPUSLIC-012)
import { withPermission } from '@/lib/kernel/auth/with-permission';
import { db } from '@/lib/kernel/db/client';
import { sourceLicense } from '@/lib/kernel/db/schema';
import { and, eq } from 'drizzle-orm';

// GET — list licenses for the caller's org. REQ-CORPUSLIC-001.
export const GET = withPermission('corpuslicense.view', async (_req, _ctx, session) => {
  const organizationId = session.user.organizationId;
  if (!organizationId) {
    return Response.json({ error: 'Organization context required' }, { status: 403 });
  }
  const rows = await db.select().from(sourceLicense).where(eq(sourceLicense.orgId, organizationId));
  return Response.json({ licenses: rows });
});

// POST — create license metadata. REQ-CORPUSLIC-001/010.
/* audit-check-ignore: this route calls auditLicenseSet()/auditCorpusAccessDenied() (lib
   audit wrappers) within the same tx (Part 11 atomicity) — route-level writeAudit would duplicate */
export const POST = withPermission('corpuslicense.manage', async (req, _ctx, session) => {
  const organizationId = session.user.organizationId;
  if (!organizationId) {
    return Response.json({ error: 'Organization context required' }, { status: 403 });
  }
  const parsed = sourceLicenseInputSchema.safeParse(await req.json());
  if (!parsed.success) {
    return Response.json(
      { error: 'validation_failed', issues: parsed.error.issues },
      { status: 400 },
    );
  }
  const body = parsed.data;

  // REQ-CORPUSLIC-012 IDOR: source must belong to the caller's org.
  const ok = await assertSourceInOrg({
    sourceId: body.sourceId,
    orgId: organizationId,
    userId: session.user.id,
  });
  if (!ok) {
    return Response.json({ error: 'source_not_found' }, { status: 404 });
  }

  return db.transaction(async (tx) => {
    const inserted = await tx
      .insert(sourceLicense)
      .values({
        orgId: organizationId,
        sourceId: body.sourceId,
        licenseType: body.licenseType,
        entitlementRef: body.entitlementRef ?? null,
        permittedUse: body.permittedUse,
        fullTextAllowed: body.fullTextAllowed,
        abstractOnly: body.abstractOnly,
        confidentialityLevel: body.confidentialityLevel,
        expiryDate: body.expiryDate ?? null,
        createdBy: session.user.id,
      })
      .returning({ id: sourceLicense.id });

    const created = inserted[0];
    if (!created) throw new Error('source_license_insert_failed');

    await auditLicenseSet(
      {
        userId: session.user.id,
        sourceLicenseId: created.id,
        sourceId: body.sourceId,
        licenseType: body.licenseType,
        expiryDate: body.expiryDate ?? null,
      },
      tx,
    );
    return Response.json({ id: created.id }, { status: 201 });
  });
});

// PUT — update license metadata. REQ-CORPUSLIC-010.
export const PUT = withPermission('corpuslicense.manage', async (req, _ctx, session) => {
  const organizationId = session.user.organizationId;
  if (!organizationId) {
    return Response.json({ error: 'Organization context required' }, { status: 403 });
  }
  const parsed = sourceLicenseInputSchema.safeParse(await req.json());
  if (!parsed.success) {
    return Response.json(
      { error: 'validation_failed', issues: parsed.error.issues },
      { status: 400 },
    );
  }
  const body = parsed.data;

  // IDOR: find existing license scoped to org. Cross-org → 404 + audit.
  const [existing] = await db
    .select({ id: sourceLicense.id, orgId: sourceLicense.orgId, sourceId: sourceLicense.sourceId })
    .from(sourceLicense)
    .where(eq(sourceLicense.sourceId, body.sourceId))
    .limit(1);
  if (!existing || existing.orgId !== organizationId) {
    if (existing && existing.orgId !== organizationId) {
      await auditCorpusAccessDenied({
        userId: session.user.id,
        sourceId: body.sourceId,
        reason: 'source_license_cross_org',
      });
    }
    return Response.json({ error: 'source_license_not_found' }, { status: 404 });
  }

  return db.transaction(async (tx) => {
    await tx
      .update(sourceLicense)
      .set({
        licenseType: body.licenseType,
        entitlementRef: body.entitlementRef ?? null,
        permittedUse: body.permittedUse,
        fullTextAllowed: body.fullTextAllowed,
        abstractOnly: body.abstractOnly,
        confidentialityLevel: body.confidentialityLevel,
        expiryDate: body.expiryDate ?? null,
        updatedAt: new Date(),
      })
      .where(and(eq(sourceLicense.id, existing.id), eq(sourceLicense.orgId, organizationId)));

    await auditLicenseSet(
      {
        userId: session.user.id,
        sourceLicenseId: existing.id,
        sourceId: existing.sourceId,
        licenseType: body.licenseType,
        expiryDate: body.expiryDate ?? null,
      },
      tx,
    );
    return Response.json({ id: existing.id });
  });
});
