import { db } from '@/lib/kernel/db/client';
// One-off: noise-floor vs strong-query avgVec distribution for normalization constants.
import { sql } from 'drizzle-orm';

const ORG = '10000000-0000-4000-8000-000000000001';
const NOISE = ['오늘 저녁 메뉴 추천해줘', '점심 뭐 먹을까', '날씨가 어떨까', '재미있는 영화 추천'];
const STRONG = [
  'MD-process 인허가 절차에서 문서화 요건은 무엇인가요?',
  'design history file 구성 요소',
  '510(k) submission documentation requirements',
  'risks management process 절차',
];

async function avgVec(q: string): Promise<number> {
  const { embed } = await import('ai');
  const { getEmbeddingModel } = await import('@/lib/ai/embedding-provider');
  const { embedding } = await embed({ model: getEmbeddingModel() as never, value: q });
  const lit = `[${embedding.join(',')}]`;
  const res = (await db.execute(sql`
    SELECT 1.0 - (ss.embedding <=> ${lit}::vector) AS v FROM source_sections ss JOIN sources s ON s.id=ss.source_id
    WHERE ss.embedding IS NOT NULL AND s.organization_id=${ORG} AND s.type='Internal' AND ss.superseded_by IS NULL
    ORDER BY ss.embedding <=> ${lit}::vector LIMIT 8
  `)) as unknown;
  const rows = (Array.isArray(res) ? res : ((res as { rows?: unknown[] }).rows ?? [])) as Array<{
    v: number;
  }>;
  return rows.reduce((a, b) => a + Number(b.v), 0) / rows.length;
}

async function main() {
  const noise: number[] = [];
  const strong: number[] = [];
  for (const q of NOISE) noise.push(await avgVec(q));
  for (const q of STRONG) strong.push(await avgVec(q));
  const avg = (a: number[]) => a.reduce((x, y) => x + y, 0) / a.length;
  console.log(
    `NOISE  avgVec: ${noise.map((n) => n.toFixed(3)).join(' ')} → mean=${avg(noise).toFixed(3)}`,
  );
  console.log(
    `STRONG avgVec: ${strong.map((n) => n.toFixed(3)).join(' ')} → mean=${avg(strong).toFixed(3)}`,
  );
  process.exit(0);
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
