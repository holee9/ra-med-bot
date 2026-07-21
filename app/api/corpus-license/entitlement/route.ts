import { assertSourceLicenseInOrg } from '@/lib/corpus-license/access';
import { grantEntitlement, revokeEntitlement } from '@/lib/corpus-license/entitlement';
import { entitlementInputSchema } from '@/lib/corpus-license/types';
// @MX:NOTE [AUTO] POST /api/corpus-license/entitlement — grant/revoke entitlement.
// @MX:SPEC SPEC-REGULA-CORPUS-LICENSE-001 (REQ-CORPUSLIC-008, REQ-CORPUSLIC-012)
import { withPermission } from '@/lib/kernel/auth/with-permission';

/* audit-check-ignore: audit is written inside grantEntitlement()/revokeEntitlement()
   within the same tx (21 CFR Part 11 atomicity) — route-level writeAudit would duplicate */
export const POST = withPermission('corpuslicense.manage', async (req, _ctx, session) => {
  const organizationId = session.user.organizationId;
  if (!organizationId) {
    return Response.json({ error: 'Organization context required' }, { status: 403 });
  }
  const parsed = entitlementInputSchema.safeParse(await req.json());
  if (!parsed.success) {
    return Response.json(
      { error: 'validation_failed', issues: parsed.error.issues },
      { status: 400 },
    );
  }
  const body = parsed.data;

  // REQ-CORPUSLIC-012 IDOR: source_license must belong to caller's org.
  const lic = await assertSourceLicenseInOrg({
    sourceLicenseId: body.sourceLicenseId,
    orgId: organizationId,
    userId: session.user.id,
  });
  if (!lic) {
    return Response.json({ error: 'source_license_not_found' }, { status: 404 });
  }

  if (body.action === 'grant') {
    const res = await grantEntitlement({
      sourceLicenseId: body.sourceLicenseId,
      orgId: organizationId,
      grantedBy: session.user.id,
    });
    return Response.json(res, { status: 201 });
  }
  const res = await revokeEntitlement({
    sourceLicenseId: body.sourceLicenseId,
    orgId: organizationId,
    revokedBy: session.user.id,
  });
  return Response.json(res);
});
