# LLM/Embedding 백엔드 마이그레이션 설계안

- **문서 ID**: llm-backend-migration-2026-07-01
- **작성일**: 2026-07-01
- **상태**: DESIGN ONLY (구현 미포함)
- **범위**: OpenAI API 완전 제거, 2-소스 체계로 통합 (Ollama chat + GitHub Models embedding)
- **검증 기준**: 본 문서의 모든 파일 경로/모델명/라인 주장은 2026-07-01 실제 코드 검증 완료 (grep/read)

---

## 0. Executive Summary

Regula의 LLM/임베딩 백엔드를 **3-레이어 단일 체계**로 통합한다:

1. **Embedding 계층** = GitHub Models API (`https://models.github.ai/inference`, OpenAI 호환) — `text-embedding-3-small` (1536차원 유지)
2. **Chat/생성 계층** = 로컬 Ollama (`http://localhost:11434/v1`, `llama3.2`) — 이미 80% 와이어링 완료
3. **Anthropic 하드코딩 8개 사이트** = `lib/ai/llm-provider.ts` (Ollama 경로)로 통합

**OpenAI API는 프로덕션에서 완전 제거** (`OPENAI_API_KEY` 불필요). **Anthropic SDK 의존성**은 8개 하드코딩 사이트가 `llm-provider`로 통합된 후 `package.json`에서 제거 후보. 단 `@ai-sdk/openai`는 Ollama의 OpenAI 호환 엔드포인트 호출용으로 `llm-provider.ts` 자체가 사용 중이므로 **유지**.

**권장 1단계**: Phase A (임베딩 엔드포인트 교체) — 차원 변경 없음, 말뭉치 0건이라 리스크 최소.

---

## 1. 현재 상태 (검증 완료)

### 1.1 Chat/생성 — 부분 와이어링

`lib/ai/llm-provider.ts` (75 LOC)는 이미 `ollama` 경로를 포함한다:

```typescript
case 'ollama': {
  const baseURL = process.env.OLLAMA_BASE_URL ?? 'http://localhost:11434/v1';
  const mainModel = process.env.OLLAMA_MODEL ?? 'llama3.2';
  const ollama = createOpenAI({ baseURL, apiKey: 'ollama' });
  return ollama(modelName) as unknown as LanguageModel;
}
```

**이미 `llm-provider`를 사용하는 사이트** (8곳, 정상):
- `lib/ai/router.ts`, `lib/ai/intent.ts`, `lib/ai/consult.ts`
- `lib/cer/pico-generator.ts`, `lib/cer/screening-pipeline.ts`, `lib/cer/evidence-synthesis.ts`
- `lib/project-memory/extractor.ts`
- `app/api/ra/refine/route.ts`

### 1.2 Anthropic 하드코딩 사이트 (11곳 — orchestrator-verified, L-007; 초기 8에서 정정)

> **주의 (orchestrator-verified 2026-07-01)**: 최초 설계 시 8곳으로 집계했으나, `grep -rn "sharedAnthropicClient\|@anthropic-ai/sdk\|new Anthropic" lib/ app/` 재검증 결과 **11곳**으로 정정됨. 누락된 4곳은 모두 `app/api/ra/` 라우트 핸들러. Phase B는 11곳 전체를 다뤄야 한다. (`lib/ai/anthropic-client.ts`는 공유 클라이언트 정의 자체로 11번째이며 Phase B 완료 후 삭제 후보.)

| # | 파일 | 호출 패턴 | 모델 (하드코딩) |
|---|------|-----------|-----------------|
| 1 | `lib/classification/intent-parser.ts` | `new Anthropic()` → `client.messages.create` | `claude-haiku-4-5-20251001` |
| 2 | `lib/vigilance/report-generator.ts` | `sharedAnthropicClient.messages.create` | (경로 내 상수) |
| 3 | `lib/digest/digest-generator.ts` | `new Anthropic()` → `client.messages.create` | `claude-sonnet-4-6` |
| 4 | `lib/radar/relevance-scorer.ts` | `sharedAnthropicClient.messages.create` | `claude-haiku-4-5` |
| 5 | `lib/predicate/comparison-builder.ts` | `anthropicClient.messages.create` (주입됨) | (동적) |
| **6** | **`lib/radar/classifier.ts`** | `sharedAnthropicClient.messages.create` **× 3회** (3-tier) | (TIER1/2/3 프로ンプ트) |
| **7** | **`lib/ai/structured-blocks.ts`** | `new Anthropic()` → `client.messages.create` | (블록별 동적) |
| **8** | **`app/api/ra/updates/[id]/route.ts`** | `sharedAnthropicClient.messages.create` | (동적) — 초기 누락 |
| **9** | **`app/api/ra/samd/[id]/generate/route.ts`** | `sharedAnthropicClient.messages.create` **× 3회** | (동적) — 초기 누락 |
| **10** | **`app/api/ra/predicate/comparison/route.ts`** | `createComparisonBuilder(sharedAnthropicClient)` 주입 | (동적) — 초기 누락 |
| **11** | **`app/api/ra/radar/search/route.ts`** | `sharedAnthropicClient.messages.create` | (동적) — 초기 누락 |
| (def) | `lib/ai/anthropic-client.ts` | 공유 클라이언트 싱글톤 (ZDR 헤더) — 11 사이트 통합 후 삭제 후보 | (N/A) |

