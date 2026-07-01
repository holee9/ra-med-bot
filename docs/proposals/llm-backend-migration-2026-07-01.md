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

## 11. Phase B 전면 수정 — Anthropic → GitHub Copilot 구독 (revised per hermes pattern 2026-07-01)

> **수정 배경**: 원래 Phase B는 "Anthropic 11개 사이트 → Ollama(llama3.2)" 였으나, Claude→로컬 3B 모델로의 품질 회귀가 심각하다는 판단으로 사용자가 방향을 변경했다. 로컬 도구 **hermes**(`~/.hermes/hermes-agent/`)가 이미 GitHub Copilot 구독을 Claude/GPT 백엔드로 사용하는 패턴을 구현하고 있어, 이를 Regula(TypeScript/Next.js)로 포팅한다.
>
> **검증 기준**: 본 섹션의 모든 hermes 파생 주장은 2026-07-01 실제 파일 read로 확인 (L-013). 엔드포인트 추측 없음.

### 11.1 hermes 패턴 요약 (검증 완료)

hermes는 Copilot 접근에 **두 경로**를 가진다:

| 경로 | 엔드포인트 | 용도 | Regula 적합도 |
|------|-----------|------|---------------|
| **직접 API** | `https://api.githubcopilot.com/chat/completions` (OpenAI 호환) | chat_completions 모드 — Claude/GPT/Gemini 모두 처리 | **적합** (서버 사이드 REST 호출) |
| ACP 서브프로세스 | `copilot --acp --stdio` (JSON-RPC over stdio) | Copilot CLI 바이너리를 요청마다 spawn | 부적합 (Next.js 서버에서 CLI 바이너리 관리 불가) |

→ Regula는 **직접 API 경로만** 사용한다.

**인증 3단계** (hermes `copilot_auth.py` 검증):

1. **OAuth device-code flow** → `gho_` 토큰 획득
   - client_id: `Ov23li8tweQw6odWQebz` (opencode/Copilot CLI 공용 ID)
   - `POST https://github.com/login/device/code` (client_id + scope=`read:user`)
   - 사용자가 `https://github.com/login/device`에서 user_code 입력 후授权
   - `POST https://github.com/login/oauth/access_token` (grant_type=`urn:ietf:params:oauth:grant-type:device_code`) → `gho_...` 반환
   - **주의**: classic PAT(`ghp_`)는 Copilot API가 거부. `github_pat_`(fine-grained), `ghu_`(App)는 허용.
2. **토큰 교환** (매 요청이 아님, 캐시됨): `gho_` → 단기 Copilot API JWT
   - `GET https://api.github.com/copilot_internal/v2/token`
   - headers: `Authorization: token <gho_>`, `User-Agent: GitHubCopilotChat/0.26.7`, `Editor-Version: vscode/1.104.1`
   - 응답: `{token: "tid=...;exp=...", expires_at: <epoch>}` (~30분 TTL, 세미콜론 구분 문자열)
   - 캐시: 만료 2분 전 자동 갱신 (`_JWT_REFRESH_MARGIN_SECONDS = 120`)
3. **API 호출**: 교환된 JWT를 `Authorization: Bearer <jwt>`로 `/chat/completions` 전송

**필수 헤더** (`copilot_request_headers`, `models.py:2612`):

```
Editor-Version: vscode/1.104.1
User-Agent: <식별자>/1.0
Copilot-Integration-Id: vscode-chat
Openai-Intent: conversation-edits
x-initiator: agent  (또는 user)
Authorization: Bearer <교환된-Copilot-JWT>
```

### 11.2 로컬 환경 검증 (중요 — 인증 옵션 분기)

`~/.config/gh/hosts.yml`의 holee9 / hnabyz-bot 토큰은 **모두 `ghp_`** (classic PAT) 이다. Copilot API는 `ghp_`를 거부하므로, **"옵션 (a) gh auth token 재사용"은 현재 불가능**.

→ 옵션 (b) device-code flow 1회 실행 → `gho_` 획득 → `.env`의 `COPILOT_GITHUB_TOKEN`에 저장이 유일한 실행 가능 경로.

hermes-gateway 서비스(PID 1606230)가 이미 `/opt/hermes-ra/hermes-api-server.py`로 구동 중이므로, hermes 자체는 이미 유효한 Copilot 인증 경로를 확보하고 있음 — Regula는 동일한 GitHub 계정(holee9)의 구독을 공유하되, 토큰은 Regula 전용으로 별도 획득 권장 (서비스별 토큰 분리).

### 11.3 추천 Chat/LLM 백엔드 역할 분담 (사용자 위임 조정안)

사용자의 원래 위임은 "chat=Ollama, local" + "Copilot 구독" 두 소스였다. 이를 **명시적 3-티어**로 분해한다 (이전 "chat=Ollama" 단일화 결정을 조용히 덮어쓰지 않음 — 11개 사이트를 별도 "domain LLM" 티어로 프레이밍):

| 티어 | 백엔드 | 대상 | 근거 |
|------|--------|------|------|
| **General chat** | Ollama `llama3.2` (T3610 로컬) | `consult.ts`, `llm-provider.ts` 기본값, `intent.ts`, `router.ts`, CER pipeline 3종, project-memory | 비용 $0, PII 온프레미스, 이미 80% 와이어링. 일반 RA 컨설팅 대화는 품질 허용치 충족. |
| **Domain LLM (고위험/구조화)** | **Copilot 구독 (Claude)** — 신규 `copilot-provider.ts` | 섹션 1.2의 **11개 Anthropic 사이트** (classifier 3-tier, structured-blocks, report-generator, digest, relevance-scorer, intent-parser, comparison-builder, 4개 API 라우트) | Claude 품질 유지 = 동작 보존(behavior-preserving). llama3.2로 이관 시 3-tier 분류기/JSON 구조화 출력 회귀 리스크 최대. |
| **Embedding** | GitHub Models `text-embedding-3-small` | Phase A 완료 (변경 없음) | 임베딩 특화 모델, 1536차원 유지. |
| **Offline fallback** | Ollama (domain LLM 티어의 fallback) | Copilot 가용성 상실 시 11개 사이트를 일시적 Ollama 경로로 강하 | 품질 저하 감수, 운영 연속성 확보. `COPILOT_FALLBACK_TO_OLLAMA=true` 시 활성화. |

**이 분담이 사용자 위임을 존중하는 방식**:
- "chat=Ollama" 결정 유지 — 일반 대화/컨설팅은 Ollama.
- "Copilot 구독"은 11개 도메인 LLM 사이트 전용 — Claude 품질이 비즈니스 판단(레이더 분류, 구조화 리포트, SAMD 생성)에 직결되는 영역.
- Ollama는 domain LLM 티어의 안전망(off-ramp)으로 유지 — Copilot 단절 시에도 시스템이 멈추지 않음.

