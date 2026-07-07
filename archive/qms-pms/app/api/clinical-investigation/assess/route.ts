// @MX:ANCHOR [AUTO] POST /api/clinical-investigation/assess — gap → necessity.
// @MX:REASON REQ-CLININV-001 entry point. fan_in from dashboard / RAG consult flow.

// @MX:LEGACY archived from app
//           Three-layer defense:
//             1) withPermission('clinical_investigation.assess') — ra-lead only.
//             2) IDOR gate via assertPmsProjectAccess when projectId is supplied.
//             3) RLS at the DB layer.
//           Mutation + audit ride the same db.transaction (H2 atomicity).
// @MX:SPEC SPEC-REGULA-CLINICAL-INVESTIGATION-001 (Issue #69, REQ-CLININV-001, AC-01)

import { writeAudit } from '@/lib/audit';
import { withPermission } from '@/lib/auth/with-permission';
import { assessNecessity } from '@/lib/clinical-investigation/gap-assessment';
import { assessInputSchema } from '@/lib/clinical-investigation/types';
import { db } from '@/lib/db/client';
import { clinicalInvestigations } from '@/lib/db/schema';
import { assertPmsProjectAccess } from '@/lib/pms/project-ownership';

export const POST = withPermission('clinical_investigation.assess', async (req, _ctx, session) => {
  const organizationId = session.user.organizationId;
  if (!organizationId) {
    return Response.json({ error: 'Organization context required' }, { status: 403 });
  }

  const parsed = assessInputSchema.safeParse(await req.json());
  if (!parsed.success) {
    return Response.json(
      { error: 'Invalid input', issues: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const input = parsed.data;

  // IDOR defense — when projectId is supplied, verify it belongs to the org.
  if (input.projectId) {
    const ok = await assertPmsProjectAccess(input.projectId, organizationId);
    if (!ok) {
      return Response.json({ error: 'Project not found' }, { status: 404 });
    }
  }

  // REQ-CLININV-010: gap assessment carries regulatory citations.
  const result = assessNecessity(input, []);

  try {
    // H2 atomicity: investigation record + audit row in one transaction.
    const inserted = await db.transaction(async (tx) => {
      const [row] = await tx
        .insert(clinicalInvestigations)
        .values({
          orgId: organizationId,
          projectId: input.projectId ?? null,
          necessityStatus: result.necessityStatus,
          necessityRationale: result.rationale,
          approvalStatus: 'draft',
          createdBy: session.user.id,
        })
        .returning({ id: clinicalInvestigations.id });

      if (!row) throw new Error('clinical_investigations insert returned no rows');

      await writeAudit(
        {
          actor_id: session.user.id,
          action: 'ci.assessed',
          resource_type: 'clinical_investigation',
          resource_id: row.id,
          meta_json: {
            investigationId: row.id,
            necessityStatus: result.necessityStatus,
            confidence: result.confidence,
            citationCount: result.citations.length,
          },
        },
        tx,
      );

      return row;
    });

    return Response.json(
      {
        id: inserted.id,
        necessityStatus: result.necessityStatus,
        recommendation: result.recommendation,
        rationale: result.rationale,
        citations: result.citations,
        confidence: result.confidence,
      },
      { status: 201 },
    );
  } catch (err) {
    console.error('ci.assess failed (transaction rolled back)', err);
    return Response.json({ error: 'Failed to create assessment' }, { status: 500 });
  }
});
