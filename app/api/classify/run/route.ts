// @MX:NOTE [AUTO] POST /api/classify/run — run 5-jurisdiction device classification.
// @MX:SPEC SPEC-REGULA-CLASSIFY-001 (REQ-CLASSIFY-001~004, REQ-CLASSIFY-019, REQ-CLASSIFY-020)

import { internalDocsRetrieve } from '@/lib/ai/retrievers/internal-docs';
import { createHybridRaFetch } from '@/lib/api/hybrid-ra-client';
import { writeAudit } from '@/lib/audit';
import { withPermission } from '@/lib/auth/with-permission';
import { classifyDevice } from '@/lib/classify/engine';
import type { WizardAnswers } from '@/lib/classify/types';
import { db } from '@/lib/db/client';
import { deviceClassifications, workflowRuns } from '@/lib/db/schema';
import { sql } from 'drizzle-orm';
import { z } from 'zod';

const ClassifyRunSchema = z.object({
  deviceDescription: z.string().min(1).max(8000),
  deviceType: z.enum(['active', 'non_active', 'software_only', 'ivd', 'implantable']),
  contactType: z.enum(['no_contact', 'external', 'internal', 'implant']),
  hasSoftware: z.boolean().default(false),
  hasAiMl: z.boolean().default(false),
  isSterile: z.boolean().default(false),
  projectId: z.string().uuid().optional(),
});

export const POST = withPermission('classify.generate', async (req, _ctx, session) => {
  const organizationId = session.user.organizationId;
  if (!organizationId) {
    return Response.json({ error: 'Organization context required' }, { status: 403 });
  }

  const parsed = ClassifyRunSchema.safeParse(await req.json());
  if (!parsed.success) {
    return Response.json(
      { error: 'Invalid input', issues: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const body = parsed.data;

  // Persist the wizard input as the canonical answers fed to the engine.
  const wizardAnswers: WizardAnswers = {
    deviceDescription: body.deviceDescription,
    deviceType: body.deviceType,
    contactType: body.contactType,
    hasSoftware: body.hasSoftware,
    hasAiMl: body.hasAiMl,
    isSterile: body.isSterile,
  };

  // Create the workflow_runs row (type 'classify') for lifecycle tracking.
  const inserted = await db
    .insert(workflowRuns)
    .values({
      userId: session.user.id,
      organizationId,
      projectId: body.projectId ?? null,
      workflowType: 'classify',
      status: 'running',
      inputJson: wizardAnswers as unknown as Record<string, unknown>,
    })
    .returning({ id: workflowRuns.id });
  const runId = inserted[0]?.id;
  if (!runId) {
    return Response.json({ error: 'Failed to create workflow run' }, { status: 500 });
  }

  // Run the engine. createHybridRaFetch provides the LLM endpoint fetcher; the
  // engine falls back to its deterministic stub when the endpoint is unavailable.
  const hybridFetch = createHybridRaFetch();
  const result = await classifyDevice(wizardAnswers, {
    orgId: organizationId,
    userId: session.user.id,
    retrieveFn: internalDocsRetrieve,
    fetchFn: async (endpoint, init) => {
      const res = await hybridFetch(endpoint, init);
      return { json: async () => res };
    },
  });

  // Persist the classification result (mirror headline class/path into flat columns).
  await db.insert(deviceClassifications).values({
    orgId: organizationId,
    userId: session.user.id,
    workflowRunId: runId,
    deviceDescription: body.deviceDescription,
    deviceType: body.deviceType,
    contactType: body.contactType,
    hasSoftware: body.hasSoftware,
    hasAiMl: body.hasAiMl,
    isSterile: body.isSterile,
    fdaClass: result.fda.class,
    fdaPathway: result.fda.path,
    euClass: result.euMdr.class,
    euRule: result.euMdr.ruleNumbers?.join(', '),
    mfdsClass: result.mfds.class,
    nmpaClass: result.nmpa.class,
    pmdaClass: result.pmda.class,
    input: wizardAnswers as unknown as Record<string, unknown>,
    result: result as unknown as Record<string, unknown>,
    status: 'completed',
  });

  // Mark the workflow run complete.
  await db
    .update(workflowRuns)
    .set({
      status: 'approved',
      resultJson: result as unknown as Record<string, unknown>,
      completedAt: new Date(),
    })
    .where(sql`${workflowRuns.id} = ${runId}`);

  // Audit — 21 CFR Part 11. Non-PII context only.
  await writeAudit({
    actor_id: session.user.id,
    action: 'device_classified',
    resource_type: 'deviceClassification',
    resource_id: runId,
    meta_json: {
      deviceType: body.deviceType,
      contactType: body.contactType,
      hasAiMl: body.hasAiMl,
      fdaClass: result.fda.class,
      euClass: result.euMdr.class,
      samdFlag: result.samdFlag,
    },
  });

  return Response.json({ workflowRunId: runId, result }, { status: 201 });
});