### 11.4 신규 `lib/ai/copilot-provider.ts` 설계 (TypeScript 포팅)

> 본 설계는 코드 구현이 아닌 인터페이스/동작 명세. 구현은 별도 태스크.

#### 11.4.1 인증 모듈 (`lib/ai/copilot-auth.ts` — 분리 권장)

```typescript
// 책임: gho_ 토큰 → 단기 Copilot API JWT 교환 + 캐시 + 자동 갱신

const TOKEN_EXCHANGE_URL = 'https://api.github.com/copilot_internal/v2/token';
const JWT_REFRESH_MARGIN_MS = 120_000; // 만료 2분 전 갱신

interface CopilotJwt { token: string; expiresAt: number; }

let cached: CopilotJwt | null = null;

export async function getCopilotApiToken(): Promise<string> {
  const raw = process.env.COPILOT_GITHUB_TOKEN;
  if (!raw) throw new Error('COPILOT_GITHUB_TOKEN unset (device-code flow로 gho_ 획득 필요)');
  if (cached && Date.now() < cached.expiresAt - JWT_REFRESH_MARGIN_MS) return cached.token;
  // GET TOKEN_EXCHANGE_URL with headers: Authorization: token <gho_>, User-Agent, Editor-Version
  // parse {token, expires_at} → cache → return token
}

// 1회성 설정 스크립트 (lib/ai/copilot-device-login.ts) — CLI에서 실행, .env에 기록
// device-code flow → gho_ 획득 → 사용자가 .env에 COPILOT_GITHUB_TOKEN=gho_... 기록
```

**인증 옵션 평가** (hermes 검증 기준):

| 옵션 | 실행 가능성 | 비고 |
|------|------------|------|
| (a) `gh auth token` / `hosts.yml` 재사용 | **불가** (현재 토큰이 `ghp_`) | hosts.yml 토큰이 classic PAT라 거부됨. `gh auth login`을 device-code 흐름으로 재실행하면 `gho_`로 교체되지만, hermes/기존 gh 워크플로에 영향. |
| (b) device-code flow 1회 서버 실행 | **권장** | Regula 전용 `gho_` 획득 → `COPILOT_GITHUB_TOKEN` env로 저장. 서버 부팅 시 만료 확인 불필요 (`gho_`는 장수명, 교환 JWT가 자동 갱신). |
| (c) env `COPILOT_TOKEN` 직접 입력 | 가능 (보조) | (b)의 저장 경로. 사용자가 직접 `gho_`를 발급받아 입력해도 됨. |

**토큰 갱신/로테이션 전략**:
- `gho_` 자체: 장수명 OAuth 토큰 (만료 없음, GitHub 계정에서 수동 revoke 시까지 유효). 분기 1회 유효성 점검 권장.
- 교환 JWT: ~30분 TTL, 프로세스 내 캐시, 만료 2분 전 백그라운드 갱신. Next.js 서버 재시작 시 캐시 초기화(무해 — 첫 요청에서 재교환).
- 다중 계정 로테이션(선택): `COPILOT_GITHUB_TOKENS="gho_...1,gho_...2"` 쉼표 구분 지원 시 429 시 다음 토큰으로 회전. 6-8명 동시 사용 환경에서 AI Credits 분산. v1은 단일 토큰, 향후 확장.

#### 11.4.2 ACP 클라이언트 (직접 API 포팅 — `lib/ai/copilot-provider.ts`)

hermes `CopilotACPClient`(ACP 서브프로세스)가 아닌, `copilot` provider profile(직접 REST)을 포팅한다.

```typescript
// 핵심: @ai-sdk/openai의 createOpenAI를 Copilot 엔드포인트로 재목적화
// Claude 모델은 chat_completions 모드로 처리 (hermes _should_use_copilot_responses_api는
// GPT-5+만 true, Claude는 chat_completions 분기 — 확인 완료)

import { createOpenAI } from '@ai-sdk/openai';
import type { LanguageModel } from 'ai';

const COPILOT_BASE_URL = 'https://api.githubcopilot.com';
const COPILOT_EDITOR_VERSION = 'vscode/1.104.1';

export function getCopilotModel(modelId: string): LanguageModel {
  const normalized = normalizeCopilotModelId(modelId); // 하이픈→점 표기 변환
  const client = createOpenAI({
    baseURL: COPILOT_BASE_URL, // /chat/completions, /models 경로는 SDK가 추가
    apiKey: 'copilot', // placeholder — 실제 토큰은 fetch 헤더로 주입
    headers: copilotHeaders(), // 아래 동적 헤더
    fetch: copilotFetchWrapper, // 매 요청 getCopilotApiToken() 호출 + Authorization 주입
  });
  return client(normalized) as unknown as LanguageModel;
}

function copilotHeaders(): Record<string, string> {
  return {
    'Editor-Version': COPILOT_EDITOR_VERSION,
    'User-Agent': 'Regula/1.0',
    'Copilot-Integration-Id': 'vscode-chat',
    'Openai-Intent': 'conversation-edits',
    'x-initiator': 'agent',
  };
}

// fetch wrapper: 매 요청마다 getCopilotApiToken() → Authorization: Bearer <jwt> 주입
// (createOpenAI의 headers는 정적이므로, 동적 토큰은 fetch 오버라이드로)
async function copilotFetchWrapper(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const jwt = await getCopilotApiToken();
  const headers = new Headers(init?.headers);
  headers.set('Authorization', `Bearer ${jwt}`);
  return globalThis.fetch(input, { ...init, headers });
}
```

#### 11.4.3 모델 카탈로그 매핑 (검증 완료)

hermes `_COPILOT_MODEL_ALIASES` (`models.py:2977`) 기준. **임베딩은 Copilot에 없음** — Phase A GitHub Models가 임베딩을 담당 (변경 없음).

| Regula 현재 ID (하이픈) | Copilot ID (점 표기) | 사이트 |
|--------------------------|---------------------|--------|
| `claude-haiku-4-5-20251001` | `claude-haiku-4.5` | intent-parser, comparison-builder, samd/generate×3 |
| `claude-haiku-4-5` | `claude-haiku-4.5` | relevance-scorer, classifier×3, structured-blocks, radar/search |
| `claude-sonnet-4-5` | `claude-sonnet-4.5` | report-generator, updates/[id] |
| `claude-sonnet-4-6` | `claude-sonnet-4.6` | digest-generator |

`normalizeCopilotModelId()` 로직 (hermes 검증):
1. `claude-X-Y` → `claude-X.Y` (하이픈→점, 메이저.마이너)
2. 날짜 접미사(`-20251001`) 제거
3. Copilot `/models` 카탈로그로 존재 확인 (부팅 시 1회, 캐시)

