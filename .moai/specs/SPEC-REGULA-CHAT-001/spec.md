---
id: SPEC-REGULA-CHAT-001
title: Regula Phase 2 Chat Core — SSE 스트리밍 RAG 파이프라인, Citation 강제, Composer/AnswerBlock/DocViewer
status: draft
created: 2026-04-22
updated: 2026-04-23
author: manager-spec
phase: 2
skill: regula
version: 0.2.0
priority: High
revision_history:
  - version: 0.1.0
    date: 2026-04-22
    author: manager-spec
    notes: |
      Initial draft. 60 REQ-CHAT across 7 groups (A: SSE Route Handler,
      B: RAG pipeline, C: Citation contract, D: Frontend components,
      E: useStreamingAnswer hook, F: Audit wiring, G: Performance).
      6 technical decisions (Vercel AI SDK locked-in, Anthropic prompt
      caching, hybrid cosine+BM25 retrieval, no reranker in Phase 2,
      SSE transport, OpenAI text-embedding-3-small). Depends on
      SPEC-REGULA-FOUNDATION-001 v0.3.0 schema/audit/env primitives.
  - version: 0.2.0
    date: 2026-04-23
    author: manager-spec (iteration via cross-spec-audit Critical patch)
    notes: |
      Applied cross-spec-audit Critical findings C1, C7:
      * C1 — expert_reviews enqueue 오너십 분리: REQ-CHAT-055 재작성. CHAT
        Phase 2는 `expert_review_required` SSE event 발행 + `writeAudit(
        action:'expert_review.flag')` call-site까지만 담당. `expert_reviews`
        row INSERT는 Phase 5 ENTERPRISE REQ-ENTERPRISE-009 `enqueueExpertReview`
        전담. 이로써 "double-insert or missed-insert" 레이스 위험 제거.
      * C7 — `messages.meta_json` 컬럼 스키마 확정: REQ-CHAT-028 spec.md L346의
        "RUN phase 결정" 문구 제거. FOUNDATION v0.4.0 REQ-FND-036 컬럼에 meta_json
        jsonb가 선제 선언됨에 따라 CHAT Phase 2는 해당 컬럼을 directly 사용하며,
        `message_meta` 보조 테이블 폴백 계획은 폐기. `migrations/0002_chat_indexes.sql`
        는 FTS GIN 인덱스만 포함.
      Depends on SPEC-REGULA-FOUNDATION-001 v0.4.0 (audit_action pgEnum +
      messages.meta_json column). REQ ID 재배치 없음, 신규 REQ 없음.
related_handoff_sections:
  - "§7.4"
  - "§8.1"
  - "§8.2"
  - "§8.3"
  - "§8.4"
  - "§9.1"
  - "§9.2"
  - "§10.3"
  - "§11.1"
  - "§11.5"
  - "§15"
depends_on:
  - SPEC-REGULA-FOUNDATION-001 (v0.4.0+)
---

# SPEC-REGULA-CHAT-001 — Regula Phase 2 Chat Core

## 목적 (Purpose)

Regula의 핵심 상호작용 경로인 **RA 전문가 채팅 상담**을 end-to-end로 가동한다. FOUNDATION Phase 1이 수립한 스캐폴딩·스키마·감사 프리미티브 위에, **SSE 3단계 스트리밍**(trace → prose → structured), **citation 강제**, **Composer/Thinking/AnswerBlock/DocViewer 컴포넌트**, **FDA 단일 코퍼스 RAG 파이프라인**, **Audit call-site wiring**, **expert-review 자동 게이팅**을 구현한다. 본 Phase는 handoff §20 Phase 2 "Chat core" 블록 범위를 엄격히 따르며, 구조화 블록(checklist/comparison/timeline/related) 렌더링, RightContextPanel, History 등은 **Out of Scope**.

본 SPEC의 성공 기준은:
1. 사용자가 `/chat`에서 질문 제출 시 1.5초 이내 첫 토큰 도달 (§15)
2. 모든 claim에 inline citation 부착 (post-processing 이후 coverage 100%)
3. Citation 클릭 시 `#source=N&offset=M` 딥링크로 DocViewer 정확한 문단 스크롤
4. 모든 LLM 호출·source 접근이 `audit_logs`에 append-only 기록 (21 CFR Part 11)
5. Confidence < 0.7 시 `expert_review_required` SSE 이벤트 자동 발행

---

## 범위 (Scope)

### In Scope

| 구분 | 산출물 |
|---|---|
| SSE Route Handler | `app/api/ra/consult/route.ts` (POST, text/event-stream, auth-protected) |
| 소스 조회 API | `app/api/ra/sources/[id]/route.ts` (GET, `?offset=N` 지원) |
| RAG 파이프라인 엔트리 | `lib/ai/consult.ts` (async generator yielding `StreamEvent`) |
| Intent classification | `lib/ai/intent.ts` (Haiku 3-class 분류기) |
| Query rewrite | `lib/ai/query-rewrite.ts` (rule-based acronym 확장, 한-영 혼합) |
| FDA retriever | `lib/ai/retrievers/fda.ts` (FDA 코퍼스 전용 pre-filter 래퍼) |
| Hybrid search | `lib/ai/retrievers/hybrid-search.ts` (pgvector cosine + Postgres FTS) |
| Prompt composition | `lib/ai/prompt-templates.ts` (citation 강제 system prompt + chunk injection) |
| Citation 후처리 | `lib/ai/citation-enforce.ts` (uncited claim strip/flag, violations 리포트) |
| Confidence 계산 | `lib/ai/confidence.ts` (chunk score + citation coverage 기반 0.0~1.0) |
| SSE emitter | `lib/ai/streaming.ts` (3-phase order validator + encoder) |
| 영속화 | `lib/ai/persistence.ts` (messages + message_sources + message_blocks insert, tokens_in/out/model 채움) |
| 공유 타입 | `types/streaming.ts` (12 event types), `types/consult.ts` (ConsultRequest zod) |
| 스트리밍 훅 | `hooks/useStreamingAnswer.ts` (AbortController, parseSSEBuffer, applyEvent) |
| DocViewer 훅 | `hooks/useDocViewer.ts` (open/close, source fetch, offset scroll) |
| Composer | `components/chat/Composer.tsx` (textarea autosize, source filter chips, submit) |
| Thinking | `components/chat/Thinking.tsx` (trace step renderer, 700ms 간격 체감) |
| AnswerBlock | `components/chat/AnswerBlock.tsx` (meta/expert callout/prose/sources만 Phase 2) |
| Citation | `components/chat/Citation.tsx` (`<sup class="cite" data-source data-offset>`) |
| SourcesGrid | `components/chat/SourcesGrid.tsx` (240px min cards, 8.4 SourceCard) |
| SourceCard | `components/chat/SourceCard.tsx` (§8.4 정확한 컴포넌트) |
| ConfidenceBadge | `components/chat/ConfidenceBadge.tsx` (§8.2 high/med/low) |
| DocViewer | `components/doc/DocViewer.tsx` (모달, amber underline highlight, 딥링크 스크롤) |
| Chat 페이지 교체 | `app/(app)/chat/page.tsx` (FOUNDATION placeholder → Composer + AnswerBlock 통합; 메시지 0건은 empty state로 fallback) |
| Env schema 확장 | `lib/env.ts`에 `ANTHROPIC_API_KEY`, `OPENAI_API_KEY` 추가 |
| Env example 추가 | `.env.example`에 신규 키 추가 |
| Seed 스크립트 | `scripts/seed-fda-corpus.ts` (21 CFR Part 807/820/814, 3 sources, ~650 chunks) |
| 추가 마이그레이션 | `migrations/0002_chat_indexes.sql` (source_sections FTS GIN 인덱스) |
| Audit call-sites | `consult.ts`에 `llm.call`, `source.access`, `expert_review.flag` 3종 wiring |

### Out of Scope

아래 항목은 후속 Phase에서 처리하며, 본 SPEC에서는 **의도적으로 구현하지 않는다**. SSE 타입 정의는 유지하되 emitter는 yield하지 않는 패턴으로 Phase 3 호환성을 확보한다.

| 항목 | 해당 Phase | 사유 |
|---|---|---|
| Checklist/ComparisonTable/Timeline 구조화 블록 렌더링 | Phase 3 | handoff §20 Phase 3 "Structured outputs" |
| `checklist`/`comparison`/`timeline`/`related` SSE 이벤트 **방출** | Phase 3 | 타입 정의만 Phase 2, emitter는 Phase 3 |
| RightContextPanel (§7.4 우측) | Phase 3 | 현재 프로젝트·활용 출처·규제 업데이트 컨텍스트 |
| SuggestedFollowups UI (§8.10 SuggestionPill 그리드) | Phase 3 | related 이벤트에 의존 |
| History 페이지 (`/history`) | Phase 4 | handoff §7.5 |
| Templates / Knowledge Base / Updates / Dashboard 페이지 | Phase 4 | handoff §7.6–§7.9 |
| Expert review 워크플로우 UI (티켓 큐, 할당, 해결) | Phase 5 | handoff §9.3 Manual flow |
| `POST /api/ra/expert-review` 엔드포인트 | Phase 5 | `expert_review_required` SSE event 자동 발행 + audit flag call-site만 Phase 2 담당 (v0.2.0 C1). Row INSERT(`enqueueExpertReview`) 및 수동 제출 API는 Phase 5 ENTERPRISE REQ-ENTERPRISE-009 전담 |
| `expert_reviews` row INSERT 실행 | Phase 5 | v0.2.0 C1 오너십 분리 — CHAT은 event+audit, ENTERPRISE는 row INSERT (double-insert race 방지) |
| Expert review `status` 전이 (`pending` → `in_progress` → `resolved`) | Phase 5 | writeAudit 액션 `expert_review.resolve`는 Phase 5에서 enum 추가 |
| Cohere Rerank / cross-encoder | Phase 5 | cosine + BM25 하이브리드로 MVP 충분 |
| Multi-corpus (EU MDR, MFDS, NMPA, PMDA, 사내 SOP) | Phase 4+ | Phase 2는 FDA 단일 |
| Ingestion API (`/api/admin/ingest/*`) | Phase 4+ | seed 스크립트로만 공급 |
| 파일 첨부 기능 | Phase 4 | Composer UI 칩은 disabled 상태로 표시 |
| Feedback (thumb up/down, `POST /api/ra/conversations/[id]/feedback`) | Phase 4 | meta row 버튼은 disabled |
| `GET /api/ra/conversations` 목록 조회 | Phase 4 | `invalidateConversationList` 훅만 Phase 2에 placeholder |
| Langfuse/Sentry/PostHog 관측성 wiring | Phase 5 | 전용 관측성 블록 |
| i18n locale 런타임 전환 UI | Phase 5 | `locale` 파라미터만 Phase 2에서 routing |
| Playwright e2e 테스트 | Phase 6 | Vitest 단위/통합 테스트만 Phase 2 |
| LLM eval harness (promptfoo) | Phase 6 | Phase 6 quality |
| Streaming markdown 렌더링 중 `<sup>` 태그 sanitize 정책 수정 (rehype-sanitize allow list) | Phase 2 내부 구현 결정 (SPEC 미열거) | citation 계약이 요구하므로 allow list 추가는 필수 |
| Redis/memcached 기반 rate limit | Post-launch | Phase 2는 in-memory token bucket + 사용자별 DB row lock |

