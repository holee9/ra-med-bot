// @MX:ANCHOR [AUTO] POST /api/ra/workflows/cer — CER run + PMS local persistence.
// @MX:REASON fan_in >= 3 (CerStartForm, PMS auto-linkage query, integration tests).
//           Cross-SPEC contract: SPEC-REGULA-CER-001 (REQ-CER-036~040) +
//           SPEC-REGULA-PMS-001 (AC-04 / REQ-PMS-004).
// @MX:SPEC SPEC-REGULA-PMS-001 (AC-04, REQ-PMS-004) + SPEC-REGULA-CER-001
import { writeAudit } from '@/lib/audit';
import { withPermission } from '@/lib/auth/with-permission';
import type { AuthSession } from '@/lib/auth/with-permission';
import { auditCerCreated, auditCerLiteratureSearch } from '@/lib/cer/audit';
import { assembleCer } from '@/lib/cer/cer-assembler';
import { formatVancouver } from '@/lib/cer/citation-formatter';
import { type AppraisalResult, appraiseEvidence } from '@/lib/cer/literature-appraisal';
import type { CerStageId } from '@/lib/cer/meddev-stages';
import { assertPmsProjectAccess } from '@/lib/cer/project-ownership';
import { searchPubMed } from '@/lib/cer/pubmed-client';
import { db } from '@/lib/db/client';
import { workflowRuns } from '@/lib/db/schema';
import { CerInputSchema } from '@/lib/workflows/types';

// REQ-CER-016: literature search retrieves >=50 abstracts per query.
const LITERATURE_MAX_RESULTS = 50;

async function postCer(request: Request, session: AuthSession): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid input', details: {} }, { status: 400 });
  }

  const result = CerInputSchema.safeParse(body);
  if (!result.success) {
    return Response.json(
      { error: 'Invalid input', details: result.error.format() },
      { status: 400 },
    );
  }

  const data = result.data;
  const runId = crypto.randomUUID();
  const organizationId = session.user.organizationId ?? '';

  // SPEC-REGULA-PMS-001 (REQ-PMS-010): when a projectId is supplied, prove the
  // project belongs to the caller's org BEFORE any external work (IDOR guard).
  // assertPmsProjectAccess returns null on success, or a 404 Response on denial.
  if (data.projectId) {
    if (!organizationId) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }
    const denied = await assertPmsProjectAccess(data.projectId, organizationId);
    if (denied) return denied;
  }

  // REQ-CER-036: record CER creation before any external work.
  await auditCerCreated(session.user.id, runId);

  // REQ-CER-016~022: fetch and appraise literature.
  const articles = await searchPubMed(data.pubmedQuery, LITERATURE_MAX_RESULTS);
  const literature = articles.map((article) => {
    const appraisal: AppraisalResult = appraiseEvidence(article);
    return {
      ...article,
      citation: formatVancouver(article),
      appraisal,
    };
  });

  // REQ-CER-040: audit the literature search (query text NOT persisted).
  await auditCerLiteratureSearch(session.user.id, runId, data.pubmedQuery, articles.length);

  // Assemble the initial CerDocument. No stage content is authored yet, so all
  // 10 MEDDEV stages are emitted empty/incomplete (REQ-CER-031).
  const cerDocument = assembleCer({
    cerRunId: runId,
    deviceName: data.deviceName,
    manufacturer: data.manufacturer,
    stageContent: new Map<CerStageId, string>(),
    literature: articles,
  });

  // SPEC-REGULA-PMS-001 (AC-04 / REQ-PMS-004): persist to workflow_runs when a
  // projectId is present, so PMS report auto-linkage resolves in production.
  // The workflow_runs insert and a cer_persisted audit (with persisted meta) ride
  // the SAME db.transaction — 21 CFR Part 11 atomicity (H2 pattern): a failure
  // between the two rolls back both.
  // input_json is PII-safe: PubMed query text is NOT stored, only its length
  // (mirrors lib/cer/audit.ts auditCerLiteratureSearch).
  let workflowRunId: string | undefined;
  if (data.projectId && organizationId) {
    const inserted = await db.transaction(async (tx) => {
      const rows = await tx
        .insert(workflowRuns)
        .values({
          userId: session.user.id,
          organizationId,
          projectId: data.projectId,
          workflowType: 'cer',
          status: 'approved',
          inputJson: {
            deviceName: data.deviceName,
            manufacturer: data.manufacturer,
            pubmedQueryLength: data.pubmedQuery.length,
          },
          resultJson: {
            cerRunId: runId,
            deviceName: data.deviceName,
            manufacturer: data.manufacturer,
            intendedUse: data.intendedUse ?? '',
            literatureCount: articles.length,
          },
        })
        .returning({ id: workflowRuns.id });
      const rowId = rows[0]?.id;
      if (!rowId) throw new Error('workflow_runs insert returned no rows');

      // H2 atomicity: audit + mutation ride the same transaction.
      await writeAudit(
        {
          actor_id: session.user.id,
          action: 'cer_persisted',
          resource_type: 'cer_run',
          resource_id: runId,
          meta_json: {
            workflowRunId: rowId,
            projectId: data.projectId,
            persisted: true,
          },
        },
        tx,
      );
      return rowId;
    });
    workflowRunId = inserted;
  }

  return Response.json(
    {
      runId,
      workflowType: 'cer',
      status: 'queued',
      cerDocument,
      literature,
      literatureCount: articles.length,
      ...(workflowRunId ? { workflowRunId } : {}),
      queuedAt: new Date().toISOString(),
    },
    { status: 202 },
  );
}

export const POST = withPermission('consult.create', async (request, _ctx, session) =>
  postCer(request, session),
);
