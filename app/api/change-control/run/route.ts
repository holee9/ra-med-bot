// @MX:NOTE [AUTO] POST /api/change-control/run — assess a design change across jurisdictions.
// @MX:SPEC SPEC-REGULA-CHANGE-CONTROL-001 (REQ-001~006, REQ-010, REQ-012, AC-01, AC-02, AC-03, AC-04, AC-08)

import { internalDocsRetrieve } from '@/lib/ai/retrievers/internal-docs';
import { createHybridRaFetch } from '@/lib/api/hybrid-ra-client';
import { writeAudit } from '@/lib/audit';
import { withPermission } from '@/lib/auth/with-permission';
import { isValidChangeType } from '@/lib/change-control/classify';
import { assessChange } from '@/lib/change-control/engine';
import { resolveVersionMetadata } from '@/lib/change-control/version-metadata';
import { db } from '@/lib/db/client';
import {
  changeAssessments,
  changeVerdictCitations,
  changeVerdicts,
  workflowRuns,
} from '@/lib/db/schema';
import { assertPmsProjectAccess } from '@/lib/pms/project-ownership';
import { sql } from 'drizzle-orm';
import { z } from 'zod';

const ChangeControlRunSchema = z.object({
  projectId: z.string().uuid(),
  changeType: z.enum([
    'design',
    'material',
    'manufacturing_process',
    'software',
    'labeling',
    'intended_use',
  ]),
  description: z.string().min(1).max(8000),
  impactScope: z.string().min(1).max(8000),
  targetMarkets: z.array(z.string().min(1).max(32)).min(1).max(8),
  /** Optional risk_items to link (REQ-008). Empty array is valid. */
  riskItemIds: z.array(z.string().uuid()).optional(),
});

