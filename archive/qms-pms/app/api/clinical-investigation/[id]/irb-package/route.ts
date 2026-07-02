// @MX:NOTE [AUTO] POST /api/clinical-investigation/[id]/irb-package — REQ-004/007, AC-03.
// @MX:SPEC SPEC-REGULA-CLINICAL-INVESTIGATION-001 (Issue #69, REQ-CLININV-004, AC-03)
// @MX:TODO [AUTO] eSubmit bundle assembly is DEFERRED to Issue 65 (eSubmit dependency).
//   This route persists a DRAFT only; it does NOT submit to FDA / EUDAMED.

import { writeAudit } from '@/lib/audit';
import { withPermission } from '@/lib/auth/with-permission';
import { assertInvestigationAccess, resolveRouteId } from '@/lib/clinical-investigation/access';
import { buildIrbPackageDraft } from '@/lib/clinical-investigation/irb-package';
import { irbPackageInputSchema } from '@/lib/clinical-investigation/types';
import { db } from '@/lib/db/client';
import { ciDocuments, clinicalInvestigations } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export const POST = withPermission('clinical_investigation.manage', async (req, ctx, session) => {
  const organizationId = session.user.organizationId;
  if (!organizationId) {
    return Response.json({ error: 'Organization context required' }, { status: 403 });
  }
  const investigationId = await resolveRouteId(ctx);

  const investigation = await assertInvestigationAccess(investigationId, organizationId);
  if (!investigation) {
    return Response.json({ error: 'Investigation not found' }, { status: 404 });
  }

  const parsed = irbPackageInputSchema.safeParse(await req.json());
  if (!parsed.success) {
    return Response.json(
      { error: 'Invalid input', issues: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const input = parsed.data;

  const pkg = buildIrbPackageDraft(input, {
    intendedUse: investigation.necessityRationale ?? undefined,
  });
  // @MX:TODO [AUTO] M-1 prompt-injection defense DEFERRED. tier1 is deterministic
  //   (no LLM), so necessityRationale is only interpolated into template text.
  //   When tier2 LLM wiring lands, this field MUST be wrapped in
  //   `<UNTRUSTED_USER_CONTENT>` markers and the system prompt MUST instruct the
  //   model to treat it as data, not instructions (OWASP LLM01).

  try {
    const documentIds = await db.transaction(async (tx) => {
      // Persist pathway on the parent investigation.
      await tx
        .update(clinicalInvestigations)
        .set({ pathway: input.pathway, updatedAt: new Date() })
        .where(eq(clinicalInvestigations.id, investigationId));

      const ids: Record<string, string> = {};

      const persistDoc = async (
        docType: 'irb_package' | 'consent' | 'brochure' | 'monitoring_plan',
        content: string,
      ): Promise<void> => {
        if (!content) return;
        const [row] = await tx
          .insert(ciDocuments)
          .values({
            orgId: organizationId,
            investigationId,
            docType,
            content,
          })
          .returning({ id: ciDocuments.id });
        if (row) ids[docType] = row.id;
      };

      await persistDoc('irb_package', pkg.irbPackage);
      if (pkg.consentDraft) await persistDoc('consent', pkg.consentDraft);
      if (pkg.brochure) await persistDoc('brochure', pkg.brochure);
      if (pkg.monitoringPlan) await persistDoc('monitoring_plan', pkg.monitoringPlan);

      await writeAudit(
        {
          actor_id: session.user.id,
          action: 'ci.irb_package_drafted',
          resource_type: 'clinical_investigation',
          resource_id: investigationId,
          meta_json: {
            investigationId,
            pathway: input.pathway,
            includeConsent: input.includeConsentDraft,
            includeBrochure: input.includeBrochure,
            includeMonitoringPlan: input.includeMonitoringPlan,
            documentIds: ids,
          },
        },
        tx,
      );

      return ids;
    });

    return Response.json(
      {
        pathway: input.pathway,
        documentIds,
        irbPackage: pkg.irbPackage,
        consentDraft: pkg.consentDraft,
        brochure: pkg.brochure,
        monitoringPlan: pkg.monitoringPlan,
        citations: pkg.citations,
      },
      { status: 201 },
    );
  } catch (err) {
    console.error('ci.irb-package failed (transaction rolled back)', err);
    return Response.json({ error: 'Failed to generate IRB package' }, { status: 500 });
  }
});