> 파일 #5 `comparison-builder.ts`는 `import type Anthropic` (타입 전용)이지만 런타임에 주입된 클라이언트로 `messages.create`를 호출함 (line 114).

### 1.3 Embedding — OpenAI 완전 하드코딩 (11곳 — orchestrator-verified, L-007; 초기 7에서 정정)

> **주의 (orchestrator-verified 2026-07-01)**: 최초 설계 시 7곳으로 집계했으나 재검증 결과 **11곳**으로 정정. **6곳은 직접 OpenAI SDK / @ai-sdk/openai import** (Phase A 코드 수정 대상), **5곳은 간접 소비** (상위 함수 경유 — 직접 수정 불필요, 상위 파일 마이그레이션 시 자동 적용).

**직접 import 6곳** (Phase A 수정 대상):

| 파일 | 패턴 | 비고 |
|------|------|------|
| `lib/ingest/embed.ts` | `new OpenAI({apiKey: process.env.OPENAI_API_KEY ?? 'no-key-in-test'})`, `MODEL='text-embedding-3-small'`, `BATCH_SIZE=100` | PII 가드 포함 (정상, 유지) |
| `lib/knowledge-promo/embedding.ts` | `import {openai} from '@ai-sdk/openai'`, `openai.embedding('text-embedding-3-small')` | 2회 호출 |
| `lib/knowledge-promo/semantic-search.ts` | `openai.embedding('text-embedding-3-small')` | 2회 (line 95, 151) |
| `lib/ai/retrievers/hybrid-search.ts` | `openai.embedding('text-embedding-3-small')` (line 77) | 공용 하이브리드 검색 |
| `lib/ai/retrievers/promoted-answers.ts` | `openai.embedding('text-embedding-3-small')` (line 67) | |
| `lib/ai/retrievers/internal-sops.ts` | `openai.embedding('text-embedding-3-small')` (line 58) | |

**간접 소비 5곳** (상위 파일 경유 — 자동 적용, 직접 수정 불필요):

| 파일 | 간접 경로 | 비고 |
|------|-----------|------|
| `lib/ai/retrievers/nmpa.ts` | → `hybridSearch()` | 초기 문서 누락 |
| `lib/ai/retrievers/eu-mdr.ts` | → `hybridSearch()` | 초기 문서 누락 |
| `lib/ai/retrievers/mfds.ts` | → `hybridSearch()` | 초기 문서 누락 |
| `lib/ai/retrievers/pmda.ts` | → `hybridSearch()` | 초기 문서 누락 |
| `lib/inngest/knowledge-promo/messages-embedding-backfill.ts` | → `embedForMessage()` (embedding.ts) | 백필 워커 |
| `lib/radar/delta-sync/orchestrator.ts` | → `embedChunks()` (embed.ts) | delta-sync |
| `lib/knowledge-gap/clustering.ts` | → `embedChunks()` (embed.ts) | gap clustering |

**유지 대상** (Phase A 예외):

| 파일 | 비고 |
|------|------|
| `lib/ai/llm-provider.ts` | `createOpenAI` (Ollama용 — **유지**, chat 경로) |

### 1.4 pgvector 차원 — 1536 고정 (5+ 사이트)

`lib/db/schema.ts`:
- line 19, 44-49: `vector` customType 정의 (`vector(1536)` 리턴)
- line 735, 773, 868, 1032: `embedding: vector('embedding')` 컬럼 4곳
- line 1003: 주석 "embedding vector(1536) supports REQ-002 semantic search"

`lib/db/schema-docingest.ts`:
- line 32-36: `vector(1536)` customType
- line 153: `embedding: vector('embedding')` 컬럼

### 1.5 package.json 관련 의존성

```json
"@ai-sdk/anthropic": "^3.0.74",      // Anthropic SDK (8사이트 통합 후 제거 후보)
"@ai-sdk/openai": "^3.0.58",          // OpenAI SDK — llm-provider Ollama 경로가 createOpenAI 사용하므로 유지 필수
"@anthropic-ai/sdk": "^0.27.0",       // 직접 Anthropic SDK (제거 후보)
```

### 1.6 .env.example 현재 상태