#### 11.4.4 11개 사이트 파일별 마이그레이션 (동작 보존)

각 사이트는 `sharedAnthropicClient.messages.create({model, messages, ...})` → `generateText({model: getCopilotModel('claude-...'), messages, ...})` 또는 `streamText`로 교체. **동일 Claude 패밀리이므로 프롬프트 재튜닝 불필요** (Ollama 이관 시 필요했던 튜닝 제거 — 이것이 Copilot 경로의 핵심 이점).

| # | 파일 | 현재 모델 | 변경 요약 |
|---|------|-----------|-----------|
| 1 | `lib/classification/intent-parser.ts` | `claude-haiku-4-5-20251001` | `new Anthropic()` → `getCopilotModel('claude-haiku-4.5')`. JSON 파싱 로직 유지. |
| 2 | `lib/vigilance/report-generator.ts` | `claude-sonnet-4-5` | `sharedAnthropicClient` → `getCopilotModel('claude-sonnet-4.5')`. |
| 3 | `lib/digest/digest-generator.ts` | `claude-sonnet-4-6` | `new Anthropic()` → `getCopilotModel('claude-sonnet-4.6')`. |
| 4 | `lib/radar/relevance-scorer.ts` | `claude-haiku-4-5` | `sharedAnthropicClient` → `getCopilotModel('claude-haiku-4.5')`. |
| 5 | `lib/predicate/comparison-builder.ts` | `claude-haiku-4-5-20251001` | `anthropicClient` 주입 → `getCopilotModel()` 사용. 인터페이스 단순화. |
| 6 | `lib/radar/classifier.ts` ×3 | `claude-haiku-4-5` | 3-tier 각 `getCopilotModel()`. **가장 높은 회귀 리스크** — 그러나 Claude 유지로 프롬프트 변경 불필요 (Ollama 대비 리스크 대폭 감소). |
| 7 | `lib/ai/structured-blocks.ts` | `claude-haiku-4-5` | `new Anthropic()` → `getCopilotModel()`. AbortSignal 전파 로직 유지 (`@MX:WARN`). |
| 8 | `app/api/ra/updates/[id]/route.ts` | `claude-sonnet-4-5` | `sharedAnthropicClient` → `getCopilotModel()`. |
| 9 | `app/api/ra/samd/[id]/generate/route.ts` ×3 | `claude-haiku-4-5-20251001` | `sharedAnthropicClient` ×3 → `getCopilotModel()`. |
| 10 | `app/api/ra/predicate/comparison/route.ts` | (주입) | `createComparisonBuilder(sharedAnthropicClient)` → `getCopilotModel()` 주입. |
| 11 | `app/api/ra/radar/search/route.ts` | `claude-haiku-4-5` | `sharedAnthropicClient` → `getCopilotModel()`. |
| (def) | `lib/ai/anthropic-client.ts` | (ZDR 헤더) | 11사이트 통합 후 **삭제**. Copilot 경로는 ZDR 헤더 대신 Copilot의 자체 데이터 정책 적용. |

**Ollama fallback 통합**: `getCopilotModel()` 내부에서 `try { copilot 호출 } catch { if (COPILOT_FALLBACK_TO_OLLAMA) return getLlmFastModel() }` 래핑 (선택). 단, 품질 저하 명시적 로깅 필수.

#### 11.4.5 레이트 리미트 / ToS 리스크 (구현 전 사용자 결정 필요 — 핵심 미해결 항목)

> 이 항목은 hand-wave 하지 않음. 사용자가 구현 전 명시적으로 결정해야 할 사안.

**리스크 1 — Copilot 구독 ToS의 "IDE 내 사용" 조항**:
- GitHub Copilot ToS는 역사적으로 "지원되는 IDE 내에서의 사용"을 전제. `api.github.com/copilot_internal/v2/token` 엔드포인트명의 `_internal` 접미사는 이 API가 1차 소비자(VS Code CLI)용임을 시사.
- **완화 요인 (2026-07-01 웹 검색)**: 2026-06-01부터 Copilot이 **사용량 기반 과금(AI Credits, 토큰 metered)**으로 전환. 이는 "공정 사용" 모호성을 토큰 단위 명시 과금으로 해소 — 자동화된 백엔드 호출도 이제 단순히 토큰만큼 과금됨.
- **잔존 리스크**: GitHub가 언제든 `copilot_internal` API를 지원 IDE 검증(gate) 뒤로 숨길 수 있음. hermes/opencode 등 비-IDE 도구들이 현재 작동하므로 GitHub이 관대히 허용 중이지만, 정책 변경 시 Regula의 11개 사이트가 동시에 중단될 수 있음.

**리스크 2 — 단일 구독으로 6-8명 동시 사용 시 AI Credits 고갈**:
- 11개 사이트는 고빈도는 아니지만(분당 수 회), classifier 3-tier + SAMD 3회 호출 + structured-blocks는 단일 컨설팅 세션에서 다중 호출을 유발할 수 있음.
- Copilot Pro 등급의 AI Credits 한도가 내부 도구 6-8명의 도메인 LLM 호출을 감당하는지 미확인. Pro+/Business 등급이 필요할 수 있음.

**리스크 3 — 데이터 정책 (ZDR 대체)**:
- 기존 `anthropic-client.ts`는 `anthropic-beta: zero-data-retention` 헤더로 PHI/PII 보호. Copilot 경로는 Anthropic ZDR 대신 **GitHub Copilot의 데이터 정책**(REQ-LAUNCH-035 준거성 별도 검증 필요)이 적용됨.
- Copilot Trust Center FAQ(2026-07-01 확인)에 따르면 프롬프트/응답은 모델 훈련에 사용되지 않으나, PHI가 포함된 레이더/리포트 생성 시 별도 DPA(데이터 처리 합의) 검토 권장.

**사용자 결정 필요 항목** (구현 전):
1. Copilot 구독 등급(Pro / Pro+ / Business) 중 어느 것으로 11개 사이트를 감쌀 것인가? AI Credits 예산 확보 필요.
2. `copilot_internal` API 사용에 대한 ToS 리스크를 수용할 것인가? (수용 시 Ollama fallback을 필수 안전망으로 구현 권장)
3. PHI/PII 포함 프롬프트의 Copilot 전송이 내부 규정(REQ-LAUNCH-035 ZDR 요구사항)에 부합하는가? (불가 시 일부 사이트는 Ollama 잔류 또는 데이터 마스킹 전송 필요)

#### 11.4.6 롤백

