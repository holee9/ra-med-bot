---
spec_id: SPEC-REGULA-CHAT-001
phase: 2
skill: regula
author: manager-spec
created: 2026-04-22
---

# Research — Regula Phase 2 Chat Core

본 문서는 `SPEC-REGULA-CHAT-001` 작성을 위한 codebase·handoff·skill·의존 SPEC 분석 기록이다. SPEC의 "Why"를 증거 기반으로 뒷받침하고 잘못된 결정이 발생하지 않도록 추적 가능성을 확보한다.

---

## 1. Handoff README 분석 (§11.1 SSE 9 Event Types + 3-Phase Order)

### 1.1 SSE 이벤트 9종 + 종결 2종 = 총 11종 인벤토리

handoff §11.1 line 620–643 원문 분석 결과:

| # | Event type | Phase | Schema 핵심 필드 | 의무/조건 | 비고 |
|---|---|---|---|---|---|
| 1 | `meta` | A (선행) | `conversationId: string`, `messageId: string` | 반드시 최초 1회 | 신규/기존 대화 식별 기준 |
| 2 | `trace` | A | `step: string`, `status: 'active' \| 'done'` | N회 | §9.1 Phase A — 500ms 간격 체감 필수 |
| 3 | `prose_delta` | B | `delta: string` | N회 | token chunk, 내부에 `<sup>` 포함 가능 |
| 4 | `confidence` | C | `level: 'high'\|'med'\|'low'`, `score: number` | 1회 | §8.2 ConfidenceBadge 렌더링 |
| 5 | `sources` | C | `items: Source[]` | 1회 | §8.4 SourceCard 그리드 |
| 6 | `checklist` | C | `items: ChecklistItem[]` | 0~1회 | **Phase 3로 이월** (본 SPEC out of scope) |
| 7 | `comparison` | C | `title, cols, rows` | 0~1회 | **Phase 3로 이월** |
| 8 | `timeline` | C | `items: TimelineItem[]` | 0~1회 | **Phase 3로 이월** |
| 9 | `related` | C | `items: string[]` | 0~1회 | Phase 3 SuggestedFollowups (본 SPEC out of scope) |
| 10 | `expert_review_required` | C | `reason: string` | 조건부 | confidence<0.7 시 발행 (본 SPEC 포함) |
| 11 | `done` | 종결 | `duration_ms: number` | 반드시 마지막 1회 | 정상 종결 |
| 12 | `error` | 종결 | `code: string`, `message: string` | 예외 시 | 에러 종결 |

**SPEC 포함 이벤트 (Phase 2):** `meta`, `trace`, `prose_delta`, `confidence`, `sources`, `expert_review_required`, `done`, `error` — **8종**.

**SPEC 정의만(방출 없음) 이벤트 (Phase 3 reserve):** `checklist`, `comparison`, `timeline`, `related` — **4종**.

이 구분은 TypeScript union 타입 정의는 Phase 2에서 완결(regula-streaming-contract와 일치)하되, 백엔드 emitter는 4종 블록을 방출하지 않는다는 scope discipline을 의미한다. 타입만 정의하고 발행하지 않는 이유는 Phase 3 착수 시 type 변경 없이 emitter만 추가하면 되도록 상호운용성을 미리 고정하기 위함이다.

### 1.2 3단계 순서 강제 (HARD)

handoff §9.1 Chat submission flow + regula-streaming-contract SKILL:

```
Phase A (Trace)    → meta → trace*(N)
Phase B (Prose)    → prose_delta*(M)
Phase C (Structured) → confidence → sources → [expert_review_required?] → done
```

위반 조건:
- `prose_delta` 도달 **이전에** `sources` 또는 `confidence`가 도달 → 클라이언트 throw
- `meta`가 2회 이상 발행 → 중복 오류
- `done` 이전에 다른 종결 이벤트 없이 종료 → hang 감지

백엔드 emitter는 비동기 generator `async function* consult()`가 순서대로 yield하므로 구조적으로 보장된다. 추가 방어로 `StreamOrderValidator` 클래스를 두어 phase tracking (`phase: 'A' | 'B' | 'C' | 'done'`)을 수행한다.

### 1.3 백엔드 파이프라인 8단계 (§11.1 line 646–653)