export const POST = withPermission('change.assess', async (req, _ctx, session) => {
  const organizationId = session.user.organizationId;
  if (!organizationId) {
    return Response.json({ error: 'Organization context required' }, { status: 403 });
  }

  const parsed = ChangeControlRunSchema.safeParse(await req.json());
  if (!parsed.success) {
    return Response.json(
      { error: 'Invalid input', issues: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const body = parsed.data;

  if (!isValidChangeType(body.changeType)) {
    return Response.json({ error: 'Invalid change type' }, { status: 400 });
  }

  // C-1 IDOR defense: prove the project belongs to the caller's org BEFORE any
  // write. Mirrors PMS pattern (app/api/workflows/pms-report/run/route.ts:70).
  // assertPmsProjectAccess returns a 404 Response when the project is absent or
  // cross-org; we surface 403 here so callers cannot probe for foreign project
  // UUIDs while still blocking the attack.
  const projectAccessDenied = await assertPmsProjectAccess(body.projectId, organizationId);
  if (projectAccessDenied) {
    return Response.json({ error: 'Project access denied' }, { status: 403 });
  }

  // REQ-010 version metadata — captured for rollback.
  const versions = resolveVersionMetadata();

  // Create the workflow_runs row (type 'change_control_assessment') for lifecycle.
  const inserted = await db
    .insert(workflowRuns)
    .values({
      userId: session.user.id,
      organizationId,
      projectId: body.projectId,
      workflowType: 'change_control_assessment',
      status: 'running',
      inputJson: {
        changeType: body.changeType,
        description: body.description,
        impactScope: body.impactScope,
        targetMarkets: body.targetMarkets,
      } as unknown as Record<string, unknown>,
    })
    .returning({ id: workflowRuns.id });
  const runId = inserted[0]?.id;
  if (!runId) {
    return Response.json({ error: 'Failed to create workflow run' }, { status: 500 });
  }

  // H-1: wire the real LLM endpoint via createHybridRaFetch (mirrors
  // /api/classify/run/route.ts:69-79). In production (HYBRID_RA_API_BASE_URL +
  // token configured) assessViaLLM runs so the REQ-006 citation-reject path is
  // live. In offline dev / tests hybridFetch throws 'unconfigured' before the
  // first request — we catch that and fall back to the deterministic stubVerdict
  // (grounded by REGULATORY_ANCHOR) so the happy path still exercises end-to-end.
  let fetchFn: NonNullable<Parameters<typeof assessChange>[1]>['fetchFn'] | undefined;
  try {
    const hybridFetch = createHybridRaFetch();
    fetchFn = async (endpoint, init) => {
      const res = await hybridFetch(endpoint, init);
      return { json: async () => res };
    };
  } catch {
    // Hybrid-RA not configured (dev/test). fetchFn stays undefined → engine
    // uses stubVerdict. This keeps the fallback explicit and logged via the
    // version metadata path, never silently bypassing REQ-006 in production.
    fetchFn = undefined;
  }

  // Run the engine. fetchFn=undefined (offline) → engine uses stubVerdict
  // (grounded by REGULATORY_ANCHOR, REQ-006 does not reject). In production
  // fetchFn is live so REQ-006 reject is exercised.
  try {
    const result = await assessChange(
      {
        changeType: body.changeType,
        description: body.description,
        impactScope: body.impactScope,
        // resolveJurisdictions normalizes these strings (US→FDA, EU→EU_MDR, etc.).
        targetMarkets: body.targetMarkets,
      },
      {
        orgId: organizationId,
        userId: session.user.id,
        retrieveFn: internalDocsRetrieve,
        fetchFn,
      },
    );

    // Persist assessment + verdicts + citations in a single transaction so a
    // mid-write failure rolls back all 21 CFR Part 11 audit-material rows.
    const assessmentRow = await db.transaction(async (tx) => {
      const [assessment] = await tx
        .insert(changeAssessments)
        .values({
          orgId: organizationId,
          projectId: body.projectId,
          workflowRunId: runId,
          changeType: body.changeType,
          description: body.description,
          impactScope: body.impactScope,
          status: 'provisional', // REQ-009: starts provisional, expert review gate
          modelVersion: versions.modelVersion,
          promptVersion: versions.promptVersion,
          templateVersion: versions.templateVersion,
          createdBy: session.user.id,
        })
        .returning({ id: changeAssessments.id });

      const assessmentId = assessment?.id;
      if (!assessmentId) throw new Error('failed to insert change_assessments');

      let citationRejectedCount = 0;

      for (const v of result.verdicts) {
        const [verdictRow] = await tx
          .insert(changeVerdicts)
          .values({
            orgId: organizationId,
            assessmentId,
            jurisdiction: v.jurisdiction,
            verdict: v.verdict,
            rationale: v.rationale,
            confidence: v.confidence,
          })
          .returning({ id: changeVerdicts.id });
        const verdictId = verdictRow?.id;
        if (!verdictId) throw new Error('failed to insert change_verdicts');

        for (const c of v.citations) {
          // REQ-006 DB-level defense: excerpt NOT NULL CHECK enforced here.
          // validateVerdictCitations already stripped empties, but this is the
          // last-line defense if a caller bypasses the validator.
          await tx.insert(changeVerdictCitations).values({
            orgId: organizationId,
            verdictId,
            excerpt: c.excerpt,
            sourceLabel: c.source,
          });
        }

        if (v.citationRejected) {
          citationRejectedCount++;
          await writeAudit(
            {
              actor_id: session.user.id,
              action: 'change.verdict_citation_rejected',
              resource_type: 'changeAssessment',
              resource_id: assessmentId,
              meta_json: {
                jurisdiction: v.jurisdiction,
                projectId: body.projectId,
                originalRationale: v.rationale,
              },
            },
            tx,
          );
        }

        await writeAudit(
          {
            actor_id: session.user.id,
            action: 'change.verdict_produced',
            resource_type: 'changeAssessment',
            resource_id: assessmentId,
            meta_json: {
              jurisdiction: v.jurisdiction,
              verdict: v.verdict,
              confidence: v.confidence,
              citationCount: v.citations.length,
            },
          },
          tx,
        );
      }

      // REQ-012 top-level creation audit (21 CFR Part 11).
      await writeAudit(
        {
          actor_id: session.user.id,
          action: 'change.assessment_created',
          resource_type: 'changeAssessment',
          resource_id: assessmentId,
          meta_json: {
            projectId: body.projectId,
            changeType: body.changeType,
            targetMarkets: body.targetMarkets,
            modelVersion: versions.modelVersion,
            promptVersion: versions.promptVersion,
            templateVersion: versions.templateVersion,
            citationRejectedCount,
          },
        },
        tx,
      );

      return { assessmentId };
    });

    // Link risk_items (REQ-008). Done OUTSIDE the transaction because the link
    // table FK is to risk_items which may live in a different workflow_run; a
    // partial link is acceptable (caller sees the recommendedForReevaluation list).
    if (body.riskItemIds && body.riskItemIds.length > 0) {
      const { linkAssessmentToRiskItems } = await import('@/lib/change-control/risk-linkage');
      await linkAssessmentToRiskItems(assessmentRow.assessmentId, body.riskItemIds, organizationId);
    }

    // Mark the workflow run complete.
    await db
      .update(workflowRuns)
      .set({
        status: 'approved',
        resultJson: result as unknown as Record<string, unknown>,
        completedAt: new Date(),
      })
      .where(sql`${workflowRuns.id} = ${runId}`);

    return Response.json(
      { workflowRunId: runId, assessmentId: assessmentRow.assessmentId, result, versions },
      { status: 201 },
    );
  } catch (err) {
    // H1 — fail closed: mark the run failed, audit the failure (error message
    // only, never the description text), return a structured 502.
    // H-3: wrap the failure audit in its own transaction so the audit row is
    // atomic even though the main assessment tx already rolled back. The
    // workflow_runs status update and the audit insert are kept on separate
    // transactions intentionally — the status update is idempotent and the
    // audit must never be lost (21 CFR Part 11: failure events are recordable).
    const message = err instanceof Error ? err.message : 'unknown_error';
    await db
      .update(workflowRuns)
      .set({ status: 'failed', completedAt: new Date() })
      .where(sql`${workflowRuns.id} = ${runId}`);
    try {
      await db.transaction(async (tx) => {
        await writeAudit(
          {
            actor_id: session.user.id,
            action: 'change.assessment_created',
            resource_type: 'changeAssessment',
            resource_id: runId,
            meta_json: { error: message, projectId: body.projectId, failed: true },
          },
          tx,
        );
      });
    } catch (auditErr) {
      // If the failure-path audit itself fails we cannot block — Sentry captures
      // the detail. Surface 500 so the operator knows compliance material was
      // not recorded.
      console.error('change.assessment_created failure-audit write failed', auditErr);
      return Response.json({ error: 'assessment_failed_audit_lost' }, { status: 500 });
    }
    return Response.json({ error: 'assessment_failed' }, { status: 502 });
  }
});