- `LLM_PROVIDER=ollama` (기본값)
- `OLLAMA_BASE_URL`, `OLLAMA_MODEL` 정의됨
- `OPENAI_API_KEY`, `ANTHROPIC_API_KEY` 주석 처리됨 (이미 비활성)
- GitHub Models 관련 변수는 **부재**

---

## 2. 목표 아키텍처

### 2.1 3-레이어 다이어그램

```
┌─────────────────────────────────────────────────────────────────────┐
│                    Regula Application (Next.js 15)                   │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  [Chat/생성 계층]              [Embedding 계층]                      │
│  모든 LLM 프롬프트 처리         모든 벡터화 처리                      │
│                                                                      │
│  lib/ai/llm-provider.ts        lib/ai/embedding-provider.ts (신규)  │
│  ├─ getLlmModel()              ├─ getEmbeddingModel()                │
│  └─ getLlmFastModel()          └─ embedChunks() 위임                 │
│         │                            │                               │
│         │ 단일 진입점                │ 단일 진입점                   │
│         │                            │                               │
│         ▼                            ▼                               │
│  ┌─────────────────┐         ┌─────────────────────────────┐        │
│  │  Local Ollama   │         │   GitHub Models API         │        │
│  │  (T3610 박스)   │         │   models.github.ai/inference│        │
│  │  llama3.2       │         │   text-embedding-3-small    │        │
│  │  :11434/v1      │         │   (OpenAI 호환)             │        │
│  │                 │         │                             │        │
│  │  비용: $0       │         │  비용: 프리 티어 (한도 존재)│        │
│  │  PII: 온프레미스│         │  PII: 외부 전송 (가드 필수) │        │
│  └─────────────────┘         └─────────────────────────────┘        │
│         ▲                            ▼                               │
│         │                            │                               │
│  ┌──────┴──────────┐         ┌──────────────────────┐               │
│  │ 통합 대상 8사이트│        │ pgvector vector(1536)│               │
│  │ (현재 Anthropic) │        │ (차원 유지)          │               │
│  │ - intent-parser  │        └──────────────────────┘               │
│  │ - report-gen     │                                               │
│  │ - digest-gen     │                                               │
│  │ - relevance-scorer│                                              │
│  │ - comparison-bld │                                               │
│  │ - classifier×3   │                                               │
│  │ - structured-blks│                                               │
│  └──────────────────┘                                               │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘

[제거 대상]
  ✗ OpenAI API (OPENAI_API_KEY) — 프로덕션 완전 제거
  ✗ Anthropic SDK — 8사이트 통합 후 package.json에서 제거
```

### 2.2 Embedding vs Chat 역할 분리 원칙

| 역할 | 선택된 백엔드 | 근거 |
|------|--------------|------|
| **Embedding** = 외부 (GitHub Models) | 품질 우선 | `text-embedding-3-small`은 임베딩 특화 모델로, 로컬 Ollama 임베딩 모델(`nomic-embed-text` 등) 대비 검색 품질이 우수. 말뭉치 0건 현재 상태에서는 차원/품질 일관성이 중요. GitHub Models는 OpenAI 호환이라 SDK 교체 최소화. |
| **Chat/생성** = 로컬 (Ollama) | 비용/프라이버시 우선 | RA 컨설팅 프롬프트는 PHI/PII 후보를 다룰 수 있음. 로컬 Ollama는 네트워크 외부로 데이터가 나가지 않아 Zero Data Retention 계약 없이도 데이터 통제권 확보. T3610 박스에 6-8명 동시 사용 감당 가능. 비용 $0. |
| **Anthropic 직접 호출** = 제거 | 통일성 | 8개 사이트가 `llm-provider`를 우회해 Claude에 직결 → 환경 변수/모델 정책/관측성(Langfuse)이 분기됨. 단일 진입점으로 수렴 시 모니터링·정책 적용이 단일화됨. |

---

## 3. 파일별 변경 인벤토리

> 모든 경로는 2026-07-01 실제 검증 완료. **본 설계안은 변경 내역만 기술하며, 실제 코드 수정은 수행하지 않음.**

### 3.1 신규 파일 (1개)

| 파일 | 용도 |
|------|------|
| `lib/ai/embedding-provider.ts` | 임베딩 단일 진입점. `getEmbeddingModel()` (ai-sdk 모델) + `embedBatchTexts()` (배치 임베딩, `embedMany` 기반). 모든 임베딩 호출이 이 파일을 경유하도록 강제. `EMBEDDING_BASE_URL`, `EMBEDDING_MODEL`, `GITHUB_MODELS_TOKEN` 환경 변수 사용. **참고**: `openai` SDK는 package.json 직접 의존성이 아니므로 사용하지 않음 — `@ai-sdk/openai`의 `createOpenAI` + `ai`의 `embedMany`로 대체. |

### 3.2 Embedding 계층 수정 (직접 6개 파일 + 간접 5개 파일 — orchestrator-verified, L-007; 초기 7에서 정정)

