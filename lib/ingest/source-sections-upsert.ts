// @MX:NOTE [AUTO] Shared org-scoped batch insert into source_sections.
// @MX:SPEC Issue #314 (refactor) — extracts the duplicated org-scoped tx + batch
//   insert loop that previously lived inline in BOTH:
//     - lib/radar/delta-sync/orchestrator.ts runDeltaSync step 7c
//     - lib/knowledge-sources/sync.ts ingestOneFile step h
//   Both wrote the same shape ({sourceId, anchor, heading, text, embedding,
//   sectionPath, ingestionRunId, ingestedAt, chunkHash}) inside
//   withTenantScope(orgId). The helper preserves that exact write semantics.
//
// Design note (Enforce Simplicity): the helper does NOT derive anchor/sectionPath
// because those are caller-specific provenance keys (delta-sync uses
// `delta-<runId>-<i>`; knowledge-sources uses `<sha8(relPath)>-<i>`). Forcing a
// shared derivation would create a false abstraction. Callers compute the per-row
// values; the helper owns the tx + batch + id collection.
//
// Org isolation: the insert runs inside withTenantScope(orgId), identical to the
// original inline blocks. No RLS bypass introduced.
//
// 21 CFR Part 11: no audit emission here. Both call sites emit audit at the
// run/sync level (corpus_sync_runs + corpus.sync_*), and supersession audit fires
// inside applyOutdateOperations. The insert of NEW sections is not itself a
// regulated event; preserving the prior tx boundary (no new audit inside this tx)
// matches the pre-refactor behavior exactly.

import { withTenantScope } from '@/lib/kernel/db/client';
import { sourceSections } from '@/lib/kernel/db/schema';

/**
 * Input row for insertSourceSections — one per chunk to persist.
 *
 * Callers populate every field; the helper does not synthesize or override.
 * This keeps the primitive low-level and free of caller assumptions about
 * anchor/sectionPath derivation.
 */
export interface SourceSectionInsertRow {
  sourceId: string;
  anchor: string;
  heading: string | null;
  text: string;
  embedding: number[];
  sectionPath: string | null;
  ingestionRunId: string;
  chunkHash: string;
}

/**
 * @MX:ANCHOR [AUTO] insertSourceSections — shared org-scoped batch insert into
 *   source_sections. Live callers: lib/radar/delta-sync/orchestrator.ts
 *   runDeltaSync (7c) and lib/knowledge-sources/sync.ts ingestOneFile (h).
 *   fan_in = 2. Issue #314 extracted this to eliminate the verbatim
 *   duplication between those two write paths.
 * @MX:REASON Pre-refactor, the exact same withTenantScope + batch insert loop
 *   existed inline in both files with identical row shape. A drift bug between
 *   the two would silently corrupt RAG provenance. Centralizing the write keeps
 *   the retriever's data contract single-sourced.
 * @MX:SPEC Issue #314 (priority/low refactor — behavioral equivalence required)
 *
 * Executes the batch insert inside `withTenantScope(orgId)` (RLS-enforced) and
 * returns the ids of the newly-inserted rows in input order. Rows whose insert
 * returns no row (rare — only on DB-level anomalies) are omitted from the
 * returned array; callers count via `.length` exactly as before.
 *
 * @param orgId   Organization scope for the write (RLS GUC is set inside).
 * @param rows    Pre-computed per-chunk row values (caller derives anchor/path).
 * @returns       Array of inserted section ids (length <= rows.length).
 */
export async function insertSourceSections(
  orgId: string,
  rows: SourceSectionInsertRow[],
): Promise<string[]> {
  if (rows.length === 0) return [];

  return withTenantScope(orgId, async (tx) => {
    const insertedIds: string[] = [];
    for (const row of rows) {
      const ins = await tx
        .insert(sourceSections)
        .values({
          sourceId: row.sourceId,
          anchor: row.anchor,
          heading: row.heading,
          text: row.text,
          embedding: row.embedding,
          sectionPath: row.sectionPath,
          ingestionRunId: row.ingestionRunId,
          ingestedAt: new Date(),
          chunkHash: row.chunkHash,
        })
        .returning({ id: sourceSections.id });
      const r = ins[0];
      if (r) insertedIds.push(r.id);
    }
    return insertedIds;
  });
}
