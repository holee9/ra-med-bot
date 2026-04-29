---
id: SPEC-REGULA-CLOUDFLARE-001
document: research
phase: 7
created: 2026-04-22
author: manager-spec
related_handoff_sections:
  - "§16"
  - "§18"
depends_on:
  - SPEC-REGULA-FOUNDATION-001 (v0.4.0)
  - SPEC-REGULA-CHAT-001
  - SPEC-REGULA-STRUCTURED-001
  - SPEC-REGULA-BREADTH-001
  - SPEC-REGULA-ENTERPRISE-001
  - SPEC-REGULA-LAUNCH-001
---

# SPEC-REGULA-CLOUDFLARE-001 — Research (Phase 7: Cloudflare 전면 통합)

본 문서는 Phase 6 (LAUNCH) 완료 시점에서 Vercel + Neon 스택으로 production 운영 중인 Regula 시스템을 Cloudflare 엣지·스토리지·워커 생태계로 이식·증강하는 Phase 7의 SPEC 작성에 선행하는 사전 조사 문서다. 조사 범위는 (1) Next.js 15 App Router의 Cloudflare Workers runtime 호환성, (2) Vectorize v2 vs pgvector 하이브리드 전략, (3) Workers AI 전처리 레이어 (Llama 3.3 70B Instruct), (4) AutoRAG 2025 GA 기반 공개 regulatory corpus 자동 동기화, (5) KV + Durable Objects + R2 + Queues + Cron 조합의 애플리케이션 레이어 대체, (6) WAF + DDoS + Zero Trust + Access + Turnstile + mTLS 보안 레이어, (7) Cloudflare HIPAA BAA 및 EU-only routing의 규제 준수 영향, (8) 21 CFR Part 11 audit cold storage를 R2 + Iceberg(Data Catalog)로 이관하는 패턴이다.

본 문서는 Phase 7 SPEC의 `## 기술 결정 (Technical Decisions)` 섹션이 참조할 근거 자료 창고이며, 구현 가이드가 아니다. 결정의 재평가 조건은 각 섹션 말미에 명시한다.

---

## 1. Next.js 15 on Cloudflare Workers — OpenNext.js v3 호환성

### 1.1 런타임 옵션 비교

| 옵션 | 방식 | Next.js 15 지원 | App Router | SSE | Server Actions | 탈락/선정 |
|---|---|:---:|:---:|:---:|:---:|---|
| **@opennextjs/cloudflare v1.x** | OpenNext build adapter → Workers | ✓ (공식 Next.js 15) | ✓ | ✓ (Workers runtime compat flag `nodejs_compat`) | ✓ | **선정** |
| Cloudflare Pages + @cloudflare/next-on-pages | Pages Functions | △ (v14까지 stable, v15 beta) | ✓ | △ (stream 제약 보고됨) | △ | 탈락 (Pages는 Cloudflare 자체 "레거시 경로" 권고) |
| Vercel 유지 + Cloudflare in front (CDN-only) | Proxy | ✓ | ✓ | ✓ | ✓ | 탈락 (edge compute 혜택 상실, 본 SPEC 목적 불충족) |
| Self-hosted Docker + Cloudflare Tunnel | Node.js container | ✓ | ✓ | ✓ | ✓ | 탈락 (운영 복잡도, cold start, 자동 스케일 부재) |

### 1.2 OpenNext.js v3 주요 제약 (2026-04 기준 공식 문서 요약)

OpenNext.js v3는 다음 Next.js 기능을 지원한다:
- App Router (RSC, Server Components, Streaming SSR)
- Route Handlers (`app/api/**/route.ts`)
- Middleware (`middleware.ts`)
- Server Actions (use server)
- Image Optimization (Cloudflare Images 또는 remote loader)
- Incremental Static Regeneration (ISR) via R2 cache
- Edge Runtime segments (`export const runtime = 'edge'`)

제약 사항:
- `next/font/google` 런타임은 edge에서 동작하나 빌드 시 패키지 다운로드 필요 (현재 Regula는 Source Serif 4 + Noto Serif KR + Pretendard 모두 `next/font/google` + `next/font/local` 혼합 → 빌드 단계 점검 필요)
- `pages/` 디렉토리는 best-effort 지원 (Regula는 App Router 전용이므로 무관)
- `Node.js-only APIs` (예: `fs`, `child_process`, `crypto` 일부)는 `nodejs_compat` 플래그로 부분 지원 (Drizzle Postgres client는 Neon HTTP driver로 전환 검토 필요)
- WebSocket은 Durable Objects로만 가능 (Regula는 SSE만 사용 → 무관)

### 1.3 SSE Route Handler 검증 (CHAT `/api/ra/consult`)

CHAT Phase의 SSE 구현은 `ReadableStream` + `TransformStream` + Vercel AI SDK `toDataStreamResponse()`로 구성된다. Workers runtime에서:

- `ReadableStream` / `TransformStream` — Web Streams API 네이티브 지원 (Workers는 표준 Web Platform 런타임)
- `TextEncoder` / `TextEncoderStream` — 지원
- Anthropic SDK의 `messages.stream()` — `fetch` 기반이므로 Workers에서 동작 (단, AI SDK의 Node.js 전용 헬퍼는 점검 필요)
- Streaming 응답 타임아웃: Workers Paid plan은 CPU time 30초, Duration 제한 없음 (SSE 장시간 연결 허용); Free plan은 10ms CPU (본 SPEC은 Paid 가정)

