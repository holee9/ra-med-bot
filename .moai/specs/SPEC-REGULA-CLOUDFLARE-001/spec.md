---
id: SPEC-REGULA-CLOUDFLARE-001
title: Regula Phase 7 Cloudflare 전면 통합 — Workers Runtime · Vectorize Hybrid · AutoRAG · KV/DO · R2 Audit Cold Storage · WAF/Access · Workers AI 전처리
status: draft
created: 2026-04-22
updated: 2026-04-22
author: manager-spec
phase: 7
skill: regula
version: 0.1.0
priority: High
revision_history:
  - version: 0.1.0
    date: 2026-04-22
    author: manager-spec
    notes: |
      Initial Phase 7 draft. 85 REQ-CF across 8 groups (A Next.js on Workers /
      B Vectorize+AutoRAG / C KV+Durable Objects / D R2+Audit Cold Storage /
      E Queues+Cron / F Security (WAF/Access/DDoS/Turnstile/mTLS) / G Observability /
      H Compliance (EU residency + HIPAA BAA + 21 CFR Part 11 immutability)).
      9 technical decisions captured in research.md. Depends on all 6 Wave-1 SPECs
      (FOUNDATION v0.4.0, CHAT, STRUCTURED, BREADTH, ENTERPRISE v0.2.0, LAUNCH v0.2.0).
      Two Pending Items: Workers AI HIPAA BAA scope (#1), Vectorize EU GA (#2).
related_handoff_sections:
  - "§16"
  - "§18"
depends_on:
  - SPEC-REGULA-FOUNDATION-001 (v0.4.0)
  - SPEC-REGULA-CHAT-001
  - SPEC-REGULA-STRUCTURED-001
  - SPEC-REGULA-BREADTH-001
  - SPEC-REGULA-ENTERPRISE-001 (v0.2.0)
  - SPEC-REGULA-LAUNCH-001 (v0.2.0)
---

# SPEC-REGULA-CLOUDFLARE-001 — Regula Phase 7 Cloudflare 전면 통합

## 목적 (Purpose)

Vercel + Neon + Anthropic + OpenAI + Cohere + Sentry/PostHog/Langfuse 스택으로 Phase 6 LAUNCH에서 production 출시된 Regula 시스템을 **Cloudflare 엣지·스토리지·워커 생태계로 전면 이식·증강**한다. 본 Phase는 신규 비즈니스 기능을 추가하지 않으며, 대신 다음 8개 축을 완결한다:

1. **Next.js 15 on Cloudflare Workers 이식** — OpenNext.js v3 어댑터를 통한 Workers runtime 배포, SSE Route Handler 호환성 검증, Edge Middleware 재작성, Auth.js v5 Edge session strategy 전환
2. **Vectorize + AutoRAG Hybrid 검색 전략** — 공개 5개 regulatory corpus (FDA / EU MDR / MFDS / NMPA / PMDA)를 Cloudflare Vectorize v2 + AutoRAG로 이관, 내부 SOP + 테넌트 문서는 pgvector 유지, hybrid router + silent-failure 금지 fallback
3. **KV + Durable Objects** — Workers KV로 Auth.js session + rate limit counter + feature flag override 이관, Durable Objects 기반 SSE 3-phase 순서 invariant 강제 (옵션, RUN 측정 후)
4. **R2 Object Storage + Audit Cold Storage** — corpus PDF 원본, 제출 문서 preview 저장, audit_logs 90일 이상 cold storage를 R2 Data Catalog (Iceberg 포맷) + Object Lock (Compliance Mode)로 이관하여 21 CFR Part 11 immutability를 엣지 스토리지 레이어에서 재현
5. **Cloudflare Queues + Cron Triggers** — Inngest의 단순 job 이관, 복잡 워크플로는 Cloudflare Workflows 평가 후 결정, daily/weekly cron으로 regulatory feed crawl + AutoRAG 재인덱싱 + audit cold storage 이관 자동화
6. **WAF + DDoS + Zero Trust Access + Turnstile + mTLS** — 엣지 레이어 보안 (OWASP Core Rule Set + Regula custom rules), L3/L4 + L7 DDoS 보호, Cloudflare Access로 외부 RA 컨설턴트 제한 접근, Turnstile로 로그인 bot 방지, mTLS는 FDA eSTAR/EU eCTD 연동 레일만 준비
7. **Logpush + Analytics Engine** — Cloudflare-native 관측성 (엣지 레이어), 기존 Sentry/PostHog/Langfuse는 애플리케이션 레이어 유지, Vercel Analytics는 Cloudflare Web Analytics로 대체
8. **규제 준수** — EU-only routing (EU MDR data residency), HIPAA BAA scope 준수, 21 CFR Part 11 audit immutability R2 compliance mode + Iceberg 포맷으로 확장

본 Phase 7은 **Phase 8 인증 문서 ingestion, Phase 10 regulatory radar 자동화의 선행 레일**이며 — 해당 기능은 별도 SPEC에서 구현한다. 본 Phase는 Phase 6 LAUNCH에서 locked된 결정 (promptfoo, k6, Vercel baseline, Neon, GitHub Actions)을 **직접 대체하지 않고** Cloudflare 생태계로 확장한다.

---

## 범위 (Scope)

### In Scope

#### Group A: Next.js on Workers 이식

| 구분 | 산출물 |
|---|---|
| Build adapter | `open-next.config.ts`, `wrangler.toml` (production + preview environments) |
| Workers runtime 설정 | `compatibility_flags = ["nodejs_compat"]`, `compatibility_date = "2026-04-22"`, Workers Paid plan 가정 |
| Edge middleware | `middleware-edge.ts` (기존 `middleware.ts` 재작성, Auth.js v5 Edge session preset, noindex 전역 헤더 유지, locale redirect 유지) |
| Auth session 전환 | Auth.js v5 `database` strategy → `jwt` 또는 Workers KV session, `users.sessions` join 방식 점검 |
| SSE Route Handler 검증 | `/api/ra/consult/route.ts` Workers runtime 동작 검증, Web Streams 순수 사용, `nodejs_compat` 없이 동작 시 우선 |
| 배포 파이프라인 | `.github/workflows/cf-deploy.yml` (production manual gate, preview auto deploy per PR), `pnpm wrangler deploy --env production` |
| Canary DNS | 10% / 50% / 100% 단계 전환, Vercel 병렬 유지 기간 7일 이상, canary 기간 중 P95 latency 비교 로깅 |

#### Group B: Vectorize + AutoRAG Hybrid

| 구분 | 산출물 |
|---|---|
| Vectorize indexes | `regula-fda-public`, `regula-eu-mdr-public` (EU region), `regula-mfds-public`, `regula-nmpa-public`, `regula-pmda-public` (각 1536 dim, cosine) |
| AutoRAG instances | 위 5개 Vectorize index에 대응하는 AutoRAG 인스턴스 5종, 주 1회 재인덱싱 스케줄, R2 source bucket 연결 |
| Retriever 구현 | `lib/ai/retrievers/vectorize-fda.ts`, `vectorize-eu-mdr.ts`, `vectorize-mfds.ts`, `vectorize-nmpa.ts`, `vectorize-pmda.ts` (BREADTH Retriever 인터페이스 구현), `lib/ai/retrievers/autorag-adapter.ts` (AutoRAG API → Retriever) |
| Hybrid router | `lib/ai/hybrid-router.ts` (public corpus → Vectorize/AutoRAG, internal → pgvector, timeout 100ms fallback, Langfuse trace + Sentry breadcrumb emit) |
| pgvector 유지 경로 | internal SOP retrievers (`lib/ai/retrievers/internal-sop.ts` from BREADTH) 수정 없음, `lib/ai/router.ts` BREADTH의 기존 router는 hybrid-router에 의해 래핑 |

#### Group C: KV + Durable Objects

| 구분 | 산출물 |
|---|---|
| KV namespaces | `SESSION_KV` (Auth.js session store), `RATELIMIT_KV` (rate limit counter), `FLAGS_KV` (feature flag override, optional), `LOCALE_KV` (locale preference cache) |
| Session store adapter | `lib/auth/kv-session-store.ts` (Auth.js v5 Adapter interface 구현), dual-write 기간 Neon `sessions` + KV 병용 |
| Rate limit adapter | `lib/ratelimit/cloudflare-kv.ts` (기존 `lib/ratelimit/upstash.ts` 대체 or wrap) |
| Durable Objects (옵션) | `workers/consult-session-do.ts` (conversationId 기반 SSE invariant 강제), Phase 7 RUN에서 기존 stateless 설계와 A/B 비교 후 결정 |
| Binding 설정 | `wrangler.toml` `[[kv_namespaces]]`, `[[durable_objects.bindings]]` 전체 정의 |

#### Group D: R2 Storage + Audit Cold Storage

| 구분 | 산출물 |
|---|---|
| R2 buckets | `regula-corpus-public` (FDA/EU MDR/MFDS/NMPA/PMDA PDF 원본), `regula-corpus-internal` (ISO 13485/14971), `regula-audit-cold` (audit_logs 90일+ Iceberg 포맷), `regula-assets` (제출 문서 preview, Phase 8 재사용 레일), `regula-opennext-cache` (ISR/static cache) |
| Object Lock | `regula-audit-cold` + `regula-corpus-internal`에 compliance mode object lock, retention 7년 (`retainUntilDate` = created_at + 7y) |
| Versioning | 모든 버킷에 versioning 활성 (우발 override 방지) |
| Iceberg 포맷 | R2 Data Catalog + Iceberg table `audit_logs_cold` schema (audit_logs와 동일 컬럼 + `archived_at`), 월 1회 Neon → R2 batch migration |
| Query layer | `lib/audit/cold-query.ts` (Iceberg SQL query 래퍼, 감사 대응 시 date range 조회) |
| Migration tool | `scripts/audit-archive.ts` (월 1회 cron 실행, idempotent, checksum 기반 dedup) |

#### Group E: Queues + Cron Triggers

| 구분 | 산출물 |
|---|---|
| Queues | `audit-archive-queue` (audit_logs → R2 이관 batch), `corpus-update-queue` (AutoRAG re-index trigger), `notification-queue` (expert review assignment notification), `langfuse-flush-queue` (비동기 trace upload) |
| Queue consumers | `workers/audit-archive-consumer.ts`, `workers/corpus-update-consumer.ts`, `workers/notification-consumer.ts`, `workers/langfuse-flush-consumer.ts` |
| Cron Triggers | Daily FDA crawl (`0 2 * * *` UTC), Weekly AutoRAG re-index (`0 3 * * 1`), Monthly audit archive (`0 4 1 * *`), Quarterly secrets rotation reminder (`0 0 1 */3 *`) |
| Inngest 병용 | 복잡 워크플로 (eval harness 재실행, bulk ingestion) Phase 7 범위에서는 Inngest 유지, Cloudflare Workflows 평가 문서만 작성 |

#### Group F: Security (WAF + Access + DDoS + Turnstile + mTLS)

| 구분 | 산출물 |
|---|---|
| WAF rules | `cloudflare/waf-rules.toml` (OWASP Core Rule Set 활성화 설정 + Regula custom rules: `/api/ra/consult` body size ≤ 100KB, `/api/ra/expert-review` DELETE block, User-Agent 봇 차단 패턴) |
| DDoS | L3/L4 기본 (자동), L7 Paid plan ML-based (설정 문서 `docs/security/cloudflare-ddos.md`) |
| Cloudflare Access | `/api/admin/*`, `/expert-review` 경로에 대한 Access application 설정, 조직 SSO front, 외부 RA 컨설턴트 이메일 화이트리스트 |
| Turnstile | `/login` 페이지 + admin critical 액션 (e.g., user role change) 에 Turnstile widget 통합 (`@marsidev/react-turnstile` 또는 Cloudflare native) |
| mTLS 레일 | `lib/external/fda-estar.ts`, `lib/external/eu-ectd.ts` placeholder (빈 인터페이스 + mTLS config 주석), Cloudflare API Gateway mTLS trusted CA 등록 문서 `docs/integrations/mtls-setup.md` |
| Application 보안 유지 | Phase 5 ENTERPRISE의 CSP/HSTS/CSRF/SSRF 미들웨어는 **유지** (defense in depth) |

#### Group G: Observability 통합

| 구분 | 산출물 |
|---|---|
| Logpush | Workers 실행 로그 + WAF 매치 로그 + Access 감사 로그를 `regula-audit-cold` R2로 실시간 스트리밍, 정합성 weekly cron 검증 |
| Analytics Engine | `lib/analytics/cloudflare-engine.ts` (엣지 메트릭 emit: consult 요청 수, edge response time P95, geographic distribution) |
| Sentry Workers SDK | `@sentry/cloudflare` Workers SDK 전환 (기존 `@sentry/nextjs` client/server config 유지, edge config만 추가) |
| PostHog / Langfuse | 애플리케이션 레이어 유지 (Workers runtime에서 `fetch` 기반 HTTP 전송만 확인) |
| Vercel Analytics 제거 | Cloudflare Web Analytics 또는 제거만 (Phase 6 LAUNCH의 Web Vitals 대체) |

#### Group H: Compliance (EU residency + HIPAA BAA + 21 CFR Part 11)

| 구분 | 산출물 |
|---|---|
| EU-only routing | `organizations.data_region` 컬럼 신규 migration (`'us' | 'eu' | 'apac'`), EU 조직 요청은 Workers EU route + Vectorize EU instance + R2 EU bucket 강제 |
| HIPAA BAA verification | `docs/compliance/hipaa-baa-scope.md` (Cloudflare 법무 확인 결과 기록, Workers AI scope 명시 — Pending #1 해소), PII path에서 BAA 미포함 서비스 우회 정책 |
| 21 CFR Part 11 확장 | R2 compliance mode object lock + Iceberg audit archive + tamper-evident log chain (hash chain: 각 archive chunk의 SHA-256이 이전 chunk hash 포함), `docs/compliance/part-11-extended.md` (Phase 1 FOUNDATION의 append-only trigger + Phase 7 R2 object lock 결합 설명) |
| Audit 정적 분석 확장 | `scripts/qa/audit-archive-completeness.ts` (Neon audit_logs - R2 archived_audit_logs count 정합 검증, CI gate) |

### Out of Scope

다음 항목은 Phase 8 이후 또는 Post-launch에서 처리한다.

| 항목 | 이관 위치 | 사유 |
|---|---|---|
| Phase 8 인증 문서 ingestion | Phase 8 별도 SPEC | 본 SPEC은 `regula-assets` R2 bucket + mTLS 레일만 준비 |
| Phase 10 regulatory radar 풀 자동화 | Phase 10 별도 SPEC | 본 SPEC은 daily crawl cron 기본 설정만 |
| Workers AI를 LLM 답변 생성의 주 경로로 사용 | Post-launch 검토 | Claude Sonnet 유지, Workers AI는 전처리(intent/PII)만 |
| Cloudflare Pages 전환 | Out of Scope 영구 | Pages는 Cloudflare 권고 레거시 경로, Workers runtime 우선 |
| Multi-region Postgres (Neon EU + US active-active) | Post-launch | 단일 region Neon 유지, 장애 시 read replica만 |
| Vercel 완전 제거 | Phase 7 종료 게이트의 일부로 포함되나, 본 SPEC 범위에서는 "canary 100% 확인 후 아카이브" 수준 | Vercel project 실제 삭제는 별도 운영 작업 |
| Cloudflare Workflows 전면 도입 | Post-launch | Phase 7은 Cloudflare Queues만, Workflows는 평가 문서만 |
| 다중 클라우드 failover (DNS fail-over to Vercel standby) | Post-launch Phase 11+ | Cloudflare 장애 다중화는 별도 전략 SPEC |
| DB-level Row-Level Security on internal corpus | Post-launch | 애플리케이션 레이어 RBAC + metadata filter 유지 |
| Cloudflare R2 Data Catalog의 Athena/BigQuery federation | Out of Scope | Iceberg-native 쿼리만 (R2 SQL) |
| Inngest 완전 제거 | Post-launch | Phase 7은 병용, 안정화 후 제거 |
| mTLS 실제 FDA eSTAR/EU eCTD 연동 | Phase 9+ | 본 SPEC은 레일 (placeholder 파일 + config)만 |
| Workers AI 정확도 저하 시 전환 fallback 로직의 자동화 수준 | Phase 7 RUN 결정 | 기본은 환경 변수 플래그 기반 수동 전환 |

---

## 기술 결정 (Technical Decisions)

research.md §11 Decision Matrix 요약. 상세 근거는 research.md 해당 섹션 참조.

| # | 결정 항목 | 선택 | 탈락안 | 근거 (research.md) | 재평가 조건 |
|---|---|---|---|---|---|
| 1 | Next.js Cloudflare 이식 도구 | **OpenNext.js v3 (@opennextjs/cloudflare)** | Cloudflare Pages / Vercel CDN-only 유지 | §1.1, §1.2 — Cloudflare 공식 권고, App Router+RSC+SSE 전 기능 지원 | Next.js v15 future feature 지원 gap 발생 시 |
| 2 | Vector store 전략 | **Hybrid (Vectorize public / pgvector internal)** | 단일 스토어 | §2 — 데이터 주권(내부 corpus pgvector) + 엣지 latency(공개 corpus Vectorize) 양립 | Vectorize 5M limit 도달 또는 tenant isolation 취약성 |
| 3 | AutoRAG 도입 | **Yes (공개 5 corpus 한정)** | 자체 ingestion 전량 유지 | §4 — managed 안정성, 주간 재인덱싱 자동화 | retrieval precision -5% 이상 저하 또는 비용 3배 초과 |
| 4 | Queue 시스템 | **Cloudflare Queues (단순 job) + Inngest 병용 (복잡 워크플로)** | 전량 Inngest 유지 / 전량 Queues 전환 | §5.4 — 단계적 이관, 관측성 보존 | Cloudflare Workflows 관측성 개선 발표 시 전면 이관 재평가 |
| 5 | Session store | **Workers KV + Neon dual-write (이행 기간)** | Redis/Upstash / Neon only / KV only | §5.1 — 엣지 레이턴시 + fallback 안전성 | KV eventual consistency로 인한 세션 인증 장애 |
| 6 | SSE 상태 관리 | **Durable Objects (옵션, RUN A/B 결정)** | Stateless application layer 유지 | §5.2 — invariant 위반율과 비용 trade-off | 기존 validator로 위반 0건 확인 시 DO 미도입 |
| 7 | Audit cold storage | **R2 Data Catalog (Iceberg) + Object Lock (Compliance Mode)** | Neon audit_logs 파티션 유지 | §5.3, §8.3 — 비용 + 7년 retention + WORM semantic | FDA 감사관이 cloud object lock 수용 거부 시 AWS S3 Glacier Vault Lock 이중화 |
| 8 | WAF 정책 | **Cloudflare OWASP + Regula custom rules** | 애플리케이션 only 유지 | §6.1 — defense in depth, 엣지 차단 | OWASP false-positive rate > 0.1% 시 custom override |
| 9 | LLM 전처리 | **Workers AI (Llama 3.3 70B Instruct) + Haiku fallback** | Haiku-only 유지 | §3 — 비용 절감, 정확도 85% baseline | 정확도 < 85% 또는 HIPAA BAA 미포함 |

---

## EARS 요구사항 (EARS Requirements)

본 SPEC은 **85개 REQ-CF**를 8개 그룹으로 조직한다. 각 REQ는 EARS 패턴(Ubiquitous / Event-Driven / State-Driven / Unwanted / Optional) 중 하나를 명시한다.

- **Group A — Next.js on Workers 이식** (REQ-CF-001 ~ REQ-CF-015): 15개
- **Group B — Vectorize + AutoRAG Hybrid** (REQ-CF-016 ~ REQ-CF-030): 15개
- **Group C — KV + Durable Objects** (REQ-CF-031 ~ REQ-CF-040): 10개
- **Group D — R2 Storage + Audit Cold Storage** (REQ-CF-041 ~ REQ-CF-055): 15개
- **Group E — Queues + Cron Triggers** (REQ-CF-056 ~ REQ-CF-065): 10개
- **Group F — Security (WAF / Access / DDoS / Turnstile / mTLS)** (REQ-CF-066 ~ REQ-CF-075): 10개
- **Group G — Observability 통합** (REQ-CF-076 ~ REQ-CF-080): 5개
- **Group H — Compliance (EU residency / HIPAA BAA / Part 11 immutability)** (REQ-CF-081 ~ REQ-CF-085): 5개

---

### Group Overview

각 그룹은 다음 3 요소를 공통 구조로 갖는다: (a) **그룹 목적** — 본 그룹이 Phase 7에서 담당하는 범위와 타 그룹과의 경계, (b) **선행 조건** — 본 그룹 REQ 실행 전 충족되어야 할 상태, (c) **그룹 완료 게이트** — 본 그룹 REQ 전체 구현 완료로 간주되는 정량 기준. REQ 본문에서 그룹 간 cross-reference가 필요한 경우 `[see Group X]` 표기를 사용한다.

---

### Group A: Next.js on Workers 이식 (REQ-CF-001 ~ REQ-CF-015)

**그룹 목적:** Phase 6 LAUNCH의 Vercel 프로덕션 배포를 Cloudflare Workers runtime으로 이식. OpenNext.js v3 어댑터가 기능 동등성을 보장하고, SSE/Edge Middleware/Auth.js가 Workers에서 기존 Phase 1-6 동작을 유지한다. Canary DNS 분할을 통한 무중단 전환이 본 그룹의 운영 리스크 완화 축이다.

**선행 조건:**
- Phase 6 LAUNCH `v0.2.0` production deploy 성공 및 7일 stability 확보
- Cloudflare 계정 Workers Paid plan 활성 + R2 + Vectorize + KV + Durable Objects 권한
- `wrangler` CLI v3+ 설치 + GitHub Actions OIDC 연동
- Anthropic / OpenAI / Cohere API 키가 Cloudflare environment secrets로 이관

**그룹 완료 게이트:**
- Canary 100% + 7-day stability (REQ-CF-014)
- Phase 1-6 integration test 전체 통과 (REQ-CF-015)
- Workers P50 first token latency ≤ Vercel baseline + 20% (REQ-CF-013)
- `scripts/qa/no-vercel-edge.ts` 0 violations (REQ-CF-009)

#### REQ-CF-001 (Ubiquitous)
**요구사항:** The system SHALL include `@opennextjs/cloudflare` (version `^1.0.0` 이상) as a `devDependency` in `package.json`.
**근거:** research.md §1.1 — Cloudflare 공식 Next.js 15 어댑터.
**검증 방법:** `pnpm why @opennextjs/cloudflare` 실행 시 존재 확인. `package.json` parsing으로 버전 구간 `^1.x` 일치.

#### REQ-CF-002 (Ubiquitous)
**요구사항:** The system SHALL provide `open-next.config.ts` at repository root configuring the Cloudflare adapter with `incrementalCache` pointing to R2 bucket `regula-opennext-cache` and `runtime: "cloudflare"`.
**근거:** research.md §1.2 — ISR cache 엣지 저장소.
**검증 방법:** `open-next.config.ts` TypeScript compile 성공 + `incrementalCache.bucketName === 'regula-opennext-cache'`.

#### REQ-CF-003 (Ubiquitous)
**요구사항:** The system SHALL provide `wrangler.toml` at repository root defining `compatibility_date = "2026-04-22"` OR newer, `compatibility_flags = ["nodejs_compat"]`, and distinct `[env.production]` and `[env.preview]` blocks.
**근거:** research.md §1.2 — Workers runtime 호환성.
**검증 방법:** `pnpm wrangler deploy --dry-run --env production` 및 `--env preview` 모두 성공.

#### REQ-CF-004 (State-Driven)
**요구사항:** WHILE the Next.js application is deployed on Cloudflare Workers, THE system SHALL preserve all SSE 3-phase order invariants (trace → prose → structured) from SPEC-REGULA-CHAT-001 and SPEC-REGULA-STRUCTURED-001.
**근거:** research.md §1.3 — Web Streams API 네이티브 지원으로 invariant 유지 가능.
**검증 방법:** `tests/integration/sse-workers.test.ts` — Workers 환경에서 `/api/ra/consult` 요청 시 `trace` event 최소 1개 → `prose` token stream → `done` → `structured` event 순 방출 검증.

#### REQ-CF-005 (Ubiquitous)
**요구사항:** The system SHALL provide `middleware-edge.ts` replacing `middleware.ts` for Workers deployment, preserving these behaviors: (a) Auth.js v5 session validation, (b) `X-Robots-Tag: noindex, nofollow` global header, (c) locale redirect based on `organizations.data_region`, (d) `/login` path noindex override whitelist.
**근거:** handoff §16 data residency + FOUNDATION REQ-FND noindex + Phase 5 ENTERPRISE RBAC + research.md §1.4.
**검증 방법:** `tests/middleware/edge-middleware.test.ts` 각 동작 단위 테스트.

#### REQ-CF-006 (Event-Driven)
**요구사항:** WHEN a request arrives at `/login`, THE edge middleware SHALL NOT apply `X-Robots-Tag: noindex`, preserving FOUNDATION Phase 1 noindex whitelist behavior.
**근거:** FOUNDATION Phase 1 `/login`은 marketing SEO 예외.
**검증 방법:** `tests/middleware/noindex-whitelist.test.ts`: GET `/login` response headers에 `X-Robots-Tag` 부재 확인.

#### REQ-CF-007 (Ubiquitous)
**요구사항:** The Auth.js v5 session strategy SHALL be configured with a Workers KV-backed adapter via `lib/auth/kv-session-store.ts` exporting `getSessionAdapter()` which returns an Auth.js `Adapter` interface implementation.
**근거:** research.md §5.1 — KV session store.
**검증 방법:** `lib/auth/kv-session-store.ts` exists with `getSessionAdapter()` function; Auth.js `auth.config.ts`에서 `adapter: getSessionAdapter()` 설정.

#### REQ-CF-008 (State-Driven)
**요구사항:** WHILE the dual-write migration period is active (`env.DUAL_WRITE_SESSIONS === 'true'`), THE session write SHALL occur to BOTH Workers KV AND Neon `sessions` table atomically (best-effort, KV failure does not block DB write).
**근거:** research.md §5.1 — eventual consistency 리스크 완화.
**검증 방법:** `tests/integration/session-dual-write.test.ts` 활성 상태에서 KV + Neon 양측에 write 확인.

#### REQ-CF-009 (Unwanted)
**요구사항:** The system SHALL NOT use `@vercel/edge` or `@vercel/og` or any Vercel-specific edge runtime API in Workers deployment. IF any such import is detected in `app/**/*.ts(x)` OR `middleware-edge.ts`, THEN the CI build SHALL fail.
**근거:** Workers runtime 호환성 — Vercel Edge API는 Cloudflare에서 동작하지 않음.
**검증 방법:** `scripts/qa/no-vercel-edge.ts` (grep-based 정적 분석), CI gate `pnpm cf:check`.

#### REQ-CF-010 (Ubiquitous)
**요구사항:** The system SHALL provide `.github/workflows/cf-deploy.yml` that runs on `push` to `main`, executes `pnpm build && pnpm wrangler deploy --env production`, and requires `environment: production` manual approval via GitHub Environments.
**근거:** Phase 6 LAUNCH REQ-LAUNCH deployment gate 패턴 재사용.
**검증 방법:** YAML parse + `jobs.deploy.environment === 'production'` 확인 + GitHub Environments에서 reviewer 설정 확인.

#### REQ-CF-011 (Optional)
**요구사항:** WHERE canary deployment is enabled (via DNS traffic split), THE Cloudflare deployment SHALL receive 10%, 50%, 100% traffic in sequential steps with at least 24 hours between increments.
**근거:** Phase 6 LAUNCH rollback 안전성 + research.md §10.1.
**검증 방법:** `docs/deployment/cloudflare-canary.md` runbook 존재 + DNS CNAME 설정 스크린샷.

#### REQ-CF-012 (State-Driven)
**요구사항:** WHILE canary is at 10% or 50%, THE Vercel production deployment SHALL remain active as fallback, with identical env vars + DB connection.
**근거:** research.md §10.1 — 이행 기간 duoal 운영.
**검증 방법:** Vercel project 상태 + DNS weighted routing config 정합성 수동 확인.

#### REQ-CF-013 (Event-Driven)
**요구사항:** WHEN the P95 `/api/ra/consult` first-token latency on Cloudflare exceeds the Vercel baseline by more than 20% during canary, THE deployment SHALL NOT advance to the next canary step and SHALL log a blocker to `docs/deployment/canary-log.md`.
**근거:** research.md §10.3 — retrieval latency regression 방지.
**검증 방법:** Langfuse 비교 대시보드 + blocker doc entry 수동 확인.

#### REQ-CF-014 (Unwanted)
**요구사항:** The system SHALL NOT remove the Vercel deployment until canary reaches 100% AND stability is confirmed for at least 7 consecutive days. IF `vercel project rm` is executed before this condition, THEN the change SHALL be reverted.
**근거:** 롤백 안전성.
**검증 방법:** 운영 체크리스트 `docs/deployment/cloudflare-cutover.md` 7-day gate 항목.

#### REQ-CF-015 (Ubiquitous)
**요구사항:** The Workers deployment SHALL preserve the existing `/api/ra/*` route surface (consult, expert-review, conversations, templates, sources, updates, dashboard, projects) from Phase 2-5, with NO breaking change to request/response contracts.
**근거:** `Phase 7 신규 비즈니스 기능 없음` 원칙.
**검증 방법:** `tests/integration/api-contract.test.ts` (기존 Phase 2-5 integration tests) 전부 통과.

---

### Group B: Vectorize + AutoRAG Hybrid (REQ-CF-016 ~ REQ-CF-030)

**그룹 목적:** 공개 regulatory corpus (FDA / EU MDR / MFDS / NMPA / PMDA)를 Cloudflare Vectorize + AutoRAG로 이관하여 전 세계 엣지 쿼리 레이턴시를 확보한다. 내부 SOP + 테넌트 문서는 pgvector Neon 유지하여 데이터 주권을 지킨다. Hybrid router가 두 백엔드 사이의 라우팅 + fallback + 관측성을 일원화한다. 본 그룹은 Phase 2 CHAT의 `cite_index` / `source_sections` invariant, Phase 4 BREADTH의 5 retriever 인터페이스, Phase 5 ENTERPRISE의 Langfuse trace 를 **모두 보존**한다.

**선행 조건:**
- Group A REQ-CF-001~003 wrangler 기본 설정 완료
- R2 `regula-corpus-public` 버킷 provisioned (Group D REQ-CF-041)
- 공개 corpus PDF 원본이 R2로 이관된 상태 (`docs/operations/corpus-migration.md`)
- Cohere Rerank v3 계약 유지 (Phase 5 ENTERPRISE TD에서 pending → lock)

**그룹 완료 게이트:**
- 5 Vectorize index + 5 AutoRAG instance provisioned (REQ-CF-016, 022)
- Vectorize P95 query latency < 10ms at provisioned vector count (global acceptance criteria)
- AutoRAG retrieval precision 저하 ≤ 5% versus pgvector baseline (REQ-CF-030)
- Hybrid router fallback 발생 시 Langfuse + Sentry trace 100% 기록 (REQ-CF-020)
- Internal corpus → AutoRAG 노출 0건 (REQ-CF-027)

#### REQ-CF-016 (Ubiquitous)
**요구사항:** The system SHALL provision 5 Cloudflare Vectorize indexes: `regula-fda-public`, `regula-eu-mdr-public`, `regula-mfds-public`, `regula-nmpa-public`, `regula-pmda-public`, each with `dimensions: 1536`, `metric: "cosine"`, matching the OpenAI `text-embedding-3-small` model used in Phase 2.
**근거:** research.md §2.2 데이터 주권 매트릭스 + Phase 2 CHAT embedding model lock.
**검증 방법:** `pnpm wrangler vectorize list` 실행 시 5개 index 존재 확인.

#### REQ-CF-017 (State-Driven)
**요구사항:** IF an organization's `organizations.data_region` column value is `'eu'`, THEN the `regula-eu-mdr-public` Vectorize index SHALL be configured with EU region (`--region eu`) at creation time.
**근거:** research.md §8.1 EU residency + handoff §16.
**검증 방법:** `wrangler vectorize describe regula-eu-mdr-public` 출력 region 확인.

#### REQ-CF-018 (Ubiquitous)
**요구사항:** The system SHALL provide 5 Vectorize retriever implementations: `lib/ai/retrievers/vectorize-fda.ts`, `vectorize-eu-mdr.ts`, `vectorize-mfds.ts`, `vectorize-nmpa.ts`, `vectorize-pmda.ts`, each implementing the `Retriever` interface defined in SPEC-REGULA-BREADTH-001 without modification to the interface.
**근거:** research.md §2.4 retriever 시그니처 호환.
**검증 방법:** TypeScript compile + `import type { Retriever } from 'lib/ai/retrievers/types'` 확인.

#### REQ-CF-019 (Ubiquitous)
**요구사항:** The system SHALL provide `lib/ai/hybrid-router.ts` exporting `hybridRetrieve(query, scope, filters, k)` function that routes to Vectorize/AutoRAG for `scope === 'public_corpus'` and to pgvector for `scope === 'internal'`.
**근거:** research.md §2.3.
**검증 방법:** Unit test `tests/unit/hybrid-router.test.ts`: public scope → Vectorize call spy; internal scope → pgvector call spy.

#### REQ-CF-020 (Event-Driven)
**요구사항:** WHEN a Vectorize query times out (>100ms) OR returns an error, THE hybrid router SHALL silently fallback to pgvector for the same corpus AND emit a Langfuse trace breadcrumb `{event: 'vectorize_fallback', corpus, reason}` AND send a Sentry breadcrumb with the same payload.
**근거:** research.md §2.3 silent fallback 금지 (관측성 보존).
**검증 방법:** 통합 테스트에서 Vectorize mock throw → pgvector 호출 확인 + Langfuse/Sentry mock assertions.

#### REQ-CF-021 (Optional) [Pending Item #2]
**요구사항:** WHERE Cloudflare Vectorize EU region is confirmed GA (not beta) at Phase 7 RUN start, THE `regula-eu-mdr-public` Vectorize index SHALL be deployed to EU region; OTHERWISE the EU MDR corpus retriever SHALL use the existing pgvector Neon EU branch from Phase 4 BREADTH.
**근거:** research.md §12 Pending #2.
**검증 방법:** Cloudflare Status Page + changelog 확인 결과를 `docs/compliance/vectorize-eu-region.md`에 기록.

#### REQ-CF-022 (Ubiquitous)
**요구사항:** The system SHALL provision 5 Cloudflare AutoRAG instances (`regula-rag-fda`, `regula-rag-eu-mdr`, `regula-rag-mfds`, `regula-rag-nmpa`, `regula-rag-pmda`), each connected to the corresponding subdirectory of R2 bucket `regula-corpus-public/`.
**근거:** research.md §4.2.
**검증 방법:** `wrangler autorag list` 출력 5개 instance 확인.

#### REQ-CF-023 (State-Driven)
**요구사항:** IF AutoRAG instance `regula-rag-fda` receives a query AND the configured embedding model matches `text-embedding-3-small` (1536 dim), THEN the response chunks SHALL be compatible with the `Chunk` schema used by Phase 2 CHAT citation enforcement.
**근거:** Phase 2 CHAT `cite_index` + `source_sections` invariant 보존.
**검증 방법:** 통합 테스트 — AutoRAG 응답 chunk를 `lib/ai/citation-enforce.ts`에 통과시켜 의도된 `<sup class="cite">` 생성 확인.

#### REQ-CF-024 (Ubiquitous)
**요구사항:** The system SHALL provide `lib/ai/retrievers/autorag-adapter.ts` exporting `AutoRAGRetriever` class implementing the `Retriever` interface, wrapping `env.AI.autorag(instanceName).aiSearch(...)` calls.
**근거:** research.md §4.3.
**검증 방법:** TypeScript compile + unit test.

#### REQ-CF-025 (Event-Driven)
**요구사항:** WHEN the Weekly AutoRAG re-index Cron Trigger fires (`0 3 * * 1`), THE system SHALL invoke `POST /api/admin/autorag-reindex` which iterates all 5 AutoRAG instances and triggers re-indexing via the Cloudflare AutoRAG API.
**근거:** research.md §4.2 + §5.5.
**검증 방법:** `tests/integration/cron-autorag.test.ts` mock cron 발동 시 5개 instance `sync()` 호출 확인.

#### REQ-CF-026 (State-Driven)
**요구사항:** IF an AutoRAG re-index operation fails for any corpus, THEN the Cron handler SHALL log the failure via `writeAudit({action: 'corpus.update_failed', meta: {corpus, error_class}})` and continue with remaining corpora (no early termination).
**근거:** idempotency + observability.
**검증 방법:** 한 instance throw 시 다른 instance 호출 지속 + audit_logs row 존재 확인.

#### REQ-CF-027 (Unwanted)
**요구사항:** The `lib/ai/hybrid-router.ts` SHALL NOT expose internal corpus (pgvector Neon internal SOP) via the public AutoRAG API surface. IF an AutoRAG-routed query attempts to include `scope === 'internal'`, THEN the router SHALL reject the request with a 400 `BadScopeError`.
**근거:** 데이터 주권 + tenant isolation.
**검증 방법:** Unit test — internal scope로 AutoRAG 경로 진입 시 에러 확인.

#### REQ-CF-028 (Event-Driven)
**요구사항:** WHEN the hybrid router's fallback from Vectorize to pgvector occurs, THE fallback rate SHALL be tracked in Cloudflare Analytics Engine (`vectorize_fallback` counter) AND the weekly rate average SHALL be written to `docs/operations/vectorize-health.md`.
**근거:** research.md §2.3 + §7.2.
**검증 방법:** Analytics Engine metric 존재 + weekly cron이 doc entry 작성 확인.

#### REQ-CF-029 (Ubiquitous)
**요구사항:** The AutoRAG `aiSearch` invocation SHALL be wrapped by `lib/ai/langfuse.ts` Langfuse generation trace to preserve Phase 5 observability coverage, with trace attributes: `{corpus, topK, latency_ms, score_distribution}`.
**근거:** Phase 5 ENTERPRISE Langfuse wrapper + research.md §4.3.
**검증 방법:** Langfuse dashboard에서 AutoRAG generation 항목 확인.

#### REQ-CF-030 (State-Driven)
**요구사항:** IF an AutoRAG retrieval precision degradation of ≥5% versus pre-migration baseline is observed in Phase 6 LAUNCH eval harness (promptfoo), THEN the corresponding corpus SHALL be reverted to pgvector via env flag `VECTOR_BACKEND_<CORPUS>=pgvector` without code change.
**근거:** research.md §4.5 재평가 조건.
**검증 방법:** env 플래그 적용 후 retrieval path가 pgvector로 전환됨을 smoke test로 확인.

---

### Group C: KV + Durable Objects (REQ-CF-031 ~ REQ-CF-040)

**그룹 목적:** 세션 저장소, rate limit counter, feature flag override, locale 선호 캐시를 Workers KV로 이관하여 엣지 레이턴시를 확보한다. SSE 3-phase 순서 invariant를 엣지에서 stateful 강제할지는 Phase 7 RUN의 A/B 측정 결과에 기반한 **Optional** 도입이다. 본 그룹의 핵심 원칙은 (a) dual-write 기간 안전성, (b) eventual consistency 장애 완화, (c) PII 저장 금지(DO 내부 state)이다.

**선행 조건:**
- Group A REQ-CF-001~003 완료
- Neon `sessions` 테이블 schema (Phase 1 FOUNDATION 13-table)가 그대로 유지된 상태
- Phase 5 ENTERPRISE `lib/ratelimit/upstash.ts` 기존 로직이 대체 대상으로 식별됨

**그룹 완료 게이트:**
- `SESSION_KV` / `RATELIMIT_KV` / `FLAGS_KV` / `LOCALE_KV` 4개 namespace provisioned (REQ-CF-031)
- Auth.js v5 KV adapter 전체 메서드 구현 및 Phase 1 SSO 플로우 통과 (REQ-CF-032)
- Dual-write 기간 세션 정합성 검증 (KV + Neon 양측 동일 sessionToken 존재, REQ-CF-033)
- 120-second grace period 경계 테스트 통과 (REQ-CF-034)
- DO 도입 여부 결정 및 `docs/decisions/durable-objects.md` 기록 (REQ-CF-036)
- DO 내부 state PII 검사 0 violations (REQ-CF-038)

#### REQ-CF-031 (Ubiquitous)
**요구사항:** The `wrangler.toml` SHALL declare at least these 4 KV namespaces: `SESSION_KV`, `RATELIMIT_KV`, `FLAGS_KV`, `LOCALE_KV` with unique `id` values per environment (production/preview).
**근거:** research.md §5.1.
**검증 방법:** `wrangler kv:namespace list` 출력 확인.

#### REQ-CF-032 (Ubiquitous)
**요구사항:** The `lib/auth/kv-session-store.ts` SHALL implement the Auth.js v5 `Adapter` interface including these methods at minimum: `getSessionAndUser`, `createSession`, `updateSession`, `deleteSession`, with KV key pattern `session:<sessionToken>` and value TTL of 30 days.
**근거:** research.md §5.1 + Auth.js v5 adapter spec.
**검증 방법:** Unit test `tests/unit/kv-session-store.test.ts` 각 메서드.

#### REQ-CF-033 (Event-Driven)
**요구사항:** WHEN a session is created via Auth.js callback AND `env.DUAL_WRITE_SESSIONS === 'true'`, THE adapter SHALL write to KV first, then attempt Neon `sessions` write; IF Neon write fails, THEN the session SHALL remain valid in KV (no rollback).
**근거:** research.md §5.1 dual-write ordering.
**검증 방법:** 통합 테스트 — Neon mock throw 상황에서 세션 유효성 유지 확인.

#### REQ-CF-034 (State-Driven)
**요구사항:** WHILE a session exists in KV but NOT in Neon (eventual consistency gap), THE middleware SHALL accept the KV-only session as valid for a maximum of 120 seconds (configurable via `env.KV_SESSION_GRACE_PERIOD_SECONDS`).
**근거:** research.md §5.1 eventual consistency 완화.
**검증 방법:** 통합 테스트 — Neon absent KV present 상태에서 120초 이내 accept, 초과 시 재인증.

#### REQ-CF-035 (Ubiquitous)
**요구사항:** The `lib/ratelimit/cloudflare-kv.ts` SHALL implement sliding-window rate limit with KV key pattern `ratelimit:<endpoint>:<userId>:<window>` replacing or wrapping `lib/ratelimit/upstash.ts` from Phase 5 ENTERPRISE.
**근거:** research.md §5.1.
**검증 방법:** Unit test limit enforcement + 기존 Phase 5 rate limit 테스트 스위트 통과.

#### REQ-CF-036 (Optional)
**요구사항:** WHERE Phase 7 RUN A/B measurement determines that stateless SSE validator (Phase 2) has non-zero invariant violation rate, THE system SHALL deploy `workers/consult-session-do.ts` Durable Object binding per `conversationId` for SSE state management.
**근거:** research.md §5.2 옵션 의사결정.
**검증 방법:** `docs/decisions/durable-objects.md`에 A/B 결과 기록 + 채택 시 DO binding 존재 확인.

#### REQ-CF-037 (State-Driven)
**요구사항:** IF Durable Objects are deployed for SSE (REQ-CF-036 active), THEN each `ConsultSessionDO` instance SHALL enforce phase state machine: `trace` → `prose` → `structured` → `done`, rejecting out-of-order `emit()` calls with `InvalidPhaseTransitionError`.
**근거:** Phase 2 + 3 SSE invariant 엣지 강제.
**검증 방법:** Unit test — out-of-order emit 시 throw.

#### REQ-CF-038 (Unwanted)
**요구사항:** The Durable Object SHALL NOT persist user message content (question/answer text) in its internal state; only event metadata (phase, timestamp, event_type) is allowed.
**근거:** Phase 5 ENTERPRISE audit-completeness PII 금지 + handoff §16.
**검증 방법:** DO schema 정적 검증 + `scripts/qa/do-no-pii.ts` grep rule.

#### REQ-CF-039 (Ubiquitous)
**요구사항:** The `FLAGS_KV` namespace SHALL store feature flag overrides with key pattern `ff:<flagName>:<userId>`, readable by middleware and Route Handlers without blocking on Neon.
**근거:** research.md §5.1 Phase 5 TD-3 재평가 가능성 반영.
**검증 방법:** KV read latency P95 ≤ 5ms from Workers edge.

#### REQ-CF-040 (Event-Driven)
**요구사항:** WHEN a user updates their preferred locale via `PATCH /api/ra/profile`, THE system SHALL invalidate the `LOCALE_KV` entry `locale:<userId>` (delete OR overwrite with new value) AND update `users.preferred_locale` in Neon atomically.
**근거:** Phase 5 ENTERPRISE i18n + cache invalidation.
**검증 방법:** 통합 테스트 — PATCH 후 다음 요청이 새 locale 반영 확인.

---

### Group D: R2 Storage + Audit Cold Storage (REQ-CF-041 ~ REQ-CF-055)

**그룹 목적:** R2를 Regula의 **단일 object storage** 레이어로 확립한다. corpus PDF 원본, 제출 문서 preview (Phase 8 재사용 레일), ISR cache, 그리고 **21 CFR Part 11 audit cold storage**가 본 그룹의 범위다. Audit cold storage의 Object Lock Compliance Mode 채택은 규제 감사관의 수용성(research.md §8.4)에 직결되므로 본 그룹이 Phase 7의 compliance 기여도 대부분을 담당한다. Iceberg 포맷 + SHA-256 checksum chain + audit-of-audit meta-logging이 tamper-evident 증거 체인을 완성한다.

**선행 조건:**
- Group A REQ-CF-003 wrangler r2_buckets binding 선언
- Phase 1 FOUNDATION audit_logs append-only trigger 유지
- Phase 5 ENTERPRISE `writeAudit` 호출 site 전체가 Neon hot storage로 정상 기록 중
- Iceberg SDK (`@iceberg/client` 또는 Cloudflare 공식 SDK) 평가 완료

**그룹 완료 게이트:**
- 5 R2 bucket provisioned with versioning (REQ-CF-041, 044)
- `regula-audit-cold` Compliance Mode lock 활성 (REQ-CF-042, 083)
- Monthly archive cron 3 연속 성공 (REQ-CF-046)
- `audit-archive-completeness.ts` 0 violations (REQ-CF-052)
- `part-11-extended.md` 문서 5 항목 전부 기술 (REQ-CF-084)
- Cold query P95 < 500ms for 90-day range (REQ-CF-049 + global criteria)
- R2 public URL 노출 0건 (REQ-CF-050, 055)

#### REQ-CF-041 (Ubiquitous)
**요구사항:** The system SHALL provision 5 R2 buckets: `regula-corpus-public`, `regula-corpus-internal`, `regula-audit-cold`, `regula-assets`, `regula-opennext-cache`, each declared in `wrangler.toml` via `[[r2_buckets]]` bindings.
**근거:** research.md §5.3.
**검증 방법:** `wrangler r2 bucket list` 출력 확인.

#### REQ-CF-042 (State-Driven)
**요구사항:** WHILE R2 bucket `regula-audit-cold` is active, THE bucket SHALL have Object Lock enabled in **Compliance mode** (not Governance mode), with default retention period of 7 years from object creation.
**근거:** handoff §16 7-year retention + 21 CFR Part 11 §11.10(e) + research.md §8.3.
**검증 방법:** `wrangler r2 bucket lock-config regula-audit-cold` 출력 `mode: COMPLIANCE` + `retention_days >= 2555` 확인.

#### REQ-CF-043 (State-Driven)
**요구사항:** WHILE R2 bucket `regula-corpus-internal` is active, THE bucket SHALL have Object Lock enabled in Compliance mode with retention period matching customer license terms (minimum 1 year).
**근거:** 내부 SOP 라이선스 제약 + immutability.
**검증 방법:** `wrangler r2 bucket lock-config` 확인.

#### REQ-CF-044 (Ubiquitous)
**요구사항:** All 5 R2 buckets SHALL have object versioning enabled.
**근거:** research.md §5.3 우발 override 방지.
**검증 방법:** `wrangler r2 bucket versioning-config` 각 bucket 확인.

#### REQ-CF-045 (Ubiquitous)
**요구사항:** The system SHALL provision a Cloudflare R2 Data Catalog Iceberg table `audit_logs_cold` with schema matching Neon `audit_logs` columns PLUS additional `archived_at timestamp NOT NULL` field.
**근거:** research.md §5.3 + §8.3.
**검증 방법:** R2 Data Catalog API 조회 시 `audit_logs_cold` 스키마 9 columns 확인.

#### REQ-CF-046 (Event-Driven)
**요구사항:** WHEN the Monthly audit archive Cron Trigger fires (`0 4 1 * *` UTC), THE `workers/audit-archive-consumer.ts` SHALL transfer audit_logs entries older than 90 days from Neon to R2 Iceberg `audit_logs_cold` in idempotent batches of 10,000 rows.
**근거:** research.md §5.3 monthly batch + §5.5.
**검증 방법:** `tests/integration/audit-archive.test.ts` mock 90-day-old rows 이관 후 R2 table row count 일치 확인.

#### REQ-CF-047 (State-Driven)
**요구사항:** IF an audit archive batch fails mid-transfer, THEN the system SHALL NOT delete any Neon rows AND the next cron cycle SHALL resume from the last successful checkpoint (tracked via `audit_archive_checkpoint` column in separate `audit_archive_state` table).
**근거:** idempotency + 데이터 손실 방지.
**검증 방법:** 중간 실패 시뮬레이션 후 재실행으로 중복/누락 0건 확인.

#### REQ-CF-048 (Unwanted)
**요구사항:** The audit archive process SHALL NOT remove rows from Neon `audit_logs` until the R2 Iceberg write is confirmed via checksum verification (SHA-256 hash match). IF verification fails, THEN Neon rows remain and an alert is raised via Sentry.
**근거:** FOUNDATION append-only trigger + research.md §8.3 tamper-evident chain.
**검증 방법:** Checksum mismatch 시 DELETE 미실행 + Sentry event 확인.

#### REQ-CF-049 (Ubiquitous)
**요구사항:** The system SHALL provide `lib/audit/cold-query.ts` exporting `queryColdAudit(filters: {dateRange, action, actorId})` function that executes Iceberg SQL queries against R2 Data Catalog and returns results in the same shape as Neon `audit_logs` rows.
**근거:** research.md §5.3 쿼리 레이어.
**검증 방법:** 감사 대응 시나리오 통합 테스트: 2-year-old query → cold storage hit → Neon-compatible row shape.

#### REQ-CF-050 (Unwanted)
**요구사항:** The system SHALL NOT expose `regula-audit-cold` R2 bucket via any public URL. All access SHALL route through `lib/audit/cold-query.ts` which requires admin-level RBAC authentication (REQ-ENTERPRISE Phase 5 RBAC reuse).
**근거:** audit 무결성 + handoff §16.
**검증 방법:** `wrangler r2 bucket get-public-access regula-audit-cold` 출력 `disabled` 확인.

#### REQ-CF-051 (Event-Driven)
**요구사항:** WHEN an admin executes a cold audit query via Phase 5 admin portal, THE system SHALL write a meta-audit entry `writeAudit({action: 'audit.cold_query', meta: {dateRange, matched_count}})` to Neon audit_logs (hot storage) recording the query itself.
**근거:** "감사 기록을 조회한 사실도 감사 대상" (21 CFR Part 11 chain of custody).
**검증 방법:** 쿼리 실행 후 Neon `audit_logs`에 해당 row 존재 확인.

#### REQ-CF-052 (Ubiquitous)
**요구사항:** The `scripts/qa/audit-archive-completeness.ts` SHALL verify that for each month M, `COUNT(Neon.audit_logs WHERE created_at BETWEEN M-start AND M-end) == COUNT(R2.audit_logs_cold WHERE created_at BETWEEN M-start AND M-end)` within 99.99% tolerance AFTER the archive cron completes.
**근거:** research.md §8 정합성 검증.
**검증 방법:** CI gate `pnpm audit-archive:check` script pass.

#### REQ-CF-053 (Ubiquitous)
**요구사항:** Corpus PDF originals SHALL be stored in `regula-corpus-public` bucket under subdirectory structure: `{corpus}/{YYYY}/{filename}.pdf` (e.g., `fda/2024/21cfr-820.pdf`).
**근거:** research.md §5.3 + AutoRAG source 경로.
**검증 방법:** 샘플 조회 시 경로 패턴 일치.

#### REQ-CF-054 (Optional)
**요구사항:** WHERE submission document preview generation is requested (Phase 8 placeholder), THE generated preview images SHALL be stored in `regula-assets` bucket under `preview/{submissionId}/{pageNumber}.webp`.
**근거:** Phase 8 레일 준비 + research.md §5.3.
**검증 방법:** Phase 8 진입 시 경로 규칙 재사용 가능 확인 (Phase 7 본 REQ는 경로 reservation만).

#### REQ-CF-055 (Ubiquitous)
**요구사항:** All R2 bucket access SHALL require Workers Bindings (no public R2 URLs except for `regula-opennext-cache` if needed for CDN caching); `lib/storage/r2.ts` SHALL be the single-point abstraction for bucket operations.
**근거:** 보안 + handoff §16.
**검증 방법:** `scripts/qa/r2-access-audit.ts` grep rule + `lib/storage/r2.ts` existence.

---

### Group E: Queues + Cron Triggers (REQ-CF-056 ~ REQ-CF-065)

**그룹 목적:** Inngest에서 실행되던 단순 비동기 작업(audit archive, corpus update, notification delivery, Langfuse flush)을 Cloudflare Queues로 이관하여 동일 생태계 통합 + 비용 최적화를 달성한다. 복잡 워크플로(eval harness 재실행, bulk ingestion)는 Phase 7 범위에서 Inngest 병용 유지 → Cloudflare Workflows 평가 문서만 작성. Cron Triggers는 daily/weekly/monthly/quarterly 4 주기의 운영 자동화 축을 구성한다. Phase 10 regulatory-radar의 선행 인프라다.

**선행 조건:**
- Group A/D 완료 (Queues가 R2로 audit archive 기록 가능)
- Phase 1 FOUNDATION `notifications` 테이블 schema (Phase 5 ENTERPRISE 스펙 확장)
- Inngest 기존 작업 목록이 `docs/integrations/inngest-boundaries.md`에 정리됨

**그룹 완료 게이트:**
- 4 Queue + DLQ provisioned (REQ-CF-056, 057)
- 4 Cron Trigger 활성 (REQ-CF-060)
- Singleton lock 중복 실행 0건 (REQ-CF-061)
- Consumer 처리 + writeAudit 기록 정합 (REQ-CF-059, 063)
- Inngest-Cloudflare 경계 문서화 (REQ-CF-065)

#### REQ-CF-056 (Ubiquitous)
**요구사항:** The `wrangler.toml` SHALL declare at least these 4 Queues: `audit-archive-queue`, `corpus-update-queue`, `notification-queue`, `langfuse-flush-queue`.
**근거:** research.md §5.4.
**검증 방법:** `wrangler queues list` 확인.

#### REQ-CF-057 (Ubiquitous)
**요구사항:** Each Queue SHALL have a dead letter queue (DLQ) configured with `max_retries = 3` AND `max_batch_size = 100` AND `max_batch_timeout_ms = 30000`.
**근거:** Cloudflare Queues best practice + idempotency.
**검증 방법:** `wrangler queues describe <queue>` 각 파라미터 확인.

#### REQ-CF-058 (Event-Driven)
**요구사항:** WHEN an expert review assignment occurs (`PATCH /api/ra/expert-review/[id]` with `assignedTo` change), THE Route Handler SHALL enqueue a notification message to `notification-queue` with `{reviewId, assignedTo, reason}` payload.
**근거:** Phase 5 ENTERPRISE notification.
**검증 방법:** `tests/integration/expert-review-notification.test.ts` PATCH 후 queue send 확인.

#### REQ-CF-059 (Ubiquitous)
**요구사항:** The `workers/notification-consumer.ts` SHALL process `notification-queue` messages, deliver via in-app notification write (Neon `notifications` table, Phase 5 schema) AND record delivery via `writeAudit({action: 'notification.delivered', meta: {reviewId, channel: 'in_app'}})`.
**근거:** Phase 5 ENTERPRISE TD-3 in-app polling.
**검증 방법:** Consumer 실행 후 Neon notifications row + audit_logs row 확인.

#### REQ-CF-060 (Ubiquitous)
**요구사항:** The Cloudflare Cron Triggers SHALL include at minimum: `0 2 * * *` UTC (daily FDA crawl), `0 3 * * 1` UTC (weekly AutoRAG re-index), `0 4 1 * *` UTC (monthly audit archive), `0 0 1 */3 *` UTC (quarterly secrets rotation reminder).
**근거:** research.md §5.5.
**검증 방법:** `wrangler.toml` `[triggers.crons]` 4 항목 확인.

#### REQ-CF-061 (State-Driven)
**요구사항:** IF a Cron Trigger execution overlaps with a previous unfinished execution for the same job, THEN the later execution SHALL exit immediately without work (singleton lock via KV key `cron:lock:<jobName>` with 60-minute TTL).
**근거:** idempotency.
**검증 방법:** Unit test 잠금 획득 실패 시 early return 확인.

#### REQ-CF-062 (Event-Driven)
**요구사항:** WHEN the Daily FDA crawl Cron fires, THE handler SHALL fetch the FDA feed, compute checksums, enqueue new/changed documents to `corpus-update-queue`, and NOT directly modify R2 bucket contents.
**근거:** separation of concerns (producer/consumer).
**검증 방법:** mock feed 변경 시 queue send 이벤트 발생.

#### REQ-CF-063 (Ubiquitous)
**요구사항:** The `workers/corpus-update-consumer.ts` SHALL process `corpus-update-queue` messages by (a) downloading the source document, (b) storing in `regula-corpus-public` R2 with versioning, (c) triggering AutoRAG re-index for the affected corpus, (d) writing audit log `writeAudit({action: 'corpus.updated', meta: {corpus, doc_id, checksum}})`.
**근거:** research.md §5.5 + Phase 5 audit enum `corpus.updated`.
**검증 방법:** 통합 테스트 — message 소비 후 4 단계 실행 확인.

#### REQ-CF-064 (Unwanted)
**요구사항:** Cron Triggers SHALL NOT be used for real-time operations (< 1 minute latency). IF such a requirement emerges (Phase 10 regulatory radar), THEN Queue consumer polling SHALL be used instead.
**근거:** research.md §5.5 Cron 최소 주기 1분 제약.
**검증 방법:** Phase 10 SPEC 작성 시 본 REQ 인용.

#### REQ-CF-065 (Optional)
**요구사항:** WHERE Inngest complex workflows (eval harness re-run, bulk ingestion) remain in use during Phase 7, THE Inngest invocations SHALL be idempotent AND mutually exclusive with Cloudflare Queues (no same job processed by both).
**근거:** research.md §5.4 병용 기간.
**검증 방법:** `docs/integrations/inngest-cloudflare-boundary.md` 작업 목록 분리 명시.

---

### Group F: Security — WAF / Access / DDoS / Turnstile / mTLS (REQ-CF-066 ~ REQ-CF-075)

**그룹 목적:** 엣지 보안 레이어를 Regula에 도입하되 **Phase 5 ENTERPRISE application-layer security 미들웨어는 유지**한다(defense in depth). WAF가 OWASP rule + Regula custom rule로 공격을 엣지에서 차단, Access가 조직 IdP front + 외부 컨설턴트 화이트리스트 제공, Turnstile이 로그인 bot 방어, mTLS는 Phase 9+ FDA eSTAR/EU eCTD 연동의 placeholder 레일만 준비한다. 본 그룹은 `regula-security-audit` 에이전트의 책임 범위를 엣지로 확장하나, application 미들웨어의 implementation ownership은 동일하게 유지된다.

**선행 조건:**
- Group A 완료 (Cloudflare 도메인 + Workers 배포)
- Phase 5 ENTERPRISE CSP/HSTS/CSRF/SSRF 미들웨어 정상 동작 중
- `regula-security-audit` 에이전트 존재 (Phase 0 remediation 완료)
- 조직 SSO IdP (Microsoft Entra ID, Google) 설정 완료

**그룹 완료 게이트:**
- WAF OWASP rule 활성 + 72시간 0 false-positive (REQ-CF-066 + global criteria)
- Regula custom WAF rules 3종 적용 (REQ-CF-068)
- Access application 2 경로 (`/api/admin/*`, `/expert-review`) 설정 (REQ-CF-069)
- Double login P95 < 5s (REQ-CF-070 + global criteria)
- Turnstile 통합 + fallback 로직 검증 (REQ-CF-071)
- mTLS placeholder 파일 + 문서 존재 (REQ-CF-073, 074)
- Phase 5 security test suite 회귀 0 (REQ-CF-075)

#### REQ-CF-066 (Ubiquitous)
**요구사항:** The Cloudflare WAF SHALL enable OWASP Core Rule Set at sensitivity level "Medium" or higher for all `/api/ra/*` paths.
**근거:** handoff §16 + research.md §6.1.
**검증 방법:** Cloudflare Dashboard WAF configuration screenshot in `docs/security/waf-config.md`.

#### REQ-CF-067 (State-Driven)
**요구사항:** IF the WAF detects a request matching OWASP `CRS_RULE_SQLi` OR `CRS_RULE_XSS` OR `CRS_RULE_RCE`, THEN the request SHALL be blocked with HTTP 403 AND logged via Logpush to `regula-audit-cold`.
**근거:** handoff §16.
**검증 방법:** 공격 시나리오 테스트 (pentest 계획에서 수행) + Logpush log 존재.

#### REQ-CF-068 (Ubiquitous)
**요구사항:** The system SHALL define custom WAF rules for: (a) `/api/ra/consult` POST body size limit ≤ 100KB (reject 413), (b) `/api/ra/expert-review` DELETE method block (reject 405), (c) User-Agent pattern match for known scraper bots (reject 403).
**근거:** REQ-ENTERPRISE-005 edge 이중 enforcement + corpus 보호.
**검증 방법:** `cloudflare/waf-rules.toml` parse + test requests.

#### REQ-CF-069 (Ubiquitous)
**요구사항:** Cloudflare Access SHALL be configured for `/api/admin/*` AND `/expert-review` paths, requiring organization IdP (Microsoft Entra ID, Google) OR email whitelist for external RA consultants.
**근거:** research.md §6.3 + handoff §16 SSO.
**검증 방법:** Cloudflare Access application list에 해당 path policy 존재.

#### REQ-CF-070 (Event-Driven)
**요구사항:** WHEN a user completes Cloudflare Access authentication for `/api/admin/*`, THE downstream Auth.js middleware SHALL STILL validate the session (double-layer auth), NOT skip auth based on Access header.
**근거:** research.md §6.3 defense in depth.
**검증 방법:** Access 통과 + Auth.js 세션 부재 상황 → 401 반환 확인.

#### REQ-CF-071 (Ubiquitous)
**요구사항:** The `/login` page SHALL integrate Cloudflare Turnstile widget for bot prevention, with fallback to manual reCAPTCHA OR hCaptcha if Turnstile availability is degraded.
**근거:** research.md §6.4.
**검증 방법:** `/login` page rendering 시 Turnstile script 로드 확인.

#### REQ-CF-072 (State-Driven)
**요구사항:** IF a Turnstile challenge fails 3 consecutive times for the same IP within 10 minutes, THEN the IP SHALL be temporarily blocked (10 minutes) via Cloudflare Rate Limiting AND the event SHALL be logged.
**근거:** bot 방어 강화.
**검증 방법:** Cloudflare Rate Limiting rule 설정 + 실패 시나리오 로그 확인.

#### REQ-CF-073 (Optional)
**요구사항:** WHERE FDA eSTAR OR EU eCTD API integration is planned (Phase 9+), THE `lib/external/fda-estar.ts` AND `lib/external/eu-ectd.ts` SHALL exist as placeholder files with TypeScript interfaces declaring expected mTLS config shape, without implementation.
**근거:** research.md §6.5 레일만 준비.
**검증 방법:** 두 파일 존재 + TypeScript compile + implementation 부재 확인.

#### REQ-CF-074 (Ubiquitous)
**요구사항:** The `docs/integrations/mtls-setup.md` SHALL document the Cloudflare API Gateway mTLS trusted CA registration procedure for future external regulatory API integrations.
**근거:** Phase 9+ 선행 준비.
**검증 방법:** doc 존재 + step-by-step instructions 포함.

#### REQ-CF-075 (Unwanted)
**요구사항:** The Phase 5 ENTERPRISE application-layer security middleware (CSP, HSTS, CSRF, SSRF guards, secrets scanning) SHALL NOT be removed or weakened as a result of Cloudflare WAF adoption. IF any middleware is removed, THEN the removal SHALL be justified in `docs/security/defense-in-depth.md` and require explicit audit approval.
**근거:** defense in depth + research.md §6.1.
**검증 방법:** `tests/integration/security-headers.test.ts` Phase 5 전체 스위트 통과.

---

### Group G: Observability 통합 (REQ-CF-076 ~ REQ-CF-080)

**그룹 목적:** Cloudflare-native 관측성(Logpush + Analytics Engine)을 **인프라 레이어**에 추가하고, Phase 5 ENTERPRISE가 확립한 애플리케이션 레이어 관측성(Sentry + PostHog + Langfuse) 4-way는 그대로 유지한다(단, Vercel Analytics → Cloudflare Web Analytics 교체). Logpush가 audit_logs R2 복제(감사 이중화)를, Analytics Engine이 엣지 메트릭(cache hit, geography)을 담당한다. 본 그룹은 `regula-observability` 스킬 경계를 존중하여 application 레이어 벤더(Sentry/PostHog/Langfuse)는 건드리지 않는다.

**선행 조건:**
- Group A/D 완료 (Workers runtime + R2 bucket)
- `regula-observability` 에이전트 존재 (Phase 0 remediation)
- Phase 5 ENTERPRISE 4-way observability 벤더 정상 동작 중

**그룹 완료 게이트:**
- Logpush job 3종 활성 (Workers log, WAF log, Access log → `regula-audit-cold`) (REQ-CF-076)
- Analytics Engine metric emit 동작 (REQ-CF-077)
- Sentry Workers SDK 에러 수신 확인 (REQ-CF-078)
- Analytics Engine PII 검사 0 violations (REQ-CF-079)
- `@vercel/analytics` import 0건 (REQ-CF-080)

#### REQ-CF-076 (Ubiquitous)
**요구사항:** Cloudflare Logpush SHALL be configured to stream Workers request logs, WAF match logs, and Access audit logs to R2 bucket `regula-audit-cold` in real-time.
**근거:** research.md §7.1.
**검증 방법:** Cloudflare Logpush job list + R2 bucket object count growth.

#### REQ-CF-077 (Event-Driven)
**요구사항:** WHEN a `/api/ra/consult` request completes, THE system SHALL emit an event to Cloudflare Analytics Engine with attributes `{latency_ms, cache_hit, region, status_code}` via `lib/analytics/cloudflare-engine.ts`.
**근거:** research.md §7.2.
**검증 방법:** Analytics Engine query 시 해당 metric 존재.

#### REQ-CF-078 (Ubiquitous)
**요구사항:** The Sentry SDK SHALL be replaced by `@sentry/cloudflare` Workers SDK in Workers runtime (preserving Phase 5 client/server configs unchanged where applicable); error tracking MUST continue functioning with existing DSN.
**근거:** research.md §7.3.
**검증 방법:** Workers error throw → Sentry project 이벤트 수신 확인.

#### REQ-CF-079 (Unwanted)
**요구사항:** Cloudflare Analytics Engine SHALL NOT store any user-identifying fields (question text, answer text, email, userId). Only aggregate metrics (latency, counts, categorical dimensions) are allowed.
**근거:** Phase 5 ENTERPRISE PII 금지 원칙 + handoff §16.
**검증 방법:** `scripts/qa/analytics-pii.ts` 정적 검사 (Analytics Engine emit 호출 인자 검증).

#### REQ-CF-080 (State-Driven)
**요구사항:** IF Vercel Analytics was previously active (Phase 6 LAUNCH), THEN Phase 7 SHALL replace it with Cloudflare Web Analytics OR remove Web Vitals collection entirely; `@vercel/analytics` import SHALL be removed from `app/layout.tsx`.
**근거:** research.md §7.3.
**검증 방법:** `grep -r '@vercel/analytics' app/` 결과 없음 + Cloudflare Web Analytics beacon 존재.

---

### Group H: Compliance — EU residency / HIPAA BAA / 21 CFR Part 11 (REQ-CF-081 ~ REQ-CF-085)

**그룹 목적:** Phase 7 Cloudflare 전면 통합의 **규제 준수 최종 검증** 그룹이다. EU residency는 조직별 `data_region` 컬럼 + Workers/Vectorize/R2의 region pinning으로, HIPAA BAA scope는 Cloudflare 법무 확인 + BAA 미포함 서비스 우회 정책으로, 21 CFR Part 11 immutability는 Phase 1 Neon append-only trigger + Phase 7 R2 Compliance Mode Object Lock 결합으로 완결한다. 본 그룹의 REQ 중 2개(Pending #1, #2)는 Cloudflare 외부 사실에 의존하므로 conditional 처리.

**선행 조건:**
- Group A/B/D 완료
- Phase 1 FOUNDATION append-only audit trigger 유지 + 8-step regression PASS
- Phase 5 ENTERPRISE audit-completeness CI gate 0 violations
- Cloudflare 법무팀 HIPAA BAA 확인서 수령 (Pending Item #1)

**그룹 완료 게이트:**
- `organizations.data_region` migration 적용 (REQ-CF-081)
- EU 조직 요청의 EU-only routing 검증 (REQ-CF-082)
- R2 Compliance Mode lock modification 시도 거부 확인 (REQ-CF-083)
- `part-11-extended.md` 5 항목 기술 (REQ-CF-084)
- Weekly reconciliation cron P1 alert 시나리오 동작 (REQ-CF-085)

#### REQ-CF-081 (Ubiquitous)
**요구사항:** The system SHALL add a migration `migrations/00XX_organizations_data_region.sql` introducing column `organizations.data_region` pgEnum (`'us' | 'eu' | 'apac'`) with default `'us'` AND NOT NULL constraint.
**근거:** research.md §8.1 EU residency per-organization.
**검증 방법:** Migration apply 후 `\d+ organizations` 조회 시 컬럼 존재.

#### REQ-CF-082 (State-Driven) [Pending Item #1]
**요구사항:** IF an organization's `data_region` is `'eu'`, THEN all Cloudflare resources (Workers route, Vectorize index, R2 bucket) for that organization's requests SHALL be pinned to EU region AND the request SHALL NOT be processed by any Cloudflare service outside Cloudflare's published HIPAA BAA scope.
**근거:** handoff §16 data residency + research.md §8.2 HIPAA BAA scope.
**검증 방법:** `docs/compliance/hipaa-baa-scope.md`에 Cloudflare 법무 확인 결과 기록 + EU 조직 요청 traced to EU region (DevTools network inspector).

#### REQ-CF-083 (Unwanted)
**요구사항:** The R2 `regula-audit-cold` bucket object lock SHALL NOT be modifiable after provisioning. IF any CLI or API attempts to change lock mode from `COMPLIANCE` to `GOVERNANCE` OR disable lock, THEN the operation MUST fail at Cloudflare API level (compliance mode guarantee).
**근거:** research.md §8.3 WORM semantic + 21 CFR Part 11 §11.10(c).
**검증 방법:** `wrangler r2 bucket lock-config --mode GOVERNANCE regula-audit-cold` 시도 → 거부 확인.

#### REQ-CF-084 (Ubiquitous)
**요구사항:** The `docs/compliance/part-11-extended.md` SHALL document the combined audit immutability architecture: (a) Phase 1 FOUNDATION Neon append-only trigger (UPDATE/DELETE/TRUNCATE blocked), (b) Phase 7 R2 Compliance Mode object lock (delete blocked), (c) Iceberg checksums (tamper-evident), (d) 7-year retention enforcement, (e) audit-of-audit meta-logging (REQ-CF-051).
**근거:** regulatory audit 대응.
**검증 방법:** 문서 존재 + 5 항목 전부 기술.

#### REQ-CF-085 (State-Driven)
**요구사항:** IF the Weekly Logpush-to-R2 reconciliation cron detects a mismatch between Neon audit_logs write count and R2 archived count (outside 99.99% tolerance after 24 hours lag), THEN Sentry SHALL raise a P1 alert AND the admin portal SHALL display a compliance banner.
**근거:** research.md §8.3 정합성 보증.
**검증 방법:** 불일치 시나리오 주입 후 Sentry event + banner 렌더링 확인.

---

## 인수 기준 (Acceptance Criteria — Global)

REQ 단위 검증 외에도 다음 글로벌 인수 기준 전원 만족 시 Phase 7 완료:

- **Global P50 consult latency < 50ms** from 10 geography (Cloudflare Analytics Engine measurement, excluding LLM call time)
- **Workers AI intent classifier accuracy ≥ 85%** versus Haiku baseline (Phase 6 LAUNCH eval harness 재실행)
- **R2 audit cold storage query P95 < 500ms** for 90-day date range queries
- **WAF OWASP rule 0 false-positive** at production traffic (measured over 72-hour window)
- **Cloudflare Access + Auth.js double login completion < 5s** P95 (Cloudflare dashboard 측정)
- **AutoRAG corpus auto-sync weekly success rate 100%** (4 consecutive weeks)
- **Vectorize query P95 < 10ms at 5M vectors** (stress test)
- **Vercel fallback disarmed** after canary 100% + 7-day stability
- **Audit completeness: Neon count == R2 archive count** within 99.99% tolerance
- **Phase 5 ENTERPRISE security middleware regression = 0** (defense in depth preserved)

---

## Non-Obvious Constraints 매트릭스 (확장)

CLAUDE.md Non-Obvious Product Constraints 7항목의 Phase 7 영향:

| # | Constraint | Phase 1-6 상태 | Phase 7 확장 |
|---|---|---|---|
| 1 | Citation 강제 | Phase 2+5+6 완결 | AutoRAG chunk 응답도 `cite_index` invariant 보존 (REQ-CF-023) |
| 2 | SSE 3-phase streaming | Phase 2+3 완결 | Workers runtime에서 invariant 유지 (REQ-CF-004), Durable Objects 옵션 강제 (REQ-CF-036) |
| 3 | Expert-review 자동 게이팅 | Phase 5 완결 | notification-queue Cloudflare Queues로 이관 (REQ-CF-058) |
| 4 | **Audit 기록 (21 CFR Part 11)** | Phase 1 FOUNDATION Neon append-only 완결, Phase 5 CI gate | **R2 Object Lock Compliance Mode + Iceberg 확장 (REQ-CF-042, 083, 084)** — at-edge immutability 추가 |
| 5 | Serif/Sans 타이포 | Phase 1+전 Phase 완결 | `next/font` Workers runtime 호환성 검증 (REQ-CF-003 nodejs_compat) |
| 6 | **ko/en 이중언어** | Phase 5 완결 | `LOCALE_KV` 캐시 (REQ-CF-040) + **geography routing이 자동 locale 판정 입력으로 활용** (Cloudflare `cf.country` header 기반 초기 locale 추정) |
| 7 | **noindex 전역** | Phase 1 완결 | **Cloudflare Access 레이어로 이중 enforced** (REQ-CF-069) — Access가 인증되지 않은 접근을 엣지에서 차단, `/login`만 whitelist |

---

## Risks

| ID | Risk | 완화 전략 |
|---|---|---|
| R-CF-01 | OpenNext.js v3가 Next.js 15의 일부 feature (특정 middleware 패턴, ISR edge cache 특정 configuration) 미지원 | Canary 10% 단계에서 feature smoke test, 문제 발견 시 Vercel 유지 경로 즉시 복귀 (REQ-CF-012) |
| R-CF-02 | Vectorize 5M vector limit 도달 (장기) | Index 분할 전략 (`regula-fda-2024-q1`, `regula-fda-2024-q2`), Phase 8 검토 |
| R-CF-03 | Workers AI Llama 3.3 70B 정확도가 Haiku 대비 저하 | env 플래그 기반 Haiku 자동 fallback, Phase 6 LAUNCH eval harness 재실행 |
| R-CF-04 | Cloudflare 전체 아웃티지로 애플리케이션 전체 영향 | Phase 7은 단일 클라우드 전제, Post-launch Phase 11+에서 다중 클라우드 검토 (research.md §9) |
| R-CF-05 | **FDA 감사관이 cloud object lock compliance mode를 "tamper-evident"로 수용 거부** | Cloudflare 법무 letter 확보 + `docs/compliance/part-11-extended.md` 상세 문서화 + Post-launch Glacier Vault Lock 이중화 옵션 (research.md §8.4) |
| R-CF-06 | Inngest → Cloudflare Queues dual-run 기간 중복 실행 | idempotency key + `docs/integrations/inngest-cloudflare-boundary.md` 작업 분리 (REQ-CF-065) |
| R-CF-07 | Durable Objects 연결당 billing 비용 스파이크 | Phase 7 RUN A/B 결과 기반 도입 (REQ-CF-036 Optional), invariant 위반 0건이면 미도입 |
| R-CF-08 | Workers AI HIPAA BAA scope 미포함 | PII path에서 Workers AI 사용 금지 (REQ-CF-082), on-prem Presidio fallback |
| R-CF-09 | Vectorize EU region이 beta 단계에 머물 경우 EU MDR corpus 이관 불가 | REQ-CF-021 conditional 처리, pgvector Neon EU 유지 |
| R-CF-10 | Workers Paid plan Duration cap이 긴 SSE 응답 차단 | 응답 생성 시간 측정 + DO 기반 SSE 세션 offload 또는 응답 chunking |
| R-CF-11 | AutoRAG retrieval precision 저하 | Phase 6 LAUNCH eval 통과 후 AutoRAG 활성, precision < -5% 시 pgvector 자동 fallback (REQ-CF-030) |
| R-CF-12 | Logpush R2 bucket과 application writeAudit 간 timing gap | 24-hour 허용 window + Sentry P1 alert (REQ-CF-085) |
| R-CF-13 | Cloudflare WAF custom rules의 production traffic false-positive | 배포 전 shadow 모드로 72시간 관찰, 0 false-positive 확인 후 enforce |
| R-CF-14 | Next.js `next/font` Workers 호환성 이슈 (Source Serif 4 / Noto Serif KR / Pretendard) | nodejs_compat 활성 + 빌드 시점 font embedding 전략 (local font file) |
| R-CF-15 | Cloudflare Queues + Inngest dual-run 중 메시지 중복 처리 | Queue consumer의 idempotency key (checksum 기반) + audit log으로 중복 감지 |

---

## Pending Items (SPEC 작성 시 남겨진 미결정 사항)

### Pending Item #1 — Workers AI HIPAA BAA scope
- **상태:** 2026-04-22 현재 Cloudflare 공식 문서에 Workers AI의 BAA 포함 여부 명시 없음
- **영향:** REQ-CF-082 `data_region = 'eu'` 또는 PHI 포함 가능 경로에서 Workers AI 사용 가능 여부
- **해소 경로:** Cloudflare 법무 확인서 요청 → `docs/compliance/hipaa-baa-scope.md` 작성
- **미포함 확정 시 폴백:** PII redaction은 on-prem Presidio (별도 컨테이너 배포) 또는 Anthropic API의 기본 PII handling 정책 의존; Workers AI는 non-PII intent classification에만 사용

### Pending Item #2 — Vectorize EU region GA 확정
- **상태:** 2026-04 기준 Cloudflare 블로그 "EU region beta" 단계 → GA 전환 시점 미확인
- **영향:** REQ-CF-021 EU MDR corpus의 Vectorize EU 배치 가능 여부
- **해소 경로:** Cloudflare Status Page + changelog 확인, beta 상태일 경우 EU 조직은 pgvector Neon EU branch 유지
- **SPEC 기록:** REQ-CF-021 자체가 conditional (WHERE 절) 처리

---

## Deliverables — 신규 파일 매니페스트

Phase 7 RUN에서 생성/수정될 파일 개략 목록 (상세는 tasks.md 또는 tasks 분해 단계에서 확정).

### 신규 파일 (28)

- `wrangler.toml` (루트)
- `open-next.config.ts` (루트)
- `middleware-edge.ts` (루트)
- `lib/auth/kv-session-store.ts`
- `lib/ratelimit/cloudflare-kv.ts`
- `lib/ai/retrievers/vectorize-fda.ts`
- `lib/ai/retrievers/vectorize-eu-mdr.ts`
- `lib/ai/retrievers/vectorize-mfds.ts`
- `lib/ai/retrievers/vectorize-nmpa.ts`
- `lib/ai/retrievers/vectorize-pmda.ts`
- `lib/ai/retrievers/autorag-adapter.ts`
- `lib/ai/hybrid-router.ts`
- `lib/ai/pre-filter.ts` (Workers AI intent classifier)
- `lib/ai/pii-redact.ts` (Workers AI PII redaction, BAA scope 조건부)
- `lib/storage/r2.ts`
- `lib/audit/cold-storage.ts`
- `lib/audit/cold-query.ts`
- `lib/analytics/cloudflare-engine.ts`
- `lib/external/fda-estar.ts` (placeholder)
- `lib/external/eu-ectd.ts` (placeholder)
- `workers/consult-session-do.ts` (Durable Object, 옵션)
- `workers/audit-archive-consumer.ts`
- `workers/corpus-update-consumer.ts`
- `workers/notification-consumer.ts`
- `workers/langfuse-flush-consumer.ts`
- `.github/workflows/cf-deploy.yml`
- `cloudflare/waf-rules.toml`
- `migrations/00XX_organizations_data_region.sql`

### 문서 신규 (7)

- `docs/deployment/cloudflare-canary.md`
- `docs/deployment/cloudflare-cutover.md`
- `docs/security/waf-config.md`
- `docs/security/defense-in-depth.md`
- `docs/integrations/mtls-setup.md`
- `docs/integrations/inngest-cloudflare-boundary.md`
- `docs/compliance/hipaa-baa-scope.md`
- `docs/compliance/part-11-extended.md`
- `docs/compliance/vectorize-eu-region.md`
- `docs/operations/vectorize-health.md`
- `docs/decisions/durable-objects.md`

### 스크립트 신규 (4)

- `scripts/qa/no-vercel-edge.ts`
- `scripts/qa/do-no-pii.ts`
- `scripts/qa/r2-access-audit.ts`
- `scripts/qa/analytics-pii.ts`
- `scripts/qa/audit-archive-completeness.ts`
- `scripts/audit-archive.ts`

### 수정 파일 (간략)

- `package.json` (devDependency `@opennextjs/cloudflare`, `wrangler`, `@sentry/cloudflare`)
- `app/layout.tsx` (`@vercel/analytics` 제거, Cloudflare Web Analytics beacon 추가)
- Phase 1-6 기존 retrievers (`lib/ai/retrievers/fda.ts` 등)는 hybrid-router에 의해 래핑되므로 수정 없음 (인터페이스 보존)

---

---

## Phase 7 Completion Gate (집계)

Phase 7이 "완료" 상태로 전환되기 위한 조건을 단일 체크리스트로 집계한다. 각 항목은 상위 8 그룹 완료 게이트의 교집합 + 글로벌 인수 기준을 포함한다.

### PR-CF-001 ~ PR-CF-025 (Phase 7 Readiness Checklist)

| ID | 항목 | 근거 REQ | 검증 방법 |
|---|---|---|---|
| PR-CF-001 | Canary DNS 100% Cloudflare 전환 + 7-day stability | REQ-CF-011~014 | DNS config + Langfuse 7-day metric |
| PR-CF-002 | Phase 1-6 integration test 전체 통과 | REQ-CF-015 | CI green on `tests/integration/**` |
| PR-CF-003 | SSE 3-phase invariant 유지 | REQ-CF-004 | `tests/integration/sse-workers.test.ts` green |
| PR-CF-004 | `scripts/qa/no-vercel-edge.ts` 0 violations | REQ-CF-009 | CI gate |
| PR-CF-005 | 5 Vectorize index + 5 AutoRAG instance 운영 | REQ-CF-016, 022 | `wrangler` 출력 |
| PR-CF-006 | Vectorize P95 < 10ms (global criteria) | Group B | stress test result |
| PR-CF-007 | AutoRAG retrieval precision 저하 ≤ 5% | REQ-CF-030 | promptfoo 재실행 |
| PR-CF-008 | Hybrid router fallback 100% trace 기록 | REQ-CF-020 | Langfuse + Sentry mock test |
| PR-CF-009 | Internal corpus AutoRAG 노출 0건 | REQ-CF-027 | unit test |
| PR-CF-010 | KV session + Neon dual-write 정합성 | REQ-CF-033 | dual-write integration test |
| PR-CF-011 | DO 도입 결정 기록 + (채택 시) PII 검사 통과 | REQ-CF-036, 038 | `docs/decisions/durable-objects.md` + scan script |
| PR-CF-012 | R2 Compliance Mode lock 활성 | REQ-CF-042 | `wrangler r2 bucket lock-config` |
| PR-CF-013 | R2 lock modification 거부 (compliance mode guarantee) | REQ-CF-083 | 시도 실패 확인 |
| PR-CF-014 | Monthly audit archive 3 연속 성공 | REQ-CF-046, 052 | audit_archive_state 로그 |
| PR-CF-015 | Audit count 정합 (Neon vs R2) within 99.99% | REQ-CF-052, 085 | CI gate + reconciliation cron |
| PR-CF-016 | Audit cold query P95 < 500ms | REQ-CF-049 | load test result |
| PR-CF-017 | 4 Queue + DLQ 운영 정상 | REQ-CF-056, 057 | `wrangler queues describe` |
| PR-CF-018 | 4 Cron Trigger 실행 이력 | REQ-CF-060 | cron log analysis |
| PR-CF-019 | WAF OWASP 72-hour 0 false-positive | REQ-CF-066 (global) | production traffic report |
| PR-CF-020 | Double login P95 < 5s | REQ-CF-070 (global) | Cloudflare dashboard |
| PR-CF-021 | Turnstile 통합 + fallback 검증 | REQ-CF-071 | E2E smoke test |
| PR-CF-022 | mTLS placeholder 파일 + 문서 | REQ-CF-073, 074 | file existence + doc content |
| PR-CF-023 | Phase 5 security test suite regression 0 | REQ-CF-075 | CI green |
| PR-CF-024 | Analytics Engine PII 검사 0 violations | REQ-CF-079 | `scripts/qa/analytics-pii.ts` |
| PR-CF-025 | `part-11-extended.md` 5 항목 + HIPAA BAA 확인서 수령 | REQ-CF-084 + Pending #1 resolution | doc review + 법무 수령 확인 |

---

## Cross-Reference Map (의존성 매트릭스)

Phase 7이 **이전 Phase의 산출물을 어떻게 재사용 / 보존 / 확장**하는지 추적한다. 본 매트릭스는 `plan-auditor` 재감사에서 "Phase 7이 이전 SPEC을 silently modify하지 않는지" 검증 기준이 된다.

### 재사용 (No Modification)

| 이전 Phase 산출물 | 재사용 방식 | Phase 7 REQ |
|---|---|---|
| Phase 2 `lib/ai/citation-enforce.ts` | AutoRAG 응답 chunk에 그대로 적용 | REQ-CF-023 |
| Phase 4 `Retriever` interface | Vectorize/AutoRAG 구현체가 준수 | REQ-CF-018, 024 |
| Phase 5 `lib/auth/with-permission.ts` RBAC | Cold audit query에도 admin role 요구 | REQ-CF-050 |
| Phase 5 `lib/ai/langfuse.ts` | AutoRAG 호출 trace wrapping | REQ-CF-029 |
| Phase 5 `writeAudit` | Cloudflare Queue consumer에서도 호출 | REQ-CF-059, 063 |
| Phase 5 CSP/HSTS/CSRF/SSRF 미들웨어 | Workers runtime에서 유지 | REQ-CF-075 |
| Phase 6 `tests/integration/api-contract.test.ts` | Workers 배포 검증용 | REQ-CF-015 |
| Phase 6 promptfoo eval harness | AutoRAG precision 재평가 | REQ-CF-030 |
| Phase 1 FOUNDATION append-only audit trigger | Hot storage layer 그대로 | REQ-CF-048, 051 |

### 확장 (Additive, Non-Breaking)

| 이전 Phase 요소 | Phase 7 확장 | REQ |
|---|---|---|
| `organizations` 테이블 | `data_region` 컬럼 추가 | REQ-CF-081 |
| `audit_logs` 테이블 | `archived_at` 추가 (Iceberg cold table) | REQ-CF-045 |
| `audit_action` pgEnum | `audit.cold_query`, `corpus.updated`, `corpus.update_failed`, `notification.delivered` 추가 | REQ-CF-026, 051, 059, 063 |
| `AuditAction` TypeScript union | 위 4 enum 값 추가 | 동일 |
| Inngest job list | Cloudflare Queues로 점진적 이관, 병용 | REQ-CF-065 |

### 금지 사항 (Do NOT Modify)

| 대상 | 이유 |
|---|---|
| Phase 1 FOUNDATION `audit_logs` append-only trigger 정의 | 21 CFR Part 11 무결성 — Phase 7 R2 확장은 trigger 위에 쌓는 것 |
| Phase 2 CHAT SSE event 12 union | citation invariant 직접 관련, Workers 이식은 implementation만 변경 |
| Phase 4 BREADTH 5 corpus retriever 시그니처 | 본 Phase hybrid router가 래핑하므로 인터페이스 보존 필수 |
| Phase 5 ENTERPRISE RBAC 4-role × 2-tier scope | Cloudflare Access는 **추가** 레이어이며 RBAC를 대체하지 않음 |
| Phase 6 LAUNCH `launch_readiness_checklist` LR-001~025 | Phase 7 전환 시 이 25 항목 전부 여전히 PASS 유지 필요 |

---

## 운영 실행 순서 권고 (Phase 7 RUN 참고)

research.md §10.1 순서의 SPEC-레벨 재기술. 본 SPEC은 priority만 명시하며, 실제 실행 기간은 운영팀 판단.

1. **Priority High** (Phase 7 진입 즉시):
   - Group A REQ-CF-001~003 wrangler 기본 설정
   - Group D REQ-CF-041~044 R2 bucket provisioning (corpus + audit-cold)
   - Group B REQ-CF-016 Vectorize index provisioning
   - Group C REQ-CF-031 KV namespace provisioning

2. **Priority High** (Migration 착수):
   - Group D REQ-CF-045~052 Audit archive pipeline (compliance의 축)
   - Group B REQ-CF-017~023 Retriever 구현 + hybrid router

3. **Priority Medium** (Workers 이식):
   - Group A REQ-CF-004~015 Next.js on Workers 이식 + canary
   - Group C REQ-CF-032~040 Session/rate limit 이관
   - Group F REQ-CF-066~072 WAF + Access + Turnstile 활성

4. **Priority Medium** (Observability 이관):
   - Group G REQ-CF-076~080 Logpush + Analytics Engine
   - Group E REQ-CF-056~063 Queue + Cron

5. **Priority Low** (최종 통합):
   - Group H REQ-CF-081~085 Compliance 최종 검증
   - Group F REQ-CF-073~074 mTLS placeholder (레일만)
   - Group E REQ-CF-064~065 Inngest 경계 문서화
   - Group A REQ-CF-014 Vercel 해제 (canary 100% + 7-day stability 후)

---

## Non-Goals (명시적 금지)

본 SPEC이 **의도적으로 해결하지 않는** 항목 — Out of Scope 섹션과 별개로 명시한다. 본 목록은 Phase 7 RUN 중 scope creep 방지 용도다.

- Regula 신규 비즈니스 기능 추가 (모든 신규 엔드포인트, 신규 UI view, 신규 Zod schema는 Out of Scope)
- Claude Sonnet/Haiku를 Workers AI로 완전 대체 (Workers AI는 intent classification + PII redaction 전처리만)
- Neon Postgres를 D1 또는 기타 DB로 이관 (단일 소스 DB 유지)
- 사용자 대면 breaking change (API 계약, UI 경로, SSE event 구조)
- 관측성 벤더 전면 교체 (Sentry/PostHog/Langfuse는 유지, 추가만 허용)
- Phase 6 LAUNCH에서 locked된 기술 결정 복원 (promptfoo, k6, GitHub Actions 그대로)

---

*End of SPEC-REGULA-CLOUDFLARE-001 v0.1.0*
