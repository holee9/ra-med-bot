// @MX:NOTE [AUTO] POST /api/classify/run — run 5-jurisdiction device classification.
// @MX:SPEC SPEC-REGULA-CLASSIFY-001 (REQ-CLASSIFY-001~004, REQ-CLASSIFY-019, REQ-CLASSIFY-020)

import { internalDocsRetrieve } from '@/lib/ai/retrievers/internal-docs';
import { createHybridRaFetch } from '@/lib/api/hybrid-ra-client';
import { classifyDevice } from '@/lib/classify/engine';
import type { WizardAnswers } from '@/lib/classify/types';
import { writeAudit } from '@/lib/kernel/audit';
import { withPermission } from '@/lib/kernel/auth/with-permission';
import { db } from '@/lib/kernel/db/client';
import { deviceClassifications, workflowRuns } from '@/lib/kernel/db/schema';
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
  try {
    const result = await classifyDevice(wizardAnswers, {
      orgId: organizationId,
      userId: session.user.id,
      retrieveFn: internalDocsRetrieve,
      fetchFn: async (endpoint, init) => {
        const res = await hybridFetch(endpoint, init);
        return { json: async () => res };
      },
    });

    // Persist the classification result + mark the run complete + audit ride ONE
    // db.transaction (21 CFR Part 11 §11.10(e), Issue #378 PR-D-1) so a crash
    // between them cannot leave a classification row with no audit trail. The
    // initial workflow_runs(running) INSERT stays outside this tx — it is a
    // pre-LLM lifecycle marker recorded before the (long, fallible) engine runs.
    await db.transaction(async (tx) => {
      // Persist the classification result (mirror headline class/path into flat columns).
      await tx.insert(deviceClassifications).values({
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
      await tx
        .update(workflowRuns)
        .set({
          status: 'approved',
          resultJson: result as unknown as Record<string, unknown>,
          completedAt: new Date(),
        })
        .where(sql`${workflowRuns.id} = ${runId}`);

      // Audit — 21 CFR Part 11. Non-PII context only.
      await writeAudit(
        {
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
        },
        tx,
      );
    });

    return Response.json({ workflowRunId: runId, result }, { status: 201 });
  } catch (err) {
    // H1 — fail closed: mark the run failed, audit the failure (error message only,
    // never deviceDescription), return a structured 502. The failed-status update
    // + failure audit ride one db.transaction (21 CFR Part 11 §11.10(e), #378 PR-D-1).
    const message = err instanceof Error ? err.message : 'unknown_error';
    await db.transaction(async (tx) => {
      await tx
        .update(workflowRuns)
        .set({ status: 'failed', completedAt: new Date() })
        .where(sql`${workflowRuns.id} = ${runId}`);
      await writeAudit(
        {
          actor_id: session.user.id,
          action: 'device_classified',
          resource_type: 'deviceClassification',
          resource_id: runId,
          meta_json: { error: message },
        },
        tx,
      );
    });
    return Response.json({ error: 'classification_failed' }, { status: 502 });
  }
});
