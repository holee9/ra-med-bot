/**
 * Operational corpus ingestion driver — SPEC-REGULA-CORPUS-SEED-001 (REQ-KB-001/002/007).
 *
 * Registers a public git repo as a knowledge_source and runs syncKnowledgeSource
 * (clone -> extract -> classify -> chunk -> gx10 embed -> source_sections upsert).
 *
 * Usage:
 *   tsx scripts/ingest-knowledge-repo.ts <gitUrl> <branch> <host> <owner> <repo>
 *
 * Real-DB only. No mocks (L-013). Prints ingest stats + a real SELECT COUNT after.
 */
import { randomUUID } from 'node:crypto';
import { db } from '@/lib/db/client';
import { knowledgeSources, sourceSections, sources } from '@/lib/db/schema';
import { syncKnowledgeSource } from '@/lib/knowledge-sources/sync';
import { eq } from 'drizzle-orm';

const ORG_ID = process.env.SEED_ORG_ID ?? '10000000-0000-4000-8000-000000000001';
const USER_ID = process.env.SEED_USER_ID ?? '10000000-0000-4000-8000-000000000101';

async function main() {
  const [gitUrl, branch, host, owner, repo] = process.argv.slice(2);
  if (!gitUrl || !branch || !host || !owner || !repo) {
    console.error(
      'usage: tsx scripts/ingest-knowledge-repo.ts <gitUrl> <branch> <host> <owner> <repo>',
    );
    process.exit(1);
  }

  const before = await db.select({ n: sources.id }).from(sources);
  console.log(`[ingest] before: sources=${before.length}`);

  const id = randomUUID();
  await db.insert(knowledgeSources).values({
    id,
    organizationId: ORG_ID,
    gitUrl,
    branch,
    sourceHost: host,
    sourceOwner: owner,
    sourceRepo: repo,
    syncStatus: 'idle',
    createdBy: USER_ID,
  });
  console.log(`[ingest] knowledge_source registered: ${id} (${owner}/${repo}#${branch})`);

  const t0 = Date.now();
  await syncKnowledgeSource({ id, gitUrl, branch, auth_token: null, orgId: ORG_ID });
  const secs = ((Date.now() - t0) / 1000).toFixed(1);

  const ks = await db
    .select({ status: knowledgeSources.syncStatus })
    .from(knowledgeSources)
    .where(eq(knowledgeSources.id, id));
  const afterSrc = await db.select({ n: sources.id }).from(sources);
  const afterSec = await db.select({ n: sourceSections.id }).from(sourceSections);

  console.log(`[ingest] done in ${secs}s — syncStatus=${ks[0]?.status}`);
  console.log(`[ingest] after: sources=${afterSrc.length} source_sections=${afterSec.length}`);
  process.exit(0);
}

main().catch((e) => {
  console.error('[ingest] FAILED:', e instanceof Error ? e.stack : e);
  process.exit(1);
});