### 경계 명시 — SSE 이벤트 타입 vs 방출

| 이벤트 type | `types/streaming.ts` 정의 | `lib/ai/consult.ts` 방출 | 프론트 `applyEvent` 처리 |
|---|---|---|---|
| `meta` | Phase 2 | Phase 2 | Phase 2 |
| `trace` | Phase 2 | Phase 2 | Phase 2 |
| `prose_delta` | Phase 2 | Phase 2 | Phase 2 |
| `confidence` | Phase 2 | Phase 2 | Phase 2 |
| `sources` | Phase 2 | Phase 2 | Phase 2 |
| `expert_review_required` | Phase 2 | Phase 2 | Phase 2 |
| `done` | Phase 2 | Phase 2 | Phase 2 |
| `error` | Phase 2 | Phase 2 | Phase 2 |
| `checklist` | **Phase 2 (reserve)** | Phase 3 | **Phase 2 (no-op reducer)** |
| `comparison` | **Phase 2 (reserve)** | Phase 3 | **Phase 2 (no-op reducer)** |
| `timeline` | **Phase 2 (reserve)** | Phase 3 | **Phase 2 (no-op reducer)** |
| `related` | **Phase 2 (reserve)** | Phase 3 | **Phase 2 (no-op reducer)** |

근거: Phase 3 착수 시 타입 변경 없이 emitter만 추가. regula-streaming-contract SKILL의 union은 12 types 전체이므로 Phase 2부터 일관성 유지.

---

## 기술 결정 (Technical Decisions)

본 SPEC은 handoff §11.1 + FOUNDATION v0.3.0의 Phase 2 기록(P2-1)을 다음과 같이 **확정**한다.

| # | 결정 항목 | 선택 | 탈락안 | 근거 | 재평가 조건 |
|---|---|---|---|---|---|
| TD-1 | LLM Orchestration | **Vercel AI SDK (`ai` + `@ai-sdk/anthropic`)** | LangChain.js v0.3 | 의존성 ≈ 5.5x 경량 (LCP 2.0s 목표), Next.js 15 Route Handler 네이티브, Anthropic prompt caching 네이티브, v0.3 breaking change 리스크 회피 (research §5) | Phase 5에서 multi-corpus + reranker 도입 시 `@langchain/community` 일부 차용 검토 |
| TD-2 | Anthropic Prompt Caching | **활성화** (system prompt + citation rules + retrieved chunks) | 비활성 | 반복 호출 비용 절감, 첫 토큰 latency 개선 (cache hit 시 최대 90% 감소) | 캐시 invalidation 버그 발견 시 비활성화 후 재평가 |
| TD-3 | Retrieval 방식 | **pgvector cosine similarity + Postgres FTS BM25 하이브리드** | dense only / sparse only | 규제 문서는 키워드 정확성 중요 (예: "510(k)" 정확 매치), 가중치 0.6 vec + 0.4 fts (Phase 5 튜닝) | Phase 5 Langfuse eval로 가중치 재조정 |
| TD-4 | Reranker | **없음 (Phase 5로 이월)** | 즉시 도입 (Cohere/cross-encoder) | Phase 2 MVP 복잡도 관리, 하이브리드 스코어로 충분한 recall 확보, 추가 외부 API 의존성 회피 | Phase 5에서 retrieval precision@10 < 0.7 확인 시 Cohere Rerank 도입 |
| TD-5 | 스트리밍 Transport | **Server-Sent Events (SSE)** | WebSocket / long-polling | handoff §11.1 강제, 단방향 server → client로 충분, Vercel edge runtime 호환, 프록시/CORS 단순 | N/A (handoff 규정) |
| TD-6 | Embedding Provider | **OpenAI `text-embedding-3-small` (1536 dim)** | Cohere embed / Voyage | REQ-FND-039 `vector(1536)` 컬럼 폭과 일치, 가격/품질 balance, Anthropic은 embedding 미제공이므로 별도 API 필요 | Data residency 이슈(EU 고객)로 OpenAI EU region 사용 불가 시 Cohere EU endpoint 재검토 |

### Phase 3+ 기록 (Phase 2에서 실행 불필요, 참고용)

| # | 결정 항목 | 후보 | 확정 시점 |
|---|---|---|---|
| P3-1 | Structured block generation 방식 | Anthropic tool_use vs 별도 Haiku call | Phase 3 Kickoff |
| P5-1 | Reranker 도입 | Cohere Rerank v3 vs cross-encoder MiniLM | Phase 5 Kickoff |
| P5-2 | Langfuse vs custom trace | Langfuse SaaS vs self-host | Phase 5 Kickoff |

---

## EARS 인수 기준 (Acceptance Criteria)

모든 요구사항은 `REQ-CHAT-NNN` ID로 식별하며, EARS 5개 패턴 중 적절한 형태로 기술한다. **총 60개 REQ-CHAT**를 7개 그룹으로 구성.

**요구사항 그룹 개요:**
- Group A: SSE Route Handler (REQ-CHAT-001 ~ REQ-CHAT-010) — 10개
- Group B: RAG Pipeline (REQ-CHAT-011 ~ REQ-CHAT-020) — 10개
- Group C: Citation Contract (REQ-CHAT-021 ~ REQ-CHAT-030) — 10개
- Group D: Frontend Components (REQ-CHAT-031 ~ REQ-CHAT-045) — 15개
- Group E: useStreamingAnswer Hook (REQ-CHAT-046 ~ REQ-CHAT-052) — 7개
- Group F: Audit Wiring (REQ-CHAT-053 ~ REQ-CHAT-056) — 4개
- Group G: Performance (REQ-CHAT-057 ~ REQ-CHAT-060) — 4개

---

### Group A: SSE Route Handler (REQ-CHAT-001 ~ REQ-CHAT-010)

#### REQ-CHAT-001 (Ubiquitous)
**요구사항:** The system SHALL expose a Next.js 15 Route Handler at `app/api/ra/consult/route.ts` that accepts only `POST` requests and returns a `Response` with `Content-Type: text/event-stream`.
**근거:** handoff §11.1 line 606 "POST /api/ra/consult (streaming)".
**검증 방법:** `curl -X GET /api/ra/consult` → 405 Method Not Allowed. `curl -X POST ...` → 200 with `Content-Type: text/event-stream` header.

#### REQ-CHAT-002 (State-driven)
**요구사항:** WHILE the incoming request lacks a valid Auth.js session cookie, the system SHALL respond with HTTP 401 and SHALL NOT open an SSE stream.
**근거:** handoff §11 "Auth via session cookie (Auth.js)" + FOUNDATION REQ-FND-053 middleware.
**검증 방법:** Session cookie 제거 후 `curl -X POST /api/ra/consult` → 401. Vitest 통합 테스트에서 `await auth()` 모킹으로 null 반환 시 401 응답 확인.

#### REQ-CHAT-003 (Ubiquitous)
**요구사항:** The Route Handler SHALL validate the JSON request body against a Zod schema `ConsultRequestSchema` defined in `types/consult.ts` with fields `{ question: string (1~4000 chars), conversationId?: uuid, projectId?: uuid, sourceFilter: 'all'|'regs'|'internal' (default 'all'), attachments?: Array<{fileId: uuid}>, locale: 'ko'|'en' (default 'ko') }`. Invalid requests SHALL return HTTP 400 with a ZodError payload.
**근거:** handoff §11.1 Request schema + regula-streaming-contract `ConsultRequestSchema`.
**검증 방법:** `question: ''` → 400. `question: 'x'.repeat(5000)` → 400. `locale: 'ja'` → 400. Valid request → 200.

#### REQ-CHAT-004 (Ubiquitous)
**요구사항:** The Route Handler response SHALL include the headers `Content-Type: text/event-stream`, `Cache-Control: no-cache, no-transform`, `Connection: keep-alive`, and `X-Accel-Buffering: no` to prevent Vercel edge/nginx proxy buffering.
**근거:** regula-streaming-contract SKILL line 176–181.
**검증 방법:** 응답 헤더 전수 확인. Playwright 또는 `curl -I` 로 4개 헤더 값 전부 일치 확인.

#### REQ-CHAT-005 (Event-driven)
**요구사항:** WHEN the Route Handler receives a valid request, THEN the system SHALL emit exactly one `meta` event as the **first** event on the stream, with `{ type: 'meta', conversationId, messageId }`. IF `conversationId` is absent in the request, THEN the system SHALL insert a new `conversations` row and use its `id`.
**근거:** handoff §11.1 line 622 "Conversation metadata (first)".
**검증 방법:** 새 conversation 요청 시 응답 첫 chunk가 `data: {"type":"meta","conversationId":"<new-uuid>","messageId":"<new-uuid>"}\n\n` 확인. 기존 conversationId 지정 시 해당 값 echo.