> **정정**: 초기 문서는 7개 파일로 집계했으나, 직접 OpenAI/`@ai-sdk/openai`를 import 하는 **6개 파일**만 코드 수정이 필요하며, 나머지 **5개 파일**(per-corpus retrievers 4종 + backfill)은 상위 함수 경유 간접 소비로 자동 적용됨.

**직접 수정 6개 파일:**

| 파일 | 변경 성격 |
|------|-----------|
| `lib/ingest/embed.ts` | `new OpenAI(...)` 직접 생성 → `embedBatchTexts()` 사용. `MODEL` 상수 → `getEmbeddingModelId()`. PII 가드는 **유지** (외부 API이므로). `BATCH_SIZE=100` 유지 (섹션 6.2 참조). |
| `lib/knowledge-promo/embedding.ts` | `import {openai} from '@ai-sdk/openai'` → `import {getEmbeddingModel} from '@/lib/ai/embedding-provider'`. `openai.embedding('text-embedding-3-small')` 2회 → `getEmbeddingModel()`. |
| `lib/knowledge-promo/semantic-search.ts` | 동일 패턴 (line 95, 151 두 곳). |
| `lib/ai/retrievers/hybrid-search.ts` | 동일 패턴 (line 77). 하이브리드 검색의 핵심 — 회귀 리스크 최대. |
| `lib/ai/retrievers/promoted-answers.ts` | 동일 패턴 (line 67). |
| `lib/ai/retrievers/internal-sops.ts` | 동일 패턴 (line 58). |

**간접 소비 5개 파일** (직접 수정 불필요 — 상위 파일 마이그레이션 시 자동 적용):

| 파일 | 간접 경로 |
|------|-----------|
| `lib/ai/retrievers/nmpa.ts`, `eu-mdr.ts`, `mfds.ts`, `pmda.ts` | → `hybridSearch()` (수정됨) |
| `lib/inngest/knowledge-promo/messages-embedding-backfill.ts` | → `embedForMessage()` (수정됨) |

### 3.3 Chat/Anthropic 계층 수정 (11개 파일 — Anthropic → llm-provider; orchestrator-verified, L-007; 초기 8에서 정정)

> **정정**: 초기 문서는 8개 파일로 집계했으나, `sharedAnthropicClient` / `@anthropic-ai/sdk` / `new Anthropic` grep 재검증 결과 **11개 파일**로 정정됨. 누락 4개는 `app/api/ra/` 라우트 핸들러.

| 파일 | 변경 성격 |
|------|-----------|
| `lib/classification/intent-parser.ts` | `import Anthropic` + `client.messages.create` → `generateText({model: getLlmFastModel(), ...})` (Vercel AI SDK). JSON 출력 파싱 로직 유지. |
| `lib/vigilance/report-generator.ts` | `sharedAnthropicClient.messages.create` → `streamText` 또는 `generateText` with `getLlmModel()`. |
| `lib/digest/digest-generator.ts` | 동일. `claude-sonnet-4-6` 프롬프트 튜닝 필요 (섹션 6.1). |
| `lib/radar/relevance-scorer.ts` | 동일. |
| `lib/predicate/comparison-builder.ts` | `anthropicClient` 주입 → `getLlmModel()` 사용. `ComparisonBuilder` 인터페이스 단순화 가능. |
| `lib/radar/classifier.ts` | **3-tier 분류기 — `messages.create` × 3회**. 각 tier별 프롬프트 재튜닝 필요 (TIER1/2/3 상수). 회귀 리스크 높음. |
| `lib/ai/structured-blocks.ts` | 블록별 generator 호출. AbortSignal 전파 로직 유지 중요 (`@MX:WARN`). |
| `app/api/ra/updates/[id]/route.ts` | `sharedAnthropicClient.messages.create` → llm-provider. — 초기 누락 |
| `app/api/ra/samd/[id]/generate/route.ts` | `messages.create` × 3회 → llm-provider. — 초기 누락 |
| `app/api/ra/predicate/comparison/route.ts` | `createComparisonBuilder(sharedAnthropicClient)` → `getLlmModel()` 주입. — 초기 누락 |
| `app/api/ra/radar/search/route.ts` | `sharedAnthropicClient.messages.create` → llm-provider. — 초기 누락 |
| `lib/ai/anthropic-client.ts` | 11사이트 통합 완료 후 **삭제 후보**. 단, ZDR(Zero Data Retention) 헤더 의미론이 필요하면 문서화만 남기고 파일 제거. |

### 3.4 환경 변수 파일 (1개 — 제안 diff만, 미적용)

`.env.example` (섹션 4 참조)

### 3.5 package.json (검토 전용 — Phase C)

