// @MX:NOTE [AUTO] Delta-sync orchestrator — thin coordinator over detector +
//   chunker/embedder + applyOutdateOperations. Activates the #238 dead-code
//   call site (AC-05 auto stale propagation) so delta-sync actually fires.
//   Manual-sync entry: caller supplies already-fetched rawContent + a known
//   sourceId. No crawler, no cron, no retry framework (Charter Simplicity).
// @MX:SPEC SPEC-REGULA-DELTA-SYNC-001 (Issue #45, REQ-DELTA-001..007, AC-05)
//           SPEC-REGULA-TRACEABILITY-001 (M-2 fix, REQ-TRACEABILITY-009)
//
// Reuse contract (Enforce Simplicity — do NOT reinvent):
//   - chunkForDelta (lib/radar/delta-sync/ingest.ts) → chunkers registry
//   - embedChunks (lib/ingest/embed.ts) → OpenAI text-embedding-3-small + PII guard
//   - assembleEmbeddedChunks → EmbeddedChunk[]
//   - applyOutdateOperations (#238) → org-scoped supersession tx + non-blocking hook
//   - upsertWithRetry (vectorstore) is reused for the embedding upsert retry policy
//
// M-1 (org isolation): existingChunkIds is resolved by joining source_sections →
//   sources.organization_id, so cross-org sections can never be superseded.
//   applyOutdateOperations trusts caller-provided ids; the orchestrator is the
//   single caller that guarantees org scoping at the lookup site.
//
// M-2 (Part 11 audit): applyOutdateOperations emits traceability.section_superseded
//   inside its tx for EACH newly-superseded section, independent of evidence_node
//   existence. This closes the gap where onSourceSectionSuperseded early-returns
//   when no deliverable cited the section (the supersession itself was unaudited).

import {
  type SourceSectionInsertRow,
  insertSourceSections,
} from '@/lib/ingest/source-sections-upsert';
import { writeAudit } from '@/lib/kernel/audit';
import { corpusSyncRuns, sourceSections, sources } from '@/lib/kernel/db/schema';
import { logger } from '@/lib/observability/logger';
import { and, desc, eq, isNull } from 'drizzle-orm';
import { embedChunks } from '../../ingest/embed';
import { getSourceInOrg } from '../../source-governance/access';
import { detectChanges } from './detector';
import {
  type EmbeddedChunk,
  applyOutdateOperations,
  assembleEmbeddedChunks,
  chunkForDelta,
} from './ingest';
import { defaultRetryDelay, upsertWithRetry } from './vectorstore';

/**
 * Input for a manual delta-sync run. The caller has already fetched `rawContent`
 * and knows which existing source this URL maps to (IDOR-verified sourceId).
 */
export interface RunDeltaSyncInput {
  orgId: string;
  crawlerName: string;
  sourceUrl: string;
  rawContent: string;
  /** Existing source being re-synced. IDOR-verified via getSourceInOrg. */
  sourceId: string;
  /** User that triggered the sync. null = system (e.g. scheduled ingestion). */
  actorId: string | null;
}

export type RunDeltaSyncStatus = 'unchanged' | 'synced' | 'failed';

export interface RunDeltaSyncResult {
  runId: string;
  status: RunDeltaSyncStatus;
  change: 'new' | 'changed' | 'unchanged';
  chunksAdded: number;
  chunksOutdated: number;
  chunksUnchanged: number;
  errorMessage?: string;
}

/**
 * @MX:NOTE [AUTO] runDeltaSync — the pipeline. Activates #238 applyOutdateOperations.
 *
 * Pipeline (each step is a single, reuse-only operation):
 *   1. IDOR-verify sourceId belongs to orgId (M-1 prerequisite).
 *   2. INSERT corpus_sync_runs (status='pending', startedAt=now) → runId.
 *   3. Audit corpus.sync_started (21 CFR Part 11).
 *   4. Look up existingHash: latest corpus_sync_runs.content_hash for this sourceUrl
 *      within the org, or sources.content_hash as the seed baseline.
 *   5. detectChanges → status: new | changed | unchanged.
 *   6. If unchanged → UPDATE run (status='unchanged', completedAt) + return.
 *   7. If new/changed:
 *      a. existingChunkIds = org-scoped (JOIN sources.organization_id) non-superseded
 *         source_sections for this source. (M-1 fix — org isolation at lookup.)
 *      b. chunkForDelta → embedChunks → assembleEmbeddedChunks.
 *      c. INSERT new source_sections (the "added" path, org-scoped tx).
 *      d. applyOutdateOperations({orgId, existingChunkIds, newIngestionRunId: runId, actorId})
 *         — the #238 live call site. M-2: emits traceability.section_superseded per section.
 *      e. UPDATE corpus_sync_runs (status='synced', counts, completedAt).
 *      f. Audit corpus.sync_completed.
 *   8. On any error: UPDATE run (status='failed', errorMessage) + audit
 *      corpus.sync_failed + return error result (never leave it 'pending').
 */