#### REQ-CHAT-006 (Unwanted)
**요구사항:** The system SHALL NOT emit any structured event (`confidence`, `sources`, `expert_review_required`, `done`) before the final `prose_delta` event is emitted. Phase C events MUST follow the last `prose_delta`.
**근거:** regula-streaming-contract SKILL 3-phase order + handoff §9.1 Phase A/B/C.
**검증 방법:** Vitest 통합 테스트에서 수집한 이벤트 시퀀스에 대해 `indexOf('sources') > lastIndexOf('prose_delta')` 및 동일 assertion을 `confidence`·`done`에도 적용. 순서 위반 시 `StreamOrderValidator`가 에러 throw.

#### REQ-CHAT-007 (Event-driven)
**요구사항:** WHEN a user exceeds 30 consult requests within 60 seconds (per user_id), THEN the system SHALL respond with HTTP 429 and SHALL NOT open an SSE stream. The rate limit SHALL be enforced via an in-memory token bucket keyed by `session.user.id`.
**근거:** handoff §11 + §16 "Auth-wall / rate limit" + OWASP A05.
**검증 방법:** Vitest에서 31회 연속 요청 시 31번째가 429 반환 확인. 60초 후 재요청 시 복구 확인.

#### REQ-CHAT-008 (Event-driven) [HARD]
**요구사항:** WHEN the `consult()` generator throws any exception, THEN the Route Handler SHALL catch it, emit exactly one `error` event (`{ type: 'error', code, message }`) with a user-safe `message` (no stack traces), and close the stream controller. The caught exception details SHALL be logged to `console.error` (Phase 5에서 Sentry 교체).
**근거:** handoff §11.1 line 642 + 보안 정보 노출 방지.
**검증 방법:** Mock `consult()` throw 시 응답에 `data: {"type":"error","code":"llm_failure","message":"Internal error"}\n\n` 정확히 1회 포함. stack trace 노출 없음 확인.

#### REQ-CHAT-009 (Event-driven)
**요구사항:** WHEN the `consult()` generator completes normally, THEN the Route Handler SHALL emit exactly one `done` event (`{ type: 'done', duration_ms: number }`) measuring wall-clock time from request receipt to final emission, as the **last** event before stream close.
**근거:** handoff §11.1 line 641 + §15 Performance 측정.
**검증 방법:** 정상 응답의 마지막 chunk가 `done` 이벤트임을 확인. `duration_ms` > 0 확인.

#### REQ-CHAT-010 (State-driven)
**요구사항:** WHILE the SSE connection is open, IF the client aborts (abort signal), THEN the Route Handler SHALL detect `request.signal.aborted === true`, stop yielding further events, close the stream, and SHALL NOT persist an incomplete `messages` row (rollback via `ON CONFLICT DO NOTHING` or transaction abort).
**근거:** handoff §10.3 "Manages SSE connection with abort controller" + 리소스 누수 방지.
**검증 방법:** Vitest에서 `AbortController.abort()` 후 서버 측 async generator가 3초 이내 종료되는지 확인. 해당 요청의 `messages` row가 DB에 **없음** 확인 (rollback).

---

### Group B: RAG Pipeline (REQ-CHAT-011 ~ REQ-CHAT-020)

#### REQ-CHAT-011 (Ubiquitous)
**요구사항:** The system SHALL expose `consult(input: ConsultRequest, session: Session): AsyncGenerator<StreamEvent>` from `lib/ai/consult.ts` as the single entry point for the RAG pipeline. The generator SHALL yield events in the 3-phase order enforced by `StreamOrderValidator`.
**근거:** regula-streaming-contract SKILL + research §2.
**검증 방법:** 함수 시그니처 타입 체크 + Vitest에서 `for await (const ev of consult(...)) { ... }` 루프 후 수집된 이벤트 순서 검증.

#### REQ-CHAT-012 (Event-driven)
**요구사항:** WHEN `consult()` starts, THEN the system SHALL invoke `classifyIntent(question, locale)` from `lib/ai/intent.ts` using Haiku (model: `claude-haiku-4-5` 또는 동등 버전) with max_tokens=50, returning one of `{ 'regulation-lookup', 'comparison', 'general' }`. The result SHALL yield a `trace` event with `step: '질의 유형 분류 중'` status transitioning `'active' → 'done'`.
**근거:** handoff §11.1 line 646 "Classify intent with Haiku" + §9.1 Phase A trace.
**검증 방법:** Vitest에서 "510(k)가 뭐야" → `regulation-lookup`, "FDA와 EU MDR 차이는?" → `comparison`, "안녕하세요" → `general` 반환 확인.

#### REQ-CHAT-013 (Ubiquitous)
**요구사항:** The system SHALL perform rule-based query rewrite via `rewriteQuery(question, locale, intent)` from `lib/ai/query-rewrite.ts`. The function SHALL (a) expand known acronyms (`510(k)` → `510(k) premarket notification`; `QSR` → `QSR quality system regulation`; at least 20 acronyms for FDA corpus), (b) if `locale='ko'`, append Korean-English mixed keywords (예: "의료기기 등급" → "의료기기 등급 device classification medical device class"), (c) return the rewritten query as a single string. No LLM call is performed in Phase 2.
**근거:** handoff §11.1 line 647 + research §6.3.
**검증 방법:** Vitest 유닛 테스트에서 "510(k) 제출 기한은?" → "510(k) premarket notification 제출 기한은? submission deadline" 등 20개 패턴 assertion.

#### REQ-CHAT-014 (Event-driven)
**요구사항:** WHEN query rewrite completes, THEN the system SHALL invoke `hybridSearch(rewrittenQuery, corpus, k=10)` from `lib/ai/retrievers/hybrid-search.ts` returning an ordered array of `RetrievedChunk` objects with fields `{ sectionId, sourceId, anchor, text, offset, vec_score, fts_score, combined_score }`. The score formula SHALL be `combined_score = 0.6 * vec_score + 0.4 * fts_score`.
**근거:** handoff §11.1 line 648 "Hybrid search: vector (pgvector) + FTS" + TD-3 + research §6.1.
**검증 방법:** Vitest 통합 테스트 (실 DB seed 사용)에서 "510(k) submission" 질의 시 `sources.org_label='FDA'` 조건으로 10개 이하 결과 반환. `combined_score` 내림차순 정렬 확인.

#### REQ-CHAT-015 (State-driven)
**요구사항:** WHILE `sourceFilter='regs'` is set, the system SHALL pre-filter `sources` by `type IN ('Regulation', 'Guidance', 'Standard')`. WHILE `sourceFilter='internal'`, filter by `type='Internal'`. WHILE `sourceFilter='all'`, apply no filter. The filter SHALL be applied as a WHERE clause in the hybrid search SQL, not in application code.
**근거:** handoff §7.4 Composer 칩 "전체 소스 / 규제만 / 사내 SOP".
**검증 방법:** 각 필터 값에 대해 실행된 SQL의 WHERE 절 assertion. Vitest에서 `EXPLAIN` 계획에 해당 조건 포함 확인.

#### REQ-CHAT-016 (Event-driven)
**요구사항:** WHEN `hybridSearch` returns, THEN the system SHALL yield three `trace` events in sequence: `'검색 중: FDA 코퍼스'` (active→done), `'관련 조항 추출 중'` (active→done), `'답변 생성 중'` (active→done). The minimum delay between `active` and `done` per step SHALL be ≥500ms to ensure perceptibility per handoff §9.1 Phase A.
**근거:** handoff §9.1 line 525 "each step ≥500ms apart for perceptibility".
**검증 방법:** Vitest에서 trace 이벤트 타임스탬프 수집, 각 `done` - `active` ≥ 500ms 확인. 3개 step 모두 확인.

#### REQ-CHAT-017 (Ubiquitous)
**요구사항:** The system SHALL compose the LLM prompt via `composePrompt(question, intent, chunks, locale)` from `lib/ai/prompt-templates.ts` with the following components:
1. **System message**: citation enforcement rules (see Group C) + role framing ("You are Regula, a medical device RA expert assistant")
2. **Cached chunk context**: each retrieved chunk wrapped as `[Source N: <org> <title> (<year>) | section_id=<anchor>, offset=<offset>]\n<text>\n\n` (Anthropic cache_control on this block)
3. **User question**: `rewrittenQuery` (not original)
4. **Locale instruction**: `locale='ko'` → "Respond in Korean. Use Source Serif KR style prose.", `locale='en'` → "Respond in English."

**근거:** handoff §11.1 line 650 + regula-citation-contract 방어선 1+2 + TD-2 (prompt caching).
**검증 방법:** Vitest 유닛 테스트에서 composed prompt 구조 assertion: system message에 citation rule 문구 포함, chunks 블록이 `cache_control: { type: 'ephemeral' }` 속성 보유 확인.

#### REQ-CHAT-018 (Event-driven)
**요구사항:** WHEN the prompt is composed, THEN the system SHALL invoke `streamText` from Vercel AI SDK with `model: anthropic('claude-sonnet-4-5')`, `max_tokens: 2048`, and stream the response tokens via `onChunk` callback. Each non-empty token SHALL be yielded as a `prose_delta` event (`{ type: 'prose_delta', delta }`).
**근거:** handoff §11.1 line 651 "Stream answer from Sonnet 4.5" + TD-1.
**검증 방법:** Vitest에서 mock Anthropic response를 chunk 단위로 반환하도록 설정, 수집된 `prose_delta` 개수가 chunk 개수와 일치 확인. 빈 delta는 yield되지 않음 확인.