1. Haiku intent classification (regulation-lookup / strategy / comparison / etc.)
2. Query rewrite (expand acronyms, add synonyms)
3. Hybrid search: vector (pgvector) + FTS, per-corpus retrievers
4. Re-rank (Cohere Rerank or cross-encoder)
5. Prompt composition with strict citation rules
6. Stream from Sonnet 4.5
7. Post-process: citation extraction, confidence, expert-review flag
8. Persist to DB; log to Langfuse

**Phase 2 Minimum Viable scope:**
- Step 1: Haiku intent classification — **포함** (간단한 3-class: regulation-lookup / comparison / general)
- Step 2: Query rewrite — **포함** (단순 acronym 확장만; LLM 호출 없음)
- Step 3: Hybrid search — **포함**, 단 FDA 코퍼스 단일
- Step 4: Re-rank — **제외 (Phase 5)**, cosine similarity + BM25 score로 충분
- Step 5: Prompt composition with citation rules — **포함**
- Step 6: Sonnet 4.5 streaming — **포함**
- Step 7: Post-process — **포함** (citation enforce + confidence 계산 + expert-review gate)
- Step 8: Persist + Langfuse — **persist 포함 / Langfuse 제외 (Phase 5)**

---

## 2. regula-streaming-contract 스킬 분석

### 2.1 `StreamEvent` union 타입 (9+2 event types)

- `MetaEvent`, `TraceEvent`, `ProseDeltaEvent`, `ConfidenceEvent`, `SourcesEvent`, `ChecklistEvent`, `ComparisonEvent`, `TimelineEvent`, `RelatedEvent`, `ExpertReviewRequiredEvent`, `DoneEvent`, `ErrorEvent`

**SPEC가 요구하는 타입 파일:** `types/streaming.ts` — 이 union과 1:1 일치해야 하며, Phase 3에서는 추가/수정 없이 재사용.

### 2.2 `useStreamingAnswer` 훅 시그니처

```ts
interface StreamingState {
  status: 'idle' | 'streaming' | 'done' | 'error';
  traceSteps: TraceEvent[];
  prose: string;
  structured: {
    confidence?: ConfidenceEvent;
    sources?: Source[];
    checklist?: ChecklistItem[];      // Phase 3 reserve
    comparison?: ComparisonEvent;     // Phase 3 reserve
    timeline?: TimelineItem[];        // Phase 3 reserve
    related?: string[];               // Phase 3 reserve
    expertReviewRequired?: ExpertReviewRequiredEvent;
  };
  meta?: MetaEvent;
  duration_ms?: number;
  error: string | null;
}

interface UseStreamingAnswer {
  start: (input: ConsultRequest) => Promise<void>;
  abort: () => void;
  // state getters spread
}
```

**핵심 의무:**
- `AbortController` 기반 cancellation
- SSE buffer가 chunk boundary에서 불완전한 이벤트를 다음 chunk로 이월 (`parseSSEBuffer`)
- `applyEvent` reducer는 switch-case로 12 event types 전부 처리 (4개는 Phase 3 reserve이지만 처리 로직은 선제적으로 구현 — handoff §9.1 Phase C 순서 보장)

### 2.3 Route Handler 기본 구조

```ts
export async function POST(req: Request) {
  const session = await auth();
  if (!session) return new Response(null, { status: 401 });

  const input = ConsultRequestSchema.parse(await req.json());
  await writeAudit({
    actor_id: session.user.id,
    action: 'llm.call',
    resource_type: 'conversation',
    resource_id: conversationId,
    meta_json: { model, question_hash, tokens_in_estimate },
  });

  const stream = new ReadableStream({
    async start(controller) {
      try {
        for await (const event of consult(input, session)) {
          controller.enqueue(encodeSSE(event));
        }
      } catch (e) {
        controller.enqueue(encodeSSE({ type: 'error', ... }));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
```

SSE 헤더 `X-Accel-Buffering: no`는 Vercel edge runtime + nginx 프록시 레이어에서 버퍼링을 금지하므로 필수.

---

## 3. regula-citation-contract 스킬 분석

### 3.1 Citation 마크업 정확한 형식

```html
<sup class="cite" data-source="3" data-offset="1420">3</sup>
```

속성 고정:
- `class="cite"` (정확히 이 값)
- `data-source="N"` — `message_sources.cite_index`와 1:1 일치 (1-based)
- `data-offset="M"` — `source_sections` 기반 문자 offset (선택적이지만 Phase 2에서 DocViewer 딥링크 기능을 위해 **반드시 설정**)
- 텍스트 = N과 동일

