// @MX:NOTE [AUTO] POST /api/source-governance/[id]/sync — manual delta-sync run.
// @MX:SPEC SPEC-REGULA-DELTA-SYNC-001 (Issue #45/#300, REQ-DELTA-001..007, AC-05)
//
// Route choice: this lives under the sourcegov.manage tree alongside
// `[id]/supersede` because delta-sync is a per-source governance operation on
// an IDOR-verified sourceId. A parallel `/api/radar/delta-sync/run` tree would
// duplicate the IDOR pattern without adding any isolation guarantee — the
// orchestrator already requires a known sourceId. RBAC sourcegov.manage +
// IDOR via getSourceInOrg (runDeltaSync step 1 re-verifies). Audit
// corpus.sync_started/completed/failed (migration 0065) fire inside the
// orchestrator; this route emits no additional audit because the regulated
// event IS the sync lifecycle.

import { withPermission } from '@/lib/kernel/auth/with-permission';
import { runDeltaSync } from '@/lib/radar/delta-sync';
import { z } from 'zod';

const SyncRequestSchema = z.object({
  crawlerName: z.string().min(1).max(120),
  sourceUrl: z.string().url().max(2048),
  rawContent: z.string().min(1).max(2_000_000), // 2MB hard cap — regulatory text
  actorId: z.string().uuid().nullable().optional(),
});

async function resolveRouteId(ctx: {
  params?: Record<string, string | string[]> | Promise<Record<string, string | string[]>>;
}): Promise<string> {
  const params = ctx.params && 'then' in ctx.params ? await ctx.params : (ctx.params ?? {});
  const raw = (params as Record<string, string | string[]>).id;
  return Array.isArray(raw) ? (raw[0] ?? '') : (raw ?? '');
}

/* audit-check-ignore: audit (source.delta_sync_updated) is written inside runDeltaSync()
   within the same tx (21 CFR Part 11 atomicity) — route-level writeAudit would duplicate */
export const POST = withPermission('sourcegov.manage', async (req, ctx, session) => {
  const organizationId = session.user.organizationId;
  if (!organizationId) {
    return Response.json({ error: 'Organization context required' }, { status: 403 });
  }
  const sourceId = await resolveRouteId(ctx);
  if (!sourceId) {
    return Response.json({ error: 'source_id_required' }, { status: 400 });
  }

  const parsed = SyncRequestSchema.safeParse(await req.json());
  if (!parsed.success) {
    return Response.json(
      { error: 'validation_failed', issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const result = await runDeltaSync({
    orgId: organizationId,
    sourceId,
    crawlerName: parsed.data.crawlerName,
    sourceUrl: parsed.data.sourceUrl,
    rawContent: parsed.data.rawContent,
    actorId: parsed.data.actorId ?? session.user.id,
  });

  // IDOR: orchestrator could not verify the source belongs to the org.
  if (result.status === 'failed' && result.errorMessage === 'source_not_found_in_org') {
    return Response.json({ error: 'source_not_found' }, { status: 404 });
  }

  if (result.status === 'failed') {
    // @MX:NOTE [AUTO] M-1 (expert-security): do NOT echo errorMessage to the
    // caller. A mid-pipeline DB/driver error could expose connection strings,
    // schema names, or table names. The detailed message is already captured
    // server-side: orchestrator.ts writes it to corpus_sync_runs.errorMessage
    // AND to the corpus.sync_failed audit meta_json.error, and emits a
    // logger.error. The HTTP response carries only a generic error + runId
    // (runId lets ops cross-reference the server-side detail).
    return Response.json({ error: 'sync_failed', runId: result.runId }, { status: 500 });
  }

  return Response.json(result, { status: 200 });
});
