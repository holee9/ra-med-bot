import { db } from '@/lib/db/client';
import { sourceSections } from '@/lib/db/schema';
import { embedChunks } from '@/lib/ingest/embed';
/**
 * Embedding backfill — #538 root-cause repair.
 *
 * source_sections rows created by the June ingestion carry NULL embeddings, so
 * pgvector retrieval returns nothing and every consult scores confidence 0.00
 * (external enrichment alone carries the answers). Backfills embeddings via
 * the same embedChunks path the sync pipeline uses (gx10 qwen3-embedding,
 * 1536-dim MRL, PII-guarded).
 *
 * Sections whose text trips the PII guard (email/SSN/phone/card) are skipped
 * and remain FTS-retrievable — the hybrid search's FTS branch still finds them.
 *
 * Usage:
 *   DATABASE_URL=... pnpm exec tsx scripts/embed-backfill.ts [--dry-run]
 */
import { eq, isNull, sql } from 'drizzle-orm';

const BATCH = 50;

// Mask emails in the EMBEDDING INPUT ONLY (DB text stays original). Corporate
// contact addresses and code `user@host` literals pervade the internal corpus
// and trip embedChunks' PII guard on 61% of sections — but embedding goes to
// the on-prem gx10 server (#318), so masking (not rejecting) preserves the
// guard's spirit while restoring vector coverage. SSN/phone/card still reject.
const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const maskEmails = (text: string): string => text.replace(EMAIL_RE, '[email-masked]');

async function pendingCount(): Promise<number> {
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(sourceSections)
    .where(isNull(sourceSections.embedding));
  return row?.n ?? 0;
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const total = await pendingCount();
  console.log(`[backfill] sections without embedding: ${total}`);
  if (dryRun || total === 0) return;

  let embedded = 0;
  let skipped = 0;
  let processed = 0;

  while (processed < total) {
    const rows = await db
      .select({ id: sourceSections.id, text: sourceSections.text })
      .from(sourceSections)
      .where(isNull(sourceSections.embedding))
      .limit(BATCH);
    if (rows.length === 0) break;

    let embeddings: (number[] | null)[] = [];
    try {
      const batch = await embedChunks(rows.map((r) => maskEmails(r.text)));
      embeddings = batch;
    } catch {
      // Batch-level failure (typically one PII-guard hit poisoning the batch) —
      // fall back to per-row embedding so only the offending rows are skipped.
      embeddings = await Promise.all(
        rows.map(async (r) => {
          try {
            return (await embedChunks([maskEmails(r.text)]))[0] ?? null;
          } catch {
            return null;
          }
        }),
      );
    }

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const emb = embeddings[i];
      if (!row || !emb) {
        skipped++;
        continue;
      }
      await db.update(sourceSections).set({ embedding: emb }).where(eq(sourceSections.id, row.id));
      embedded++;
    }
    processed += rows.length;
    console.log(
      `[backfill] ${processed}/${total} processed (embedded=${embedded} skipped=${skipped})`,
    );
  }

  const remaining = await pendingCount();
  console.log(
    `[backfill] done: embedded=${embedded} skipped=${skipped} remaining-null=${remaining}`,
  );
  process.exit(0);
}

main().catch((err) => {
  console.error('[backfill] failed:', err);
  process.exit(1);
});