```json
// 제거 후보 (8사이트 통합 후)
- "@ai-sdk/anthropic": "^3.0.74",
- "@anthropic-ai/sdk": "^0.27.0",

// 유지 필수 (llm-provider.ts의 Ollama 경로가 createOpenAI 사용)
"@ai-sdk/openai": "^3.0.58",

// 유지 (Vercel AI SDK 코어)
"ai": "^...",
```

### 3.6 pgvector 스키마 (변경 없음)

`lib/db/schema.ts`, `lib/db/schema-docingest.ts` — 모두 `vector(1536)` 유지. 차원 변경은 섹션 5의 조건부 플랜에만 명시.

---

## 4. 환경 변수 매핑

### 4.1 .env.example 제안 diff (미적용)

```diff
# --- LLM providers (Phase 2) --------------------------------------------------
# Supported: ollama (default, local) | openai | anthropic
- # Supported: ollama (default, local) | openai | anthropic
+ # Chat/생성: 단일 소스 (Ollama). OpenAI/Anthropic 제거됨.
  LLM_PROVIDER=ollama

  # Ollama — local GX10 or any Ollama-compatible endpoint
  OLLAMA_BASE_URL=http://localhost:11434/v1
  OLLAMA_MODEL=llama3.2
  # OLLAMA_FAST_MODEL=llama3.2   # optional: separate fast model for intent/routing

- # OpenAI — set LLM_PROVIDER=openai to activate
- # OPENAI_API_KEY=sk-replace-with-real-key
- # OPENAI_MODEL=gpt-4o-mini
- # OPENAI_FAST_MODEL=gpt-4o-mini
-
- # Anthropic — set LLM_PROVIDER=anthropic to activate (OAuth subscription planned)
- # ANTHROPIC_API_KEY=sk-ant-replace-with-real-key
- # ANTHROPIC_MODEL=claude-sonnet-4-5
- # ANTHROPIC_FAST_MODEL=claude-haiku-4-5
+ # --- Embedding (GitHub Models API — OpenAI 호환) ---------------------------
+ # GitHub Models: https://models.github.ai/inference
+ # text-embedding-3-small (1536차원, pgvector vector(1536) 일치)
+ # PAT는 Models scope 필요. 프리 티어: 모델별 RPM 제한 존재.
+ GITHUB_MODELS_TOKEN=ghp_replace-with-pat-models-scope
+ EMBEDDING_BASE_URL=https://models.github.ai/inference
+ EMBEDDING_MODEL=text-embedding-3-small
+
+ # Fallback (text-embedding-3-small 단종 시 — 섹션 5 참조)
+ # EMBEDDING_MODEL=text-embedding-3-large  # 3072차원 → 스키마 마이그레이션 필요
+
+ # Optional: label shown in the UI for the active model
+ # NEXT_PUBLIC_LLM_MODEL_LABEL=Llama 3.2 (Local)
```

### 4.2 변수 분류 요약

| 액션 | 변수 | 비고 |
|------|------|------|
| **제거** | `OPENAI_API_KEY` | 프로덕션에서 완전 미사용. `lib/ingest/embed.ts`의 `'no-key-in-test'` 폴백도 제거. |
| **제거** | `ANTHROPIC_API_KEY` | 8사이트 통합 후 미사용. |
| **추가** | `GITHUB_MODELS_TOKEN` | GitHub PAT (Models scope). |
| **추가** | `EMBEDDING_BASE_URL` | `https://models.github.ai/inference` |
| **추가** | `EMBEDDING_MODEL` | `text-embedding-3-small` (기본값). |
| **유지** | `LLM_PROVIDER=ollama` | 단일 값으로 고정 (다른 provider 분기 코드는 후보 제거). |
| **유지** | `OLLAMA_BASE_URL`, `OLLAMA_MODEL` | 현재값 유지. |
| **유지** | `OPENAI_MODEL`, `OPENAI_FAST_MODEL` | **제거** — Ollama 단일화 후 불필요. |
| **유지** | `ANTHROPIC_MODEL`, `ANTHROPIC_FAST_MODEL` | **제거**. |

---

## 5. pgvector 차원 전략

### 5.1 현재 (1536차원 유지)

- `text-embedding-3-small` (1536차원)은 GitHub Models에서 지원됨
- pgvector `vector(1536)` 5+ 사이트 변경 없음
- 말뭉치 0건 (seed 제거됨) — 재임베딩 비용 0

### 5.2 조건부 폴백 플랜 (text-embedding-3-small 단종 시)

> **트리거**: OpenAI가 `text-embedding-3-small` 단종 (~2026-10-23 예상). GitHub Models 가용성은 별도 확인 필요.

**대안 A — `text-embedding-3-large` (3072차원)**:

