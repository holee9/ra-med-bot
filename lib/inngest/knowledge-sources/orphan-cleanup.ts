// @MX:NOTE [AUTO] Daily orphan sources cleanup cron (Issue 313).
// @MX:SPEC Issue 313 — orphan sources sunset (21 CFR Part 11 audit-material)
// @MX:REASON Phase D-2b (#307) re-sync supersession handles source_sections
//   (superseded_by set, excluded from retrieval), but the parent sources row
//   lingers as an orphan when all its sections are superseded. This cron
//   detects such orphans and sets approval_status='sunset' + sunset_date=today
//   so the source catalog stays clean and the retrieval gate permanently
//   excludes them (retrieval-gate.ts: approvalStatus !== 'approved').
//
// Design choice (dedicated cron vs inline cleanup in sync.ts):
//   A dedicated Inngest cron is chosen over inline cleanup at re-sync end.
//   Reasons: (1) matches the codebase pattern (weekly-sync, knowledge-gap-daily,
//   standards-revision-daily are all separate crons); (2) keeps sync.ts focused
//   on the ingestion path — scope discipline, since Issue 314 also touches
//   sync-adjacent code and isolating 313 reduces merge risk; (3) orphan
//   detection is a batch query better suited to a background cron than blocking
//   the re-sync response; (4) daily cadence is appropriate — orphan
//   accumulation is gradual, no urgency.
//
// Orphan definition:
//   A source is "orphan eligible for sunset" when ALL its source_sections are
//   superseded (no active section remains). Detected via NOT EXISTS active
//   section (superseded_by IS NULL). Sources already at approval_status='sunset'
//   or 'rejected' are skipped (idempotent — no re-sunset).
//
// Audit trail (21 CFR Part 11):
//   One 'source.orphan_sunsetted' audit row per sunset batch per org, with
//   meta_json listing the sunset sourceIds. System actor (cron has no session).
//   triggeredBy='cron' distinguishes from any future manual path.

import { inngest } from '../client';

/** Cron schedule: every day at 03:00 UTC (off-peak, daily cadence). */
export const ORPHAN_CLEANUP_CRON_SCHEDULE = '0 3 * * *';

/**
 * Daily orphan sources cleanup function. Registered with Inngest so the
 * dev/prod server triggers it on schedule.
 *
 * The cron iterates all orgs that have sources, detects orphans per-org
 * (withTenantScope enforces RLS org isolation), and sunsets them in a tx with
 * the audit write (21 CFR Part 11 atomicity — H2 pattern).
 */
export const knowledgeSourcesOrphanCleanupFn = inngest.createFunction(
  {
    id: 'knowledge-sources-orphan-cleanup',
    name: 'Daily Orphan Sources Cleanup',
    triggers: [{ cron: ORPHAN_CLEANUP_CRON_SCHEDULE }],
  },
  async ({ step, logger }) => {
    // Lazy imports — keeps the cron module import-light (L-003 pattern) and
    // avoids eagerly loading lib/db/client → lib/env at module registration
    // time (env validation requires DATABASE_URL etc. which are absent in the
    // Inngest function-registration test environment).
    const { db } = await import('@/lib/db/client');
    const { withTenantScope } = await import('@/lib/db/client');
    const { sources, sourceSections } = await import('@/lib/db/schema');
    const { writeAudit } = await import('@/lib/audit');
    const { and, eq, inArray, notExists, sql } = await import('drizzle-orm');

    // Step 1: enumerate distinct org_ids that have sources (system-actor query,
    // no RLS scope — db singleton bypasses RLS via the service role).
    const orgs = await step.run('enumerate-orgs', async () => {
      const rows = await db
        .select({ orgId: sources.organizationId })
        .from(sources)
        .groupBy(sources.organizationId);
      return rows.map((r) => r.orgId).filter((id): id is string => Boolean(id));
    });

    let totalSunset = 0;
    const perOrg: Record<string, number> = {};

    // Step 2: per-org orphan detection + sunset + audit.
    for (const orgId of orgs) {
      try {
        const sunsetCount = await step.run(`cleanup-org-${orgId}`, async () => {
          return await withTenantScope(orgId, async (tx) => {
            // Detect orphan sources: all sections superseded (NOT EXISTS active section).
            // Skip sources already sunset/rejected (idempotent).
            const orphans = await tx
              .select({ id: sources.id, title: sources.title })
              .from(sources)
              .where(
                and(
                  eq(sources.organizationId, orgId),
                  // Only sunset sources currently in active-or-pending state.
                  // Already-sunset or rejected sources are left alone.
                  inArray(sources.approvalStatus, ['pending_review', 'approved']),
                  // Orphan condition: no active (non-superseded) section exists.
                  notExists(
                    sql`SELECT 1 FROM ${sourceSections} ss WHERE ss.source_id = ${sources.id} AND ss.superseded_by IS NULL`,
                  ),
                ),
              );

            if (orphans.length === 0) return 0;

            const orphanIds = orphans.map((o) => o.id);
            const today = new Date().toISOString().slice(0, 10);

            // Sunset the orphans: approval_status='sunset' + sunset_date=today.
            await tx
              .update(sources)
              .set({
                approvalStatus: 'sunset',
                sunsetDate: today,
              })
              .where(inArray(sources.id, orphanIds));

            // 21 CFR Part 11 audit — single row per org batch. Non-PII meta only.
            // tx-scoped so the sunset + audit ride the same transaction boundary
            // (H2 atomicity pattern — a failure between them rolls back both).
            await writeAudit(
              {
                actor_id: null, // system actor — cron has no session
                action: 'source.orphan_sunsetted',
                resource_type: 'source',
                resource_id: `org:${orgId}`,
                meta_json: {
                  orgId,
                  sunsetCount: orphanIds.length,
                  sourceIds: orphanIds,
                  triggeredBy: 'cron',
                  reason: 'all source_sections superseded (orphan cleanup Issue 313)',
                },
              },
              tx,
            );

            return orphanIds.length;
          });
        });
        perOrg[orgId] = sunsetCount;
        totalSunset += sunsetCount;
      } catch (error) {
        // Per-org failure does NOT abort the whole run — other orgs still get cleaned.
        logger.error(`[orphan-cleanup] Failed for org ${orgId}:`, error);
        perOrg[orgId] = 0;
      }
    }

    logger.info('[orphan-cleanup] batch complete', { totalSunset, orgCount: orgs.length });
    return { totalSunset, orgCount: orgs.length, perOrg };
  },
);
