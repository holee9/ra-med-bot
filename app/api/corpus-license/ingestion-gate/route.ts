// @MX:NOTE [AUTO] POST /api/corpus-license/ingestion-gate — pre-ingest license check.
// @MX:SPEC SPEC-REGULA-CORPUS-LICENSE-001 (REQ-CORPUSLIC-002, REQ-CORPUSLIC-003, REQ-CORPUSLIC-004)
//
// Primary call site for assertIngestionLicensed (REQ-002 gate). The lib/ingest/
// pipeline calls this endpoint (or the lib function directly) before embedding.
import { withPermission } from '@/lib/auth/with-permission';
import { assertIngestionLicensed } from '@/lib/corpus-license/license-gate';
import { ingestionGateInputSchema } from '@/lib/corpus-license/types';

export const POST = withPermission('corpuslicense.view', async (req, _ctx, session) => {
  const organizationId = session.user.organizationId;
  if (!organizationId) {
    return Response.json({ error: 'Organization context required' }, { status: 403 });
  }
  const parsed = ingestionGateInputSchema.safeParse(await req.json());
  if (!parsed.success) {
    return Response.json(
      { error: 'validation_failed', issues: parsed.error.issues },
      { status: 400 },
    );
  }
  const body = parsed.data;

  const result = await assertIngestionLicensed({
    sourceId: body.sourceId,
    orgId: organizationId,
    userId: session.user.id,
    wantsFullText: body.wantsFullText,
  });

  // REQ-003/004: blocked ingestion returns 403; allowed returns 200.
  return Response.json(result, { status: result.allowed ? 200 : 403 });
});
