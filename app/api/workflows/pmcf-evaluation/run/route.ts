// @MX:NOTE [AUTO] POST /api/workflows/pmcf-evaluation/run — PMCF evaluation draft (REQ-PMS-011).
// @MX:SPEC SPEC-REGULA-PMS-001 (REQ-PMS-011, REQ-PMS-010)

import { writeAudit } from '@/lib/audit';
import { withPermission } from '@/lib/auth/with-permission';
import { db } from '@/lib/db/client';
import { pmsDocuments, workflowRuns } from '@/lib/db/schema';
import { executePmcfEvaluation } from '@/lib/workflows/pmcf-evaluation/executor';
import { z } from 'zod';

const PmcfEvaluationRunSchema = z.object({
  projectId: z.string().uuid(),
  deviceName: z.string().min(1).max(256),
  deviceClass: z.enum(['I', 'Is', 'Im', 'IIa', 'IIb', 'III']),
  pmcfPlan: z.object({
    objectives: z.array(z.string()).min(1),
    methods: z.array(z.string()).default([]),
  }),
  collectedData: z.object({
    registrySize: z.number().int().min(0),
    adverseEvents: z.number().int().min(0),
    surveyResponses: z.number().int().min(0).default(0),
    followUpDurationMonths: z.number().int().min(0).default(0),
  }),
});

async function postRun(
  request: Request,
  session: { user: { id: string; organizationId?: string } },
): Promise<Response> {
  const organizationId = session.user.organizationId;
  if (!organizationId) {
    return Response.json({ error: 'Organization context required' }, { status: 403 });
  }

  const parsed = PmcfEvaluationRunSchema.safeParse(await request.json());
  if (!parsed.success) {
    return Response.json(
      { error: 'Invalid input', details: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const body = parsed.data;

  const result = await executePmcfEvaluation(
    {
      orgId: organizationId,
      userId: session.user.id,
      projectId: body.projectId,
      deviceName: body.deviceName,
      deviceClass: body.deviceClass,
    },
    { pmcfPlan: body.pmcfPlan, collectedData: body.collectedData },
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
          workflowType: 'pmcf_evaluation',
          status: result.status === 'complete' ? 'queued' : 'pending_review',
          inputJson: body as unknown as Record<string, unknown>,
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
          workflowType: 'pmcf_evaluation',
          body: { sections: result.sections, objectiveStatus: result.objectiveStatus } as Record<
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
          action: 'pmcf.evaluation_drafted',
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
    console.error('pmcf.evaluation_drafted failed (transaction rolled back)', err);
    return Response.json({ error: 'Failed to draft evaluation' }, { status: 500 });
  }

  return Response.json(
    { runId, documentId, status: result.status, sections: result.sections },
    { status: 201 },
  );
}

export const POST = withPermission('workflow.execute', async (req, _ctx, session) =>
  postRun(req, session),
);
