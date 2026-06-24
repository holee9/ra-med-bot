// @MX:NOTE [AUTO] POST /api/ra/capa/records/[id]/root-cause — RCA (5 Whys / Fishbone) (REQ-003).
// @MX:SPEC SPEC-REGULA-CAPA-001 (REQ-003, AC-04)

import { withPermission } from '@/lib/auth/with-permission';
import { auditCapaRootCauseDocumented } from '@/lib/capa/audit';
import { getCapaRecord } from '@/lib/capa/records';
import { saveRootCause } from '@/lib/capa/records';
import { validateRootCauseAnalysis } from '@/lib/capa/root-cause';
import { db } from '@/lib/db/client';
import { z } from 'zod';

const FiveWhysSchema = z.object({
  why1: z.string(),
  why2: z.string(),
  why3: z.string(),
  why4: z.string(),
  why5: z.string(),
  rootCause: z.string(),
});

const FishboneSchema = z.object({
  man: z.array(z.string()).default([]),
  machine: z.array(z.string()).default([]),
  material: z.array(z.string()).default([]),
  method: z.array(z.string()).default([]),
  measurement: z.array(z.string()).default([]),
  environment: z.array(z.string()).default([]),
  rootCause: z.string(),
});

const RootCauseSchema = z.object({
  method: z.enum(['5whys', 'fishbone']),
  analysisData: z.unknown(),
  summary: z.string().min(1).max(4000),
});

export const POST = withPermission('capa.root_cause', async (req, ctx, session) => {
  const organizationId = session.user.organizationId;
  if (!organizationId) {
    return Response.json({ error: 'Organization context required' }, { status: 403 });
  }

  const rawParams = ctx.params;
  const resolvedParams = rawParams && 'then' in rawParams ? await rawParams : rawParams;
  const capaId = resolvedParams?.id ?? '';

  if (!capaId) {
    return Response.json({ error: 'capa id required' }, { status: 400 });
  }

  const parsed = RootCauseSchema.safeParse(await req.json());
  if (!parsed.success) {
    return Response.json(
      { error: 'validation_failed', issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const body = parsed.data;

  // REQ-003: validate the analysis structure before persisting.
  // method-specific schema validation + semantic validation (non-empty chains).
  let analysisData: unknown = body.analysisData;
  if (body.method === '5whys') {
    const p = FiveWhysSchema.safeParse(body.analysisData);
    if (!p.success) {
      return Response.json({ error: 'invalid_5whys', issues: p.error.issues }, { status: 400 });
    }
    analysisData = p.data;
  } else {
    const p = FishboneSchema.safeParse(body.analysisData);
    if (!p.success) {
      return Response.json({ error: 'invalid_fishbone', issues: p.error.issues }, { status: 400 });
    }
    analysisData = p.data;
  }

  const errors = validateRootCauseAnalysis(body.method, analysisData);
  if (errors.length > 0) {
    return Response.json({ error: 'invalid_analysis', issues: errors }, { status: 400 });
  }

  // IDOR defense: CAPA must belong to the caller's org.
  const capa = await getCapaRecord(capaId, organizationId);
  if (!capa) {
    return Response.json({ error: 'CAPA not found' }, { status: 404 });
  }

  // REQ-003: persist the root cause analysis.
  //
  // H-2 fix (Part 11 atomicity): the RCA insert + audit ride the same
  // transaction boundary so a mid-write failure cannot leave an RCA without
  // an audit row. Mirrors the PMS close route pattern.
  let rootCauseId = '';
  try {
    await db.transaction(async (tx) => {
      rootCauseId = await saveRootCause(
        {
          capaId,
          orgId: organizationId,
          createdBy: session.user.id,
          method: body.method,
          analysisData,
          summary: body.summary,
        },
        tx,
      );

      // REQ-010 / AC-04: audit the RCA documentation.
      await auditCapaRootCauseDocumented(
        {
          userId: session.user.id,
          capaId,
          method: body.method,
        },
        tx,
      );
    });
  } catch (err) {
    console.error('capa.root_cause_documented failed (transaction rolled back)', err);
    return Response.json({ error: 'root_cause_failed' }, { status: 500 });
  }

  return Response.json({ rootCauseId, capaId }, { status: 201 });
});