1. **상수 변경**: `lib/ai/embedding-provider.ts`의 `EMBEDDING_MODEL` 환경 변수 값을 `text-embedding-3-large`로 변경.
2. **스키마 마이그레이션 형태**:
   ```sql
   -- 신규 Drizzle migration (예: 00XX_vector_dim_3072.sql)
   ALTER TABLE sources ALTER COLUMN embedding TYPE vector(3072);
   ALTER TABLE source_sections ALTER COLUMN embedding TYPE vector(3072);
   ALTER TABLE document_chunks ALTER COLUMN embedding TYPE vector(3072);
   ALTER TABLE messages ALTER COLUMN embedding TYPE vector(3072);
   -- lib/db/schema.ts: vector customType 리턴값 'vector(3072)'로 변경
   -- lib/db/schema-docingest.ts: 동일
   ```
3. **재임베딩 절차** (말뭉치 0건이므로 현재 비용 0, 향후 데이터 축적 시):
   - 모든 `embedding` 컬럼 `NULL` 처리 (또는 백업 후 `DELETE`)
   - `lib/inngest/knowledge-promo/messages-embedding-backfill.ts` 워커로 전체 재임베딩 트리거
   - 임베딩 출처 추적용 `embedding_model` 메타데이터 컬럼 추가 고려 (감사 추적)
4. **리스크**: 3072차원은 저장 공간 2배, 검색 인덱스 메모리 증가. HNSW 인덱스 재구축 필요.

**대안 B — 최신 OpenAI/Azure 임베딩 모델 (차원 확인 필요)**:
- 신규 모델 출시 시 `EMBEDDING_MODEL` 값만 교체하고 차원 호환성 검증.
- 가능하면 1536차원 유지 모델 선호 (마이그레이션 최소화).

### 5.3 차원 불일치 방지 세이프가드 (권장)

`embedding-provider.ts`에 런타임 검증 추가 (구현 시):
```typescript
// 환경 변수로 선언된 차원과 pgvector 스키마 차원 일치 여부 확인
// 불일치 시 부팅 단계에서 명시적 에러 (잘못된 재임베딩 방지)
```

---

## 6. 마이그레이션 단계 (회귀 리스크 낮은 순)

### Phase A — 임베딩 엔드포인트 교체 (OpenAI → GitHub Models)

**범위**: 섹션 3.2의 7개 파일 + `.env.example`
**리스크**: **최소**. 차원 변경 없음 (1536 유지). 말뭉치 0건이라 기존 벡터와의 불일치 발생 안 함.
**검증**: 
- 단위 테스트: `embedChunks(['test'])`가 1536차원 벡터 반환
- 통합 테스트: `lib/ai/retrievers/hybrid-search.ts`가 GitHub Models 경유로 정상 임베딩
- PII 가드가 여전히 차단하는지 확인 (여전히 외부 API이므로)
**완료 기준**: `OPENAI_API_KEY` 없이 모든 retriever가 정상 동작.

### Phase B — Anthropic 8사이트 llm-provider 통합

**범위**: 섹션 3.3의 8개 파일
**리스크**: **중간~높음**. Claude-tuned 프롬프트를 llama3.2에서 재검증해야 함.
**세부 순서** (8사이트 내 위험도 차등):
1. `lib/predicate/comparison-builder.ts` — 타입 주입이라 영향 제한적
2. `lib/classification/intent-parser.ts` — 단순 분류
3. `lib/vigilance/report-generator.ts` — 단일 호출
4. `lib/digest/digest-generator.ts` — 단일 호출
5. `lib/radar/relevance-scorer.ts` — 단일 호출
6. `lib/ai/structured-blocks.ts` — AbortSignal 전파 주의
7. `lib/radar/classifier.ts` — **3-tier, × 3회 호출, 리스크 최대**
8. `lib/ai/anthropic-client.ts` — 7개 완료 후 삭제

**검증** (사이트별):
- 기존 Claude 출력과 llama3.2 출력의 품질 비교 (정성 평가)
- 특히 `classifier.ts` 3-tier: TIER1/2/3 각 분류 정확도 유지
- `structured-blocks.ts`: AbortSignal 전파 로직 회귀 테스트
**완료 기준**: `ANTHROPIC_API_KEY` 없이 모든 경로 동작. Langfuse 트레이스에 8사이트 트랜잭션 정상 기록.

### Phase C — 환경 변수 정리 + 의존성 제거

**범위**: `.env.example` 최종 확정, `package.json`에서 `@ai-sdk/anthropic`, `@anthropic-ai/sdk` 제거 후보 검토.
**리스크**: **낮음** (A, B 완료 전제). 단, `package.json` 제거는 grep으로 잔여 import 0건 확인 후 수행.
**완료 기준**: 
- `grep -rn "@anthropic-ai/sdk\|@ai-sdk/anthropic" lib/ app/` 결과 0건
- `package.json`에서 두 패키지 제거
- `@ai-sdk/openai`는 `llm-provider.ts`가 사용하므로 **유지** (주의: 잘못 제거하면 Ollama 경로도 붕괴)