#### REQ-CHAT-019 (Ubiquitous)
**요구사항:** The top-K chunks sent to the LLM SHALL be limited to 8 chunks (approximately 4K tokens) to prevent prompt truncation under Sonnet's 200K context window (real-world limit for latency). IF retrieved chunks exceed 8, THEN the system SHALL keep the highest `combined_score` 8 and discard the rest.
**근거:** handoff §15 Performance + research §10 위험 완화.
**검증 방법:** Vitest에서 15개 chunk mock 후 prompt에 포함된 chunk 개수 = 8 확인. 선택된 chunks의 score가 버려진 chunks의 score 이상임을 확인.

#### REQ-CHAT-020 (Ubiquitous)
**요구사항:** The `consult()` generator SHALL yield a `sources` event (`{ type: 'sources', items: Source[] }`) exactly once after all `prose_delta` emissions complete. The `items` array SHALL contain only sources referenced by at least one `<sup data-source="N">` in the final prose, in ascending `citeIndex` order (1-based).
**근거:** handoff §11.1 line 633 + §8.3 line 491 "출처 (N)" 섹션.
**검증 방법:** Vitest에서 prose에 `<sup data-source="1">`, `<sup data-source="3">` 포함 시 sources event items가 2개 (index 1, 3만), 정렬 확인. `citeIndex=2` 소스는 포함되지 않음 확인.

---

### Group C: Citation Contract (REQ-CHAT-021 ~ REQ-CHAT-030)

#### REQ-CHAT-021 (Ubiquitous) [HARD]
**요구사항:** The system prompt SHALL include the following citation directive verbatim (translated to match `locale`):
```
모든 사실 주장(claim)에는 반드시 출처 번호를
<sup class="cite" data-source="N" data-offset="M">N</sup>
형식으로 inline 인용하세요. 출처 없이 주장을 생성하지 마세요.
사용자의 질문에 대한 답을 retrieved 출처에서 찾을 수 없으면
"해당 질문에 대한 공식 출처를 찾을 수 없습니다"라고만 답하세요.
상상으로 규정을 만들지 마세요.
```
English variant must have identical semantics.
**근거:** regula-citation-contract SKILL 방어선 1.
**검증 방법:** Vitest에서 composed prompt의 system message 내 해당 문구 regex 매치 확인. `locale='en'` 시 영어 버전 매치 확인.

#### REQ-CHAT-022 (Ubiquitous)
**요구사항:** Each retrieved chunk injected into the prompt SHALL be prefixed with `[Source N: <org_label> <title> (<year>) | section_id=<anchor>, offset=<quoted_offset>]` where N is 1-based index matching the chunk's final `cite_index` in `message_sources`.
**근거:** regula-citation-contract SKILL 방어선 2.
**검증 방법:** Vitest 유닛 테스트에서 8개 chunks 주입 후 prompt text가 `[Source 1: FDA 21 CFR ...`, `[Source 2: FDA ...]` 형식으로 8번 반복 포함 확인.

#### REQ-CHAT-023 (Ubiquitous) [HARD]
**요구사항:** The system SHALL insert one row into `message_sources` per retrieved-and-cited chunk, with `cite_index` matching the N used in the prompt injection (REQ-CHAT-022) and referenced in `<sup data-source="N">`. The invariant `HTML data-source = prompt Source N = message_sources.cite_index` MUST hold. Insertion SHALL occur inside the same transaction as the `messages` row insert (REQ-CHAT-053).
**근거:** regula-citation-contract SKILL "data-source는 반드시 cite_index와 일치" + REQ-FND-037.
**검증 방법:** Vitest 통합 테스트에서 응답 완료 후 DB 조회: `SELECT cite_index FROM message_sources WHERE message_id = $1 ORDER BY cite_index` vs prose 내 모든 `data-source` 값 unique set 비교 → 동일.

#### REQ-CHAT-024 (Ubiquitous)
**요구사항:** The system SHALL provide `enforceCitations(prose: string, availableSources: number[]): { cleaned: string; violations: Violation[] }` from `lib/ai/citation-enforce.ts`. The function SHALL use `htmlparser2` (not regex) to parse the prose tree.
**근거:** regula-citation-contract SKILL 방어선 3 + research §3.2.
**검증 방법:** 파일 존재 + export signature 확인. `htmlparser2` import 확인. 복잡한 중첩 태그 케이스에서 regex 기반 구현보다 parse 정확도 테스트.

#### REQ-CHAT-025 (Conditional)
**요구사항:** IF a sentence in the prose (terminator `.`, `?`, `!`, `。`, `？`, `！`) does NOT contain any `<sup class="cite">` tag AND the sentence does NOT match the meta-sentence whitelist (예: `/^(다음은|본 답변은|요약하면|참고로|아래 표는)/`), THEN `enforceCitations` SHALL classify it as violation `CLAIM_UNCITED` and wrap it with `<mark class="uncited">...</mark>` in `cleaned`.
**근거:** regula-citation-contract SKILL line 68–70 "문장 단위로 citation 요구".
**검증 방법:** Vitest 유닛: `"FDA는 90일 내 심사한다."` 단독 문장 → `<mark class="uncited">FDA는 90일 내 심사한다.</mark>` 출력 + violations에 1건 포함.

#### REQ-CHAT-026 (Conditional)
**요구사항:** IF a `<sup data-source="N">` tag has `N` not present in `availableSources`, THEN `enforceCitations` SHALL strip the tag (remove entirely) and add a `SOURCE_MISMATCH` violation to the result.
**근거:** regula-citation-contract SKILL + research §3.2.
**검증 방법:** Vitest에서 availableSources=[1,2]인데 prose에 `<sup data-source="7">` 포함 시 해당 tag 제거 + `SOURCE_MISMATCH` 1건.

#### REQ-CHAT-027 (Ubiquitous)
**요구사항:** The meta-sentence whitelist SHALL be defined as a bounded regex list in `lib/ai/citation-enforce.ts` with at minimum these 5 Korean and 5 English patterns:
- KO: `^다음은`, `^본 답변은`, `^요약하면`, `^참고로`, `^아래 표는`
- EN: `^The following`, `^In summary`, `^Note that`, `^Please note`, `^This response`

Additional patterns MAY be added but each addition SHALL include a test case in `enforce.test.ts`.
**근거:** research §3.2 false positive 방지.
**검증 방법:** 파일 내 정확한 10개 regex 목록 확인. 각 regex에 대한 Vitest 매칭 테스트 케이스 존재 확인.

#### REQ-CHAT-028 (Event-driven) [v0.2.0 C7 수정]
**요구사항:** WHEN the full prose stream completes, THEN `consult()` SHALL call `enforceCitations(fullProse, availableSources)` exactly once, and the resulting `cleaned` string SHALL be persisted in `messages.content_prose` (not the raw LLM output). The `violations` array SHALL be stored in `messages.meta_json` jsonb column as `{ violations: Violation[] }` shape.
**근거:** regula-citation-contract + FOUNDATION v0.4.0 REQ-FND-036 (cross-spec-audit C7 — `meta_json jsonb NULL` 컬럼 선제 선언).
**검증 방법:** Vitest 통합에서 uncited claim 포함한 mock LLM 응답 → DB `messages.content_prose`에 `<mark class="uncited">` 포함 확인. `SELECT meta_json->'violations' FROM messages WHERE id=$1` 결과가 violations 배열을 반환.

> **스키마 주석 (v0.2.0 C7 해소됨):** FOUNDATION v0.4.0 REQ-FND-036에서 `messages.meta_json jsonb NULL` 컬럼이 선제 선언되었으므로, Phase 2는 해당 컬럼을 directly 사용한다. 이전 `message_meta` 보조 테이블 폴백 계획(v0.1.0)은 폐기되었으며, `migrations/0002_chat_indexes.sql`는 FTS GIN 인덱스만 포함한다. "RUN 단계 결정" 분기는 SPEC 레벨에서 해소.

#### REQ-CHAT-029 (Conditional)
**요구사항:** IF the count of `CLAIM_UNCITED` violations exceeds 20% of total sentences in the prose, THEN `consult()` SHALL yield an `expert_review_required` event with `reason: 'citation coverage < 80%'` regardless of confidence score.
**근거:** research §3.2 "violations 집합이 답변 총 문장의 20% 초과 시 expert_review_required 자동 발행".
**검증 방법:** Vitest에서 10문장 prose에 3개 uncited 포함 시 expert_review_required event emission 확인. 2개 uncited는 발행 없음 확인.

#### REQ-CHAT-030 (Unwanted) [HARD]
**요구사항:** The frontend SHALL NOT sanitize the `<sup class="cite">` markup away. The `rehype-sanitize` configuration in `components/chat/AnswerBlock.tsx` SHALL explicitly allow `sup` tags with `class="cite"`, `data-source`, `data-offset` attributes. Any change to this allow-list SHALL be documented in a code comment with rationale.
**근거:** regula-citation-contract SKILL line 153.
**검증 방법:** `components/chat/AnswerBlock.tsx` 파일 내 `rehype-sanitize` 설정에 `sup` 및 `data-source`/`data-offset` allow-list 존재 확인. Vitest 렌더링 테스트에서 `<sup class="cite" data-source="1">1</sup>` 포함 prose 마크다운 처리 시 DOM에 sup 태그 보존 확인.

---

### Group D: Frontend Components (REQ-CHAT-031 ~ REQ-CHAT-045)

#### REQ-CHAT-031 (Ubiquitous)
**요구사항:** The system SHALL provide `components/chat/Composer.tsx` implementing handoff §7.4 Composer: textarea with auto-grow to 200px max, 16px font, radius 12px, shadow-md on card, focus-ring on focus, placeholder text configurable via prop.
**근거:** handoff §7.4 Composer section.
**검증 방법:** React Testing Library에서 render 후 textarea의 computed style `font-size: 16px`, `max-height: 200px` 확인. Focus 시 outline 또는 ring 클래스 적용 확인.