- 파일별 `git revert` (11개 사이트 각각 독립).
- `ANTHROPIC_API_KEY` 경로 재활성화: `lib/ai/anthropic-client.ts`를 삭제 전까지 보존하면, `package.json`의 `@anthropic-ai/sdk`가 남아있는 동안 즉시 원복 가능.
- 환경 변수: `COPILOT_GITHUB_TOKEN` 제거 → Copilot 경로 비활성화. 동시에 `ANTHROPIC_API_KEY` 재주입으로 Anthropic 직접 경로 복원.

### 11.5 수정된 Phase 순서

| Phase | 내용 | 상태 |
|-------|------|------|
| **A** | Embedding → GitHub Models (`text-embedding-3-small`, 1536차원 유지) | **완료** (섹션 3.2, 기존 설계 참조) |
| **B-revised** | **Anthropic 11개 사이트 → Copilot 구독 (Claude)** — 신규 `copilot-provider.ts` + `copilot-auth.ts` 포팅. 동일 Claude 패바리리 유지로 프롬프트 재튜닝 불필요. | 설계 완료 (본 섹션). 구현 전 ToS 결정(11.4.5) 대기. |
| **C** | `@anthropic-ai/sdk` + `ANTHROPIC_API_KEY` 경로 제거. `package.json`에서 `@ai-sdk/anthropic`, `@anthropic-ai/sdk` 제거. `copilot-provider.ts`가 Anthropic SDK를 대체. **`@ai-sdk/openai`는 유지** — Ollama 경로 + Copilot 경로 모두 `createOpenAI` 사용. | B-revised 완료 후. |

**Phase B-revised 세부 순서** (리스크 낮은 순):

1. `lib/ai/copilot-auth.ts` + `lib/ai/copilot-provider.ts` 신규 — 단위 테스트(토큰 교환, 모델 ID 정규화) 선행
2. `lib/predicate/comparison-builder.ts` — 타입 주입, 영향 제한적
3. `lib/classification/intent-parser.ts` — 단순 분류 1회
4. `lib/vigilance/report-generator.ts` — 단일 호출
5. `lib/digest/digest-generator.ts` — 단일 호출
6. `lib/radar/relevance-scorer.ts` — 단일 호출
7. `app/api/ra/radar/search/route.ts` — 단일 API 라우트
8. `app/api/ra/updates/[id]/route.ts` — 단일 API 라우트
9. `app/api/ra/predicate/comparison/route.ts` — 주입 패턴
10. `app/api/ra/samd/[id]/generate/route.ts` ×3 — 다중 호출 API
11. `lib/ai/structured-blocks.ts` — AbortSignal 전파 주의
12. `lib/radar/classifier.ts` ×3 — **3-tier, 최종 검증**
13. `lib/ai/anthropic-client.ts` — 삭제 (grep 잔여 0건 확인 후)

**완료 기준**:
- `grep -rn "sharedAnthropicClient\|@anthropic-ai/sdk\|new Anthropic" lib/ app/ --include='*.ts'` 결과 0건 (타입 전용 import 포함)
- `COPILOT_GITHUB_TOKEN`만으로 11개 사이트 정상 동작
- classifier 3-tier 회귀 테스트 통과 (Claude 품질 유지이므로 Ollama 대비 회귀 최소)
- structured-blocks AbortSignal 전파 정상

---

## 12. gx10 전용 전면 재설계 (2026-07-01) — 최종 방침

> **선행 섹션 폐기**: 섹션 11(Copilot 구독 경로), 섹션 3~10의 GitHub Models / OpenAI / Anthropic 기반 설계는 모두 **superseded**. 본 섹션은 사용자의 비타협 방침(외부 API 전면 배제, 과금 0, 온프레미스)을 충족하는 유일한 경로다.
>
> **검증 기준**: gx10 인프라 모든 주장은 2026-07-01 오케스트레이터 직검 데이터 기반 (L-013 준수 — 재추측 금지). 코드 상태는 `lib/ai/embedding-provider.ts`, `lib/ai/llm-provider.ts`, `lib/db/schema*.ts`, `migrations/`, `lib/env.ts`, `package.json` 직접 read로 확인.

### 12.1 목표 아키텍처 — gx10 Ollama 단일 백엔드

```
┌──────────────────────────────────────────────────────────────┐
│  Regula (T3610, Next.js)  192.168.100.200                     │
│  ├─ chat (11개 사이트 + intent/router/consult)                │
│  │   → OLLAMA_BASE_URL=http://192.168.100.1:11434/v1          │
│  │     OLLAMA_MODEL=gpt-oss:120b                              │
│  └─ embedding (retrievers 3 + knowledge-promo 2 + ingest)     │
│      → EMBEDDING_BASE_URL=http://192.168.100.1:11434/v1       │
│        EMBEDDING_MODEL=qwen3-embedding:latest                 │
└──────────────────┬───────────────────────────────────────────┘
                   │ 2.5G 직결 (ping 0.9ms 측정)
                   ▼
┌──────────────────────────────────────────────────────────────┐
│  gx10 (NVIDIA GB10 Grace Blackwell)  192.168.100.1            │
│  Ollama 0.0.0.0:11434 (OPENAI 호환 /v1/* + 네이티브 /api/*)   │
│  ├─ gpt-oss:120b       (116.8B MXFP4, ctx 131072, reasoning)  │
│  └─ qwen3-embedding    (2880차원)                              │
│  최적화: KEEP_ALIVE=2h NUM_PARALLEL=2 MAX_LOADED_MODELS=3     │
│          FLASH_ATTENTION=1                                     │
└──────────────────────────────────────────────────────────────┘

외부 API 호출: 0건 (OpenAI / Anthropic / GitHub Models / Copilot 전부 배제)
과금: 0 (월구독·사용량과금 전부)
인증: 무 (192.168.100.x 로컬망 신뢰 — OLLAMA_HOST=0.0.0.0 이미 설정됨)
```

| 계층 | 기존 (superseded) | 최종 (gx10) |
|------|-------------------|-------------|
| chat LLM | Anthropic Claude 11사이트 + Ollama llama3.2 fallback | **gpt-oss:120b** (단일 모델, 사이트별 모델 차이 없음) |
| embedding | GitHub Models `text-embedding-3-small` (1536차원) | **qwen3-embedding:latest** (4096 풀 → **MRL 1536 truncate**) |
| 외부 의존 | OpenAI API, Anthropic API, GitHub Models PAT | **없음** (gx10 단일 홉) |

### 12.2 Phase A-revised — 임베딩 gx10 전환 + MRL 1536 truncate (migration 불필요) — 구현 완료 2026-07-01