### 3.2 3단 방어선

**방어선 1 — System Prompt:**
```
모든 사실 주장(claim)에는 반드시 출처 번호를
<sup class="cite" data-source="N" data-offset="M">N</sup>
형식으로 inline 인용하세요. 출처 없이 주장을 생성하지 마세요.
사용자의 질문에 대한 답을 retrieved 출처에서 찾을 수 없으면
"해당 질문에 대한 공식 출처를 찾을 수 없습니다"라고만 답하세요.
상상으로 규정을 만들지 마세요.
```

**방어선 2 — Retrieved Chunks 주입:**
```
[Source 1: FDA 21 CFR 807.81 (2023) | section_id=abc, offset=1420]
"A device manufacturer must submit a 510(k) notification..."

[Source 2: FDA 21 CFR 820.30 (2023) | section_id=def, offset=3200]
"..."
```

LLM은 source index를 `data-source` 속성에, `offset` hint를 `data-offset` 속성에 써야 함. `section_id`는 system side-channel이며 LLM에게 직접 노출하지 않고 post-processing에서 `data-offset`과 교차 검증.

**방어선 3 — Post-processing `enforceCitations`:**

```ts
export function enforceCitations(
  prose: string,
  availableSources: number[]
): { cleaned: string; violations: Violation[] }
```

검증 로직 (Phase 2 구현):
1. `<sup class="cite">` 태그 parse (DOMParser 또는 htmlparser2)
2. 각 완결 문장(마침표·물음표·느낌표로 종결)이 `<sup>` 태그를 포함하는지 확인
3. `data-source` 값이 availableSources 집합에 존재하는지 확인
4. 위반 분류:
   - **Missing citation (CLAIM_UNCITED):** 완결 문장인데 citation 없음 → flag 후 `<mark class="uncited">…</mark>` wrap, compliance-qa 리포트
   - **Invalid source index (SOURCE_MISMATCH):** `data-source="N"`이 retrieved sources 집합에 없음 → strip
   - **Meta sentence (ALLOW_UNCITED):** "다음은 요약입니다:", "본 답변은…" 같은 transition → 허용 (regex whitelist)

**False positive 방지:**
- Meta sentence whitelist는 bounded regex 집합으로 유지
- "가" 앞의 "으로"로 끝나지 않는 transitional 문장 등 한국어 특수성 고려
- violations 집합이 답변 총 문장의 20% 초과 시 `expert_review_required` 자동 발행

---

## 4. FOUNDATION SPEC 의존성 매핑

SPEC-REGULA-FOUNDATION-001 v0.3.0 기준. 본 Phase 2 SPEC은 FOUNDATION의 다음 REQ-FND에 명시적으로 의존하며 FOUNDATION을 수정하지 않는다.

### 4.1 스키마 의존 (REQ-FND Group D)

| REQ-FND | 의존 컬럼/테이블 | Phase 2 사용처 |
|---|---|---|
| REQ-FND-035 | `conversations` (id, project_id, user_id, title, status, created_at, archived_at) | 대화 생성/조회 |
| REQ-FND-036 | `messages` (id, conversation_id, role, content_prose, confidence_level, confidence_score, duration_ms, expert_review_required, tokens_in, tokens_out, model, created_at) | 메시지 append — **tokens_in/tokens_out/model은 Phase 2에서 채운다 (AUD-018 배경)** |
| REQ-FND-037 | `message_sources` (..., cite_index, quoted_offset, quoted_length) UNIQUE(message_id, cite_index) | citation ground truth 삽입 |
| REQ-FND-038 | `message_blocks` (block_type enum, block_json) | Phase 2에서 `prose` 및 `sources` 두 block_type만 사용. `checklist`/`comparison`/`timeline`/`related`는 Phase 3에서 채운다 |
| REQ-FND-039 | `sources` (..., full_text_tsv, embedding vector(1536)) | hybrid search ground truth |
| REQ-FND-040 | `sources.embedding` ivfflat/hnsw index | vector similarity |
| REQ-FND-044a | `source_sections` (id, source_id, anchor, heading, text, embedding) | chunk-level retrieval + offset 딥링크 |
| REQ-FND-044b | `source_sections.embedding` index | chunk retrieval 가속 |
| REQ-FND-044c | UNIQUE(source_id, anchor) | 딥링크 O(1) lookup |

