// @MX:NOTE [AUTO] POST /api/ra/capa/records/[id]/qms-sync — QMS sync stub (REQ-009).
// @MX:SPEC SPEC-REGULA-CAPA-001 (REQ-009, AC-05)
//
// REQ-009: bidirectional CAPA status sync with QMS (#57). SPEC-REGULA-QMS-001
// is not yet implemented, so this route calls the stub (lib/capa/qms-sync.ts)
// which returns a deterministic no-op. The route is wired so when #57 lands
// only the stub body changes — the API contract is stable.

import { withPermission } from '@/lib/auth/with-permission';
import { syncCapaToQms } from '@/lib/capa/qms-sync';
import { getCapaRecord } from '@/lib/capa/records';

export const POST = withPermission('capa.qms_sync', async (_req, ctx, session) => {
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

  // IDOR defense: CAPA must belong to the caller's org.
  const capa = await getCapaRecord(capaId, organizationId);
  if (!capa) {
    return Response.json({ error: 'CAPA not found' }, { status: 404 });
  }

  // REQ-009 stub: no-op until #57 lands. The signature is stable.
  const result = await syncCapaToQms({ capaId, status: capa.status });

  return Response.json({
    capaId,
    qmsSync: result,
    // AC-05: surface the stub state so callers know sync is not yet active.
    stubNotice: 'QMS integration pending SPEC-REGULA-QMS-001 (#57)',
  });
});
