import { parallelRetrieveAndMerge } from '@/lib/ai/merge';
// One-off: run the merged retrieval (incl. nas-docs) for a NAS-only question
// and print what the prompt composer would actually receive.
import { classifyAndRoute } from '@/lib/ai/router';

async function main() {
  const q = process.argv[2] ?? 'HnX-R1 사이버보안 라벨링 문서의 필수 항목은 무엇인가요?';
  const { corpora } = await classifyAndRoute(q, ['us']);
  console.log('corpora:', corpora);
  const merged = await parallelRetrieveAndMerge(q, corpora, {
    limit: 10,
    orgId: '10000000-0000-4000-8000-000000000001',
    actorId: null,
  });
  console.log('merged:', merged.length);
  for (const r of merged) {
    console.log(
      `  ${r.score.toFixed(3)} | ${String(r.metadata.orgLabel).padEnd(10)} | ${String(r.metadata.title).slice(0, 40)} | ${r.content.slice(0, 60).replace(/\n/g, ' ')}`,
    );
  }
  process.exit(0);
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