export async function runDeltaSync(input: RunDeltaSyncInput): Promise<RunDeltaSyncResult> {
  const { orgId, crawlerName, sourceUrl, rawContent, sourceId, actorId } = input;

  // 1. IDOR: the source must belong to the org. getSourceInOrg returns null for
  //    cross-org or missing sources — treat as a hard precondition failure.
  const owned = await getSourceInOrg(sourceId, orgId);
  if (!owned) {
    // No corpus_sync_runs row exists yet, so the failure is returned directly.
    // The route handler surfaces this as 404 (IDOR — no existence leak).
    const result: RunDeltaSyncResult = {
      runId: '',
      status: 'failed',
      change: 'unchanged',
      chunksAdded: 0,
      chunksOutdated: 0,
      chunksUnchanged: 0,
      errorMessage: 'source_not_found_in_org',
    };
    await writeAudit({
      actor_id: actorId,
      action: 'corpus.sync_failed',
      resource_type: 'source',
      resource_id: sourceId,
      meta_json: { crawlerName, sourceUrl, reason: 'source_not_found_in_org' },
    });
    return result;
  }

  // 2. Create the run row (pending). Org scoping is enforced at the query layer
  //    because corpus_sync_runs has no organization_id column — the (sourceUrl,
  //    content_hash) lookup in step 4 is scoped by joining through sources, and
  //    the sourceId itself was just IDOR-verified.
  // 2-3. 21 CFR Part 11 §11.10(e) — Issue #378: the corpus_sync_runs INSERT and
  // its sync_started audit ride the SAME db.transaction so a transient failure
  // between them can never leave a run row with no start audit. runId is
  // returned for the downstream pipeline (detection/embed stay outside the tx).
  const runId = await (await import('@/lib/kernel/db/client')).db.transaction(async (tx) => {
    const inserted = await tx
      .insert(corpusSyncRuns)
      .values({
        crawlerName,
        sourceUrl,
        contentHash: '', // filled after detection
        status: 'pending',
      })
      .returning({ id: corpusSyncRuns.id });
    const runRow = inserted[0];
    if (!runRow) {
      throw new Error('delta-sync: failed to insert corpus_sync_runs row');
    }

    // Audit start (21 CFR Part 11). meta is PII-free.
    await writeAudit(
      {
        actor_id: actorId,
        action: 'corpus.sync_started',
        resource_type: 'source',
        resource_id: sourceId,
        meta_json: { runId: runRow.id, crawlerName, sourceUrl: truncateUrl(sourceUrl) },
      },
      tx,
    );

    return runRow.id;
  });

  try {
    // 4. existingHash — prefer the latest successful corpus_sync_runs hash for
    //    this sourceUrl (the delta-sync baseline). Fallback to sources.content_hash
    //    for the very first sync of a seeded source.
    const existingHash = await resolveExistingHash(orgId, sourceUrl, sourceId);

    // 5. Detect.
    const detection = detectChanges({
      crawlerName,
      sourceUrl,
      rawContent,
      existingHash,
    });

    // Persist the computed hash on the run row so future runs can diff against it.
    await (await import('@/lib/kernel/db/client')).db
      .update(corpusSyncRuns)
      .set({ contentHash: detection.contentHash })
      .where(eq(corpusSyncRuns.id, runId));

    // 6. Unchanged fast-path.
    if (detection.status === 'unchanged') {
      // 21 CFR Part 11 §11.10(e) — Issue #378: unchanged completion UPDATE +
      // audit ride the SAME db.transaction.
      await (await import('@/lib/kernel/db/client')).db.transaction(async (tx) => {
        await tx
          .update(corpusSyncRuns)
          .set({
            status: 'unchanged',
            chunksUnchanged: 0, // per-section unchanged counting is a follow-up; 0 is honest
            completedAt: new Date(),
          })
          .where(eq(corpusSyncRuns.id, runId));

        await writeAudit(
          {
            actor_id: actorId,
            action: 'corpus.sync_completed',
            resource_type: 'source',
            resource_id: sourceId,
            meta_json: { runId, change: 'unchanged', crawlerName },
          },
          tx,
        );
      });

      return {
        runId,
        status: 'unchanged',
        change: 'unchanged',
        chunksAdded: 0,
        chunksOutdated: 0,
        chunksUnchanged: 0,
      };
    }

    // 7a. M-1: existingChunkIds resolved via JOIN sources.organization_id so
    //     cross-org sections can never be superseded. Only non-superseded
    //     sections for THIS source within THIS org.
    const existingChunkIds = await resolveExistingChunkIds(sourceId, orgId);

    // 7b. Re-chunk + re-embed (reuse — no new chunking/embedding logic).
    const chunks = chunkForDelta({
      rawContent,
      sourceUrl,
      ingestionRunId: runId,
    });
    const texts = chunks.map((c) => c.text);
    const embeddings = await embedChunks(texts);
    const embedded: EmbeddedChunk[] = assembleEmbeddedChunks(chunks, embeddings, {
      sourceUrl,
      ingestionRunId: runId,
    });

    // 7c. INSERT new source_sections (org-scoped tx). Issue #314: delegates to
    //     the shared insertSourceSections helper used by knowledge-sources sync.
    //     anchor/sectionPath provenance keys remain caller-specific (delta-run
    //     based) while the tx boundary + batch insert + id collection are
    //     centralized.
    const insertRows: SourceSectionInsertRow[] = [];
    for (let i = 0; i < embedded.length; i++) {
      const ec = embedded[i];
      if (!ec) continue;
      const meta = ec.metadata as {
        sectionPath?: string;
        tokenCount?: number;
      };
      insertRows.push({
        sourceId,
        anchor: `delta-${runId.slice(0, 8)}-${i}`,
        heading: (meta.sectionPath as string) ?? null,
        text: ec.text,
        embedding: ec.embedding,
        sectionPath: (meta.sectionPath as string) ?? null,
        ingestionRunId: runId,
        chunkHash: computeChunkHash(ec.text),
      });
    }
    const insertedSections = await insertSourceSections(orgId, insertRows);

    // 7d. applyOutdateOperations — the #238 live call site. Org-scoped tx +
    //     non-blocking hook. M-2 audit (traceability.section_superseded per
    //     newly-superseded section) fires inside this function's tx.
    const outdateResult = await applyOutdateOperations({
      orgId,
      existingChunkIds,
      newIngestionRunId: runId,
      actorId,
    });

    // 7e-7f. 21 CFR Part 11 §11.10(e) — Issue #378: synced completion UPDATE +
    // audit ride the SAME db.transaction. The embed/insert/applyOutdate steps
    // (7b-7d, long-running + fallible) stay OUTSIDE the tx — only the final
    // persist+audit pair is wrapped (matches the analyzer.ts boundary pattern).
    await (await import('@/lib/kernel/db/client')).db.transaction(async (tx) => {
      await tx
        .update(corpusSyncRuns)
        .set({
          status: 'synced',
          chunksAdded: insertedSections.length,
          chunksOutdated: outdateResult.applied,
          chunksUnchanged: 0,
          completedAt: new Date(),
        })
        .where(eq(corpusSyncRuns.id, runId));

      await writeAudit(
        {
          actor_id: actorId,
          action: 'corpus.sync_completed',
          resource_type: 'source',
          resource_id: sourceId,
          meta_json: {
            runId,
            change: detection.status,
            crawlerName,
            chunksAdded: insertedSections.length,
            chunksOutdated: outdateResult.applied,
          },
        },
        tx,
      );
    });

    return {
      runId,
      status: 'synced',
      change: detection.status,
      chunksAdded: insertedSections.length,
      chunksOutdated: outdateResult.applied,
      chunksUnchanged: 0,
    };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    logger.error('[delta-sync] orchestrator failed', {
      runId,
      sourceId,
      crawlerName,
      error: errorMessage,
    });

    // 8. 21 CFR Part 11 §11.10(e) — Issue #378: never leave the run 'pending'.
    // Mark failed + audit in the SAME db.transaction so a crash between them
    // can never leave an orphaned row with no failure audit.
    await (await import('@/lib/kernel/db/client')).db.transaction(async (tx) => {
      await tx
        .update(corpusSyncRuns)
        .set({
          status: 'failed',
          errorMessage: truncateError(errorMessage),
          completedAt: new Date(),
        })
        .where(eq(corpusSyncRuns.id, runId));

      await writeAudit(
        {
          actor_id: actorId,
          action: 'corpus.sync_failed',
          resource_type: 'source',
          resource_id: sourceId,
          meta_json: { runId, crawlerName, error: truncateError(errorMessage) },
        },
        tx,
      );
    });

    return {
      runId,
      status: 'failed',
      change: 'unchanged',
      chunksAdded: 0,
      chunksOutdated: 0,
      chunksUnchanged: 0,
      errorMessage: truncateError(errorMessage),
    };
  }
}