> **[SUPERSEDED — 2026-07-01 직견 정정, L-013]** 본래 "1536→2880 migration"으로 설계했으나 구현 단계 오케스트레이터 직견으로 정정: (1) 2880은 `gpt-oss:120b` 모델 카드의 hidden `embedding_length`이지 qwen3-embedding 출력 차원이 아님 — qwen3-embedding:latest 실제 출력 = **4096**(`/v1/embeddings` 직접 호출 확인). (2) qwen3-embedding은 **MRL(Matryoshka) 지원** → `dimensions` 파라미터로 1536 truncate 가능(직견: dim=1536 요청 → 1536 반환). 따라서 **pgvector vector(1536) 유지, migration 불필요, 코퍼스 무결**. 차원 선택의 gx10 로드 영향은 직견 0(truncate는 forward pass 후 슬라이스). 아래 12.2.1/12.2.2의 2880 기반 코드/SQL 예시는 **historical(구 설계안)**이며, 실제 구현은 `lib/ai/embedding-provider.ts`의 **fetch 미들웨어** 방식(`createOpenAI({ fetch })`에서 모든 `/v1/embeddings` 요청 body에 `dimensions:1536` 강제 주입 — `@ai-sdk/openai` ^3이 `embedding()` 1-arg만 지원하므로 consumer per-call providerOptions 대신 단일 지점 처리). 게이트 직견: typecheck/lint exit 0 · full `pnpm test` 4822 passed · gx10 실호출 `embedBatchTexts` dim=1536 × 2 확인.

#### 12.2.1 embedding-provider.ts 변경

현재 `lib/ai/embedding-provider.ts` (직검):
- `DEFAULT_BASE_URL = 'https://models.github.ai/inference'`
- `DEFAULT_MODEL = 'text-embedding-3-small'`
- API key: `GITHUB_MODELS_TOKEN` (필수, 테스트용 sentinel 폴백)

변경 후 (gx10):
```typescript
const DEFAULT_BASE_URL = 'http://192.168.100.1:11434/v1';  // gx10 Ollama
const DEFAULT_MODEL = 'qwen3-embedding:latest';            // 2880차원
const NO_KEY_FALLBACK = 'ollama';  // Ollama은 key 무시, SDK는 문자열 요구

export function getEmbeddingApiKey(): string {
  // 로컬망 — 인증 불필요. SDK 생성자는 문자열을 요구하지만 요청 시 검증 안 함.
  return process.env.EMBEDDING_API_KEY ?? NO_KEY_FALLBACK;
}
```

`createOpenAI` 재사용 유지 (`@ai-sdk/openai` — Ollama /v1/embeddings는 OpenAI 호환). `embedMany` 호출부는 동일 — 차원만 1536→2880로 증가, 반환 타입 `number[][]`은 그대로.

> **대체 경로 (직접 /api/embeddings)**: Ollama 네이티브 엔드포인트 `POST http://192.168.100.1:11434/api/embeddings` (`{model, prompt}` → `{embedding: number[]}`). @ai-sdk/openai 경로가 차원·배치 처리 호환성 문제를 보일 경우에만 고려. 기본은 createOpenAI 재사용.

#### 12.2.2 pgvector 차원 마이그레이션 1536→2880 — ❌ SUPERSEDED (위 정정 노트 참조, migration 불필요)

**현황 (직검 — migrations/ 디렉토리 + schema 파일)**: `vector(1536)` 하드코딩 5개 컬럼 (messages.embedding 포함 시 6개 migration 정의, schema.ts customType 사용 5곳).

| 컬럼 | migration 파일 | 인덱스 |
|------|---------------|--------|
| `sources.embedding` | `migrations/0000_init.sql:99` | (0000_init.sql 내 ivfflat) |
| `source_sections.embedding` | `migrations/0000_init.sql:132` | (0000_init.sql 내 ivfflat) |
| `promoted_answers.embedding` | `migrations/0086_knowledge_promo.sql:46` + `0089_fixup` | `idx_promoted_answers_embedding` (ivfflat, vector_cosine_ops) |
| `document_chunks.embedding` | `migrations/0014_docingest_schema.sql:63` | `idx_document_chunks_embedding_hnsw` (hnsw, vector_cosine_ops) |
| `messages.embedding` | `migrations/0094_messages_embedding.sql:37` | `idx_messages_embedding` (ivfflat, vector_cosine_ops) |

**제약**: pgvector는 차원 축소/확대를 `ALTER COLUMN ... TYPE`로 직접 지원하지 않음 (벡터 캐스트 손실). 코퍼스가 0행이므로 **DROP COLUMN + ADD COLUMN**이 가장 깨끗한 경로.

**신규 migration SQL** (`migrations/00XX_embedding_dim_2880.sql`):

```sql
-- §0 전제: 코퍼스 0행 (데이터 이동 0). 운영 적용 전 SELECT count()로 0 확인 필수.

-- §1 차원 변경 (DROP + ADD — pgvector는 ALTER TYPE 차원 변경 미지원)
ALTER TABLE sources            DROP COLUMN embedding, ADD COLUMN embedding vector(2880);
ALTER TABLE source_sections    DROP COLUMN embedding, ADD COLUMN embedding vector(2880);
ALTER TABLE promoted_answers   DROP COLUMN embedding, ADD COLUMN embedding vector(2880);
ALTER TABLE document_chunks    DROP COLUMN embedding, ADD COLUMN embedding vector(2880);
ALTER TABLE messages           DROP COLUMN embedding, ADD COLUMN embedding vector(2880);

-- §2 인덱스 재구축 (기존 정의 준용 — 0000_init / 0086 / 0089 / 0014 / 0094)
CREATE INDEX IF NOT EXISTS idx_sources_embedding
  ON sources USING hnsw (embedding vector_cosine_ops);
CREATE INDEX IF NOT EXISTS idx_source_sections_embedding
  ON source_sections USING hnsw (embedding vector_cosine_ops);
CREATE INDEX IF NOT EXISTS idx_promoted_answers_embedding
  ON promoted_answers USING ivfflat (embedding vector_cosine_ops) WITH (lists = 10);
CREATE INDEX IF NOT EXISTS idx_document_chunks_embedding_hnsw
  ON document_chunks USING hnsw (embedding vector_cosine_ops);
CREATE INDEX IF NOT EXISTS idx_messages_embedding
  ON messages USING ivfflat (embedding vector_cosine_ops) WITH (lists = 10);
```

> **인덱스 타입 주의**: 기존 sources/source_sections 인덱스 타입은 `migrations/0000_init.sql` 하단에서 확인 필요 (ivfflat vs hnsw). 위 SQL은 hnsw로 표기했으나, 구현 시 기존 정의를 준용할 것. document_chunks는 hnsw 확정 (`0014:73`). promoted_answers/messages는 ivfflat lists=10 확정.

**schema 코드 변경**:

