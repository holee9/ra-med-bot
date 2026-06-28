// @MX:NOTE [AUTO] Incremental ingest — outdate existing chunks + prepare new ones.
// @MX:SPEC SPEC-REGULA-DELTA-SYNC-001 (REQ-DELTA-004, REQ-DELTA-005, REQ-DELTA-006)
//
// Reuses chunkers registry (generic chunker for Radar documents) for text
// segmentation. Embedding is deferred to the vectorstore layer so this module
// stays pure and unit-testable without OpenAI dependency (Enforce Simplicity).
//
// @MX:TODO [AUTO] REQ-CORPUSLIC-002 follow-up: this incremental-crawler path
// does NOT yet call assertIngestionLicensed. Seed scripts (scripts/seed-fda-corpus.ts,
// scripts/seed-corpus.ts, scripts/ingest-gitea-wiki.ts) and this delta-sync path
// assume pre-licensed curated sources — they ingest public regulatory text whose
// license is registered out-of-band. The production upload route (C-1) and Inngest
// worker (C-2) are the primary gated paths. Gating this crawler is a follow-up.

import { writeAudit } from '@/lib/audit';
import { withTenantScope } from '@/lib/db/client';
import { sourceSections } from '@/lib/db/schema';
import { and, eq, isNull } from 'drizzle-orm';
import type { Chunk } from '../../ingest/chunkers/base';
import { chunk } from '../../ingest/chunkers/index';
import { DocClass } from '../../ingest/doc-class';

/**
 * A chunk with its embedding ready for insertion into source_sections.
 */
export interface EmbeddedChunk {
  text: string;
  embedding: number[];
  metadata: Record<string, unknown>;
}

/**
 * Delta between existing and new chunk state for a single source.
 * - added: new chunks to upsert
 * - outdated: existing chunk ids to mark superseded
 * - unchanged: existing chunk ids whose content hash matched (kept as-is)
 */
export interface ChunkDelta {
  added: EmbeddedChunk[];
  outdated: string[];
  unchanged: string[];
}

/**
 * Build per-chunk outdate operations for existing chunks.
 * Each operation marks a chunk as superseded by the new ingestion run (REQ-DELTA-005).
 * Hard delete is prohibited — 21 CFR Part 11 preservation.
 */
export function buildOutdateOperations(
  existingChunkIds: string[],
  newIngestionRunId: string,
): Array<{ id: string; supersededBy: string; updatedAt: Date }> {
  const updatedAt = new Date();
  return existingChunkIds.map((id) => ({
    id,
    supersededBy: newIngestionRunId,
    updatedAt,
  }));
}

/**
 * Result of persisting a single section's supersession + firing its hook.
 */
export interface SupersessionResult {
  /** Section id that was processed. */
  sectionId: string;
  /** True when this tx actually set superseded_by (false = already superseded, no-op). */
  applied: boolean;
  /** Stale-propagation hook outcome for this section. */
  propagation: { propagated: boolean; affectedCount: number };
}

/**
 * @MX:ANCHOR [AUTO] AC-05 supersession write path — persists `source_sections.superseded_by`
 *   within an org-scoped transaction and fires `onSourceSectionSuperseded` after commit.
 *   Also emits `traceability.section_superseded` inside the tx (M-2, Issue #300).
 * @MX:REASON This is the production write path for #45 delta-sync. Live caller:
 *   lib/radar/delta-sync/orchestrator.ts runDeltaSync (#300) — the #238 dead-code
 *   status is resolved. gap-replay (#35) is a secondary caller. fan_in >= 2 and
 *   climbing; this anchor is load-bearing for AC-05 traceability.
 * @MX:WARN [AUTO] Hook fires AFTER the tx commits, not inside it. The hook uses the
 *   db singleton for `propagateStaleFromNode` (stale_flags + audit), which cannot
 *   share the supersession tx. A hook failure MUST NOT roll back the supersession —
 *   the hook is non-blocking by design (wraps its own errors in an audit row + returns).
 *   This is the correct atomicity boundary: the supersession is the fact; stale
 *   propagation is a downstream effect.
 * @MX:SPEC SPEC-REGULA-TRACEABILITY-001 (AC-05, REQ-TRACEABILITY-009)
 *           SPEC-REGULA-DELTA-SYNC-001 (REQ-DELTA-005, REQ-DELTA-006)
 *
 * Idempotent: the WHERE clause guards on `superseded_by IS NULL`, so re-running
 * the same delta against already-superseded sections is a no-op (returns applied=0).
 *
 * Org isolation: the UPDATE runs inside `withTenantScope(orgId)` which sets the
 * `app.current_org_id` GUC for RLS enforcement, matching every other org-scoped write.
 *
 * @returns summary with per-section results + total applied count.
 */
