# SPEC-REGULA-CLOUDFLARE-001 Task Decomposition

## TDD Cycle Summary

| # | Task | REQ | 파일 (생성) | 테스트 파일 | 상태 |
|---|------|-----|------------|------------|------|
| 1 | wrangler.toml + Cloudflare Env Bindings | REQ-CF-001~003, 031, 041, 056 | wrangler.toml, open-next.config.ts, lib/cloudflare/env.d.ts | tests/unit/cloudflare/wrangler-config.test.ts (19) | ✅ |
| 2 | Edge Middleware | REQ-CF-005~009 | middleware-edge.ts | tests/unit/cloudflare/middleware-edge.test.ts (7) | ✅ |
| 3 | KV Session Store | REQ-CF-032~034 | lib/auth/kv-session-store.ts | tests/unit/auth/kv-session-store.test.ts (8) | ✅ |
| 4 | KV Rate Limiter | REQ-CF-035 | lib/ratelimit/cloudflare-kv.ts | tests/unit/ratelimit/cloudflare-kv.test.ts (5) | ✅ |
| 5 | Hybrid RAG Router | REQ-CF-019, 020, 027 | lib/ai/hybrid-router.ts | tests/unit/ai/hybrid-router.test.ts (8) | ✅ |
| 6 | Vectorize Retrievers (5종) | REQ-CF-018 | lib/ai/retrievers/vectorize-{fda,eu-mdr,mfds,nmpa,pmda}.ts | tests/unit/ai/retrievers/vectorize-fda.test.ts (25) | ✅ |
| 7 | AutoRAG Adapter | REQ-CF-023, 024, 029 | lib/ai/retrievers/autorag-adapter.ts | tests/unit/ai/retrievers/autorag-adapter.test.ts (5) | ✅ |
| 8 | R2 Storage Abstraction | REQ-CF-055 | lib/storage/r2.ts | tests/unit/storage/r2.test.ts (7) | ✅ |
| 9 | Audit Cold Storage | REQ-CF-046~052 | lib/audit/cold-storage.ts, cold-query.ts | tests/unit/audit/cold-{storage,query}.test.ts (8) | ✅ |
| 10 | Analytics Engine | REQ-CF-077, 079 | lib/analytics/cloudflare-engine.ts | tests/unit/analytics/cloudflare-engine.test.ts (7) | ✅ |
| 11 | QA Script (no-vercel-edge) | REQ-CF-009 | scripts/qa/no-vercel-edge.ts | (static analysis) | ✅ |
| 12 | SQL Migration | REQ-CF-081 | migrations/0011_organizations_data_region.sql | (DDL) | ✅ |
| 13 | FDA eSTAR mTLS Placeholder | REQ-CF-073 | lib/external/fda-estar.ts | (interface only) | ✅ |
| 14 | EU eCTD mTLS Placeholder | REQ-CF-073 | lib/external/eu-ectd.ts | (interface only) | ✅ |
| 15 | 21 CFR Part 11 Extended Docs | REQ-CF-084 | docs/compliance/part-11-extended.md | (문서) | ✅ |
| 16 | HIPAA BAA + Vectorize EU Docs | Pending #1, #2 | docs/compliance/hipaa-baa-scope.md, vectorize-eu-region.md | (문서) | ✅ |

## 미구현 항목 (범위 외 또는 다음 Phase)

| 항목 | 이유 |
|------|------|
| .github/workflows/cf-deploy.yml | 배포 파이프라인 — 별도 SPEC 또는 DevOps Phase |
| Durable Objects (workers/consult-session-do.ts) | Phase 7 RUN에서 A/B 비교 후 결정 (optional) |
| Canary DNS (10%/50%/100%) | 인프라 설정 — Cloudflare 대시보드에서 수동 설정 |
| WAF/DDoS/Turnstile 설정 | Cloudflare 대시보드 설정 — IaC 없이 불가 |
| Logpush 설정 | Cloudflare 대시보드 설정 |
| AutoRAG 인스턴스 5종 생성 | Workers 배포 후 wrangler CLI로 생성 |
| Vectorize 인덱스 5종 생성 | Workers 배포 후 wrangler CLI로 생성 |
| pnpm add -D @opennextjs/cloudflare wrangler | 패키지 추가 필요 (배포 시) |
