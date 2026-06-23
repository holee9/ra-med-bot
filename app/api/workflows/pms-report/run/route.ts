// @MX:NOTE [AUTO] POST /api/workflows/pms-report/run — generate PMS report (MDCG 2022-21).
// @MX:SPEC SPEC-REGULA-PMS-001 (REQ-PMS-002, REQ-PMS-004, REQ-PMS-008, REQ-PMS-010, AC-02)

import { hybridSearch } from '@/lib/ai/retrievers/hybrid-search';
import { writeAudit } from '@/lib/audit';
import { withPermission } from '@/lib/auth/with-permission';
import { db } from '@/lib/db/client';
import { pmsDocuments, workflowRuns } from '@/lib/db/schema';
import { resolveCerLinkage } from '@/lib/pms/cer-linkage';
import { assertPmsProjectAccess } from '@/lib/pms/project-ownership';
import {
  type PmsFetchFn,
  type PmsRetriever,
  executePmsReport,
} from '@/lib/workflows/pms-report/executor';
import { z } from 'zod';

const PmsReportRunSchema = z.object({
  projectId: z.string().uuid(),
  deviceName: z.string().min(1).max(256),
  deviceClass: z.enum(['I', 'Is', 'Im', 'IIa', 'IIb', 'III']),
  cerData: z
    .object({
      cerId: z.string(),
      deviceName: z.string(),
      intendedUse: z.string(),
      riskProfile: z.string(),
    })
    .nullable()
    .default(null),
});

const retrievePmsReportSources: PmsRetriever = async (query) => {
  const chunks = await hybridSearch(query, 'all', 8, 'regs');
  return chunks.map((chunk) => ({
    source: [chunk.orgLabel, chunk.title].filter(Boolean).join(' - '),
    section: chunk.anchor || chunk.title,
  }));
};

function createRouteFetch(request: Request): PmsFetchFn {
  const origin = new URL(request.url).origin;
  return async (endpoint, options) => {
    const res = await fetch(new URL(endpoint, origin), options);
    if (!res.ok) {
      throw new Error(`PMS report LLM endpoint failed with ${res.status}`);
    }
    return { json: () => res.json() };
  };
}

async function postRun(
  request: Request,
  session: { user: { id: string; organizationId?: string } },
): Promise<Response> {
  const organizationId = session.user.organizationId;
  if (!organizationId) {
    return Response.json({ error: 'Organization context required' }, { status: 403 });
  }

  const parsed = PmsReportRunSchema.safeParse(await request.json());
  if (!parsed.success) {
    return Response.json(
      { error: 'Invalid input', details: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const body = parsed.data;

  const accessDenied = await assertPmsProjectAccess(body.projectId, organizationId);
  if (accessDenied) return accessDenied;

  // REQ-PMS-004 AC-04: CER linkage. Manual cerData (caller-provided) is the
  // functional path today. Auto-discovery returns null gracefully in production
  // (CER results not yet persisted locally — hybrid-ra-saas BFF). See
  // lib/pms/cer-linkage.ts DEFERRED note. PMS draft still created, cerLinked=false.
  const cerData = await resolveCerLinkage(body.projectId, organizationId, body.cerData);

  let result: Awaited<ReturnType<typeof executePmsReport>>;
  try {
    result = await executePmsReport(
      {
        orgId: organizationId,
        userId: session.user.id,
        projectId: body.projectId,
        deviceName: body.deviceName,
        deviceClass: body.deviceClass,
      },
      {
        retrieveFn: retrievePmsReportSources,
        fetchFn: createRouteFetch(request),
        cerData,
      },
    );
  } catch (err) {
    console.error('pms.report generation dependency failed', err);
    return Response.json({ error: 'PMS report generation service unavailable' }, { status: 503 });
  }

  // Mutation + audit in one transaction (H2 atomicity).
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
          workflowType: 'pms_report',
          status: result.status === 'pending' ? 'pending_review' : 'queued',
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
          workflowType: 'pms_report',
          cerRef: cerData?.cerId ?? null,
          body: result.sections as Record<string, unknown>,
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
          action: 'pms.report_created',
          resource_type: 'pms_document',
          resource_id: documentId,
          meta_json: {
            projectId: body.projectId,
            workflowRunId: runId,
            confidence: result.confidence,
            cerLinked: result.cerLinked,
          },
        },
        tx,
      );

      if (result.cerLinked) {
        await writeAudit(
          {
            actor_id: session.user.id,
            action: 'pms.cer_linked',
            resource_type: 'pms_document',
            resource_id: documentId,
            meta_json: { cerRef: cerData?.cerId },
          },
          tx,
        );
      }

      return { runId, documentId };
    });
    runId = txResult.runId;
    documentId = txResult.documentId;
  } catch (err) {
    console.error('pms.report_created failed (transaction rolled back)', err);
    return Response.json({ error: 'Failed to generate report' }, { status: 500 });
  }

  return Response.json(
    {
      runId,
      documentId,
      status: result.status,
      confidence: result.confidence,
      sections: result.sections,
    },
    { status: 201 },
  );
}

export const POST = withPermission('workflow.execute', async (req, _ctx, session) =>
  postRun(req, session),
);