### 6.1 순서 근거

| 단계 | 선행 조건 | 리스크 | 롤백 비용 |
|------|-----------|--------|-----------|
| A (임베딩) | 없음 | 최소 (차원 동일, 말뭉치 0) | 환경 변수 원복만으로 즉시 롤백 |
| B (Anthropic 통합) | A 독립 (병렬 가능하지만 권장 순차) | 중간 (프롬프트 튜닝 필요) | 파일별 git revert |
| C (정리) | A + B 완료 | 낮음 | package.json 복구 |

A를 먼저 수행하는 근거: OpenAI 제거라는 **사용자 비타협적 요구**를 가장 빠르게 달성하면서도, 차원 변경이 없어 회귀 가능성이 가장 낮음. B는 프롬프트 튜닝이라는 정성 작업이 동반되므로 별도 집중 필요.

---

## 7. 위험 + 완화

### 7.1 Ollama(llama3.2) 품질 vs Claude-tuned 프롬프트

**위험**: 8개 사이트의 프롬프트는 Claude(Sonnet/Haiku)의 특성(예: XML 태그 선호, 긴 컨텍스트 처리)에 최적화됨. llama3.2는 3B 파라미터로 Claude 대비 추론 능력 제한적.

**완화**:
- 각 사이트별 출력 품질 벤치마크 (Phase B 세부 순서 내 검증 항목)
- `OLLAMA_MODEL`을 더 큰 모델(`llama3.1:8b`, `qwen2.5:14b` 등 T3610 VRAM 허용 범위)로 전환 고려
- 특히 `lib/radar/classifier.ts` 3-tier와 `lib/digest/digest-generator.ts`는 품질 민감도 높음 → Few-shot 예제 추가 또는 프롬프트 재설계 필요 가능
- 구조화 출력(JSON) 의존 사이트는 Vercel AI SDK의 `generateObject` + Zod 스키마로 전환하여 파싱 신뢰성 확보

### 7.2 GitHub Models 프리 티어 레이트 리미트

**위험**: `lib/ingest/embed.ts`의 `BATCH_SIZE=100`은 OpenAI 상한 기준. GitHub Models 프리 티어는 모델별 RPM/TPM 제한이 다를 수 있음. 일괄 ingestion 시 429 에러 가능.

**완화**:
- `BATCH_SIZE`를 환경 변수화 (`EMBEDDING_BATCH_SIZE`, 기본값 100에서 20~50으로 조정 권장)
- `lib/inngest/knowledge-promo/messages-embedding-backfill.ts`의 Inngest 단계별 rate-limit 처리 확인 (이미 `text-embedding-3-small: ~100 RPM, 200K TPM limit` 주석 존재 — GitHub Models 한도로 재검증 필요)
- 프로덕션 이관 시 Azure AI Foundry/Azure OpenAI 서브스크립션으로 전환 (공식 권장 경로)

### 7.3 GitHub 토큰 스코핑/로테이션

**위험**: 단일 PAT가 유출되면 임베딩 API 남용 가능. 또한 PAT 만료 시 임베딩 전체 중단.

**완화**:
- `GITHUB_MODELS_TOKEN`은 Models scope만 포함한 최소 권한 PAT 사용 (다른 repo 권한 분리)
- 기존 `GITHUB_PAT`(repo:read용)와 별도 토큰 사용 — 한 토큰 유출의 영향 범위 제한
- 토큰 로테이션 절차 문서화 (운영 SOP에 추가)
- 부팅 시 토큰 유효성 검증 (`lib/env.ts`에 추가 검증)

### 7.4 PII 가드 유지 유효성

**위험**: `lib/ingest/embed.ts`의 PII 가드는 OpenAI 전송 전 defense-in-depth. GitHub Models도 외부 API이므로 가드는 **여전히 유효하고 필수**.

**완화**:
- `lib/ingest/embed.ts`의 PII 가드 로직은 **변경 없이 유지** (Phase A에서 엔드포인트만 교체)
- 신규 `embedding-provider.ts`에도 동일 PII 가드를 통과하도록 강제 (인터페이스 설계 시)

### 7.5 발견된 추가 사이트 (orchestrator-verified: 초기 8곳 → 11곳 정정)

**위험**: 본 설계 과정에서 `lib/ai/structured-blocks.ts`, `lib/radar/classifier.ts` (× 3회 호출), `lib/predicate/comparison-builder.ts` 런타임 호출이 추가로 확인됨(초리 5곳 → 8곳). 추가로 orchestrator 재검증에서 `app/api/ra/` 라우트 4곳(updates, samd/generate, predicate/comparison, radar/search)이 더 발견되어 **총 11곳**으로 정정됨(L-007 직검).

