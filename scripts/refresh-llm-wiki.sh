#!/usr/bin/env bash
# 이슈 552 — llm-wiki 일 1회 갱신 (설계 계약): catalog 캐시 TTL 갱신 + 증분 임베딩.
# cron: 25 3 * * * (hermes KB 인덱싱 03:1x 이후)
set -euo pipefail
cd "$(dirname "$0")/.."
set -a; . .env.local; set +a
mkdir -p /home/abyz-lab/logs
# 1) 캐시 갱신 — 리트리버 1회 호출로 24h TTL 만료 시 새 SHA 재구축
cat > /tmp/llm-wiki-refresh.ts <<'TS'
import { LlmWikiRetriever } from './lib/ai/retrievers/llm-wiki';
async function main() {
  await new LlmWikiRetriever().retrieve('refresh', { orgId: '10000000-0000-4000-8000-000000000001' });
  process.exit(0);
}
main().catch(() => process.exit(1));
TS
cp /tmp/llm-wiki-refresh.ts scripts/_refresh.ts
pnpm exec tsx scripts/_refresh.ts && rm -f scripts/_refresh.ts
# 2) 증분 색인 (content_hash 기반 — 신규/변경 엔트리만)
pnpm exec tsx scripts/index-llm-wiki-catalog.ts