**검증 스펙 (Phase 7 RUN에서 수행):** `pnpm wrangler dev`로 로컬 Workers runtime에서 `/api/ra/consult` 요청 시 (a) 3-phase event 순서 invariant 유지, (b) trace → prose → structured 12-event union 방출, (c) Anthropic prompt caching `cache_control` 헤더 전달, (d) writeAudit 3 call-sites 정상 동작.

### 1.4 Middleware on Edge

Regula의 `middleware.ts`는 Auth.js v5 세션 검증 + noindex 전역 헤더 + locale redirect를 수행한다. Workers edge에서:

- Auth.js v5는 Edge Runtime 호환 (`authjs-edge` 또는 `next-auth@beta` Edge preset). 단, `database` session strategy는 Edge에서 Neon HTTP driver 또는 Workers KV로 세션 저장소 대체 필요
- Middleware 재작성 방침: `middleware-edge.ts` 신규 파일, Auth.js `jwt` strategy 또는 Workers KV session으로 전환
- Cloudflare Access를 middleware **앞단**에 배치하여 이중 방어 (Access = 외부 ID 공급자 연동 / Auth.js = 애플리케이션 세션)

### 1.5 재평가 조건

- OpenNext.js v3에서 Next.js 15 feature (예: Partial Prerendering, Dynamic IO)가 Regula에 필요해지면 호환성 재점검
- Anthropic SDK가 Workers runtime 공식 지원 선언하지 않을 경우 직접 `fetch` wrapper로 교체
- Auth.js v5 beta → stable 전환 시 Edge Runtime session strategy 재검토
- Workers Paid plan의 Duration cap이 SSE 긴 응답(>60초)을 차단할 경우 Durable Objects로 SSE 세션 offload

---

## 2. Vectorize v2 vs pgvector — 하이브리드 전략

### 2.1 정량 비교

| 지표 | Cloudflare Vectorize v2 | pgvector (Neon Postgres) | 하이브리드 전략 적합성 |
|---|---|---|---|
| 최대 벡터 수 | 5M per index (2026-04 기준, GA) | 제한 없음 (Postgres row 한계) | 공개 corpus는 chunk 수 예측 가능 (FDA 650 + EU MDR ~1.5K + MFDS ~0.8K + NMPA ~0.4K + PMDA ~0.4K ≈ 3.75K → 5M 한도 대비 매우 여유) |
| P95 query latency | ≤ 10ms at 1M / ≤ 30ms at 5M (공식 벤치) | 50–200ms (HNSW index, Phase 4 벤치) | Vectorize가 edge query에서 더 유리 |
| Metadata filtering | ≤ 10 fields per filter | SQL WHERE 자유 | pgvector가 복잡한 tenant/project 필터에 유리 |
| 차원 제한 | 최대 1536 (OpenAI text-embedding-3-small 호환) | 제한 없음 (2048, 3072 등도 가능) | 현 embedding 1536 → 양쪽 호환 |
| 지역 레이턴시 | 전 세계 엣지에서 <50ms | 단일 region (EU 또는 US) | 글로벌 공개 corpus는 Vectorize가 유리 |
| Row-Level Security | 부재 (namespace/filter only) | Postgres RLS 가능 | tenant isolation 요구는 pgvector가 유리 |
| EU residency | EU region 옵션 존재 (2026-04 GA) | Neon EU branch | 양쪽 모두 EU 배치 가능 |
| 비용 (월) | 저장 $0.04/M vectors + query $0.02/M 쿼리 | Neon compute time + storage | Vectorize가 low-volume 공개 corpus에 유리 |

### 2.2 데이터 주권 결정 매트릭스

| Corpus 유형 | 저장소 | 근거 |
|---|---|---|
| FDA 21 CFR / Guidance | **Vectorize v2 (Global)** | 공개 정보, glob 엣지 접근 유리 |
| EU MDR / MDCG | **Vectorize v2 (EU region)** | 공개 정보 + EU residency 이중 충족 |
| MFDS (한국 식약처) | **Vectorize v2 (Global 또는 APAC)** | 공개 정보, 한국어 embedding 혼재 |
| NMPA (중국) | **Vectorize v2 (Global)** | 공개 정보 |
| PMDA (일본) | **Vectorize v2 (Global)** | 공개 정보 |
| 내부 SOP (ISO 13485 / ISO 14971 인증본) | **pgvector (Neon EU)** | 라이선스 + 고객별 커스터마이징 가능성 |
| 테넌트 업로드 문서 (Phase 8 예정) | **pgvector (Neon EU/US per tenant)** | 데이터 주권 + RLS + 삭제 권리 (GDPR Art. 17) |

### 2.3 하이브리드 Router 설계

`lib/ai/retrievers/hybrid-router.ts` 의사 정책:

```
query(q, filters) →
  if filters.scope.includes('public_corpus'):
    try: await vectorize.query(q, filters, timeout=100ms)
    catch TimeoutError | VectorizeError:
      return await pgvector.query(q, filters)  # fallback
  else if filters.scope.includes('internal'):
    return await pgvector.query(q, filters)
```

Vectorize 실패 시 silent fallback이 아닌 Langfuse trace + Sentry breadcrumb 기록 (관측성 보존).

### 2.4 5개 공개 Corpus 전용 Retriever 시그니처