**완화**: 본 문서 섹션 1.2, 3.3의 11곳 전체를 Phase B 범위로 명시. 통합 완료 후 `grep -rn "sharedAnthropicClient\|@anthropic-ai/sdk\|new Anthropic" lib/ app/ --include='*.ts'`로 잔여 0건(타입 전용 import + 클라이언트 정의 파일 제외) 확인 필수.

### 7.6 `@ai-sdk/openai` 잘못된 제거 위험

**위험**: Phase C에서 `package.json` 의존성 정리 시 `@ai-sdk/openai`를 "OpenAI 제거"라는 요구사항에 따라 함께 제거하면, `lib/ai/llm-provider.ts`의 Ollama 경로(`createOpenAI`)가 붕괴함.

**완화**: 본 문서 섹션 3.5, 4.1에 명시적으로 `@ai-sdk/openai`는 **유지** 대상임을 기록. Phase C 검증 항목에 `createOpenAI` 잔여 사용 확인 추가.

---

## 8. 단계별 롤백 플랜

### Phase A 롤백 (임베딩)

- `.env.local`에서 `EMBEDDING_BASE_URL`, `GITHUB_MODELS_TOKEN` 제거 → 기존 OpenAI 경로로 자동 폴백 (코드를 인라인 복원한 전제)
- 또는 `git revert <phase-a-commit>` — 영향 파일 7개 + `.env.example`
- 데이터 영향: 없음 (말뭉치 0건, 차원 동일)

### Phase B 롤백 (Anthropic 통합)

- 파일별 독립 롤백 가능 (8개 사이트 각각 git revert)
- 특히 `lib/radar/classifier.ts`는 단독 롤백 권장 (리스크 최대)
- 환경 변수: `ANTHROPIC_API_KEY` 재활성화로 전체 롤백 가능 (Anthropic 의존성이 package.json에 남아 있는 동안)
- 데이터 영향: 없음 (LLM 호출만, 저장 데이터 변경 없음)

### Phase C 롤백 (의존성 제거)

- `package.json`에 `@ai-sdk/anthropic`, `@anthropic-ai/sdk` 재추가 + `pnpm install`
- 코드 영향: 없음 (A, B 완료 전제하에 의존성만 제거된 상태)

---

## 9. 명시적 비목표 (Non-Goals)

본 설계안은 **다음을 수행하지 않는다**:

1. **코드 구현 미수행**: 설계 문서 산출이 유일한 결과물. 소스 코드, 스키마, 마이그레이션,`.env` 파일 수정 없음.
2. **Ollama chat 경로 변경 최소화**: 이미 정상 동작하는 `llm-provider.ts`의 Ollama 분기 코드는 8개 사이트 통합을 위한 호출부 추가 외에는 변경하지 않음.
3. **pgvector 차원 변경 미수행**: `vector(1536)`은 유지. 차원 변경은 섹션 5의 조건부 플랜(텍스트-임베딩-3-스몰 단종 시)으로만 명시.
4. **Azure AI Foundry 전환 미수행**: GitHub Models 프리 티어로 시작, 프로덕션 확장 필요 시점에 별도 설계안에서 다룸.
5. **Langfuse/관측성 재설계 미수행**: 기존 관측성 인터페이스는 유지되어야 함 (8사이트 통합 시 동일 트레이스 구조 유지).
6. **Cloudflare Vectorize 통합 미수행**: 본 마이그레이션은 pgvector 경로만 다룸. Vectorize는 별개 이슈.

---

## 10. 검증 체크리스트 (구현 단계용)

구현 후보 agent에게 인계하기 위한 항목:

- [ ] Phase A: `grep -rn "OPENAI_API_KEY" lib/` 결과 0건 (테스트 폴백 제외)
- [ ] Phase A: `embedding-provider.ts` 신규 파일의 PII 가드 정상 동작
- [ ] Phase A: 모든 retriever가 GitHub Models 경유 1536차원 벡터 반환
- [ ] Phase B: `grep -rn "sharedAnthropicClient\|@anthropic-ai/sdk" lib/` 결과 0건 (타입 전용 import 포함)
- [ ] Phase B: `lib/radar/classifier.ts` 3-tier 각각 회귀 테스트 통과
- [ ] Phase B: `lib/ai/structured-blocks.ts` AbortSignal 전파 정상
- [ ] Phase C: `package.json`에서 `@ai-sdk/anthropic`, `@anthropic-ai/sdk` 제거 후 `pnpm build` 성공
- [ ] Phase C: `@ai-sdk/openai`는 유지됨 (llm-provider Ollama 경로 정상)
- [ ] 전체: `.env.example`에 GitHub Models 3종 변수 추가, OpenAI/Anthropic 변수 제거

---

**문서 끝. 구현은 별도 후속 태스크에서 수행.**