#### REQ-CHAT-032 (Event-driven)
**요구사항:** WHEN the user presses `Enter` without Shift inside the Composer textarea, THEN the system SHALL submit the question via `onSubmit` callback. WHEN the user presses `Shift+Enter`, THEN the system SHALL insert a newline without submitting.
**근거:** handoff §9.1 line 523 "Enter (no shift) submits; Shift+Enter newline" + §7.4 Composer foot.
**검증 방법:** React Testing Library에서 `fireEvent.keyDown(textarea, { key: 'Enter' })` 시 onSubmit 호출 확인. `{ key: 'Enter', shiftKey: true }` 시 onSubmit 미호출, textarea value에 `\n` 삽입 확인.

#### REQ-CHAT-033 (Ubiquitous)
**요구사항:** The Composer SHALL render a horizontal chip group with 4 chips in this exact Korean order: `전체 소스`, `규제만`, `사내 SOP`, `파일 첨부`. The first three chips SHALL toggle `sourceFilter` state (`'all'|'regs'|'internal'`). The `파일 첨부` chip SHALL render in **disabled** state (Phase 4 feature).
**근거:** handoff §7.4 Composer action row.
**검증 방법:** React Testing Library에서 4개 chip의 textContent 정확한 순서 확인. `파일 첨부` chip의 `disabled` 또는 `aria-disabled="true"` 속성 확인. 첫 3개 클릭 시 상태 변경 확인.

#### REQ-CHAT-034 (Ubiquitous)
**요구사항:** The active source-filter chip SHALL have `bg-brand-50` background and `border-brand-200` border (distinct from inactive chips). Exactly one of `{전체 소스, 규제만, 사내 SOP}` SHALL be active at any time (single-select group).
**근거:** handoff §7.4 "active state: brand-50 bg + brand-200 border".
**검증 방법:** 클릭 후 getComputedStyle 또는 className 확인. 세 chip 중 `.active` 또는 동등 표시 선택된 chip이 정확히 1개.

#### REQ-CHAT-035 (Ubiquitous)
**요구사항:** The Composer submit button SHALL be a 34×34 square with `bg-brand-800`, containing a `SendHorizonal` icon during idle state and a `Loader2` spinning icon during `isSubmitting=true`. It SHALL be positioned to the right of the action chip row.
**근거:** handoff §7.4 "Submit button (right) — 34×34 brand-800 square with send/loader icon".
**검증 방법:** 버튼 dimensions 34×34px 확인. `isSubmitting` prop true 시 `Loader2` 렌더링 확인. false 시 `SendHorizonal` 렌더링.

#### REQ-CHAT-036 (Ubiquitous)
**요구사항:** The Composer foot SHALL display the text `Shift + Enter 줄바꿈 · Enter 전송` on the left and a monospace text showing the current model version (예: `claude-sonnet-4-5`) on the right. Model name SHALL be read from a `NEXT_PUBLIC_LLM_MODEL_LABEL` env var or default to `claude-sonnet-4-5`.
**근거:** handoff §7.4 Composer foot.
**검증 방법:** Composer rendered DOM에서 해당 두 텍스트 존재 확인. 모델명 텍스트의 `font-family` 또는 className이 mono 계열 확인.

#### REQ-CHAT-037 (Ubiquitous)
**요구사항:** The system SHALL provide `components/chat/Thinking.tsx` implementing handoff §7.4 Thinking trace box: title `분석 중` with pulsing dots animation (CSS keyframe `tdot` 1.2s infinite), per-step list in mono 12px, spinner icon → CheckCircle icon transition when a trace event transitions `active → done`.
**근거:** handoff §7.4 + §9.8 "Thinking dots: tdot keyframe 1.2s infinite".
**검증 방법:** React Testing Library에서 `traceSteps` prop 변경 시 active step은 spinner, done step은 check icon 렌더링 확인. `font-family`가 mono, `font-size: 12px` 확인.

#### REQ-CHAT-038 (State-driven)
**요구사항:** WHILE at least one trace step has `status: 'active'`, the Thinking component SHALL render with `aria-live="polite"` region announcing the current step text, per handoff §14 accessibility "Streaming — announce milestones".
**근거:** handoff §14 line 767.
**검증 방법:** `traceSteps: [{ step: '검색 중', status: 'active' }]` 상태에서 container의 `aria-live="polite"` 속성 확인. RTL `getByRole('status')` 접근 가능 확인.

#### REQ-CHAT-039 (Ubiquitous)
**요구사항:** The system SHALL provide `components/chat/AnswerBlock.tsx` rendering ONLY the Phase 2 subset of handoff §8.3 in this top-to-bottom order:
1. **Meta row** — `ConfidenceBadge` + `N 출처` text + `분석 X.Xs` (from `duration_ms / 1000`) + action buttons (copy, regenerate; **thumb up/down and download are disabled in Phase 2**)
2. **Expert-review callout** (amber Callout) — rendered conditionally if `structured.expertReviewRequired` is truthy
3. **Section label: 요약 답변** (serif, uppercase small)
4. **Prose** — 15px line-height 1.65, rendered via `react-markdown` with citations as inline `<Citation>` components
5. **Section label: 출처 (N)** where N = `structured.sources?.length ?? 0`
6. **SourcesGrid** — 240px min card grid

Sections 5-10 (checklist, comparison, timeline) and 13-14 (related pills) from §8.3 SHALL NOT be rendered in Phase 2.
**근거:** handoff §8.3 AnswerBlock composite + Phase 2 scope discipline.
**검증 방법:** RTL render 후 section label 텍스트들의 `[...document.querySelectorAll('.section-label')].map(el => el.textContent)` 정확히 `['요약 답변', '출처 (N)']` 2개 확인. Checklist/Comparison/Timeline DOM 없음 확인.

#### REQ-CHAT-040 (Ubiquitous)
**요구사항:** The system SHALL provide `components/chat/ConfidenceBadge.tsx` per handoff §8.2: pill with colored dot + label + percentage. Three levels: `high` (green = success token), `med` (amber token), `low` (red = danger token). Props: `{ level: 'high'|'med'|'low', score: number }`. Percentage SHALL be `Math.round(score * 100)` followed by `%`.
**근거:** handoff §8.2.
**검증 방법:** RTL에서 `<ConfidenceBadge level="high" score={0.87} />` 렌더링 시 "HIGH · 87%" 또는 동등 텍스트 존재 확인. 각 레벨별 색상 클래스 적용 확인.

#### REQ-CHAT-041 (Ubiquitous)
**요구사항:** The system SHALL provide `components/chat/Citation.tsx` rendering a `<sup>` element with: `class="cite"`, `data-source={sourceIndex}`, `data-offset={offset}`, `role="button"`, `tabIndex={0}`, `aria-label={\`Source ${sourceIndex}, click to view\`}`. Click or Enter key SHALL invoke `useDocViewer().open(sourceIndex, offset)`.
**근거:** handoff §8.1 + §14 accessibility + regula-citation-contract SKILL.
**검증 방법:** RTL에서 `<Citation sourceIndex={3} offset={1420} />` 렌더링 DOM의 정확한 attribute 값 확인. `fireEvent.click` 시 mock `open` 호출 with `(3, 1420)` 확인. `fireEvent.keyDown({key: 'Enter'})` 시 동일.

#### REQ-CHAT-042 (Ubiquitous)
**요구사항:** The Citation `<sup>` element SHALL have styling: `bg-brand-100`, `text-brand-700`, `font-mono text-[10px]`, `font-weight-600`, `radius-3px`. Hover state: `bg-brand-600`, `text-white`.
**근거:** handoff §8.1 + regula-citation-contract SKILL.
**검증 방법:** Storybook 또는 RTL에서 computed style assertion. Tailwind class list에 해당 유틸리티 존재 확인.

#### REQ-CHAT-043 (Event-driven) [HARD]
**요구사항:** WHEN the user clicks any `<Citation>` component, THEN the system SHALL open `DocViewer` modal AND update the URL hash to `#source=N&offset=M` AND scroll the modal body to the element matching `[data-anchor-offset="M"]` (rendered inside DocViewer) AND apply `amber-underline` + `bg-amber-100` classes to that element for visual highlight.
**근거:** handoff §9.2 + §7.10 Document Viewer + product.md Non-Obvious Constraint #1.
**검증 방법:** Playwright e2e (Phase 6) 또는 Vitest + jsdom에서 클릭 후 `window.location.hash === '#source=3&offset=1420'` 확인. Matching element `scrollIntoView` 호출 확인 (mock).

#### REQ-CHAT-044 (Ubiquitous)
**요구사항:** The system SHALL provide `components/doc/DocViewer.tsx` implementing handoff §7.10: full-screen overlay with navy-80 50% backdrop, centered panel max-width 1200px. Header bar: source index badge, org · year meta, truncated title, `원문` external link button, close icon (X). Body split: 260px doc nav (anchor list from `source_sections`) + scrolling main content. DocViewer SHALL fetch source data via `GET /api/ra/sources/[id]?offset=N`.
**근거:** handoff §7.10.
**검증 방법:** RTL render 후 header 5요소(badge, meta, title, 원문 link, close) 존재 확인. Body의 left column `width: 260px` 확인. Open 시 `fetch('/api/ra/sources/<id>?offset=<N>')` mock 호출 확인.

#### REQ-CHAT-045 (Ubiquitous)
**요구사항:** The system SHALL provide `components/chat/SourceCard.tsx` implementing handoff §8.4: index badge (brand-100 mono font) + uppercase org label + type pill (color-coded by `type`) + 2-line clamped title + mono year + external-link icon. Hover: lift 1px via `translateY(-1px)`, `border-strong` class, `shadow-sm`.
**근거:** handoff §8.4.
**검증 방법:** RTL에서 `<SourceCard source={fixture} />` 렌더링 시 각 요소 존재 확인. Title에 `-webkit-line-clamp: 2` 또는 동등 CSS 확인. Hover 시 transform style 변경 확인.

---

### Group E: useStreamingAnswer Hook (REQ-CHAT-046 ~ REQ-CHAT-052)

