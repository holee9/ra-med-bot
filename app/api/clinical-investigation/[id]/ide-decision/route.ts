// @MX:NOTE [AUTO] POST /api/clinical-investigation/[id]/ide-decision — REQ-002.
// @MX:SPEC SPEC-REGULA-CLINICAL-INVESTIGATION-001 (Issue #69, REQ-CLININV-002, AC-02)

import { writeAudit } from '@/lib/audit';
import { withPermission } from '@/lib/auth/with-permission';
import { assertInvestigationAccess, resolveRouteId } from '@/lib/clinical-investigation/access';
import { decideIdePathway } from '@/lib/clinical-investigation/ide-decision-tree';
import { ideDecisionInputSchema } from '@/lib/clinical-investigation/types';
import { db } from '@/lib/db/client';
import { clinicalInvestigations } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export const POST = withPermission('clinical_investigation.assess', async (req, ctx, session) => {
  const organizationId = session.user.organizationId;
  if (!organizationId) {
    return Response.json({ error: 'Organization context required' }, { status: 403 });
  }
  const investigationId = await resolveRouteId(ctx);

  const investigation = await assertInvestigationAccess(investigationId, organizationId);
  if (!investigation) {
    return Response.json({ error: 'Investigation not found' }, { status: 404 });
  }

  const parsed = ideDecisionInputSchema.safeParse(await req.json());
  if (!parsed.success) {
    return Response.json(
      { error: 'Invalid input', issues: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const input = parsed.data;

  const decision = decideIdePathway(input, []);

  try {
    await db.transaction(async (tx) => {
      await tx
        .update(clinicalInvestigations)
        .set({ pathway: 'fda_ide', updatedAt: new Date() })
        .where(eq(clinicalInvestigations.id, investigationId));

      await writeAudit(
        {
          actor_id: session.user.id,
          action: 'ci.pathway_determined',
          resource_type: 'clinical_investigation',
          resource_id: investigationId,
          meta_json: {
            investigationId,
            pathway: 'fda_ide',
            confidence: decision.confidence,
            riskLevel: input.riskLevel,
          },
        },
        tx,
      );
    });

    return Response.json({
      pathway: decision.pathway,
      decision: decision.decision,
      regulatoryBasis: decision.regulatoryBasis,
      citations: decision.citations,
      confidence: decision.confidence,
    });
  } catch (err) {
    console.error('ci.ide-decision failed (transaction rolled back)', err);
    return Response.json({ error: 'Failed to record pathway decision' }, { status: 500 });
  }
});
