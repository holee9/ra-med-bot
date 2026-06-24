// @MX:NOTE [AUTO] POST /api/clinical-investigation/[id]/links — REQ-009, AC-04.
// @MX:SPEC SPEC-REGULA-CLINICAL-INVESTIGATION-001 (Issue #69, REQ-CLININV-009, AC-04)

import { writeAudit } from '@/lib/audit';
import { withPermission } from '@/lib/auth/with-permission';
import { assertInvestigationAccess, resolveRouteId } from '@/lib/clinical-investigation/access';
import {
  linkInvestigationResults,
  verifyLinkTargetExists,
} from '@/lib/clinical-investigation/linkage';
import { ciLinkInputSchema } from '@/lib/clinical-investigation/types';
import { db } from '@/lib/db/client';

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

  const parsed = ciLinkInputSchema.safeParse(await req.json());
  if (!parsed.success) {
    return Response.json(
      { error: 'Invalid input', issues: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const input = parsed.data;

  // H-4 fix: validate the referent row exists AND belongs to the caller's org
  // before linking. Without this, a caller could point a ci_links row at any
  // UUID (nonexistent or another org's CER/PMS/DHF deliverable). 404 — never
  // 403 — so UUID probing is not possible. Mirrors capa verifyTargetExists.
  const targetValid = await verifyLinkTargetExists(
    organizationId,
    input.targetType,
    input.targetId,
  );
  if (!targetValid) {
    return Response.json(
      { error: 'Link target not found in caller organization' },
      { status: 404 },
    );
  }

  try {
    const result = await db.transaction(async (tx) => {
      const link = await linkInvestigationResults(
        {
          investigationId,
          orgId: organizationId,
          targetType: input.targetType,
          targetId: input.targetId,
        },
        tx,
      );

      await writeAudit(
        {
          actor_id: session.user.id,
          action: 'ci.results_linked',
          resource_type: 'clinical_investigation',
          resource_id: investigationId,
          meta_json: {
            investigationId,
            linkId: link.id,
            targetType: input.targetType,
            targetId: input.targetId,
          },
        },
        tx,
      );

      return link;
    });

    return Response.json(result, { status: 201 });
  } catch (err) {
    console.error('ci.links failed (transaction rolled back)', err);
    return Response.json({ error: 'Failed to create link' }, { status: 500 });
  }
});
