// @MX:NOTE [AUTO] 이슈 552 — llm-wiki catalog 임베딩 증분 색인 (A안).
// catalog 캐시(var/llm-wiki)의 엔트리 title+summary를 MRL 1536으로 임베딩해
// llm_wiki_catalog_entries에 upsert. content_hash 기반 증분 — 텍스트가 변하지
// 않은 엔트리는 재임베딩하지 않는다 (전량 64K건 ≈ 4h → 일 1회 갱신은 증분 필수).
// 사라진 path는 스냅샷 정리 단계에서 삭제.
// Run: set -a && source .env.local && set +a && npx tsx scripts/index-llm-wiki-catalog.ts
import { createHash } from 'node:crypto';
import { inArray, sql } from 'drizzle-orm';
import { embedBatchTexts } from '../lib/ai/embedding-provider';
import { db } from '../lib/kernel/db/client';
import { llmWikiCatalogEntries } from '../lib/kernel/db/schema';

const BATCH = 64;

interface Entry {
  path: string;
  type: string;
  title?: string;
  summary?: string;
  tags?: string[];
  aliases?: string[];
  updated?: string;
}

function entryHash(e: Entry): string {
  return createHash('sha256')
    .update(`${e.path}\n${e.title ?? ''}\n${e.summary ?? ''}`)
    .digest('hex');
}

async function countRows(): Promise<number> {
  const res = (await db.execute(
    sql`SELECT count(*)::int AS count FROM llm_wiki_catalog_entries`,
  )) as unknown as Array<{ count: number }> | { rows?: Array<{ count: number }> };
  const rows = Array.isArray(res) ? res : (res.rows ?? []);
  return rows[0]?.count ?? 0;
}

async function main() {
  const { readFileSync } = await import('node:fs');
  const cache = JSON.parse(readFileSync('var/llm-wiki/catalog-cache.json', 'utf-8')) as {
    sha: string;
    entries: Entry[];
  };
  if (!cache.sha || !Array.isArray(cache.entries) || cache.entries.length === 0) {
    throw new Error('catalog cache empty — run a retrieval first to build it');
  }
  const { sha, entries } = cache;
  console.log(
    `[index] sha=${sha.slice(0, 8)} entries=${entries.length} (existing rows: ${await countRows()})`,
  );

  // 증분: 기존 content_hash 집합과 비교해 새/변경 엔트리만 임베딩.
  const existing = new Set(
    (await db.select({ h: llmWikiCatalogEntries.contentHash }).from(llmWikiCatalogEntries)).map(
      (r) => r.h,
    ),
  );
  const todo = entries.filter((e) => !existing.has(entryHash(e)));
  console.log(`[index] to embed: ${todo.length} (unchanged skip: ${entries.length - todo.length})`);

  let done = 0;
  for (let i = 0; i < todo.length; i += BATCH) {
    const batch = todo.slice(i, i + BATCH);
    const texts = batch.map((e) => `${e.title ?? ''}\n${e.summary ?? ''}`.trim() || e.path);
    let vectors: number[][];
    try {
      vectors = await embedBatchTexts(texts, { maxRetries: 3 });
    } catch (err) {
      console.error(
        `[index] batch ${i} embedding failed — skipping:`,
        err instanceof Error ? err.message : err,
      );
      continue;
    }
    await db
      .insert(llmWikiCatalogEntries)
      .values(
        batch.map((e, j) => ({
          sha,
          path: e.path,
          contentHash: entryHash(e),
          type: e.type,
          title: e.title ?? '',
          summary: e.summary ?? '',
          tags: e.tags ?? [],
          aliases: e.aliases ?? [],
          updatedAt: e.updated ?? null,
          embedding: vectors[j],
        })),
      )
      .onConflictDoNothing();
    done += batch.length;
    if (Math.floor(i / BATCH) % 25 === 0) console.log(`[index] ${done}/${todo.length}`);
  }

  // 스냅샷 정리: 새 catalog에 없는 path 삭제 (제거된 문서 반영).
  // JS diff + 청크 IN 삭제 — TEMP 테이블은 커넥션 풀 세션 격리로 안 보이고(42P01 실측),
  // 청크 NOT IN 은 청크 밖 전체를 지운다(2026-11-01 실측). IN 삭제는 나열된 행만 지운다.
  const live = new Set(entries.map((e) => e.path));
  const indexed = await db.select({ p: llmWikiCatalogEntries.path }).from(llmWikiCatalogEntries);
  const stale = [...new Set(indexed.map((r) => r.p))].filter((p) => !live.has(p));
  for (let i = 0; i < stale.length; i += 500) {
    await db
      .delete(llmWikiCatalogEntries)
      .where(inArray(llmWikiCatalogEntries.path, stale.slice(i, i + 500)));
  }
  console.log(`[index] cleanup: removed ${stale.length} stale paths`);
  // provenance sha 갱신
  await db.execute(sql`UPDATE llm_wiki_catalog_entries SET sha = ${sha} WHERE sha <> ${sha}`);
  console.log(`[index] done: ${await countRows()} rows (sha ${sha.slice(0, 8)}, embedded ${done})`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