`lib/db/schema-docingest.ts:36`:
```typescript
// before
dataType() { return 'vector(1536)'; }
// after
dataType() { return 'vector(2880)'; }
```

`lib/db/schema.ts` customType (line 42-56): `dataType()`는 이미 generic `'vector'` 반환 (Drizzle Kit push:pg 호환성). **변경 불필요** — 차원은 migration SQL이 통제. 다음 주석 업데이트만:
- `schema.ts:19` 주석 `pgvector(1536)` → `pgvector(2880)`
- `schema.ts:44` 주석 `vector(1536) dimension` → `vector(2880) dimension`
- `schema.ts:1003` 주석 `embedding vector(1536)` → `embedding vector(2880)`

**검증 (구현 시)**:
1. `pnpm drizzle-kit push:pg` 로컬 DB 적용 — 차원 2880 반영 확인 (`\d sources`, `\d document_chunks`)
2. `SELECT vector_dims(embedding) FROM sources LIMIT 1` → 2880 (L-010: migration 실DB 적용 테스트 필수)
3. embedBatchTexts 1회 호출 → 반환 벡터 길이 2880 확인

### 12.3 Phase B-revised — chat gx10 전환 (Anthropic 11사이트 → gpt-oss:120b)

#### 12.3.1 llm-provider.ts 변경

현재 (직검): Ollama 분기 존재, 기본 `OLLAMA_BASE_URL=http://localhost:11434/v1`, `OLLAMA_MODEL=llama3.2`.

변경 (기본값만 — 로직 동일):
```bash
# .env.local (gx10)
OLLAMA_PROVIDER=ollama                          # 또는 LLM_PROVIDER=ollama (기존 키명)
OLLAMA_BASE_URL=http://192.168.100.1:11434/v1   # localhost → gx10
OLLAMA_MODEL=gpt-oss:120b                       # llama3.2 → gpt-oss
OLLAMA_FAST_MODEL=gpt-oss:120b                  # 동일 모델 (사이트별 차이 없음)
```

`buildModel()`의 `case 'ollama'` 로직은 변경 없음 — `createOpenAI({ baseURL, apiKey: 'ollama' })` 재사용.

#### 12.3.2 Anthropic 11사이트 통합 마이그레이션

**현재 모델 분포 (직검)**:

| 모델 ID | 사용 사이트 |
|---------|------------|
| `claude-haiku-4-5-20251001` | intent-parser, comparison-builder, samd/generate ×3 |
| `claude-haiku-4-5` | relevance-scorer, classifier ×3, structured-blocks, radar/search |
| `claude-sonnet-4-5` | report-generator, updates/[id] |
| `claude-sonnet-4-6` | digest-generator |

**매핑 정책**: 11사이트 전부 `getLlmModel()` 또는 `getLlmFastModel()` 경유 **단일 `gpt-oss:120b`** 로 통일. 사이트별 모델 차이 없음 — gpt-oss:120b가 하나의 모델로 haiku/sonnet 역할을 모두 커버 (116.8B 파라미터로 충분한 용량).

**사이트별 변경 패턴** (예시 — `lib/classification/intent-parser.ts`):

```typescript
// before (직검 line 4, 7, 26)
import Anthropic from '@anthropic-ai/sdk';
const client = new Anthropic();
// ...
const response = await client.messages.create({
  model: 'claude-haiku-4-5-20251001',
  messages: [{ role: 'user', content: prompt }],
  max_tokens: 1024,
});
const text = response.content[0].text;

// after
import { generateText } from 'ai';
import { getLlmFastModel } from '@/lib/ai/llm-provider';
// ...
const { text } = await generateText({
  model: getLlmFastModel(),   // gpt-oss:120b
  messages: [{ role: 'user', content: prompt }],
  maxTokens: 1024,
});
```

> **max_tokens → maxTokens**: Anthropic SDK (`max_tokens`)와 @ai-sdk (`maxTokens`) 키명 차이. 11사이트 전부 검증 필요.

**11사이트 파일별 변경 요약**:

| # | 파일 | 현재 패턴 | 변경 |
|---|------|-----------|------|
| 1 | `lib/classification/intent-parser.ts` | `new Anthropic()` + `messages.create` | `generateText({ model: getLlmFastModel() })`. JSON 파싱 로직 유지. |
| 2 | `lib/vigilance/report-generator.ts` | `sharedAnthropicClient.messages.create` | `generateText({ model: getLlmModel() })` |
| 3 | `lib/digest/digest-generator.ts` | `new Anthropic()` + `messages.create` | `generateText({ model: getLlmModel() })` |
| 4 | `lib/radar/relevance-scorer.ts` | `sharedAnthropicClient.messages.create` | `generateText({ model: getLlmFastModel() })` |
| 5 | `lib/predicate/comparison-builder.ts` | `createComparisonBuilder(anthropicClient)` 주입 | 인터페이스를 `LanguageModel` 주입으로 변경, `getLlmFastModel()` 사용 |
| 6 | `lib/radar/classifier.ts` ×3 | `sharedAnthropicClient.messages.create` ×3 | `generateText({ model: getLlmFastModel() })` ×3. **3-tier 회귀 리스크 최대** — gpt-oss reasoning 품질 검증 필수. |
| 7 | `lib/ai/structured-blocks.ts` | `new Anthropic()` + AbortSignal | `generateText({ model: getLlmFastModel(), abortSignal })`. AbortSignal 전파 로직 유지 (`@MX:WARN`). |
| 8 | `app/api/ra/updates/[id]/route.ts` | `sharedAnthropicClient.messages.create` | `generateText({ model: getLlmModel() })` |
| 9 | `app/api/ra/samd/[id]/generate/route.ts` ×3 | `sharedAnthropicClient.messages.create` ×3 | `generateText({ model: getLlmFastModel() })` ×3 |
| 10 | `app/api/ra/predicate/comparison/route.ts` | `createComparisonBuilder(sharedAnthropicClient)` | `createComparisonBuilder(getLlmFastModel())` 또는 builder 내부에서 호출 |
| 11 | `app/api/ra/radar/search/route.ts` | `sharedAnthropicClient.messages.create` | `generateText({ model: getLlmFastModel() })` |
| (del) | `lib/ai/anthropic-client.ts` | ZDR 헤더 싱글톤 | **삭제** (grep 잔여 0건 확인 후). ZDR은 온프레미스 gx10으로 대체 — 외부 전송 자체가 없음. |

#### 12.3.3 gpt-oss reasoning 필드 처리 방안 (구체)

**문제**: gpt-oss:120b는 thinking-capable 모델. Ollama OpenAI 호환 `/v1/chat/completions` 응답에 `reasoning` trace가 포함됨 (직검: capabilities에 `thinking` 명시).