### 4.2 Audit wiring 의존 (REQ-FND Group E)

| REQ-FND | Phase 2 효과 |
|---|---|
| REQ-FND-048 | `writeAudit(params: AuditEvent)` 헬퍼 signature — Phase 2에서 **최초 call-site 추가** |
| REQ-FND-049 | `action` enum은 Phase 1에서 `'llm.call'`, `'source.access'`, `'expert_review.flag'` 세 값 확정 — Phase 2는 이 enum 값만 사용 |
| REQ-FND-049a | Phase 1은 call-site 0건이었으며, Phase 2에서 RAG 파이프라인에 `llm.call` + `source.access` + `expert_review.flag` wiring 추가 |
| REQ-FND-046/046a/046b | append-only 트리거는 Phase 2의 `writeAudit` 호출에 대해 UPDATE/DELETE/TRUNCATE 차단이 작동함을 보장 — 회귀 테스트는 Phase 1에서 완료 |

### 4.3 환경·라우트·셸 의존 (Group A/B/F)

| REQ-FND | Phase 2 사용처 |
|---|---|
| REQ-FND-007 | `.env.example` — Phase 2에서 `ANTHROPIC_API_KEY`, `COHERE_API_KEY?` (optional Phase 5 대비) 추가 |
| REQ-FND-010a | `lib/env.ts` zod schema — Phase 2에서 `ANTHROPIC_API_KEY: z.string().min(1)` 확장 |
| REQ-FND-013 | `app/(app)/layout.tsx` Sidebar+Topbar — Phase 2는 변경 없음 (Composer는 페이지 레벨) |
| REQ-FND-017 | `app/(app)/chat/page.tsx` 빈 상태 페이지 — Phase 2에서 **재작성** (Composer+AnswerBlock) |
| REQ-FND-051~055 | Auth.js 세션 — `/api/ra/consult`가 `auth()`로 session 확인, 미인증 시 401 |

### 4.4 FOUNDATION 미수정 원칙

Phase 2 SPEC은 FOUNDATION SPEC의 어떤 REQ-FND도 수정·추가·삭제하지 않는다. Phase 2가 FOUNDATION 간섭 없이 이루어지도록 다음 3가지 우회 패턴을 사용:

1. **`.env.example` 추가 변수**: `lib/env.ts`의 schema 확장은 Phase 2 신규 파일 변경으로 간주 (FOUNDATION REQ-FND-010a는 "최소 필수 변수" 세트만 요구; 추가는 허용).
2. **Chat 페이지 재작성**: `app/(app)/chat/page.tsx`는 FOUNDATION에서 "빈 상태 placeholder"로 명시 (REQ-FND-017). Phase 2는 이 파일을 완전히 교체하며 FOUNDATION 요건은 **empty state fallback UI로 여전히 렌더링**하여(메시지 0건 케이스) REQ-FND-017 검증 방법과 호환.
3. **Audit call-site 추가**: REQ-FND-049a가 "Phase 2에서 call-site 추가"를 이미 선언했으므로 FOUNDATION 수정 없이 wiring만 넣는다.

---

## 5. LangChain.js vs Vercel AI SDK 비교

FOUNDATION SPEC v0.3.0 Technical Decisions 표의 Phase 2 기록(P2-1)은 "Phase 2 Kickoff 시점에 `regula-architect`가 최종 결정"한다고 deferred하였다. 본 research는 의사결정 근거를 제시한다.

| 기준 | LangChain.js | Vercel AI SDK (`ai`) |
|---|---|---|
| 의존성 크기 | `@langchain/core` + `@langchain/anthropic` ≈ 2.5 MB | `ai` + `@ai-sdk/anthropic` ≈ 450 KB |
| SSE 지원 | `StreamingTextResponse` (deprecated in v0.3) → 수동 구현 필요 | `streamText()` + `toDataStreamResponse()` 네이티브 |
| Anthropic prompt caching | `ChatAnthropic`에 `extraHeaders` 패스 | `anthropic('claude-sonnet-4-5', { cacheControl: ... })` 네이티브 |
| RAG retrievers 추상화 | 풍부 (`VectorStoreRetriever`, `MultiVectorRetriever` 등) | 없음 (수동 구현) |
| 타입 안정성 | 중간 (`BaseMessage` 등 추상 타입 많음) | 높음 (zod schema 우선 설계) |
| 커뮤니티·레거시 이슈 | v0.3 breaking change 잦음 | Vercel 관리, 안정적 |
| RAG-specific 피처 | `RetrievalQAChain` 등 built-in | 없음 — 직접 조합 |

