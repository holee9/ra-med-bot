import { readFileSync } from 'node:fs';
import { LlmWikiRetriever } from '../lib/ai/retrievers/llm-wiki';
// Retrieval-level A/B: layer ①(nas) alone vs ①+②(+llm-wiki), 40 test-bank items
// from hermes-ra (Gitea drake.lee/hermes-ra docs/testbank/).
// Metric: does the item's source_path document appear in top-8 (hit@8)?
// Run: curl the two testbank JSONLs to /tmp (see hermes-ra docs/testbank/),
//      then `set -a && source .env.local && set +a && npx tsx scripts/ab-llm-wiki-testbench.ts`
// 2026-10-28 result: A(nas)=10% B(nas+wiki)=15% gains=2 regression=0 → 계층 ② 유지.
import { NasDocsRetriever } from '../lib/ai/retrievers/nas-docs';

const ORG = '10000000-0000-4000-8000-000000000001';

interface Item {
  id: string;
  product: string;
  desc: string;
  era?: string;
  leaked?: boolean;
  source_path?: string;
}

function hitTopK(
  paths: Array<string | null | undefined>,
  src: string | undefined,
  k: number,
): boolean {
  if (!src) return false;
  // match on the meaningful tail of the NAS path (filename without leading dirs)
  const tail = src.split('/').pop()?.trim();
  if (!tail) return false;
  return paths.slice(0, k).some((p) => (p ?? '').includes(tail.slice(0, 40)));
}

async function main() {
  const items: Item[] = [];
  for (const f of ['/tmp/testbank-items.jsonl', '/tmp/testbank-items_yes.jsonl']) {
    for (const line of readFileSync(f, 'utf-8').split('\n')) {
      if (line.trim()) items.push(JSON.parse(line));
    }
  }
  const nas = new NasDocsRetriever();
  const wiki = new LlmWikiRetriever();
  let both = 0;
  let nasHitA = 0;
  let nasHitB = 0;
  let wikiOnly = 0;
  const t0 = Date.now();
  for (const it of items) {
    const q = `${it.product} ${it.desc}`;
    const nasRes = await nas.retrieve(q, { orgId: ORG, limit: 8 });
    const wikiRes = await wiki.retrieve(q, { orgId: ORG, limit: 3 });
    const nasPaths = nasRes.map((r) => String(r.metadata.sourcePath ?? r.metadata.title ?? ''));
    const wikiPaths = wikiRes.flatMap((r) => [
      String(r.metadata.sourcePath ?? ''),
      String(r.metadata.wikiPath ?? ''),
    ]);
    const a = hitTopK(nasPaths, it.source_path, 8);
    // B: merged view — wiki results interleave; approximate merged top-8 as nas top-5 + wiki top-3
    const merged = [...nasPaths.slice(0, 5), ...wikiPaths.slice(0, 3)];
    const b = hitTopK(merged, it.source_path, 8);
    if (a) nasHitA += 1;
    if (b) nasHitB += 1;
    if (a && b) both += 1;
    if (b && !a) wikiOnly += 1;
    const first = items[0];
    if (wikiRes.length > 0 && first && it.id === first.id) {
      console.log(
        'sample wiki results for',
        it.id,
        wikiRes.map((r) => [r.metadata.title, r.score]),
      );
    }
  }
  console.log(`items=${items.length} elapsed=${Math.round((Date.now() - t0) / 1000)}s`);
  console.log(
    `A (nas only)        hit@8: ${nasHitA}/${items.length} (${((nasHitA / items.length) * 100).toFixed(0)}%)`,
  );
  console.log(
    `B (nas + llm-wiki)  hit@8: ${nasHitB}/${items.length} (${((nasHitB / items.length) * 100).toFixed(0)}%)`,
  );
  console.log(`both=${both} | B-only gains=${wikiOnly} | regression=${nasHitA - both}`);
  process.exit(0);
}
main().catch((e) => {
  console.error('ERR', e);
  process.exit(1);
});