**응답 스키마 차이**:
```
Ollama /v1/chat/completions (gpt-oss:120b):
{
  "choices": [{
    "message": {
      "role": "assistant",
      "content": "<최종 답변>",           ← @ai-sdk/openai가 result.text로 추출
      "reasoning": "<사고 과정 trace>"      ← @ai-sdk/openai v3 기본 무시
    }
  }]
}
```

**3계층 처리 방안**:

**계층 1 — 기본 경로 (권장)**: `@ai-sdk/openai` `generateText`/`streamText`가 `choices[0].message.content`를 `result.text`로 자동 추출. `reasoning` 필드는 무시됨. 11사이트의 기존 메시지 기반 로직(JSON 파싱, 텍스트 추출)이 그대로 동작. **추가 코드 불필요**.

**계층 2 — 관측 가능성 (선택)**: 디버깅·감사를 위해 reasoning trace를 로깅. `generateText`의 `onFinish` 콜백에서 raw response 접근:
```typescript
const { text } = await generateText({
  model: getLlmFastModel(),
  messages,
  onFinish({ rawResponse }) {
    // PHI 미포함 내부 개발 자료만 — 로컬 로그 안전
    const reasoning = (rawResponse as any)?.choices?.[0]?.message?.reasoning;
    if (reasoning && process.env.LLM_LOG_REASONING === '1') {
      console.debug('[gpt-oss reasoning]', reasoning.slice(0, 500));
    }
  },
});
```
> **PHI 안전**: Regula는 환자 정보 미취급 (내부 개발 제품 자료만). reasoning 로깅은 로컬 파일로 한정, 외부 전송 없음. `LLM_LOG_REASONING` 기본 off.

**계층 3 — 빈 content 폴백 (방어)**: 일부 thinking 모델 설정에서 최종 답변이 `reasoning`에 들어가고 `content`가 빈 문자열이 되는 엣지 케이스. provider 래퍼로 방어:
```typescript
// lib/ai/llm-provider.ts에 추가 (선택)
export function getLlmModelWithReasoningFallback(): LanguageModel {
  const base = getLlmModel();
  // @ai-sdk middleware 패턴: content가 빈 경우 reasoning을 content로 승격
  // 실제 빈 content가 관찰되는 경우에만 활성화
  return base;  // 기본은 래핑 없음 — 계층 1로 충분 확인 후 제거
}
```
> **권장**: 계층 1로 시작. 빈 content가 실제 관찰되면(구현 단계实测) 계층 3 추가. 선행 추측 금지 (L-013).

**구조화 출력 강화 (선택)**: gpt-oss는 `tools` capability 지원. intent-parser/structured-blocks/classifier의 JSON 파싱을 `generateObject` + Zod 스키마로 전환 시, reasoning 없이 구조화된 객체 직접 반환. 기존 프롬프트 기반 JSON 파싱보다 견고. 단, 프롬프트 재튜닝 필요 — Phase B 안에는 포함하지 않고 후속 개선으로 권장.

### 12.4 Phase C — 외부 API 키·의존성 제거

**환경 변수 (lib/env.ts)**:
- `ANTHROPIC_API_KEY` — **제거** (현재 `env.ts:68-71` 필수 스키마 → optional 후 제거)
- `OPENAI_API_KEY` — **제거** (현재 `env.ts:76-78` optional → 제거)
- `GITHUB_MODELS_TOKEN` — **제거** (현재 `env.ts:83-85` optional → 제거)
- `OLLAMA_BASE_URL`, `OLLAMA_MODEL`, `OLLAMA_FAST_MODEL` — **추가** (llm-provider용, optional with gx10 기본값)
- `EMBEDDING_API_KEY` — **추가** (optional, sentinel 폴백 유지). 또는 `EMBEDDING_BASE_URL`/`EMBEDDING_MODEL`만으로 Ollama keyless 운영.

**package.json 의존성 (직검 line 71-73)**:
- `@ai-sdk/anthropic` (`^3.0.74`) — **제거**
- `@anthropic-ai/sdk` (`^0.27.0`) — **제거**
- `@ai-sdk/openai` (`^3.0.58`) — **유지** (llm-provider Ollama 경로 + embedding-provider 모두 `createOpenAI` 사용)
- `ai` — **유지** (`generateText`, `embedMany`, `LanguageModel` 타입)

**검증 (구현 시)**:
```bash
grep -rn "sharedAnthropicClient\|@anthropic-ai/sdk\|new Anthropic\|@ai-sdk/anthropic" lib/ app/ --include='*.ts'
# 결과 0건이어야 함 (타입 전용 import 포함)
```

### 12.5 환경변수 최종 매핑 테이블

| 변수 | 현재 상태 | 최종 (gx10) | 비고 |
|------|-----------|-------------|------|
| `ANTHROPIC_API_KEY` | 필수 (env.ts:68) | **제거** | Phase C |
| `OPENAI_API_KEY` | optional (env.ts:76) | **제거** | Phase C |
| `GITHUB_MODELS_TOKEN` | optional (env.ts:83) | **제거** | Phase A-revised |
| `EMBEDDING_BASE_URL` | optional (env.ts:87) | `http://192.168.100.1:11434/v1` | 기본값 변경 |
| `EMBEDDING_MODEL` | optional (env.ts:88) | `qwen3-embedding:latest` | 기본값 변경, 2880차원 |
| `EMBEDDING_API_KEY` | (없음) | **추가** (optional, sentinel 폴백) | Ollama keyless 대응 |
| `OLLAMA_BASE_URL` | (llm-provider만, `localhost:11434`) | `http://192.168.100.1:11434/v1` | env.ts에 정식 추가 권장 |
| `OLLAMA_MODEL` | (llm-provider만, `llama3.2`) | `gpt-oss:120b` | env.ts에 정식 추가 권장 |
| `OLLAMA_FAST_MODEL` | (llm-provider만) | `gpt-oss:120b` | 동일 모델 |
| `LLM_PROVIDER` | optional, 기본 `ollama` | `ollama` (고정) | openai/anthropic case 제거 |
| `LLM_LOG_REASONING` | (없음) | **추가** (optional, 기본 off) | 계층 2 관측 |
| `COPILOT_GITHUB_TOKEN` | (섹션 11, 미구현) | **추가 안 함** | Copilot 경로 폐기 |

### 12.6 네트워크 / 보안

**토폴로지**:
- gx10 = `192.168.100.1` (2.5G 직결, aarch64 Ubuntu 6.17, driver 580)
- Regula T3610 = `192.168.100.200` (현재 장비, ping 0.9ms 측정)
- 단일 홉: T3610 → gx10 (외부 네트워크 경유 없음)