### 권장 결정 (Phase 2 lock-in 후보)

**선택안: Vercel AI SDK (`ai` + `@ai-sdk/anthropic`) + 수동 retriever 조합**

근거:
1. Next.js 15 App Router + Route Handler와 1급 통합 (Vercel AI SDK는 `Response`+`ReadableStream`을 직접 지원)
2. 의존성 5.5x 경량 — cold start latency (LCP ≤ 2.0s 달성 필요, handoff §15)
3. `streamText()`의 이벤트 훅(`onChunk`, `onFinish`)이 citation post-processing + audit wiring과 자연스럽게 결합
4. LangChain RAG 추상화는 본 Phase에서 필요하지 않음 (retriever는 pgvector SQL 쿼리 한 번으로 충분)
5. Anthropic prompt caching을 system prompt + citation rules + retrieved chunks에 적용하여 반복 호출 비용 절감

**탈락안 사유:**
- LangChain.js v0.3는 2025-2026 사이 여러 breaking change를 기록하여 lock-in 시 기술 부채 위험
- RAG retriever 추상화는 단일 코퍼스 Phase 2에서 overkill
- Phase 5에서 multi-corpus + re-ranker 도입 시 `@langchain/community` 일부 패키지를 옵션으로 차용 가능 (Vercel AI SDK와 공존 가능)

**본 SPEC이 최종 결정하는가?**  
예. 본 SPEC의 Technical Decisions 섹션에서 `Vercel AI SDK + @ai-sdk/anthropic`을 lock-in한다 (TD-1).

---

## 6. pgvector 하이브리드 검색 구현 접근법

### 6.1 하이브리드 검색 = cosine similarity + BM25 (Postgres FTS)

handoff §11.1 line 648: "Hybrid search: vector (pgvector) + FTS, with per-corpus retrievers"

단일 SQL 쿼리로 구현 가능:

```sql
WITH vector_results AS (
  SELECT id, source_id, text, anchor,
         1 - (embedding <=> $1::vector) AS vec_score
  FROM source_sections
  WHERE source_id IN (
    SELECT id FROM sources WHERE org_label = 'FDA'
  )
  ORDER BY embedding <=> $1::vector
  LIMIT 50
),
fts_results AS (
  SELECT id, source_id, text, anchor,
         ts_rank_cd(to_tsvector('english', text), plainto_tsquery('english', $2)) AS fts_score
  FROM source_sections
  WHERE to_tsvector('english', text) @@ plainto_tsquery('english', $2)
    AND source_id IN (SELECT id FROM sources WHERE org_label = 'FDA')
  ORDER BY fts_score DESC
  LIMIT 50
),
combined AS (
  SELECT id, source_id, text, anchor,
         COALESCE(v.vec_score, 0) * 0.6 + COALESCE(f.fts_score, 0) * 0.4 AS score
  FROM vector_results v
  FULL OUTER JOIN fts_results f USING (id, source_id, text, anchor)
)
SELECT * FROM combined ORDER BY score DESC LIMIT 10;
```

가중치 (0.6/0.4)는 Phase 2 초기값이며 Phase 5 Langfuse eval로 튜닝한다.

### 6.2 `source_sections.full_text_tsv` 컬럼은 Phase 2에서 추가?

FOUNDATION spec은 `sources.full_text_tsv`만 정의 (REQ-FND-039). `source_sections`에는 tsvector 컬럼이 **없다**. Phase 2에서 이 컬럼을 추가해야 하는가?

**판단:** 추가하지 않는다. 대신 쿼리 시점에 `to_tsvector('english', text)`를 동적으로 계산한다. 이유:
- `source_sections`는 chunk 단위이므로 tsvector storage cost가 높고 (중복 텍스트)
- PostgreSQL은 expression index (`CREATE INDEX ... ON source_sections USING gin (to_tsvector('english', text))`)를 지원하여 저장 비용 없이 검색 성능 확보 가능
- 이 GIN 인덱스는 Phase 2에서 **새 마이그레이션**으로 추가하며 FOUNDATION 스키마는 수정하지 않는다 (REQ-CHAT에서 독립적으로 명시)