#### REQ-CHAT-046 (Ubiquitous)
**요구사항:** The system SHALL provide `hooks/useStreamingAnswer.ts` exposing `useStreamingAnswer(): { status, traceSteps, prose, structured, meta, error, duration_ms, start, abort }` with the TypeScript signature defined in regula-streaming-contract SKILL.
**근거:** regula-streaming-contract SKILL + handoff §10.3.
**검증 방법:** TypeScript `tsc --noEmit` pass. `@testing-library/react-hooks` 또는 `renderHook`에서 return 객체의 9개 필드 존재 확인.

#### REQ-CHAT-047 (Event-driven)
**요구사항:** WHEN `start(input: ConsultRequest)` is called, THEN the hook SHALL (a) abort any existing AbortController, (b) create a new AbortController, (c) reset state to `{ status: 'streaming', traceSteps: [], prose: '', structured: {}, error: null }`, (d) `fetch('/api/ra/consult', { method: 'POST', body: JSON.stringify(input), signal: ac.signal })`, (e) read the response body stream via `getReader()`, (f) decode and parse SSE buffer events, (g) apply each event via `applyEvent` reducer.
**근거:** regula-streaming-contract SKILL line 205–239.
**검증 방법:** `renderHook`에서 `start({ question: 'test', ... })` 호출 후 상태 전환 관찰. `fetch` mock 호출 args 검증.

#### REQ-CHAT-048 (Ubiquitous)
**요구사항:** The `parseSSEBuffer(buffer: string): { parsed: StreamEvent[], remainder: string }` helper SHALL correctly handle chunk boundaries: if the last `data: {...}\n\n` is incomplete (no closing `\n\n`), it SHALL be retained in `remainder` for the next read cycle. Events SHALL be parsed as `JSON.parse(line.slice(6))` where `line` starts with `data: `.
**근거:** regula-streaming-contract SKILL "SSE buffer에서 불완전한 event는 다음 chunk로 이월".
**검증 방법:** Vitest 유닛: `parseSSEBuffer('data: {"type":"meta",...}\n\ndata: {"type":"trace",...}\n\ndata: {"type":"prose_delta","del')` → parsed 2개, remainder `data: {"type":"prose_delta","del`.

#### REQ-CHAT-049 (Event-driven)
**요구사항:** WHEN `abort()` is called OR when `useEffect` cleanup runs (component unmount), THEN the hook SHALL invoke `abortRef.current?.abort()` and transition state to `{ status: 'idle' or existing, error: null }` (not overwriting existing completion state).
**근거:** regula-streaming-contract SKILL "React 18 strict mode에서 useEffect cleanup 시 abort 호출 필수".
**검증 방법:** `renderHook` unmount 테스트에서 active stream 중 unmount 시 abort 호출 확인. 에러 상태로 바뀌지 않음 확인.

#### REQ-CHAT-050 (Ubiquitous)
**요구사항:** The `applyEvent(setState, ev)` reducer SHALL handle ALL 12 StreamEvent types via switch-case. For Phase 2, `checklist`/`comparison`/`timeline`/`related` cases SHALL update `structured.<field>` as pass-through (no visual rendering in Phase 2; ensures Phase 3 compatibility without type drift).
**근거:** regula-streaming-contract SKILL applyEvent + research §13.
**검증 방법:** Vitest 유닛: 12개 event types 각각에 대해 reducer 호출 후 state mutation 검증. `checklist` event 수신 시 `structured.checklist` 업데이트 확인 (렌더링은 Phase 3).

#### REQ-CHAT-051 (Event-driven)
**요구사항:** WHEN `status` transitions to `'done'`, THEN the hook SHALL invalidate the conversation list query via `queryClient.invalidateQueries({ queryKey: ['conversations'] })`. Phase 2 미구현 history에서도 향후 Phase 4 호환성을 위해 invalidation 코드는 포함.
**근거:** handoff §10.3 line 598 "On finish, invalidates conversation list query".
**검증 방법:** `renderHook`에서 `done` 이벤트 수신 후 `queryClient.invalidateQueries` mock 호출 확인 with `['conversations']` key.

#### REQ-CHAT-052 (Conditional)
**요구사항:** IF the fetch call returns `!response.ok` OR `!response.body`, THEN the hook SHALL set `status: 'error'`, `error: 'connection_failed'`, and SHALL NOT attempt to read the body.
**근거:** regula-streaming-contract SKILL line 219–222.
**검증 방법:** `fetch` mock이 `new Response(null, { status: 500 })` 반환 시 state가 error로 전환되는지 확인.

---

### Group F: Audit Wiring (REQ-CHAT-053 ~ REQ-CHAT-056)

#### REQ-CHAT-053 (Event-driven) [HARD]
**요구사항:** WHEN the Route Handler begins processing a valid authenticated request, THEN the system SHALL call `writeAudit({ actor_id: session.user.id, action: 'llm.call', resource_type: 'message', resource_id: messageId, conversation_id, meta_json: { model, question_hash: sha256(question), locale, source_filter, project_id } })` **before** starting `consult()`. `question_hash` SHALL be SHA-256 hex digest (PII-free identifier).
**근거:** product.md Non-Obvious Constraint #4 + handoff §16 "every LLM call" + REQ-FND-049 action `'llm.call'`.
**검증 방법:** Vitest 통합 테스트: consult 요청 후 `audit_logs` 테이블 조회 시 해당 메시지에 대해 `action='llm.call'` row 정확히 1건, `meta_json.model` 포함, `question_hash`가 64자 hex 확인.

#### REQ-CHAT-054 (Event-driven) [HARD]
**요구사항:** WHEN `hybridSearch` returns retrieved chunks AND prose streaming begins, THEN the system SHALL call `writeAudit({ action: 'source.access', resource_type: 'source', resource_id: <source.id>, conversation_id, meta_json: { cite_indices: number[], org_label, section_anchors: string[] } })` **once per unique source_id** referenced in the final prose. Multiple chunks from the same source count as one `source.access` audit row.
**근거:** handoff §16 "every source access" + REQ-FND-049 action `'source.access'`.
**검증 방법:** Vitest에서 2개 source에서 chunks 인용 시 `audit_logs`에 `action='source.access'` row 정확히 2건 (per source_id). `cite_indices`에 해당 source 인용 번호 모두 포함.

#### REQ-CHAT-055 (Event-driven) [HARD] [v0.2.0 C1 수정]
**요구사항:** WHEN confidence < 0.7 OR citation coverage < 80% OR policy keyword match, THEN the system SHALL (a) emit an `expert_review_required` SSE event (`{ type: 'expert_review_required', reason: string }`) **before** the `done` event, AND (b) call `writeAudit({ action: 'expert_review.flag', resource_type: 'message', resource_id: messageId, conversation_id, meta_json: { reason, confidence_score, trigger: 'auto' } })`.

**v0.2.0 C1 오너십 분리:** Phase 2 CHAT은 SSE 이벤트 발행 + audit flag call-site까지만 담당한다. `expert_reviews` row INSERT(enqueueExpertReview)는 Phase 5 ENTERPRISE REQ-ENTERPRISE-009 전담이며, Phase 5 kickoff 이후 동일 이벤트 경로에서 추가 call-site가 삽입된다. Phase 2~4 기간에는 `messages.expert_review_required = true` 플래그와 audit 기록만 존재하고 `expert_reviews` row는 비어 있으며, Phase 5 deploy 시점부터 row INSERT가 활성화된다(과거 기간 백필은 Phase 5 migration 범위 외, audit_logs + messages 플래그로 추적 가능).

**근거:** product.md Non-Obvious Constraint #3 + handoff §9.3 "Automatic" + FOUNDATION v0.4.0 REQ-FND-049 action `'expert_review.flag'` + cross-spec-audit C1 (double-insert race 방지 — CHAT은 event+audit, ENTERPRISE는 row INSERT).
**검증 방법:** Vitest에서 confidence=0.55 mock 응답 시 (1) `expert_review_required` SSE event 방출 확인 (REQ-CHAT-029와 동일 조건), (2) `audit_logs`에 `action='expert_review.flag'` row 정확히 1건 확인 (`meta_json.trigger='auto'`), (3) Phase 2 단독 테스트에서 `expert_reviews` row **부재** 확인 (Phase 5 결합 테스트에서 row 존재로 전환).

#### REQ-CHAT-056 (Unwanted)
**요구사항:** The system SHALL NOT use any audit `action` value outside the Phase 1 enum `{ 'llm.call', 'source.access', 'expert_review.flag' }`. Specifically, `auth.login`/`auth.logout`/`expert_review.resolve` SHALL NOT appear in Phase 2 code (these are Phase 5).
**근거:** FOUNDATION REQ-FND-049 + REQ-FND-049a scope discipline.
**검증 방법:** `grep -r "writeAudit" app/ lib/` 결과의 모든 호출에서 `action` 인자가 3개 값 중 하나임을 compliance-qa가 검증.

---

### Group G: Performance (REQ-CHAT-057 ~ REQ-CHAT-060)

#### REQ-CHAT-057 (Ubiquitous) [HARD]
**요구사항:** The time from Route Handler receipt of a valid POST request to emission of the first `prose_delta` event SHALL be ≤ 1.5 seconds at P95 (measured under 4-core CPU, PostgreSQL co-located, Anthropic API available, seed corpus of 650 chunks).
**근거:** handoff §15 "First answer token ≤ 1.5s after submit".
**검증 방법:** Vitest 통합 벤치마크: 20회 consult 요청 → 19회 이상에서 첫 `prose_delta`까지 경과 시간 ≤ 1500ms 확인. 측정은 `performance.now()` 사용.

#### REQ-CHAT-058 (Ubiquitous)
**요구사항:** The `/chat` page initial LCP (Largest Contentful Paint) SHALL be ≤ 2.0s on broadband (verified via Playwright Lighthouse integration in Phase 6; Phase 2는 구조적 조건만 충족: RSC 사용, Composer와 Thinking 컴포넌트는 dynamic import로 code-split, fonts preloaded via Phase 1 REQ-FND-026).
**근거:** handoff §15 "LCP ≤ 2.0s".
**검증 방법:** `app/(app)/chat/page.tsx`가 Server Component로 선언됨 확인 (`'use client'` 없음). Heavy 컴포넌트(`<ReactMarkdown>`, `<DocViewer>`)가 `next/dynamic` 로딩 확인.