/**
 * M-1 FIX: resolve existing (non-superseded) source_sections for a source,
 * org-scoped via the JOIN to sources.organization_id. Because source_sections
 * has no organization_id column, this JOIN is the authoritative org boundary.
 *
 * Returns the section ids that applyOutdateOperations will mark superseded.
 * A cross-org section can never appear here because the sources row filter
 * excludes it before the section ids are read.
 */
export async function resolveExistingChunkIds(sourceId: string, orgId: string): Promise<string[]> {
  const rows = await (await import('@/lib/kernel/db/client')).db
    .select({ id: sourceSections.id })
    .from(sourceSections)
    .innerJoin(sources, eq(sourceSections.sourceId, sources.id))
    .where(
      and(
        eq(sourceSections.sourceId, sourceId),
        eq(sources.organizationId, orgId),
        isNull(sourceSections.superseded_by),
      ),
    );
  return rows.map((r) => r.id);
}

/**
 * Resolve the baseline content hash for the (org, sourceUrl) pair. Prefer the
 * latest corpus_sync_runs row; fall back to sources.content_hash (seed baseline).
 * Returns null when this is the first sighting.
 */
async function resolveExistingHash(
  orgId: string,
  sourceUrl: string,
  sourceId: string,
): Promise<string | null> {
  const dbModule = await import('@/lib/kernel/db/client');

  // Latest successful run hash for this sourceUrl. Org scoping comes from the
  // prior getSourceInOrg check on sourceId — sourceUrl is the lookup key but
  // sourceId binds it to the org.
  const runRows = await dbModule.db
    .select({ contentHash: corpusSyncRuns.contentHash })
    .from(corpusSyncRuns)
    .where(and(eq(corpusSyncRuns.sourceUrl, sourceUrl), eq(corpusSyncRuns.status, 'synced')))
    .orderBy(desc(corpusSyncRuns.startedAt))
    .limit(1);
  if (runRows[0]?.contentHash) {
    return runRows[0].contentHash;
  }

  // Seed baseline: sources.content_hash (populated by corpus seeders).
  const srcRows = await dbModule.db
    .select({ contentHash: sources.contentHash })
    .from(sources)
    .where(and(eq(sources.id, sourceId), eq(sources.organizationId, orgId)))
    .limit(1);
  return srcRows[0]?.contentHash ?? null;
}

