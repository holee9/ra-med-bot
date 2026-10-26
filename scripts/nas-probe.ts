import { getNativeEmbeddingModel } from '@/lib/ai/embedding-provider';
// One-off integration probe: real 4096 embedding → real Qdrant search.
import { embed } from 'ai';

async function main() {
  const q = process.argv[2] ?? 'Retrofit HnX-R1 cybersecurity';
  const { embedding } = await embed({ model: getNativeEmbeddingModel() as never, value: q });
  console.log('query dims:', embedding.length);
  const res = await fetch('http://localhost:6333/collections/nas_ra_docs/points/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ vector: embedding, limit: 5, with_payload: true }),
  });
  const body = (await res.json()) as {
    result?: Array<{ score: number; payload?: Record<string, unknown> }>;
  };
  for (const h of body.result ?? []) {
    console.log(
      h.score.toFixed(3),
      '|',
      String(h.payload?.filename).slice(0, 50),
      '|',
      String(h.payload?.text).slice(0, 300).replace(/\n/g, '⏎'),
    );
  }
  process.exit(0);
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