#### REQ-CHAT-059 (Ubiquitous)
**요구사항:** The `hybridSearch` SQL query SHALL complete at P95 ≤ 500ms on the seed corpus (650 chunks, pgvector ivfflat index with `lists=50`). IF latency exceeds 500ms in benchmarks, THEN Phase 5 shall reconsider index tuning or migration to hnsw.
**근거:** FOUNDATION TD #1 재평가 조건 + research §10.
**검증 방법:** Vitest 통합 벤치마크: 100회 hybrid search 쿼리 → P95 latency 측정 및 500ms 이하 assertion. `EXPLAIN ANALYZE` 결과 첨부.

#### REQ-CHAT-060 (Ubiquitous)
**요구사항:** The SSE stream SHALL emit events with an end-to-end cost budget of ≤ 30 tokens/sec for `trace` events (≤ 6 trace events per request × ~5 tokens each) and SHALL NOT batch `prose_delta` events (each LLM token chunk flushed immediately) to preserve typing animation perceptibility.
**근거:** handoff §9.1 Phase B "Answer tokens stream into prose" (per-token streaming).
**검증 방법:** Vitest 통합: LLM mock이 20 chunks 반환 시 수집된 `prose_delta` 이벤트 개수 = 20 확인 (배치 없음). Trace 이벤트 개수 ≤ 6 확인.

---

## 의존성 (Dependencies)

### 상위 SPEC
- **SPEC-REGULA-FOUNDATION-001 v0.3.0** — 필수 선행 완료

### FOUNDATION REQ-FND 의존 매트릭스

| Phase 2 REQ-CHAT | 의존 FOUNDATION REQ-FND | 이유 |
|---|---|---|
| REQ-CHAT-002 | REQ-FND-051, 052, 053 | Auth.js 세션 + middleware |
| REQ-CHAT-003 | REQ-FND-010a | lib/env.ts 확장에 필요한 zod schema 기반 |
| REQ-CHAT-005 | REQ-FND-035, 036 | conversations, messages 테이블 insert |
| REQ-CHAT-014 | REQ-FND-039, 040, 044a, 044b, 044c | sources/source_sections + 인덱스 |
| REQ-CHAT-015 | REQ-FND-039 | sources.type pgEnum |
| REQ-CHAT-020 | REQ-FND-037 | message_sources cite_index UNIQUE 제약 |
| REQ-CHAT-023 | REQ-FND-037 | cite_index = data-source invariant |
| REQ-CHAT-028 | REQ-FND-036 | messages.content_prose, meta_json 필드 |
| REQ-CHAT-039 | REQ-FND-038 | message_blocks 스키마 — Phase 2는 `prose`, `sources` 두 타입만 insert |
| REQ-CHAT-041 | REQ-FND-021, 023 | brand-100/700 토큰, 폰트 mono |
| REQ-CHAT-043 | REQ-FND-044a, 044c | source_sections.anchor UNIQUE로 딥링크 |
| REQ-CHAT-053-055 | REQ-FND-048, 049, 049a | writeAudit helper + 3-action enum |
| REQ-CHAT-053-055 | REQ-FND-044 | audit_logs 테이블 (INSERT permission) |
| REQ-CHAT-053-055 | REQ-FND-046, 046a, 046b, 047a | audit_logs append-only 보장 |
| REQ-CHAT-058 | REQ-FND-026 | 폰트 preload, display: swap |

### pnpm 의존성 추가 (Phase 2)

Runtime dependencies:
- `ai` (Vercel AI SDK, ^4.0.0)
- `@ai-sdk/anthropic` (^1.0.0)
- `openai` (^4.0.0, embedding 전용)
- `react-markdown` (^9.0.0)
- `rehype-raw` (^7.0.0)
- `rehype-sanitize` (^6.0.0)
- `htmlparser2` (^9.0.0, citation post-processing)

Dev dependencies:
- 추가 없음 (Phase 1의 Vitest/Biome/Drizzle Kit 재사용)

### Environment Variables (Phase 2 추가)

`.env.example`에 추가되어야 할 키:
- `ANTHROPIC_API_KEY=`
- `OPENAI_API_KEY=` (embedding 전용)
- `NEXT_PUBLIC_LLM_MODEL_LABEL=claude-sonnet-4-5`

`lib/env.ts` zod schema에 추가되어야 할 항목:
- `ANTHROPIC_API_KEY: z.string().min(1)`
- `OPENAI_API_KEY: z.string().min(1)`

---

## 산출물 (Deliverables)

### 신규 파일 (25개)

**API Route Handlers (2):**
- `app/api/ra/consult/route.ts`
- `app/api/ra/sources/[id]/route.ts`

**AI Pipeline (9):**
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

**Types (2):**
- `types/streaming.ts`
- `types/consult.ts`

**Hooks (2):**
- `hooks/useStreamingAnswer.ts`
- `hooks/useDocViewer.ts`

**Components (8):**
- `components/chat/Composer.tsx`
- `components/chat/Thinking.tsx`
- `components/chat/AnswerBlock.tsx`
- `components/chat/Citation.tsx`
- `components/chat/ConfidenceBadge.tsx`
- `components/chat/SourcesGrid.tsx`
- `components/chat/SourceCard.tsx`
- `components/doc/DocViewer.tsx`

**Scripts + Migrations (2):**
- `scripts/seed-fda-corpus.ts`
- `migrations/0002_chat_indexes.sql` (FTS GIN 인덱스 + 선택적 `message_meta` 보조 테이블)

### 수정 파일 (3개)

- `app/(app)/chat/page.tsx` — Phase 1 placeholder 재작성 (Composer + AnswerBlock). 메시지 0건 케이스는 empty state로 fallback하여 REQ-FND-017 호환.
- `lib/env.ts` — zod schema 확장 (`ANTHROPIC_API_KEY`, `OPENAI_API_KEY`).
- `.env.example` — 신규 환경 변수 추가.

### FOUNDATION 미수정 원칙

본 SPEC은 FOUNDATION SPEC의 어떤 REQ-FND도 수정·삭제하지 않는다. 세 가지 인터페이스만 사용:
1. Schema 확장: 마이그레이션 번호 `0002_*` 이상만 추가
2. Env 확장: `lib/env.ts` zod schema에 신규 키 추가 (기존 키 삭제 금지)
3. Chat page 교체: `app/(app)/chat/page.tsx`는 FOUNDATION의 placeholder 역할을 Phase 2 완성형으로 대체하되 empty state rendering으로 REQ-FND-017 의도(빈 상태 메시지)를 유지

---

## Non-Obvious Constraints 적용 매트릭스

CLAUDE.md + FOUNDATION spec에서 확인된 7개 Non-Obvious Product Constraints 중 Phase 2에서 직접 적용되는 제약:

| # | 제약 | FOUNDATION 상태 | Phase 2 상태 | 담당 REQ-CHAT |
|---|---|---|---|---|
| 1 | 모든 LLM claim은 inline citation 필수 | 스키마 확보 (cite_index) | **Enforcement 구현** | Group C 전체 (REQ-CHAT-021~030), 특히 REQ-CHAT-021, 024, 025, 028 |
| 2 | 3단계 SSE 스트리밍 (trace → prose → structured) | - | **구현** | Group A (REQ-CHAT-001~010) + Group E (REQ-CHAT-046~052), 특히 REQ-CHAT-006, 009 |
| 3 | Expert-review 자동 플래그 (confidence<0.7 또는 policy keyword) | placeholder column | **로직 구현** | REQ-CHAT-029, REQ-CHAT-055 |
| 4 | Audit logging (21 CFR Part 11) | 트리거·헬퍼 완비 | **Call-site wiring** | Group F 전체 (REQ-CHAT-053~056) |
| 5 | Serif/sans 타이포 (Serif: H1·quote·doc body) | 토큰·layout 완비 | Composer·AnswerBlock 내부 적용 | REQ-CHAT-039 (section-label serif), REQ-CHAT-041-042 (citation mono) |
| 6 | Korean + English first-class | 토큰·폰트 완비 | locale 파라미터 routing + prompt 변형 | REQ-CHAT-003 (locale validation), REQ-CHAT-013 (한-영 혼합 rewrite), REQ-CHAT-017 (locale instruction), REQ-CHAT-021 (KO/EN directive) |
| 7 | `noindex` 전역 / `/login` 제외 | 메타 완비 | Phase 2 변경 없음 | N/A (FOUNDATION에서 완결) |

---

## 위험 (Risks)

Research §10의 위험 인벤토리를 SPEC 관점에서 요약:

| 위험 | 심각도 | 영향 | 완화책 | 담당 REQ-CHAT |
|---|---|---|---|---|
| Citation post-processing false positive | High | 정상 meta 문장 strip → 답변 품질 저하 | Bounded meta-sentence whitelist (10개 regex) + 20% 위반율 상한 | REQ-CHAT-025, 027, 029 |
| SSE event 순서 concurrency 위반 | High | 클라이언트 hang 또는 렌더 오류 | 백엔드 `async function*` sequential yield + `StreamOrderValidator` phase tracking | REQ-CHAT-006, 011 |
| pgvector P95 > 500ms | Med | First token latency 1.5s 목표 초과 | ivfflat `lists=50` 튜닝 + corpus pre-filter로 검색 공간 축소 | REQ-CHAT-059 |
| Anthropic rate limit 초과 | Med | 일부 사용자 503 | 사용자별 in-memory token bucket (30 req/min) + 429 반환 | REQ-CHAT-007 |
| Sonnet 토큰 상한 (chunks 과다) | Med | Prompt truncation, 답변 품질 저하 | Top-K=8 chunks 제한 (~4K tokens) | REQ-CHAT-019 |
| 한국어 질문 + 영어 코퍼스 mismatch | Med | Retrieval recall 저하 | Query rewrite에 한-영 혼합 키워드 | REQ-CHAT-013 |
| data-source ↔ cite_index 불일치 | High | Citation 클릭 시 잘못된 소스 열림 (규제 신뢰성 파괴) | DB insert와 HTML emission이 동일 ordered list에서 생성되도록 transaction 내 처리 | REQ-CHAT-023 |
| DocViewer 딥링크 스크롤 실패 | Med | UX 파손 | `source_sections.anchor` UNIQUE 제약 + `scrollIntoView` 결정론적 동작 | REQ-CHAT-043 |
| AbortController 누수 | Low | 서버 리소스 점진 증가 | React `useEffect` cleanup + `request.signal.aborted` 체크 | REQ-CHAT-010, 049 |
| `expert_review_required` 오탐 과다 | Med | 전문가 큐 오버플로우 (Phase 5 영향) | Phase 2는 confidence + citation coverage 기반만, Phase 5 Langfuse eval로 튜닝 | REQ-CHAT-029, 055 |