export async function applyOutdateOperations(params: {
  orgId: string;
  existingChunkIds: string[];
  newIngestionRunId: string;
  /** User/system that triggered the sync. Threaded to the hook for audit. null = system. */
  actorId: string | null;
}): Promise<{ applied: number; results: SupersessionResult[] }> {
  if (params.existingChunkIds.length === 0) {
    return { applied: 0, results: [] };
  }

  const operations = buildOutdateOperations(params.existingChunkIds, params.newIngestionRunId);

  // Phase 1 — persist the supersession in an org-scoped tx.
  // We capture which rows were actually touched so the hook only fires for
  // newly-superseded sections (idempotency: a re-run touches zero rows).
  const newlySuperseded = await withTenantScope(params.orgId, async (tx) => {
    const touched: string[] = [];
    for (const op of operations) {
      const result = await tx
        .update(sourceSections)
        .set({
          superseded_by: op.supersededBy,
          updated_at: op.updatedAt,
        })
        .where(and(eq(sourceSections.id, op.id), isNull(sourceSections.superseded_by)));
      // drizzle returns rowCount on execute; if the row was already superseded
      // the WHERE matches nothing and rowCount is 0 — that's the idempotent path.
      const affected = (result as unknown as { rowCount?: number }).rowCount ?? 0;
      if (affected > 0) {
        touched.push(op.id);
        // M-2 (Issue #300): emit traceability.section_superseded INSIDE the tx
        // for EACH newly-superseded section, independent of evidence_node
        // existence. This closes the Part 11 gap where onSourceSectionSuperseded
        // (fired post-commit) early-returns when no deliverable cited the section
        // — without this audit row, the supersession itself was non-traceable.
        await writeAudit(
          {
            actor_id: params.actorId,
            action: 'traceability.section_superseded',
            resource_type: 'source_section',
            resource_id: op.id,
            meta_json: {
              supersededBy: op.supersededBy,
              orgId: params.orgId,
            },
          },
          tx,
        );
      }
    }
    return touched;
  });

  // Phase 2 — fire the stale-propagation hook AFTER the tx commits.
  // Non-blocking: a hook failure is logged as an audit row inside the hook,
  // never propagated. The supersession is already durable at this point.
  const results: SupersessionResult[] = [];
  for (const op of operations) {
    const applied = newlySuperseded.includes(op.id);
    let propagation = { propagated: false, affectedCount: 0 };
    if (applied) {
      try {
        propagation = await onSourceSectionSupersededHook({
          orgId: params.orgId,
          refId: op.id,
          actorId: params.actorId,
        });
      } catch {
        // Defense-in-depth: the hook itself never throws, but if the dynamic
        // import boundary fails we still must not crash the sync.
        propagation = { propagated: false, affectedCount: 0 };
      }
    }
    results.push({ sectionId: op.id, applied, propagation });
  }

  return { applied: newlySuperseded.length, results };
}

/**
 * Thin indirection so unit tests can mock the hook without importing the full
 * traceability graph (which pulls env-validated db). The real implementation is
 * lazily imported at call time to avoid a circular import at module load.
 */
async function onSourceSectionSupersededHook(opts: {
  orgId: string;
  refId: string;
  actorId: string | null;
}): Promise<{ propagated: boolean; affectedCount: number }> {
  const { onSourceSectionSuperseded } = await import('@/lib/traceability/hooks');
  return onSourceSectionSuperseded(opts);
}

/**
 * Segment a freshly crawled document into chunks using the chunkers registry.
 * The generic chunker is used because Radar documents are public regulatory
 * guidance, not one of the 8 internal DocClass types — generic is the correct
 * reuse path (no new chunker family created).
 *
 * Embedding is NOT performed here. Callers pass the chunk texts to
 * vectorstore.upsertWithRetry, which invokes the embedder inside the retry loop.
 */
export function chunkForDelta(params: {
  rawContent: string;
  sourceUrl: string;
  ingestionRunId: string;
}): Chunk[] {
  return chunk(DocClass.internal_sop, params.rawContent, {
    sourceUrl: params.sourceUrl,
    ingestionRunId: params.ingestionRunId,
  });
}

/**
 * Assemble embedded chunks from segmented text + precomputed embeddings.
 * Index alignment must match: chunk[i] ↔ embeddings[i].
 */
export function assembleEmbeddedChunks(
  chunks: Chunk[],
  embeddings: number[][],
  context: { sourceUrl: string; ingestionRunId: string },
): EmbeddedChunk[] {
  return chunks.map((c, i) => ({
    text: c.text,
    embedding: embeddings[i] ?? [],
    metadata: {
      ...c.metadata,
      sourceUrl: context.sourceUrl,
      ingestionRunId: context.ingestionRunId,
    },
  }));
}
