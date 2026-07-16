import { embedBatchTexts } from '@/lib/ai/embedding-provider';
import { db } from '@/lib/db/client';
import { sourceSections, sources } from '@/lib/db/schema';
import { filterGovernanceEligible } from '@/lib/source-governance/retrieval-gate';
import { approveSource } from '@/lib/source-governance/review-workflow';
/**
 * SPEC-REGULA-CORPUS-SEED-001 M1 verification — approve ingested sources and
 * prove a real RAG query returns citations (REQ-KB-006/009/031). Real DB, no mocks (L-013).
 *
 * Usage: tsx scripts/approve-and-verify-corpus.ts "<query>"
 */
import { and, sql as dsql, eq } from 'drizzle-orm';

const ORG_ID = process.env.SEED_ORG_ID ?? '10000000-0000-4000-8000-000000000001';
const USER_ID = process.env.SEED_USER_ID ?? '10000000-0000-4000-8000-000000000101';

async function main() {
  const query = process.argv[2] ?? 'FDA 510(k) substantial equivalence 요건';

  // 1. Approve every pending_review source (source-governance, audited per REQ-KB-009).
  const pending = await db
    .select({ id: sources.id })
    .from(sources)
    .where(and(eq(sources.organizationId, ORG_ID), eq(sources.approvalStatus, 'pending_review')));
  console.log(`[approve] pending_review sources: ${pending.length}`);
  let approved = 0;
  for (const s of pending) {
    const r = await approveSource({
      sourceId: s.id,
      orgId: ORG_ID,
      decision: 'approved',
      userId: USER_ID,
      notes: 'SPEC-REGULA-CORPUS-SEED-001 M1 bulk approval (3-repo seed)',
    });
    if (r?.approvalStatus === 'approved') approved += 1;
  }
  console.log(`[approve] approved: ${approved}`);

  // 2. Embed the query on gx10 and run a real pgvector similarity search.
  const [qvec] = await embedBatchTexts([query]);
  if (!qvec) throw new Error('embedding_failed: gx10 returned no vector');
  const vecLiteral = `[${qvec.join(',')}]`;
  const hits = await db
    .select({
      sourceId: sourceSections.sourceId,
      title: sources.title,
      approval: sources.approvalStatus,
      dist: dsql<number>`${sourceSections.embedding} <=> ${vecLiteral}::vector`,
    })
    .from(sourceSections)
    .innerJoin(sources, eq(sources.id, sourceSections.sourceId))
    .where(eq(sources.organizationId, ORG_ID))
    .orderBy(dsql`${sourceSections.embedding} <=> ${vecLiteral}::vector`)
    .limit(10);

  // 3. Apply the governance gate — only approved sources may be cited.
  const eligible = await filterGovernanceEligible(
    hits.map((h) => h.sourceId),
    { orgId: ORG_ID },
  );
  const cited = hits.filter((h) => eligible.has(h.sourceId));

  console.log(`\n[verify] query: "${query}"`);
  console.log(`[verify] top-10 vector hits, ${cited.length} pass governance gate:`);
  for (const h of cited.slice(0, 5)) {
    console.log(`  - ${h.title?.slice(0, 70)}  (dist=${Number(h.dist).toFixed(4)}, ${h.approval})`);
  }
  if (cited.length === 0) {
    console.log('  [!] NO citations passed the gate — approval or embedding failed.');
    process.exit(1);
  }
  console.log('\n[verify] PASS — approved corpus returns citations via governance gate.');
  process.exit(0);
}

main().catch((e) => {
  console.error('[verify] FAILED:', e instanceof Error ? e.stack : e);
  process.exit(1);
});