**Ollama 노출**:
- `OLLAMA_HOST=0.0.0.0:11434` (gx10에서 이미 설정 — 직검 확인)
- 인증 무: 로컬망(192.168.100.x) 신뢰 전제. 외부 인터넷에서 접근 불가 (Cloudflare Tunnel은 Regula T3610 Next.js 앱만 노출, gx10:11434 노출 안 함).

**권장 방화벽 정책**:
- gx10 측: `192.168.100.0/24`에서만 11434 접근 허용 (ufw 또는 nftables). `0.0.0.0` 바인드이므로 망 분리 없으면 같은 L2 누구나 접근 가능 — 로컬망이 신뢰 가능한 홈/사내망인지 확인.
- Regula T3610 측: Cloudflare Tunnel은 443(Next.js)만 노출. gx10:11434는 터널에 등록 안 함 (내부망 전용).

**PHI / 데이터 정책**:
- Regula는 환자 정보 미취급 (내부 개발 제품 자료만 — Charter 준거).
-gx10 Ollama는 요청/응답을 디스크에 영구 저장하지 않음 (KEEP_ALIVE=2h는 메모리 캐시만). ZDR 헤더 불필요 — 온프레미스이므로 외부 전송 자체가 없음.
- 기존 `anthropic-client.ts`의 `zero-data-retention` 헤더는 의미 상소실 (외부 전송 없음) → 삭제.

### 12.7 위험 + 완화

| 위험 | 심각도 | 완화 |
|------|--------|------|
| **gx10 단일 장애점** — Ollama down 시 chat·embedding 전체 마비 | **High** | (1) gx10 Ollama 헬스체크 스크립트 (`GET /v1/models` 주기 호출). (2) 장애 시 사용자에게 런타임 에러 노출 (fallback LLM 없음 — 외부 API 배제 방침상 대안 없음). (3) gx10 재부팅 시 Ollama 자동 시작 (systemd 서비스 등록 권장). |
| **gpt-oss reasoning 파싱** — 빈 content 엣지 케이스 | Medium | 계층 3 폴백 래퍼 (12.3.3). 단, 실제 관찰 시에만 활성화 — 선행 추측 금지 (L-013). |
| **2880차원 pgvector 인덱스 메모리** — hnsw/ivfflat 메모리 증가 (~1.9x) | Medium | 코퍼스가 내부 문서 수십~수백 건 규모 (Charter 6-8명 내부 도구). 메모리 영향 미미. 대규모 확장 시 lists 재튜닝 또는 hnsw `m`/`ef_construction` 조정. |
| **동시성 병목** — `NUM_PARALLEL=2` vs 6-8명 동시 사용자 | Medium | (1) gpt-oss:120b는 116.8B 모델 — GB10 VRAM 제약상 NUM_PARALLEL=2가 안정 한계. (2) 요청 큐잉으로 직렬화 (Ollama가 내부 큐 처리). (3) 지연 시 사용자에게 "처리 중" 스트리밍 표시. (4) 병목 시 gx10에 두 번째 모델 인스턴스 또는 더 작은 fast 모델(qwen3 등) 병행 — 단 품질 저하 명시. |
| **gpt-oss 한국어 RA 도메인 품질 미검증 사이트** — classifier 3-tier 등 | Medium | gpt-oss:120b가 510(k) predicate 질문에 정확한 한국어 답변 검증됨 (직검). 단, classifier 3-tier의 세부 프롬프트는 회귀 테스트 필수 — 품질 열화 시 프롬프트 재튜닝 (Claude→gpt-oss 스타일 차이). |
| **차원 마이그레이션 실패** — 기존 1536 벡터 잔존 | Low | 코퍼스 0행이므로 잔존 데이터 없음. migration 후 `SELECT vector_dims(embedding) FROM <table> LIMIT 1` = 2880 확인 (L-010). |

### 12.8 단계별 롤백 플랜

| Phase | 롤백 대상 | 롤백 절차 |
|-------|-----------|-----------|
| **A-revised** (embedding) | 차원 2880→1536 + GitHub Models 복귀 | (1) migration 되돌리기: `ALTER TABLE ... DROP COLUMN embedding, ADD COLUMN embedding vector(1536)` + 인덱스 재구축. (2) `schema-docingest.ts:36` `vector(2880)` → `vector(1536)`. (3) embedding-provider.ts 기본값 복귀: `models.github.ai/inference` + `text-embedding-3-small`. (4) `GITHUB_MODELS_TOKEN` 재주입. |
| **B-revised** (chat) | gpt-oss → Anthropic 복귀 | (1) 11사이트 `git revert` (파일별 독립). (2) `lib/ai/anthropic-client.ts` 복원 (삭제 전 보존 권장). (3) `ANTHROPIC_API_KEY` 재주입. (4) `@anthropic-ai/sdk`, `@ai-sdk/anthropic` 의존성 복원. |
| **C** (의존성 제거) | 의존성·키 복원 | `package.json`에서 제거한 패키지 재추가. `ANTHROPIC_API_KEY`/`OPENAI_API_KEY` 스키마 복원. |

> **주의**: Phase A-revised 롤백은 차원 축소를 동반하므로, 2880 벡터가 이미 insert된 경우 데이터 손실 발생. 코퍼스 0행 전제이므로 실제로는 영향 없으나, 운영 적용 후에는 롤백 비용이 급증 — A-revised는 신중한 검증 후 적용.

### 12.9 명시적 비목표 (Non-Goals)

1. **hermes 수정 X** — hermes(`~/.hermes/hermes-agent/`)는 참고용 패턴 소스일 뿐, Regula 코드베이스와 무관. hermes 파일 일체 수정 안 함.
2. **환자 데이터 도입 X** — Regula는 내부 개발 제품 자료만 취급 (Charter). PHI 도메인은 별도 #10에서 축소 처리. gx10 백엔드 교체가 PHI 취급을 시작하는 것 아님.
3. **외부 API X** — OpenAI, Anthropic, GitHub Models, GitHub Copilot 전부 배제. 비타협 방침 (월구독·사용량과금 0).
4. **gpt-oss 프롬프트 재튜닝 자동화 X** — 11사이트 마이그레이션 시 프롬프트는 기존 Claude용 그대로 유지. 품질 열화가 관찰되면 개별 사이트에서 수동 튜닝 (자동화된 프롬프트 변환 도구 도입 안 함).
5. **generateObject 전환 X** — intent-parser/structured-blocks의 JSON 파싱을 generateObject+Zod로 전환하지 않음 (12.3.3에서 후속 개선으로만 권장, Phase B 범위 밖).
6. **gx10 클러스터링 X** — 단일 gx10 인스턴스. 다중 노드 분산 추론(high-availability cluster)은 구축 안 함 — 단일 장애점 수용.

---

**문서 끝. 구현은 별도 후속 태스크에서 수행.**