### 6.3 쿼리 rewrite 단계

Phase 2는 LLM 기반 rewrite를 피하고 rule-based로 제한:
- acronym expansion: `510(k)` → `510(k) premarket notification`
- 한국어 → 영어 키워드 혼합 (예: "의료기기 등급" → "의료기기 등급 device classification")
- negation 질의 감지 ("면제"): expert_review keyword match로 분기

LLM 기반 rewrite는 Phase 5 quality improvement로 유보.

---

## 7. FDA 코퍼스 Seed Indexing Scope

handoff §11.10 ingestion admin API는 Phase 1에서도 Phase 2에서도 **구현 대상이 아니다** (Phase 4+). Phase 2에서 필요한 것은 최소한의 FDA 코퍼스 seed data로 RAG가 end-to-end로 동작함을 입증하는 것.

### 7.1 Seed 대상

| Corpus | 섹션 | Chunks 대략치 | Source 등록 |
|---|---|---|---|
| 21 CFR Part 807 (Establishment Registration, 510(k)) | §807.1 ~ §807.100 | 약 150 | 1 row in `sources` |
| 21 CFR Part 820 (Quality System Regulation) | §820.1 ~ §820.250 | 약 300 | 1 row in `sources` |
| 21 CFR Part 814 (PMA) | §814.1 ~ §814.126 | 약 200 | 1 row in `sources` |

Total: 3 sources, 약 650 chunks → pgvector `ivfflat` 인덱스로 충분.

### 7.2 Seed 공급 방법

Phase 2는 ingestion API를 구현하지 않으므로 seed는 일회성 스크립트로 공급:

- `scripts/seed-fda-corpus.ts` — Phase 2 deliverable
- 21 CFR text는 Public Domain (US Federal Government work)이므로 repository에 raw data 포함 가능, 다만 저작권 안전을 위해 URL 기반 fetch 후 해시 검증 방식 채택
- 스크립트는 `pnpm seed:fda` 명령으로 실행

OpenAI `text-embedding-3-small` (1536 dim, REQ-FND-039 column width 일치) 사용. Anthropic은 embedding API를 제공하지 않으므로 OpenAI 또는 Cohere 중 선택 → OpenAI의 가격/품질 기준으로 결정.

### 7.3 `.env.example` 추가 변수

- `OPENAI_API_KEY` (embedding용)
- `ANTHROPIC_API_KEY` (LLM)

`lib/env.ts`의 zod schema 확장 시 이 두 변수를 `z.string().min(1)`로 추가.

---

## 8. Non-Obvious Constraints 적용 매트릭스 (Phase 2)

FOUNDATION spec에서 다루어진 7개 "Non-Obvious Product Constraints" (CLAUDE.md 프로젝트 지시 기반) 중 Phase 2에서 직접 적용되는 제약:

| # | 제약 | FOUNDATION 상태 | Phase 2 상태 | 담당 REQ-CHAT |
|---|---|---|---|---|
| 1 | 모든 LLM claim은 inline citation 필수 | 스키마(`cite_index`) 확보 | **enforcement 구현** | Group C (REQ-CHAT-021~030) |
| 2 | 3단계 SSE 스트리밍 (trace → prose → structured) | - | **구현** | Group A+E |
| 3 | expert-review 자동 플래그 (confidence<0.7) | placeholder column | **로직 구현** | REQ-CHAT-015, REQ-CHAT-056 |
| 4 | Audit logging (21 CFR Part 11) | 트리거·헬퍼 완비 | **call-site wiring** | Group F |
| 5 | Serif/sans 타이포그래피 | 토큰·layout 완비 | Composer·AnswerBlock 내부 적용 | Group D (렌더링) |
| 6 | Korean + English first-class | 토큰·폰트 완비 | locale 파라미터 routing만 | REQ-CHAT-003 |
| 7 | `noindex` 전역 / `/login` 제외 | 메타 완비 | Phase 2 변경 없음 | N/A |

---

## 9. Phase 2 Non-Goals 명시 (handoff 범위 초과 보호)

Phase 2 초안 작성 중 자주 유입될 수 있는 요구사항 중, handoff §20 Phase 2 경계를 벗어나는 것:

- Checklist/ComparisonTable/Timeline 렌더링 → **Phase 3**
- RightContextPanel (§7.4 우측) → Phase 3
- SuggestedFollowups UI → Phase 3
- History 목록 → Phase 4
- Templates / Knowledge Base / Updates / Dashboard → Phase 4
- Expert review UI workflow (티켓 큐) → Phase 5
- Cohere Rerank / cross-encoder → Phase 5
- Langfuse/Sentry/PostHog 관측성 → Phase 5
- i18n locale 런타임 전환 UI → Phase 5
- Playwright e2e 테스트 → Phase 6
- LLM eval harness (promptfoo) → Phase 6
- `POST /api/admin/ingest/*` → Phase 4+
- 파일 첨부 기능 (§7.4 "파일 첨부" 칩) → Phase 4 (Phase 2는 UI 칩만 disabled 상태로)

---

## 10. 위험 인벤토리

| 위험 | 영향 | 완화책 | REQ-CHAT |
|---|---|---|---|
| Citation post-processing false positive (정상 meta 문장 strip) | 답변 품질 저하 | Whitelist regex + 20% 위반율 상한 | REQ-CHAT-029 |
| SSE event 순서 concurrency 이슈 | 클라이언트 hang | 백엔드: `async function*` sequential yield. 프론트: `StreamOrderValidator` phase tracking | REQ-CHAT-010 |
| pgvector 검색 지연 P95 > 500ms | First token latency 초과 | ivfflat 인덱스 + `lists` 튜닝 + 검색 전 pre-filter로 corpus 제한 | REQ-CHAT-018, REQ-CHAT-059 |
| Anthropic rate limit 초과 | 503 returned | 사용자별 rate limit (30 req/min) + backoff on 429 | REQ-CHAT-007 |
| Sonnet 토큰 상한 초과 (chunk context) | truncation | retrieved chunks 토큰 카운트 + top-K 제한 (K=8, ~4K tokens) | REQ-CHAT-019 |
| 한국어 질문 + 영어 코퍼스 mismatch | retrieval quality 저하 | query rewrite에 한-영 키워드 혼합 | REQ-CHAT-017 |
| `data-source`/`cite_index` 불일치 | citation 클릭 시 잘못된 소스 열림 | DB insert와 HTML emission을 동일 ordered list에서 생성 | REQ-CHAT-023 |
| DocViewer `#source=N&offset=M` 스크롤 실패 | UX 파손 | `source_sections.anchor`로 결정론적 scrollIntoView | REQ-CHAT-043 |
| `abort()` 미호출로 dangling SSE connection | 서버 리소스 누수 | React `useEffect` cleanup + Route Handler `request.signal.aborted` 체크 | REQ-CHAT-049 |

---

## 11. 이전 Phase의 audit outcomes 참조

FOUNDATION SPEC의 `audit-001-response.md`, `audit-001.md`, `audit-002.md`에서 Phase 2 착수 시 유의해야 할 사항:

- `AUDN2-003` (Foundation): REQ-FND-049 Phase 2 wording "wires existing call-sites vs adds new enum values"이 확정되었으므로, Phase 2 SPEC의 audit wiring 요구사항은 **enum 추가 없이 call-site wiring만** 수행해야 함
- `AUD-017` (Foundation): Phase 2가 `llm.call`·`source.access` call-site의 최초 책임자. Phase 1은 helper signature만 준비.
- `AUD-018` (Foundation): Phase 2는 `messages.tokens_in`·`tokens_out`·`model` 컬럼을 **반드시 채운다** (Phase 4 Dashboard 전제).

---

## 12. Deliverables 매니페스트 사전 정의

Phase 2 SPEC이 생성할 산출물 (spec.md Deliverables 섹션과 1:1 일치):

### 신규 파일 (21개)

Route Handlers + AI Pipeline:
- `app/api/ra/consult/route.ts`
- `app/api/ra/sources/[id]/route.ts`
- `lib/ai/consult.ts`
- `lib/ai/intent.ts`
- `lib/ai/query-rewrite.ts`
- `lib/ai/retrievers/fda.ts`
- `lib/ai/retrievers/hybrid-search.ts`
- `lib/ai/prompt-templates.ts`
- `lib/ai/citation-enforce.ts`
- `lib/ai/confidence.ts`
- `lib/ai/streaming.ts`
- `lib/ai/persistence.ts`

