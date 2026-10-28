// @MX:NOTE [AUTO] #550 — llm-wiki 프록시 sources 행 + source_license 시드 (idempotent).
// nas-docs와 동일 패턴(#544 선생성 계승): approval=approved(3세션 협의 승인 계층),
// authority=internal_sop, 영구 internal 라이선스 — 권위·라이선스 게이트 통과용.
// Run: npx tsx scripts/seed-llm-wiki-source.ts
import { randomUUID } from 'node:crypto';
import { and, eq } from 'drizzle-orm';
import { db } from '../lib/kernel/db/client';
import { sourceLicense, sources } from '../lib/kernel/db/schema';

const ORG_ID = '10000000-0000-4000-8000-000000000001'; // nas 프록시 행과 동일 조직
const ORG_LABEL = 'llm-wiki';

async function main() {
  const existing = await db
    .select({ id: sources.id })
    .from(sources)
    .where(and(eq(sources.organizationId, ORG_ID), eq(sources.orgLabel, ORG_LABEL)))
    .limit(1);
  if (existing[0]?.id) {
    console.log(`[seed] llm-wiki 프록시 행 이미 존재: ${existing[0].id}`);
    process.exit(0);
  }

  const id = randomUUID();
  await db.insert(sources).values({
    id,
    organizationId: ORG_ID,
    orgLabel: ORG_LABEL,
    title: 'RA LLM Wiki (선별 지식 계층)',
    type: 'Internal',
    approvalStatus: 'approved',
    authorityGrade: 'internal_sop',
    contentHash: 'llm-wiki-proxy',
  });
  await db.insert(sourceLicense).values({
    orgId: ORG_ID,
    sourceId: id,
    licenseType: 'internal_sop',
    permittedUse: { rag: true, search: true },
    fullTextAllowed: true,
    abstractOnly: false,
    confidentialityLevel: 'internal',
    createdBy: '00000000-0000-0000-0000-000000000001',
  });
  console.log(`[seed] created: ${id}`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