---

## 예상 질문 (FAQ, non-normative)

**Q1. Phase 2에서 `message_blocks` 테이블에 무엇을 쓰는가?**
A. `block_type='prose'` 1행 (최종 cleaned prose 저장, citation mark 포함)과 `block_type='sources'` 1행 (sources event JSON serialize). 나머지 4종 block_type은 Phase 3에서 채움. REQ-CHAT-039와 Phase 3 handoff 참조.

**Q2. `confidence_score`는 어떻게 계산하는가?**
A. `lib/ai/confidence.ts`의 `computeConfidence(chunks, prose, violations)` 함수:
- Base: 상위 8 chunks의 `combined_score` 평균 (0.0~1.0)
- Citation coverage bonus: 전체 문장 대비 citation 포함 문장 비율 × 0.3
- Violation penalty: `CLAIM_UNCITED` 건당 -0.05, `SOURCE_MISMATCH` 건당 -0.10
- Clamp to [0.0, 1.0]
- Level mapping: `>= 0.8` → `'high'`, `>= 0.6` → `'med'`, `< 0.6` → `'low'`

**Q3. Playwright e2e 테스트는 Phase 2에서 쓰는가?**
A. 아니오. Phase 6 대상. Phase 2는 Vitest 단위+통합 테스트만.

**Q4. Prompt caching 실패 시 어떻게 되는가?**
A. Anthropic API의 cache_control은 best-effort. Cache miss 시에도 정상 작동 (cost만 증가). `lib/ai/prompt-templates.ts`에 `cacheControl` 설정 실패 시 로그 warning + 진행.

**Q5. `source_sections.full_text_tsv` 컬럼이 없는데 FTS가 어떻게 되는가?**
A. Research §6.2 참조. 쿼리 시점에 `to_tsvector('english', text)` 동적 계산 + expression GIN 인덱스(`migrations/0002_chat_indexes.sql`에서 추가). FOUNDATION 스키마 미수정.

**Q6. Streaming 중간에 네트워크 끊기면?**
A. 클라이언트: `useStreamingAnswer` fetch가 throw → status='error', error='connection_failed'. 서버: `request.signal.aborted` 감지 → async generator 종료, `messages` row rollback (REQ-CHAT-010). 재시도는 사용자 수동 (Phase 5에서 auto-retry 정책 도입 검토).

---

## 검증 전략 (Verification Strategy)

### 단위 테스트 (Vitest `tests/unit/`)

- `enforceCitations` 로직: 10+ 입력 케이스 (cited/uncited/meta/mismatch/nested)
- `rewriteQuery` 패턴 매핑: 20+ acronym 케이스
- `parseSSEBuffer` chunk boundary: 5+ 조합
- `applyEvent` reducer: 12 event types 전부
- `computeConfidence` 경계값: score=0.0, 0.6, 0.8, 1.0 4 cases
- Component snapshot: Composer, Thinking, AnswerBlock, Citation, ConfidenceBadge, SourceCard

### 통합 테스트 (Vitest `tests/integration/`, 실 DB)

- Full consult E2E: 4 대표 질문 × 2 locale = 8 시나리오
- Citation invariant: `data-source` 집합 = `message_sources.cite_index` 집합
- Audit trio: 1 consult 요청 → audit_logs에 `llm.call` 1 + `source.access` N + `expert_review.flag` ≤1
- SSE order validator: 모든 시나리오에서 Phase A < B < C 순서 유지
- Abort semantics: mid-stream abort 시 DB rollback 확인
- hybridSearch 벤치마크: 100회 쿼리 P95 latency

### Compliance-qa 검증 (Phase 2 완료 판정)

- REQ-CHAT-021 directive 문구 regex match
- REQ-CHAT-030 rehype-sanitize allow-list 확인
- REQ-CHAT-056 Phase 2 enum 외 action 값 부재 확인 (grep)
- FOUNDATION 미수정 확인 (`git diff spec-REGULA-FOUNDATION-001` → 0 lines changed)

---

## 다음 Phase Handoff (Phase 3 Structured Outputs로의 인터페이스)

Phase 2 완료 시점에 Phase 3가 **타입 변경 없이** 다음만 추가하면 되도록 설계됨:

### 변경될 파일 (Phase 3 수정)
- `components/chat/AnswerBlock.tsx`: §8.3의 섹션 5~10, 13~14 추가 (checklist/comparison/timeline/related)
- `lib/ai/consult.ts`: Phase C generator block에 `yield checklistEvent`, `yield comparisonEvent` 등 추가
- `lib/ai/prompt-templates.ts`: Structured output JSON schema instruction 추가 (Anthropic tool_use 또는 JSON mode)
- 신규: `components/chat/ChecklistBlock.tsx`, `ComparisonTable.tsx`, `Timeline.tsx`, `SuggestedFollowups.tsx`

### 변경되지 않을 파일 (Phase 2에서 안정 보장)
- `types/streaming.ts` (12 event types 이미 완결)
- `hooks/useStreamingAnswer.ts` (applyEvent는 12 types 전부 처리)
- `lib/ai/citation-enforce.ts`
- `lib/ai/streaming.ts`
- `app/api/ra/consult/route.ts`
- `lib/ai/retrievers/hybrid-search.ts`
- `components/chat/Composer.tsx`
- `components/chat/Thinking.tsx`
- `components/chat/Citation.tsx`
- `components/doc/DocViewer.tsx`

### Phase 3 준비 가이드
- `message_blocks.block_type` enum은 Phase 1에서 6개 값 전부 확정. Phase 3는 `checklist`, `comparison`, `timeline`, `related` 4종을 insert.
- `related_handoff_sections`에 추가될 Phase 3 섹션 후보: §8.5, §8.6, §8.7, §8.10.
- Phase 3 SPEC은 본 Phase 2 SPEC v0.1.0 이상에 의존 선언 필요.

---

## 변경 이력 (Revision History)

| 버전 | 날짜 | 작성자 | 변경 내용 |
|---|---|---|---|
| 0.1.0 | 2026-04-22 | manager-spec | Initial draft. 60 REQ-CHAT across 7 groups. 6 technical decisions (TD-1 Vercel AI SDK lock-in, TD-2 prompt caching, TD-3 hybrid retrieval, TD-4 no reranker, TD-5 SSE transport, TD-6 OpenAI embedding). Depends on SPEC-REGULA-FOUNDATION-001 v0.3.0. |
| 0.2.0 | 2026-04-23 | manager-spec (iteration via cross-spec-audit Critical patch) | Applied Critical C1 (expert_reviews enqueue 오너십 분리 — REQ-CHAT-055: CHAT는 event+audit only, row INSERT는 Phase 5), C7 (messages.meta_json 컬럼 확정 — REQ-CHAT-028: FOUNDATION v0.4.0 REQ-FND-036에서 선제 선언됨에 따라 message_meta 보조 테이블 폴백 폐기). depends_on을 FOUNDATION v0.4.0+로 갱신. 신규 REQ 없음, 재배치 없음. |

---

## Pending Cross-Audit Findings (v0.2.0)

cross-spec-audit.md(2026-04-22)의 High findings 중 본 iteration에서 해소되지 않고 후속 Wave에서 추적할 항목.

| ID | 요약 | 해당 SPEC | 추적 상태 |
|---|---|---|---|
| H8 | CHAT 첫 토큰 P95 ≤ 1.5s SLO가 Phase 4 multi-corpus 환경에서 재검증 필요 (BREADTH에서 5 corpora 병렬 추가 후 cumulative latency budget 재조정) | BREADTH / LAUNCH | LAUNCH Phase 6에서 실측 기반 재평가 (REQ-LAUNCH-024 revision) |
| M5 | CHAT REQ-CHAT-057 벤치마크 시드 코퍼스(650 chunks) vs Phase 4 5000+ chunks 확장 시 P95 변동 | BREADTH / LAUNCH | LAUNCH load test에서 corpus-size scaling 확인 |
| M6 | In-memory rate limit (REQ-CHAT-007)이 Vercel 멀티 인스턴스 환경에서 per-function-instance scope — LAUNCH load test 50 VU 시 효과 불확실 | LAUNCH | LAUNCH REQ-LAUNCH-023 caveat 또는 Post-launch Redis 전환 |
| M7 | `expert_reviews.message_id` 단일 FK vs ENTERPRISE Zod `messageIds[]` plural array 불일치 | ENTERPRISE | Phase 5 kickoff에서 `messageIds[0]` 채택 또는 junction table 결정 |

기타 CHAT 관련 Medium/Low findings는 각 Phase 진입 시 해당 SPEC 이터레이션에서 개별 결정.

---

**완료 판정:** 본 SPEC은 regula-architect + regula-compliance-qa 심사를 거쳐 PROCEED_TO_PHASE_2 판정을 받으면 RUN 단계 (regula-backend + regula-frontend + regula-rag-pipeline) 병렬 실행으로 진입한다.