BREADTH Phase의 5개 pgvector retriever (`lib/ai/retrievers/{fda,eu-mdr,mfds,nmpa,pmda}.ts`)와 **동일한 인터페이스**를 유지하여 switch는 구현만 교체. 시그니처:

```ts
// 기존 BREADTH Phase 4 인터페이스
export interface Retriever {
  retrieve(query: string, k: number, filters?: FilterSpec): Promise<Chunk[]>;
}

// 신규 Vectorize 구현 (lib/ai/retrievers/vectorize-{fda,eu-mdr,mfds,nmpa,pmda}.ts)
export class VectorizeFDARetriever implements Retriever { ... }
```

### 2.5 재평가 조건

- Vectorize v2가 5M limit 도달 시 index 분할 전략 (e.g., `regula-fda-2024-q1`, `regula-fda-2024-q2`)
- Pen-test 결과 metadata filter의 tenant isolation 취약성이 발견되면 내부 corpus는 반드시 pgvector 유지
- Vectorize의 EU region 레이턴시가 pgvector보다 느려지면 EU corpus를 pgvector로 회귀

---

## 3. Workers AI 전처리 레이어

### 3.1 모델 카탈로그 (2026-04 기준)

| 모델 | 제공처 | 컨텍스트 | 속도 | 용도 후보 | Regula 적합성 |
|---|---|---|---|---|---|
| `@cf/meta/llama-3.3-70b-instruct` | Cloudflare Workers AI | 128K | 엣지 빠름 | Intent classification, summarization | **주 후보** — Haiku 대체 intent classifier |
| `@cf/mistralai/mistral-small-latest` | Workers AI | 32K | 매우 빠름 | Short-text classification | 후보 (fallback) |
| `@cf/meta/llama-3.1-8b-instruct-fast` | Workers AI | 128K | 매우 빠름 | Query rewrite, PII detection | PII redaction 후보 |
| `@cf/openai/whisper` | Workers AI | — | 실시간 | 음성 (Post-launch §19 #13) | Phase 10+ |

### 3.2 Intent Classifier 전환 전략

현재 (Phase 2) Intent classification은 Claude Haiku를 Anthropic API로 호출한다. 월 비용 추정: 1M consult * 700 input tokens (system + question) * $0.80/M = $560/month, output 100 tokens * 1M * $4/M = $400/month, 합 $960/month.

Workers AI로 1차 필터 배치 시:
- Llama 3.3 70B intent classifier: $0.001/1K input + $0.001/1K output → 1M consult * 800 tokens total * $0.001/1K ≈ $0.8/month (약 99.9% 비용 절감)
- 정확도가 Haiku baseline 대비 ≥85% (Phase 7 eval로 측정) 달성 시 Haiku 호출을 intent classifier에서 제거

단, intent classifier 결과가 hybrid retriever 선택에 직접 영향 (어느 corpus로 라우팅)을 미치므로 **정확도 저하 시 fallback to Haiku** 필수. 두 모델 앙상블 (Workers AI 주, Haiku fallback) 구조 권고.

### 3.3 PII Redaction 전략

Presidio는 Python-only. Workers AI에서 PII detection 옵션:
- Llama 3.1 8B Instruct Fast에 few-shot prompt로 HIPAA Safe Harbor 18 identifier detection
- Regex 기반 1차 (SSN, email, phone, MRN) + LLM 기반 2차 (names, addresses, dates specific)
- 결과는 `[REDACTED:<category>]` 토큰으로 치환

**결정 주의 (Pending Item #1):** Cloudflare HIPAA BAA가 Workers AI를 **포함하지 않을 경우** (2026-04 기준 미확인), PII-containing 요청은 Workers AI를 우회하고 on-prem Presidio 또는 Anthropic API의 PII handling 정책에 의존해야 한다. 이 경우 Phase 7에서 Workers AI 전처리는 **non-PII intent classification only**로 범위 축소.

### 3.4 Corpus Ingestion 파이프라인 통합

AutoRAG (다음 §4) 또는 자체 ingestion의 chunking 단계 **이후**, embedding **이전**에 Workers AI를 batch로 호출:
- Summarization (긴 chunk → 1-sentence summary for metadata search)
- Language detection (ko/en/zh/ja 자동 분류)
- Regulatory section normalization (예: "§820.30(a)" → `{title: "21 CFR 820.30", subsection: "a"}`)

### 3.5 재평가 조건

- Llama 3.3 70B intent accuracy < 85% → Haiku-only 복귀 또는 Llama 3.3 + post-check ensemble
- HIPAA BAA가 Workers AI 제외 확정 → PII-sensitive 경로에서 Workers AI 사용 금지
- Cloudflare가 2026년 내 Claude/GPT 등 Frontier 모델의 Workers AI 통합 발표 시 재구성

---

## 4. AutoRAG (2025 GA) — 공개 Corpus 자동 동기화

### 4.1 AutoRAG 개요

Cloudflare AutoRAG는 2025년 GA된 managed RAG 서비스로, R2 bucket에 저장된 문서를 자동으로:
1. Chunking (configurable chunk size/overlap)
2. Embedding (Workers AI 또는 지정 embedding model)
3. Vectorize index 자동 구축
4. Query 엔드포인트 제공 (`aiSearch()` API)
5. Schedule 기반 자동 재인덱싱 (크롤러 설정)

### 4.2 Regula 적용 전략

| Corpus | AutoRAG instance name | R2 source bucket | 재인덱싱 주기 |
|---|---|---|---|
| FDA 21 CFR + Guidance | `regula-rag-fda` | `regula-corpus-public/fda/` | 주 1회 (월요일 02:00 UTC) |
| EU MDR / MDCG | `regula-rag-eu-mdr` | `regula-corpus-public/eu-mdr/` | 주 1회 |
| MFDS 의료기기법 | `regula-rag-mfds` | `regula-corpus-public/mfds/` | 주 1회 |
| NMPA | `regula-rag-nmpa` | `regula-corpus-public/nmpa/` | 격주 |
| PMDA | `regula-rag-pmda` | `regula-corpus-public/pmda/` | 격주 |

### 4.3 기존 Retriever Interface 어댑터

AutoRAG API는 `aiSearch({query, ...})` → `{data: [{content, metadata, score}]}` 응답. 기존 BREADTH `Retriever.retrieve()` 시그니처로 매핑:

```ts
// lib/ai/retrievers/autorag-adapter.ts
export class AutoRAGRetriever implements Retriever {
  constructor(private instanceName: string) {}
  async retrieve(q: string, k: number, filters?: FilterSpec): Promise<Chunk[]> {
    const r = await env.AI.autorag(this.instanceName).aiSearch({
      query: q,
      topK: k,
      filter: mapFilterSpec(filters),
    });
    return r.data.map(mapToChunk);
  }
}
```

### 4.4 vs 자체 Ingestion 비교

| 측면 | AutoRAG | 자체 Ingestion (regula-corpus-ingestion agent) |
|---|---|---|
| 운영 부담 | 낮음 (managed) | 높음 (crawler + chunking + embedding 전부 소유) |
| 커스터마이징 | 제한 (chunk strategy, embedding model만 설정) | 완전 제어 |
| 비용 | AutoRAG 사용료 + R2 storage | Workers compute + R2 + Vectorize 개별 계산 |
| 공개 corpus 적합성 | 높음 (정형 PDF/HTML) | 동일 |
| 내부 SOP 적합성 | 낮음 (라이선스 제약 + 커스텀 메타데이터 제약) | 높음 |
| 감사 추적 | AutoRAG 로그 (상세도 제한) | 완전 제어 (writeAudit) |

**결정:** 공개 5개 corpus는 AutoRAG로 이관, 내부 SOP + 테넌트 문서는 자체 ingestion (Phase 8 regula-corpus-ingestion agent와 pgvector) 유지.

### 4.5 재평가 조건

- AutoRAG의 chunking 정확도가 BREADTH의 기존 chunker 대비 Retrieval precision ≥10% 저하 시 roll-back
- AutoRAG 과금이 예상치의 3배 초과 시 자체 ingestion + Vectorize 직접 사용으로 전환
- AutoRAG 아웃풋이 `cite_index` / `source_sections` 매핑 invariant와 충돌 시 Phase 2 citation enforcement 재설계 필요

---

## 5. KV + Durable Objects + R2 + Queues + Cron

### 5.1 KV (Key-Value) 용도

| 용도 | 키 패턴 | 대체 대상 | 근거 |
|---|---|---|---|
| Auth.js session 저장소 | `session:<sessionToken>` | Neon `sessions` table (database strategy) | Edge 로컬 접근, 1–5ms 레이턴시 |
| Rate limit counter | `ratelimit:consult:<userId>` | Upstash Redis (ENTERPRISE R13) | 동일 생태계, 비용 절감 |
| Feature flag override | `ff:<flagName>:<userId>` | Vercel Flags (Phase 6 Out of Scope) | Phase 5 TD 재평가 결과 |
| i18n locale preference cache | `locale:<userId>` | `users.preferred_locale` (DB read) | cold path 가속 |
| Onboarding completion cache | `onboarded:<userId>` | localStorage | 크로스 디바이스 동기화 |

KV 제약: eventual consistency (~60초 global propagation). Session 저장소로 사용 시 로그인 직후 다른 region에서 세션 인증 실패 가능 → **Phase 7 RUN에서 로컬 + KV 계층 캐시** 또는 Durable Objects session 고려.

### 5.2 Durable Objects (DO) 용도

SSE 세션 상태 invariant (`trace → prose → structured` 순서) 강제:

```
DO: ConsultSessionDO (id: conversationId)
  state: { phase: 'trace' | 'prose' | 'structured' | 'done', events: Event[] }
  methods:
    emit(event): validate phase transition, append to events, broadcast to SSE
    close(): mark done, persist to audit_logs
```

장점:
- 단일 DO 인스턴스가 동시 다중 SSE 연결의 순서를 강제 (주어진 conversation 한 개만 active)
- Worker 재시작 시에도 상태 유지 (DO는 stateful)
- 과금: DO 요청당 $0.15/M requests + duration $12.50/M GB-sec

단점:
- Regula의 SSE는 1 conversation = 1 active stream이므로 concurrent stream 걱정 없음 → DO의 주 가치는 **재시작 안전성**에 집중
- 비용 스파이크 위험 (연결당 billing)

**결정 방향:** Phase 7 RUN에서 DO 적용 전후의 SSE invariant 위반율 측정, 위반 0건이면 DO 미도입.

### 5.3 R2 (Object Storage)

| 버킷 | 내용물 | 용량 예상 | 이관 대상 |
|---|---|---|---|
| `r2://regula-audit-cold` | audit_logs 90일+ cold storage (Iceberg) | 연 ~50GB (10M 레코드 × 1.3KB/row × 압축 0.4) | Neon audit_logs partition |
| `r2://regula-corpus-public` | FDA/EU/MFDS/NMPA/PMDA PDF 원본 | ~20GB | S3 (Phase 6 LAUNCH R2 대안) |
| `r2://regula-corpus-internal` | ISO 13485 / ISO 14971 원본 | ~5GB | Neon `sources_blob` |
| `r2://regula-assets` | 제출 문서 미리보기, 다이어그램 | ~10GB (Phase 8) | 미정 |
| `r2://regula-opennext-cache` | OpenNext ISR cache | 가변 | N/A (Phase 7 도입) |

R2의 zero egress cost 특성은 Vercel S3 대비 대역폭 절감. object lock + compliance mode로 immutability 달성 (다음 §8 참조).

### 5.4 Queues (메시지 큐)

현재 Inngest로 수행되는 작업 목록 (Phase 1 FOUNDATION + Phase 5 ENTERPRISE):
- Corpus crawl (FDA update monitor)
- Embedding batch 재생성
- Expert review assignment notification
- Langfuse trace batch upload
- Audit log partition rotation (월 1회)

Cloudflare Queues 특성:
- Producer API: Workers에서 `env.QUEUE.send(msg)` (< 1ms)
- Consumer: Worker가 batch (최대 100 msg) 소비
- 재시도: 자동, dead letter queue 지원
- 과금: $0.40/M operations

Inngest 대체 고려사항:
- Inngest는 "step function" 패턴 (multi-step, 상태 유지, visualize UI)을 제공; Cloudflare Queues는 단순 pub-sub
- 복잡한 워크플로 (retry × 3, branch, join) → Cloudflare Workflows (Queues 상위)로 대체 가능
- 장애 발생 시 debugging UI는 Inngest가 우수

**결정 방향:** 단순 작업 (send email, log flush)은 Queues로 이관, 복잡 워크플로 (eval harness 재실행, bulk ingestion)는 Cloudflare Workflows 평가 후 결정. 이행 기간 중 Inngest와 병용.

### 5.5 Cron Trigger

Cloudflare Cron Triggers는 Workers에 cron 표현식 attach. 사용처:
- Daily FDA feed crawl (`0 2 * * *` UTC)
- Weekly AutoRAG re-index trigger (`0 3 * * 1`)
- Monthly audit_logs → R2 cold storage 이관 (`0 4 1 * *`)
- Quarterly secrets rotation reminder (`0 0 1 */3 *`)

Phase 10 regulatory-radar 기능의 선행 레일.

### 5.6 재평가 조건

- KV eventual consistency로 인한 세션 장애 발생 시 Durable Objects session 또는 Neon 세션 복귀
- Durable Objects 비용이 월 $500 초과 시 stateless Workers + 외부 state store (KV) 재구성
- Queues가 Inngest 수준의 관측성 제공하지 않으면 Inngest 병용 장기화
- Cron Trigger의 최소 주기 (1분)가 Phase 10 real-time 요구에 부족 시 Queue consumer 기반 실시간 polling 추가

---

## 6. 보안 레이어 (WAF + DDoS + Zero Trust + Access + Turnstile + mTLS)

### 6.1 WAF (Web Application Firewall)

Cloudflare WAF 구성:
- **OWASP Core Rule Set**: 자동 활성, 10개 주요 카테고리 (SQLi, XSS, LFI, RFI, RCE, PHP, Session Fixation, Scanner Detection, Protocol Violation, Unusual Behavior)
- **Cloudflare Managed Rules**: Cloudflare 전용 위협 인텔 기반
- **Custom Rules**: Regula 도메인 특화
  - `/api/ra/consult` POST: body size ≤ 100KB enforcement
  - `/api/ra/expert-review` DELETE: 전역 block (REQ-ENTERPRISE-005 즉 405 반환을 WAF 레벨로 이중 enforcement)
  - User-Agent 패턴 기반 봇 차단 (규제 corpus scraping 방지)

WAF와 `regula-security-audit` agent 책임 분리:
- WAF: 엣지 레이어, 요청 도달 전 차단 (무료 rate limit, paid 규칙)
- `regula-security-audit` agent (Phase 5 ENTERPRISE): 애플리케이션 레이어 검증 (CSP, HSTS, CSRF token, SSRF guard, secrets scanning)

**결정:** WAF 도입 후에도 application layer 보안 미들웨어는 **유지**. Defense in depth 원칙.

### 6.2 DDoS Protection

- L3/L4 DDoS: 무료 무제한 보호 (Cloudflare 기본 포함)
- L7 DDoS: 무료 기본 보호 + Paid 플랜 고급 ML-based
- Regula의 공격 면: `/api/ra/consult` (LLM 비용 증폭 가능), `/api/ra/expert-review`

### 6.3 Cloudflare Access (Zero Trust)

SSO front 역할:
- 조직 IdP 연동 (Google, Microsoft Entra, Okta, Generic SAML)
- 외부 RA 컨설턴트 제한 접근 (특정 path에 대해 이메일 화이트리스트)
- Auth.js와 이중 보호: Access 통과 후 Auth.js 세션 추가 검증

Regula 적용:
- `/api/admin/*` (admin 전용 API): Access + Auth.js admin role 이중
- `/expert-review` (RA 리드 전용): Access + Auth.js ra-lead role 이중
- `/api/ra/consult`: Auth.js만 (Access는 인증 지연 최소화 목적으로 비적용)

### 6.4 Turnstile (CAPTCHA)

- `/login` (SSO callback 이전): Turnstile widget, bot 방지
- Admin 포털 critical 액션 (e.g., user role change): Turnstile challenge
- Phase 5 ExpertReview 큐 페이지 진입: Access만, Turnstile 불필요

### 6.5 mTLS (Mutual TLS)

장래 FDA eSTAR, EU eCTD, MFDS API 연동 시 필요한 인증서 기반 상호 인증. Phase 7에서는 **레일만 준비**:
- Cloudflare API Gateway (mTLS trusted CA 등록 기능)
- `lib/external/fda-estar.ts`, `lib/external/eu-ectd.ts` placeholder 파일 (빈 인터페이스)
- 실제 연동은 Phase 9+ 별도 SPEC

### 6.6 재평가 조건

- WAF OWASP rule의 false-positive가 production 트래픽 > 0.1% 시 custom rule로 override
- Access + Auth.js 이중 로그인 지연이 5초 초과 시 Access 범위 축소
- Turnstile completion rate < 95% 시 hCaptcha 전환

---

## 7. 관측성 통합 (Logpush + Analytics Engine + 기존 Sentry/PostHog/Langfuse)

### 7.1 Logpush → R2

Cloudflare Logpush는 다음 로그를 R2로 실시간 스트리밍:
- HTTP 요청 로그 (WAF 매치 포함)
- Workers 실행 로그 (console.log, errors)
- Access 감사 로그
- Queue 메시지 처리 로그

Regula는 **audit_logs 실시간 복제** 목적으로 Logpush 활용:
- Application layer writeAudit → Neon audit_logs (primary, hot)
- 동시에 application이 Workers AI log emit → Logpush → R2 (redundant cold)
- 정합성 검증 자동화 (weekly cron: Neon count == R2 count within tolerance)

### 7.2 Analytics Engine

Cloudflare Analytics Engine은 time-series 이벤트 수집 플랫폼. Regula 용도:
- 엣지 메트릭 (cache hit rate, edge response time P95)
- Consult 응답 시간 엣지-관점 측정 (application-level Langfuse와 교차 검증)
- Geographic distribution dashboard

### 7.3 Sentry/PostHog/Langfuse 유지

Phase 5 ENTERPRISE에서 확정된 4-way 관측성 (Sentry + PostHog + Langfuse + Vercel Analytics) 중:
- Sentry: **유지** (애플리케이션 오류 추적, Workers SDK 사용)
- PostHog: **유지** (product analytics)
- Langfuse: **유지** (LLM trace, application layer, audit_logs와 분리)
- Vercel Analytics: **제거** (Vercel 미운영 시) 또는 Cloudflare Web Analytics로 대체

`regula-observability` 스킬 경계 준수: Cloudflare-native 관측성은 인프라 레이어 (Logpush, Analytics Engine), application 레이어는 기존 벤더 유지.

### 7.4 재평가 조건

- Cloudflare Analytics Engine 쿼리 성능이 Langfuse 대비 현저히 낮을 경우 (비실시간) 전량 Langfuse 집중
- Sentry Workers SDK의 context propagation 문제 발생 시 Cloudflare 내장 error tracking + 외부 webhook 전환

---

## 8. 규제 준수 (EU residency + HIPAA BAA + 21 CFR Part 11)

### 8.1 EU residency (EU-only routing)

handoff §16 "EU customers → EU-only hosting" 요구사항에 대한 Cloudflare 적용:

- **Regional Services**: Cloudflare Paid plan에서 특정 서비스를 EU에만 라우팅 (WAF, Bot Management, Rate Limiting)
- **Data Localization Suite** (Enterprise plan): 메타데이터 저장 위치 EU 고정
- Workers는 기본 엣지 전역 → `compatibility_flags = ["eu-only"]` 또는 Data Localization Suite 필수 (Enterprise)
- Vectorize EU region: 2026-04 기준 GA (pending 상태 확인 필요, Pending Item #2)
- R2 EU region: EUR location hint (`jurisdiction = 'eu'`) 지원

Regula 조직별 EU 전환 경로:
1. `organizations.data_region` 컬럼 추가 (`'us' | 'eu'`)
2. EU 조직은 Workers route가 EU-only, Vectorize EU instance, R2 EU bucket 사용
3. Neon EU branch 연결 (기존 Phase 6 LAUNCH와 호환)

### 8.2 HIPAA BAA

Cloudflare HIPAA BAA (Business Associate Agreement) 범위 (2026-04 기준 공개 정보):
- **포함**: Workers, R2, KV, Durable Objects, Load Balancer, WAF, DNS
- **확인 필요 (Pending Item #1)**: Workers AI — BAA scope 명시 미확인, 확정 시 PII-path에서 사용 가능 여부 결정
- **확인 필요**: Vectorize — BAA scope 명시 미확인
- **확인 필요**: AutoRAG — BAA scope 명시 미확인 (새 서비스)

Regula는 Protected Health Information (PHI)를 직접 저장하지 않으나, 사용자 질의에 PHI 혼재 가능. HIPAA BAA 확정 전까지는:
- PII redaction (Workers AI or on-prem Presidio) 선제 적용
- PHI 포함 가능 데이터 경로에서 BAA 미포함 서비스 우회

### 8.3 21 CFR Part 11 — Audit Immutability

FDA 21 CFR Part 11 전자 기록 요구사항:
- **§11.10(e)**: "Secure, computer-generated, time-stamped audit trails... Such audit trail documentation shall be retained for a period at least as long as that required for the subject electronic records..."
- **§11.10(c)**: Record protection to enable accurate and ready retrieval throughout retention period
- **§11.10(k)**: Use of appropriate controls over systems documentation

Phase 1 FOUNDATION 완료 사항:
- audit_logs append-only trigger (UPDATE/DELETE/TRUNCATE 모두 봉쇄)
- `app_role` REVOKE + migrations role 분리
- 7-year retention 정책

Phase 7에서 추가:
- **R2 Object Lock (Compliance Mode)**: audit_logs의 90일+ cold storage를 R2로 이관, object lock + compliance mode로 관리자도 삭제 불가 (IAM-level enforcement를 R2 native로 상승)
- **Iceberg 포맷 (R2 Data Catalog)**: 쿼리 가능 cold storage, 감사 대응 시 `SELECT * FROM audit_logs WHERE created_at BETWEEN...` 가능
- **Versioning**: R2 object versioning 활성, 우발 override 방지

### 8.4 감사관 수용성 (Regulatory Acceptance)

중요 고려사항: FDA 감사관이 "cloud object lock"을 "tamper-evident storage"로 수용할지 여부. 공개 판례 (2026-04 기준):
- 21 CFR Part 11 guidance는 기술 중립적 ("appropriate controls")
- WORM (Write-Once-Read-Many) 저장소 범주에 object lock compliance mode가 해당한다는 업계 합의 존재
- 실제 감사에서 R2 compliance mode를 거부당한 공개 사례 현재 없음

**리스크 완화:**
- Phase 7 RUN에서 docs/compliance.md에 "R2 Object Lock compliance mode = WORM semantic" 문서화
- Cloudflare 법무 검토 편지 (legal letter) 확보
- Post-launch pen-test + regulatory mock audit 수행

### 8.5 재평가 조건

- HIPAA BAA scope 명확화 (Pending Item #1 resolution) → Phase 7 SPEC 업데이트
- FDA 감사 사례에서 object lock 수용성 이슈 발생 시 Iceberg + external WORM (AWS S3 Glacier Vault Lock) 이중 복제
- EU MDR 감사에서 "EU residency" 요구에 Cloudflare Workers edge distribution이 부분 EU-only로 수용되지 않으면 Vercel EU + Cloudflare CDN만 유지

---

## 9. 장애 시나리오 및 다중화 전략

### 9.1 Cloudflare 장애 영향 면

| 구성요소 | 장애 영향 | 완화 |
|---|---|---|
| Workers runtime | 전체 애플리케이션 불가 | DNS fail-over to Vercel standby (Phase 7 Out of Scope, Post-launch) |
| Vectorize | 공개 corpus 검색 불가 → 전 답변 "출처 없음" | Hybrid router fallback to pgvector (§2.3) |
| R2 | corpus PDF 뷰어 불가 + audit cold storage 쓰기 불가 | audit 쓰기는 Neon primary (hot)가 소유; cold 복제는 지연 허용 |
| KV | 세션 만료 + rate limit 무력화 | Neon 세션으로 자동 fallback (dual write 기간) |
| Durable Objects | SSE 순서 invariant 경고 | Application layer validator 유지 |
| AutoRAG | 공개 corpus query 불가 | Vectorize 직접 쿼리 fallback |
| Cron Trigger | 스케줄된 작업 미수행 | 다음 주기 재시도 (idempotent 설계) |
| WAF | 공격 면 노출 | Application layer 방어 유지 (defense in depth) |
| Access | 로그인 불가 | Auth.js 단독 경로 유지 (Access는 이중화 레이어) |

### 9.2 다중 클라우드 전략 (Post-launch 검토)

Phase 7은 "Cloudflare 전면 통합"이 목적이나, 장애 대비를 위해 Post-launch Phase 11+에서:
- Vercel preview 환경 상시 대기 (hot standby)
- DNS TTL 60초로 빠른 전환
- Neon EU/US 다중 branch

### 9.3 재평가 조건

- Cloudflare 전체 아웃티지 연 2회 이상 시 다중 클라우드 검토 우선순위 상향
- Vectorize + pgvector dual write 비용이 월 $500 초과 시 비용-리스크 trade-off 재평가

---

## 10. 마이그레이션 플랜 개요 (Phase 7 RUN 참고)

본 research는 SPEC 작성 근거이므로 마이그레이션 순서는 개요만 기록. 상세 tasks는 Phase 7 RUN에서 확정.

### 10.1 제안 순서 (priority High → Low)

1. **Preparation (High)**: wrangler.toml + open-next.config.ts 작성, CI에 `pnpm wrangler deploy --dry-run` 추가
2. **Non-critical migrations (High)**: R2 corpus PDF 원본 (S3 → R2), Cron Trigger (Inngest cron job → Cloudflare Cron)
3. **AutoRAG 시범 (High)**: FDA corpus 1개만 AutoRAG로 전환, 기존 pgvector와 shadow 실행, A/B retrieval precision 비교
4. **Vectorize 전환 (High)**: AutoRAG 확정 후 EU/MFDS/NMPA/PMDA corpus 추가 이관
5. **Workers runtime 이식 (High)**: Next.js on Workers 전체 배포 (Vercel 병렬 유지, DNS 50/50 split으로 canary)
6. **KV + Queues 전환 (Medium)**: Session store, rate limit, Inngest → Cloudflare Queues (단순 jobs 먼저)
7. **Durable Objects (Medium)**: SSE 상태 관리, 기존 stateless 설계와 병렬 측정
8. **R2 audit cold storage (Medium)**: audit_logs 90일+ Iceberg 포맷으로 이관, Neon cold partition 중단
9. **WAF + Access (Medium)**: 엣지 보안 레이어 도입, application 보안 미들웨어 유지
10. **Workers AI 전처리 (Low, 점진적)**: Haiku intent classifier 대체, 정확도 검증 후 단계적 확대
11. **Vercel 완전 제거 (Low)**: Canary 100% Cloudflare 전환 확인 후 Vercel project 아카이브

### 10.2 이행 기간 Dual-run 위험 (Risk R-CF-11 참조)

- Inngest + Cloudflare Queues 병용 기간: 중복 job 실행 방지를 위한 idempotency key 도입
- Neon audit_logs hot + R2 cold 병용: 조회 시 두 소스 union view 필요 (cold 조회는 Iceberg 쿼리 엔진)
- Vercel + Cloudflare DNS 50/50: sticky session 위험 (사용자가 같은 region 고정 필요)

### 10.3 재평가 조건

- Canary 10% 전환에서 P95 latency regression > 20% 시 즉시 롤백
- AutoRAG 시범 retrieval precision < 기존 pgvector 대비 -5% 이상 시 AutoRAG 미도입 결정

---

## 11. 요약 결정 매트릭스

| # | 결정 항목 | 선택 | 탈락 | 근거 섹션 | 재평가 조건 |
|---|---|---|---|---|---|
| D1 | Next.js Cloudflare 이식 도구 | OpenNext.js v3 | Cloudflare Pages | §1 | OpenNext 호환성 문제 발생 시 |
| D2 | Vector store | Hybrid (Vectorize public / pgvector internal) | 단일 스토어 | §2 | 5M limit 또는 tenant isolation 취약성 |
| D3 | AutoRAG 도입 | Yes (공개 5 corpus) | 자체 ingestion 전량 | §4 | precision/비용 저하 시 |
| D4 | Queue 시스템 | Cloudflare Queues + Workflows | Inngest 유지 | §5.4 | 복잡 워크플로 가시성 |
| D5 | Session store | KV + DB dual | Redis/Upstash | §5.1 | eventual consistency 장애 |
| D6 | SSE 상태 관리 | Durable Objects (옵션, RUN 측정 후) | Stateless application layer | §5.2 | 비용/invariant 위반율 |
| D7 | Audit cold storage | R2 Data Catalog (Iceberg) + Object Lock | Neon partition 유지 | §5.3, §8.3 | FDA 감사 수용성 |
| D8 | WAF 정책 | Cloudflare OWASP + custom rules | 애플리케이션 only | §6.1 | false-positive rate |
| D9 | LLM 전처리 | Workers AI (Llama 3.3 70B) Haiku fallback | Haiku-only | §3 | 정확도 < 85% 또는 HIPAA BAA 미포함 |

---

## 12. Pending Items (SPEC 작성 시 해소 필요)

### Pending Item #1 — Workers AI HIPAA BAA scope
- **상태**: 2026-04-22 기준 공식 문서에 Workers AI 포함 여부 명시 없음
- **영향**: PII/PHI 경로에서 Workers AI 사용 가능 여부 결정
- **해소 경로**: Cloudflare 영업 담당 법무 확인서 요청. 미포함 시 PII path는 on-prem Presidio 또는 Anthropic API fallback
- **SPEC 기록 위치**: `## Pending Items` + `REQ-CF-082` (HIPAA BAA compliance verification)

### Pending Item #2 — Vectorize EU region GA 확정
- **상태**: 2026-04 기준 Cloudflare 블로그 "EU region beta"에서 GA 전환 확인 필요
- **영향**: EU MDR corpus의 EU residency 준수 가능 여부
- **해소 경로**: Cloudflare Status Page + changelog 확인, beta인 경우 EU corpus는 pgvector Neon EU branch 유지
- **SPEC 기록 위치**: `REQ-CF-021` (Vectorize EU instance) — conditional

---

## 13. 연계 문서

### 13.1 SPEC 선행
- `SPEC-REGULA-FOUNDATION-001/spec.md` (v0.4.0) — 13 tables, audit_logs schema, pgEnum 8종
- `SPEC-REGULA-CHAT-001/spec.md` — SSE 3-phase invariant, Anthropic prompt caching
- `SPEC-REGULA-BREADTH-001/spec.md` — 5 retriever signature, router pattern
- `SPEC-REGULA-ENTERPRISE-001/spec.md` (v0.2.0) — RBAC, observability 4-way, audit completeness CI
- `SPEC-REGULA-LAUNCH-001/spec.md` (v0.2.0) — Vercel + Neon production deployment baseline

### 13.2 핸드오프 원본
- handoff §16 Security & Compliance — audit trail, data residency, SOC 2 planning
- handoff §18 Deployment & DevOps — Vercel baseline, observability vendors, feature flags

### 13.3 메타 전략
- `.moai/plans/master-roadmap.md` — Phase 1~6 완료 후 Post-launch 확장 위치
- `.claude/skills/regula*/SKILL.md` — 도메인 제약 스킬 7종 (citation/audit/expert-review/i18n/serif/handoff/tokens)

---

*End of SPEC-REGULA-CLOUDFLARE-001 Research Document*