Types + Hooks:
- `types/streaming.ts`
- `types/consult.ts`
- `hooks/useStreamingAnswer.ts`
- `hooks/useDocViewer.ts`

Components:
- `components/chat/Composer.tsx`
- `components/chat/Thinking.tsx`
- `components/chat/AnswerBlock.tsx`
- `components/chat/Citation.tsx`
- `components/chat/SourcesGrid.tsx`
- `components/chat/ConfidenceBadge.tsx`
- `components/chat/SourceCard.tsx`
- `components/doc/DocViewer.tsx`

Scripts + Migrations:
- `scripts/seed-fda-corpus.ts`
- `migrations/0002_chat_indexes.sql` (source_sections FTS GIN 인덱스)

### 수정 파일 (3개, FOUNDATION 건드리지 않음)

- `app/(app)/chat/page.tsx` — Phase 1 placeholder → Composer+AnswerBlock 통합
- `lib/env.ts` — Phase 1 zod schema 확장 (`ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `ANTHROPIC_PROMPT_CACHE_ENABLED?`)
- `.env.example` — Phase 2 필수 변수 추가

### 의존성 추가 (pnpm)

- `ai` (Vercel AI SDK)
- `@ai-sdk/anthropic`
- `openai` (embedding API 클라이언트; Anthropic은 embedding 미제공)
- `react-markdown`
- `rehype-raw`
- `rehype-sanitize` (`sup.cite` allow list 설정)
- `htmlparser2` (citation post-processing)
- `pgvector` (Drizzle-호환 SQL helper; 단, raw SQL로 커버 가능하면 제거)

---

## 13. 다음 Phase Handoff 포인트 (Phase 3 Structured outputs로의 인터페이스)

Phase 2의 설계는 Phase 3 착수 시 **타입 변경 없이 emitter 확장만으로** checklist/comparison/timeline/related 블록을 추가할 수 있게 한다:

1. `types/streaming.ts` 에 12 event types 전부 정의 (Phase 3 reserve 포함)
2. `hooks/useStreamingAnswer.ts`의 `applyEvent` switch-case에 12 types 모두 처리
3. `components/chat/AnswerBlock.tsx` 구조는 §8.3의 14단 구성(1~14)을 따르되, Phase 2는 1/2/3/4/11/12단만 렌더링. Phase 3는 5~10/13/14단 추가.
4. `lib/ai/consult.ts`의 emitter generator는 Phase 2에서 block type들을 yield 하지 않지만, Phase 3에서 추가 yield만 넣으면 호환.
5. `message_blocks` 테이블의 `block_type` enum은 Phase 1에서 6개 값 모두 확정 (FOUNDATION REQ-FND-038). Phase 2에서 `prose`, `sources`만 insert. Phase 3는 나머지 4개 insert.

Phase 3 SPEC은 Phase 2의 다음 파일을 **변경할 것으로 예상된다** (미리 알림, Phase 2 설계 시 예상):
- `components/chat/AnswerBlock.tsx` — 섹션 추가
- `lib/ai/consult.ts` — Phase C 블록 emitter 확장
- `lib/ai/prompt-templates.ts` — structured output instruction 추가

변경되지 **않을** 파일 (안정성 보장):
- `types/streaming.ts`
- `hooks/useStreamingAnswer.ts`
- `lib/ai/citation-enforce.ts`
- `lib/ai/streaming.ts`
- `app/api/ra/consult/route.ts`

---

## 14. 완료 기준 재확인

- [x] §11.1 9 event types (+ `done`/`error`) 분석 완료
- [x] `useStreamingAnswer` hook signature 확인
- [x] Citation contract 3단 방어선 정리
- [x] FOUNDATION 의존 REQ-FND ID 매핑
- [x] LangChain.js vs Vercel AI SDK 결정 — **Vercel AI SDK lock-in 권장**
- [x] Hybrid search SQL 접근법 확정
- [x] FDA seed 코퍼스 scope 결정 (3 sources, ~650 chunks)
- [x] Non-Obvious Constraints 매트릭스 적용
- [x] Deliverables 매니페스트 사전 정의 (21 신규 + 3 수정)
- [x] Phase 3 handoff 포인트 명시

본 research를 기반으로 spec.md에서 REQ-CHAT-001 ~ REQ-CHAT-060 EARS 요구사항을 기술한다.