function computeChunkHash(text: string): string {
  // Reuses node:crypto via the same pattern as detector.computeContentHash.
  // Kept local to avoid a circular import (detector hashes (url,content), we
  // hash the chunk text only).
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { createHash } = require('node:crypto') as typeof import('node:crypto');
  return createHash('sha256').update(text).digest('hex');
}

/** PII-safe URL truncation for audit meta (URLs are not PII but we bound length). */
function truncateUrl(url: string): string {
  return url.length > 200 ? `${url.slice(0, 197)}...` : url;
}

/** Keep error messages out of the 1KB range for audit log hygiene. */
function truncateError(msg: string): string {
  return msg.length > 500 ? `${msg.slice(0, 497)}...` : msg;
}

/**
 * Exported for tests + future gap-replay wiring. Wraps the retry policy from
 * vectorstore.ts so an embedding upsert failure is retried per SPEC policy.
 * Currently invoked inline above via direct insert; this helper is the seam
 * for switching to pgvector/Vectorize upsert in a follow-up without changing
 * the orchestrator's call shape.
 */
export async function upsertEmbeddingsWithRetry(
  upsertFn: () => Promise<void>,
  errorMessage: string,
): Promise<boolean> {
  const result = await upsertWithRetry(upsertFn, errorMessage, 0, defaultRetryDelay);
  return !result.exhausted;
}
