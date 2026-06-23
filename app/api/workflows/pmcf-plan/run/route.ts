// @MX:NOTE [AUTO] POST /api/workflows/pmcf-plan/run — generate PMCF plan (Annex XIV Part B).
// @MX:SPEC SPEC-REGULA-PMS-001 (REQ-PMS-003, REQ-PMS-010, AC-03)

import { writeAudit } from '@/lib/audit';
import { withPermission } from '@/lib/auth/with-permission';
import { db } from '@/lib/db/client';
import { pmsDocuments, workflowRuns } from '@/lib/db/schema';
import { executePmcfPlan } from '@/lib/workflows/pmcf-plan/executor';
import { z } from 'zod';

const PmcfPlanRunSchema = z.object({
  projectId: z.string().uuid(),
  deviceName: z.string().min(1).max(256),
  deviceClass: z.enum(['I', 'Is', 'Im', 'IIa', 'IIb', 'III']),
});

async function postRun(
  request: Request,
  session: { user: { id: string; organizationId?: string } },
): Promise<Response> {
  const organizationId = session.user.organizationId;
  if (!organizationId) {
    return Response.json({ error: 'Organization context required' }, { status: 403 });
  }

  const parsed = PmcfPlanRunSchema.safeParse(await request.json());
  if (!parsed.success) {
    return Response.json(
      { error: 'Invalid input', details: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const body = parsed.data;

  const result = await executePmcfPlan(
    {
      orgId: organizationId,
      userId: session.user.id,
      projectId: body.projectId,
      deviceName: body.deviceName,
      deviceClass: body.deviceClass,
    },
    {}, // No fetchFn — structural checklist draft. UI calls BFF for LLM drafting.
  );

  let runId: string;
  let documentId: string;
  try {
    const txResult = await db.transaction(async (tx) => {
      const run = await tx
        .insert(workflowRuns)
        .values({
          userId: session.user.id,
          organizationId,
          projectId: body.projectId,
          workflowType: 'pmcf_plan',
          status: 'queued',
          inputJson: { deviceName: body.deviceName, deviceClass: body.deviceClass } as Record<
            string,
            unknown
          >,
        })
        .returning({ id: workflowRuns.id });

      const runId = run[0]?.id;
      if (!runId) throw new Error('workflow_runs insert returned no rows');

      const doc = await tx
        .insert(pmsDocuments)
        .values({
          orgId: organizationId,
          projectId: body.projectId,
          workflowRunId: runId,
          workflowType: 'pmcf_plan',
          body: { checklist: result.checklist, draftedContent: result.draftedContent } as Record<
            string,
            unknown
          >,
          complianceStatus: result.status,
          reviewStatus: 'draft',
          createdBy: session.user.id,
        })
        .returning({ id: pmsDocuments.id });

      const documentId = doc[0]?.id;
      if (!documentId) throw new Error('pms_documents insert returned no rows');

      await writeAudit(
        {
          actor_id: session.user.id,
          action: 'pmcf.plan_created',
          resource_type: 'pms_document',
          resource_id: documentId,
          meta_json: { projectId: body.projectId, workflowRunId: runId, status: result.status },
        },
        tx,
      );
      return { runId, documentId };
    });
    runId = txResult.runId;
    documentId = txResult.documentId;
  } catch (err) {
    console.error('pmcf.plan_created failed (transaction rolled back)', err);
    return Response.json({ error: 'Failed to generate plan' }, { status: 500 });
  }

  return Response.json(
    { runId, documentId, status: result.status, checklist: result.checklist },
    { status: 201 },
  );
}

export const POST = withPermission('workflow.execute', async (req, _ctx, session) =>
  postRun(req, session),
);
