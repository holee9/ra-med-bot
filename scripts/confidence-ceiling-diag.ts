import { db } from '@/lib/kernel/db/client';
// One-off: measure the realistic confidence-score ceiling under current
// qwen3-embedding distance distribution. For strong queries, computes
// 0.6*avg(top-8 vec_score) with PERFECT citation coverage assumed (=+0.4).
import { sql } from 'drizzle-orm';

const ORG = '10000000-0000-4000-8000-000000000001';
const QUERIES = [
  'MD-process 인허가 절차에서 문서화 요건은 무엇인가요?',
  '510(k) submission documentation requirements',
  'design history file 구성 요소',
  'risks management process 절차',
];

async function main() {
  const { embed } = await import('ai');
  const { getEmbeddingModel } = await import('@/lib/ai/embedding-provider');
  for (const q of QUERIES) {
    const { embedding } = await embed({ model: getEmbeddingModel() as never, value: q });
    const lit = `[${embedding.join(',')}]`;
    const res = (await db.execute(sql`
      SELECT 1.0 - (ss.embedding <=> ${lit}::vector) AS vec_score
      FROM source_sections ss JOIN sources s ON s.id = ss.source_id
      WHERE ss.embedding IS NOT NULL AND s.organization_id = ${ORG} AND s.type='Internal' AND ss.superseded_by IS NULL
      ORDER BY ss.embedding <=> ${lit}::vector LIMIT 8
    `)) as unknown;
    const rows = (Array.isArray(res) ? res : ((res as { rows?: unknown[] }).rows ?? [])) as Array<{
      vec_score: number;
    }>;
    const scores = rows.map((r) => Number(r.vec_score));
    const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
    const best = Math.max(...scores);
    const ceiling = 0.6 * avg + 0.4 * 1.0; // perfect coverage assumption
    console.log(
      `q="${q.slice(0, 28)}..." avgVec=${avg.toFixed(3)} bestVec=${best.toFixed(3)} ceiling(완벽커버리)=${ceiling.toFixed(3)}`,
    );
  }
  process.exit(0);
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
