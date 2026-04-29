---
id: SPEC-REGULA-STRUCTURED-001
title: Regula Phase 3 Structured Outputs — Checklist, ComparisonTable, Timeline, SuggestionPill, RightContextPanel
status: draft
created: 2026-04-22
updated: 2026-04-23
author: manager-spec
phase: 3
skill: regula
version: 0.2.0
priority: High
depends_on:
  - SPEC-REGULA-FOUNDATION-001 (v0.4.0+)
  - SPEC-REGULA-CHAT-001 (v0.2.0+)
related_handoff_sections:
  - "§7.4"
  - "§8.3"
  - "§8.5"
  - "§8.6"
  - "§8.7"
  - "§8.8"
  - "§8.10"
  - "§9.1"
  - "§11.1"
revision_history:
  - version: 0.1.0
    date: 2026-04-22
    author: manager-spec
    notes: |
      Initial draft (Phase 3 Structured Outputs). 30+ REQ-STRUCT organized
      into 5 groups: (A) Pipeline, (B) Zod Schema, (C) Components,
      (D) RightContextPanel, (E) message_blocks persistence. 5 technical
      decisions (follow-up LLM call, shared Zod module, block_json embed,
      minimal prompt budget, event skip). Inherits FOUNDATION v0.3.0
      (13 tables, message_blocks pgEnum 6 values, block_json jsonb) and
      CHAT-001 (SSE transport, useStreamingAnswer, prose streaming,
      citation enforcement). Phase 4 handoff point: structured-schema.ts
      stability for History rendering.
  - version: 0.2.0
    date: 2026-04-23
    author: manager-spec (iteration via cross-spec-audit Critical patch)
    notes: |
      Applied cross-spec-audit Critical findings C3, C4, C5 + High H4:
      * C3 — checklist.toggle audit action enum: Scope Out-of-Scope 문구
        수정 ("Phase 5 enum 확장" → "Phase 5 wiring; enum은 FOUNDATION v0.4.0
        REQ-FND-049 inventory table에 Phase 1에서 선제 선언됨"). STRUCTURED
        Phase 3의 REQ-STRUCT-037 writeAudit 미호출 원칙은 유지 (scope
        discipline). ENTERPRISE REQ-ENTERPRISE-028에도 checklist.toggle 추가됨.
      * C4 — /api/ra/updates 단일 오너십: Deliverables에서 app/api/ra/updates/
        route.ts 제거. Phase 3는 BREADTH 담당으로 위임하며, RightContextPanel
        내 "관련 규제 업데이트" 섹션은 Phase 3에서 빈 상태/로딩 스피너로 렌더
        (실 API 호출은 Phase 4 wire-up). REQ-STRUCT-032 수정됨.
      * C5 — RightContextPanel dependency inversion 해소: REQ-STRUCT-029~033
        수정. Phase 3는 컴포넌트 스켈레톤(3 섹션 구조 + 빈 상태 + 로딩 UI)만
        완성, 실제 projects/messages-sources/updates API 호출은 Phase 4
        BREADTH wire-up(REQ-BREADTH-050 "실데이터 연결")이 담당. "현재
        프로젝트" 섹션은 Phase 3에서 placeholder("프로젝트를 선택하세요" 또는
        "Phase 4에서 연결 예정")로 표시.
      * H4 — i18n structured block regeneration 범위 명확화: Scope
        Out-of-Scope 문구 수정 ("기존 ko 블록 번역 → Phase 5"를 제거하고
        "Phase 5는 신규 질의에 대해서만 locale 기반 prompt 재생성, 기존
        저장된 블록은 재번역하지 않음"으로 변경 — ENTERPRISE REQ-ENTERPRISE-
        052와 정합).
      신규 REQ 없음, REQ ID 재배치 없음.
---

# SPEC-REGULA-STRUCTURED-001 — Regula Phase 3 Structured Outputs

## 목적 (Purpose)

Regula의 AnswerBlock(handoff §8.3) 중 **prose 이후의 구조화 계층**을 완성한다. Phase 2(CHAT)가 확보한 SSE transport, `useStreamingAnswer` 훅, prose streaming, citation 강제 위에서, Phase 3는 (1) prose 완료 후 Haiku follow-up LLM call로 **checklist / comparison / timeline / related 블록을 생성**하고, (2) Zod 스키마로 검증한 뒤 SSE event(`checklist`, `comparison`, `timeline`, `related`)로 방출하며, (3) 각 블록을 `message_blocks` 테이블에 INSERT하고, (4) 프론트에서 Checklist/ComparisonTable/Timeline/Callout/SuggestionPill/RightContextPanel 컴포넌트로 렌더링한다. 최종적으로 `/chat` 페이지가 handoff §7.4 "Most important screen" 사양을 구조적으로 충족한다. History 뷰 재렌더링(Phase 4), Expert review 통합 UI(Phase 5), i18n(Phase 5)은 의도적으로 배제한다.

본 Phase는 FOUNDATION `message_blocks.block_type` pgEnum 6값과 CHAT SSE event 9종 type union을 **모두 실제로 활용하는 최초의 Phase**이며, 여기서 확정한 `lib/ai/structured-schema.ts`는 Phase 4 History 렌더링의 공용 읽기 계약이 된다.

---

## 범위 (Scope)

### In Scope

| 구분 | 산출물 |
|---|---|
| Follow-up LLM 파이프라인 | `lib/ai/structured-blocks.ts` — prose·question·top-3 sources를 받아 Haiku follow-up call을 실행하고 4종 블록(checklist/comparison/timeline/related)을 AsyncGenerator로 순차 방출 |
| Structured prompts | `lib/ai/structured-prompts.ts` — 4개 system prompt (checklist 판별·생성, comparison 판별·생성, timeline 판별·생성, related 3~5개 고정 생성). 모두 한국어 출력 강제 |
| Zod 공유 스키마 | `lib/ai/structured-schema.ts` — 6종 블록(`prose`, `checklist`, `comparison`, `timeline`, `sources`, `related`) Zod export. 서버/클라이언트 양쪽 import. 실패 시 parse throw |
| SSE event 발행 wiring | Phase 2에서 type만 정의된 `checklist`/`comparison`/`timeline`/`related` event를 `/api/ra/consult` handler에서 **실제로 방출** (prose `done` 이후 순차). `sources`는 Phase 2 소관 유지 |
| `message_blocks` INSERT | prose 저장 후 6종 block_type(`prose`, `checklist`, `comparison`, `timeline`, `sources`, `related`) 모두에 대해 `order_index` 지정하여 INSERT. 저장 실패는 SSE `error` event로 이월 |
| Checklist component | `components/chat/Checklist.tsx` — 16×16 checkbox, ref 배지, 완료 상태 낙관적 업데이트 + 서버 persist |
| ComparisonTable component | `components/chat/ComparisonTable.tsx` — sticky first column, region-chip `<th>`, vertical-align top |
| Timeline component | `components/chat/Timeline.tsx` — 좌측 1px 수직선, 9px bullet, `.current` amber 강조 |
| Callout component | `components/chat/Callout.tsx` — 3 variants (info/warn/expert), AnswerBlock Step 2에서 재사용 |
| SuggestionPill component | `components/chat/SuggestionPill.tsx` — rounded-full, Plus 아이콘, 클릭 시 Composer prefill (auto-submit 없음) |
| RightContextPanel component | `components/chat/RightContextPanel.tsx` — 현재 프로젝트 + 활용 출처 top 5 + 관련 규제 업데이트 3개 (handoff §7.4) |
| AnswerBlock 확장 | `components/chat/AnswerBlock.tsx`에 block_type switch 도입, Phase 2의 prose+sources raw list를 §8.3 14-step composite로 확장 |
| Checklist persist API | `app/api/ra/messages/[messageId]/blocks/[blockId]/route.ts` — `PATCH` endpoint로 `block_json` 전체 교체. 소유권 검증, Zod parse |
| SuggestionPill prefill 훅 | `hooks/useComposerPrefill.ts` — SuggestionPill 클릭 시 Composer 입력 focus + 텍스트 주입 |
| Order violation guard | `/api/ra/consult` handler가 `prose_done` 내부 플래그 before에 structured event 방출 시도 시 throw (server-side invariant) |

### Out of Scope

다음 항목은 후속 Phase에서 처리하며, 본 SPEC에서는 **의도적으로 구현하지 않는다**:

| 항목 | 해당 Phase | 사유 |
|---|---|---|
| History 뷰에서 과거 대화의 structured block 재렌더링 | Phase 4 | handoff §20 Phase 4 scope. 단, Phase 3가 확정한 `structured-schema.ts`는 Phase 4가 read-only로 import |
| Templates 페이지에서 checklist를 템플릿으로 저장 | Phase 4 | handoff §7.6. Phase 3는 block_json shape만 확정 |
| Expert review 패널 UI가 block 단위로 코멘트 표시 | Phase 5 | handoff §7.4 Topbar "전문가 검토" 버튼 연동은 Phase 5 |
| Multi-user 공유 대화에서 checklist 완료 상태 분리 | Phase 5 | `checklist_completions` 정규화 테이블 migration은 Phase 5 enterprise hardening |
| i18n: English structured 블록 생성 (신규 질의용 prompt locale branching) | Phase 5 | Phase 3는 `locale: 'ko'` 하드코딩. **v0.2.0 H4 — ENTERPRISE REQ-ENTERPRISE-052와 정합: 과거 저장된 ko 블록은 Phase 5에서도 재번역하지 않음, prompt locale branching은 Phase 5 신규 질의만 적용** |
| ComparisonTable을 horizontal scroll이 아닌 여러 event로 분할 | Phase 5 | Phase 3는 단일 `comparison` event + 8KB 제한 |
| `checklist.toggle` audit action **wiring** 및 writeAudit call-site | Phase 5 | **v0.2.0 C3 — enum 값 `checklist.toggle`은 FOUNDATION v0.4.0 REQ-FND-049 inventory table에서 Phase 1 선제 선언됨. Phase 3 writeAudit 미호출 원칙(REQ-STRUCT-037)은 유지(scope discipline). Phase 5 ENTERPRISE REQ-ENTERPRISE-028이 call-site 추가와 동시에 pgEnum 확장 마이그레이션 수행** |
| SuggestionPill 자동 submit 모드 (A/B 테스트) | Phase 5+ | Phase 3는 prefill only |
| Dark mode polish for block 컴포넌트 | Phase 5 | Phase 3는 기본 토큰만 사용, 세부 조정은 Phase 5 접근성 감사 |
| Timeline 월 단위 grouping UI | Phase 5 | Phase 3는 단순 수직 리스트 |
| ChecklistItem에 `refSourceIndex` 클릭 → DocViewer 오픈 연동 | Phase 4 | DocViewer는 Phase 4 범위. Phase 3는 필드 정의만 |

---

## 기술 결정 (Technical Decisions)

| # | 결정 항목 | 선택 | 탈락안 | 근거 | 재평가 조건 |
|---|---|---|---|---|---|
| 1 | 구조화 블록 생성 방식 | **prose 완료 후 follow-up LLM call (Haiku 3.5)** | 단일 Sonnet call + JSON mode (prose + JSON 동시) | prose 말미에서 JSON syntax 섞임 hallucination 관측. Citation 강제(`<sup>`) regex가 JSON 블록에서 오작동. Haiku 비용이 Sonnet ~1/5이며 구조화는 요약 task로 Haiku 충분 | 50+ RA eval set에서 구조화 블록 사실 정합성 hit rate < 80% 시 Sonnet으로 상향 |
| 2 | Zod 스키마 위치 | **`lib/ai/structured-schema.ts` 서버/클라이언트 공유** | 컴포넌트별 ad-hoc 타입 선언 | drift 방지 + FOUNDATION `message_blocks.block_type` pgEnum과 1:1 정합. Phase 4 History 렌더가 read-only import로 재사용 | 새 block_type 추가 시 Zod + pgEnum migration 동시 수행 |
| 3 | Checklist 완료 상태 저장 | **`message_blocks.block_json.items[].completed` 직접 저장** | 별도 `checklist_completions` 정규화 테이블 | FOUNDATION 스키마 변경 없이 Phase 3 시작. 1인 소유 대화 모델에서 충분 | 다중 사용자 공유 대화 도입 시 정규화 테이블로 migration (Phase 5) |
| 4 | follow-up prompt 토큰 예산 | **prose 결과 + 원 질문 + top-3 sources meta만 재전달** (입력 ≤4K, 출력 ≤2K) | 전체 retrieval context 재전달 | prose가 이미 retrieval 반영. 중복 토큰 소모 불필요. Haiku 컨텍스트 윈도우 효율 극대 | 구조화 품질 저하 시 top-5로 확장 검토 |
| 5 | 구조화 블록 미발행 조건 | **LLM "불필요" 판정 시 event 발행 생략** (null 반환) | 빈 블록 발행 (`{ items: [] }`) | 빈 섹션 헤더 UI 플리커 방지. `useStreamingAnswer.structured.checklist === undefined`로 섹션 자체 미렌더 | — |

---

## EARS 인수 기준 (Acceptance Criteria)

각 요구사항은 `REQ-STRUCT-NNN` ID로 식별하며, EARS 5개 패턴 중 적절한 형태로 기술한다. 모든 요구사항은 테스트 가능(testable)해야 한다.

총 **37개 REQ-STRUCT** (Group A: 10, Group B: 8, Group C: 10, Group D: 5, Group E: 4).

**EARS 패턴 분포:**
- Ubiquitous (The system SHALL ...): 24개 — 항상 참인 구조적 요구
- Event-driven (WHEN ... THEN ...): 6개 (REQ-STRUCT-002, 010, 020, 027, 034) — SSE 이벤트 트리거
- Conditional (IF ... THEN ...): 5개 (REQ-STRUCT-006, 023, 030, 031, 035) — 입력 상태 분기
- State-driven (WHILE ... SHALL ...): 1개 (REQ-STRUCT-033) — viewport 조건
- Unwanted (SHALL NOT ...): 2개 (REQ-STRUCT-003, 018, 037) — 금지 동작

모든 REQ는 자동화 가능 검증 방법을 포함하며, Phase 3 완료 판정 전 Vitest 또는 MSW 기반 테스트 케이스로 회귀 가능해야 한다.

---

### Group A: Follow-up LLM Pipeline & SSE Emission (REQ-STRUCT-001 ~ REQ-STRUCT-010)

**그룹 목적:** prose 완료 후 Haiku follow-up LLM call 실행, 4종 구조화 이벤트(checklist/comparison/timeline/related)를 SSE로 순차 방출. 3단계 스트리밍 순서(Phase A Trace → Phase B Prose → Phase C Structured) 강제. 관련 REQ: REQ-STRUCT-001~010 (generator, order guard, abort, error fallback, classifier, Zod parse skip, retry).

#### REQ-STRUCT-001 (Ubiquitous)
**요구사항:** The system SHALL implement `lib/ai/structured-blocks.ts` exporting an `async function* generateStructuredBlocks(input: StructuredInput): AsyncGenerator<BlockEvent>` where `StructuredInput = { question: string; prose: string; topSources: SourceMeta[]; messageId: string; locale: 'ko' }` and `BlockEvent` is the discriminated union of `ChecklistEvent | ComparisonEvent | TimelineEvent | RelatedEvent` defined in `types/streaming.ts` (CHAT Phase 2 owned).
**근거:** Technical Decision #1 (2-pass) + regula-streaming-contract event union.
**검증 방법:** Vitest에서 mock Haiku client 주입 후 generator가 최대 4개 이벤트를 순차 yield하는지 확인. 타입 컴파일은 `tsc --noEmit` 통과.

#### REQ-STRUCT-002 (Event-driven)
**요구사항:** WHEN `/api/ra/consult` handler completes the `prose_delta` stream and has persisted the prose to `messages.content_prose`, THEN the system SHALL invoke `generateStructuredBlocks(...)` and pipe its events into the same SSE ReadableStream **before** emitting the `done` event.
**근거:** handoff §9.1 Step 6 "Phase C — Post-answer structured blocks arrive" + regula-streaming-contract 3단계 순서.
**검증 방법:** Vitest 통합 테스트에서 SSE 타임라인 캡처: `prose_delta*` → (internal `prose_done` flag set) → `sources` → `checklist?` → `comparison?` → `timeline?` → `related` → `done` 순서 강제 검증.

#### REQ-STRUCT-003 (Unwanted)
**요구사항:** IF the handler attempts to enqueue a `checklist`, `comparison`, `timeline`, or `related` event **before** the internal `prose_done` flag is set, THEN the system SHALL throw `OrderViolationError` with message `"structured event emitted before prose_done: <eventType>"` and close the stream with a terminal `error` event (code `internal_order_violation`).
**근거:** 3단계 순서 계약(Phase A→B→C) 위반은 프론트 렌더 버그 직결. Server-side invariant 강제.
**검증 방법:** Vitest에서 테스트 전용 hook으로 `prose_done` flag을 false로 고정한 뒤 `controller.enqueue(encodeSSE({ type: 'checklist', items: [] }))` 직접 호출 시 throw 확인.

#### REQ-STRUCT-004 (Ubiquitous)
**요구사항:** The `generateStructuredBlocks` function SHALL call Haiku (`claude-haiku-*` variant, exact model pinned in `lib/ai/models.ts`) with input tokens ≤ 4096 and `max_output_tokens` ≤ 2048, using the prompts defined in `lib/ai/structured-prompts.ts`.
**근거:** Technical Decision #4 (minimal prompt budget) + 비용 관리.
**검증 방법:** mock client에서 실제 호출 시 `max_tokens` 옵션 값 검증. 4K 초과 입력은 사전 truncation 로직 (prose 말미부터 잘라내기) 확인.

#### REQ-STRUCT-005 (Ubiquitous)
**요구사항:** For each of the 3 conditional blocks (`checklist`, `comparison`, `timeline`), the system SHALL first call a **classifier prompt** (one-word judgement: `yes` or `no`) to decide whether to emit. Only on `yes` SHALL the system call the full generation prompt and emit the event. The `related` block SHALL always be generated (no classifier, minimum 3 items).
**근거:** Technical Decision #5 (event skip) + handoff §8.3 각 section이 "조건부"로 표기됨.
**검증 방법:** mock Haiku가 classifier 단계에 `no`를 반환하는 시나리오에서 해당 block event가 SSE stream에 나타나지 않음을 확인. `related`는 항상 방출 확인.

#### REQ-STRUCT-006 (Conditional)
**요구사항:** IF the Haiku follow-up call returns JSON that fails Zod `safeParse` against the block schema, THEN the system SHALL (1) log the parse error via `console.error` with the raw JSON snippet (truncated to 500 chars), (2) **skip** emitting that block event (no SSE event for that block type), (3) continue with the next block in sequence.
**근거:** Technical Decision #5 (event skip) + research.md 리스크 2.
**검증 방법:** mock Haiku가 `{ cols: [...], rows: [[1,2]] }` (cols 길이 3, row 길이 2 mismatch)를 반환하는 시나리오에서 `comparison` event 미방출 + 로그 기록 + `related` event 정상 방출 확인.

#### REQ-STRUCT-007 (Ubiquitous)
**요구사항:** The SSE handler SHALL emit structured events in this exact order when present: `confidence` → `sources` → `checklist` → `comparison` → `timeline` → `related` → (optional `expert_review_required`) → `done`. Absent blocks are simply skipped; order of emitted events MUST remain monotonic.
**근거:** regula-streaming-contract Phase C 정렬 + handoff §8.3 AnswerBlock 단계 순서.
**검증 방법:** Vitest 통합 테스트에서 SSE event sequence를 배열로 수집, expected order의 subsequence 관계 검증 (skipped 허용).

#### REQ-STRUCT-008 (Ubiquitous)
**요구사항:** The `related` event payload SHALL contain at least 3 and at most 5 items, each item being a non-empty Korean natural-language question string (≤ 100 chars). IF Haiku returns fewer than 3 items, the system SHALL retry the `related` prompt once with a "반드시 3~5개를 생성하라" suffix; IF still fewer than 3, the event SHALL be skipped.
**근거:** handoff §7.4 "Suggested follow-up pills" + §8.10 UX.
**검증 방법:** Vitest mock에서 2개 아이템 반환 → 재시도 1회 후 여전히 2개면 event 미방출. 4개 반환 시 1회만 호출.

#### REQ-STRUCT-009 (Ubiquitous)
**요구사항:** The `generateStructuredBlocks` function SHALL accept an `AbortSignal` parameter and SHALL immediately stop yielding events when the signal is aborted, propagating the abort to the underlying Haiku client.
**근거:** research.md 리스크 — race condition 방지. 사용자가 새 질문 제출 시 기존 structured call 중단.
**검증 방법:** Vitest에서 `AbortController.abort()` 호출 후 generator가 `return` (not throw)로 종료되는지, 이후 enqueue 호출이 없는지 확인.

#### REQ-STRUCT-010 (Event-driven)
**요구사항:** WHEN the Haiku follow-up call itself errors (network, rate limit, model unavailable) before any event is emitted, THEN the system SHALL emit a single SSE event `{ type: 'error', code: 'structured_followup_failed', message: <redacted error> }` but SHALL still emit the terminal `done` event afterward (prose answer remains valid).
**근거:** Graceful degradation — prose 답변만으로도 사용자에게 가치 제공.
**검증 방법:** Haiku mock이 throw하는 시나리오에서 SSE stream이 `error` + `done`으로 종료, 프론트 `useStreamingAnswer.status === 'done'` (not `'error'`) 확인.

---

### Group B: Zod Schema & Structured Prompts (REQ-STRUCT-011 ~ REQ-STRUCT-018)

**그룹 목적:** 6종 블록 Zod 스키마를 서버/클라이언트 공유 단일 모듈로 제공, Haiku follow-up에 사용되는 7개 prompt builder 정의. FOUNDATION `message_blocks.block_type` pgEnum과 1:1 정합 유지. 관련 REQ: REQ-STRUCT-011~018 (6 schema, refinement, prompt shape, no-HTML 금지).

#### REQ-STRUCT-011 (Ubiquitous)
**요구사항:** The system SHALL implement `lib/ai/structured-schema.ts` exporting 6 named Zod schemas: `ProseBlockSchema`, `ChecklistBlockSchema`, `ComparisonBlockSchema`, `TimelineBlockSchema`, `SourcesBlockSchema`, `RelatedBlockSchema`, plus a discriminated-union `BlockSchema = z.discriminatedUnion('type', [...])`.
**근거:** Technical Decision #2 (shared schema) + FOUNDATION `message_blocks.block_type` pgEnum 6값과 1:1.
**검증 방법:** `import { BlockSchema } from '@/lib/ai/structured-schema'` 후 6종 각각의 `safeParse` 정상 케이스 통과.

#### REQ-STRUCT-012 (Ubiquitous)
**요구사항:** `ChecklistBlockSchema` SHALL define `items: z.array(z.object({ id: z.string().min(1), title: z.string().min(1).max(200), ref: z.string().max(100).optional(), refSourceIndex: z.number().int().positive().optional(), completed: z.boolean() })).min(1).max(20)`.
**근거:** handoff §8.5 Checklist Row (title + ref + completed) + research.md 리스크 3 (refSourceIndex 선택 필드).
**검증 방법:** 21개 items 입력 시 parse 실패, 0개 items 입력 시 parse 실패, 정상 1~20개 items 통과.

#### REQ-STRUCT-013 (Ubiquitous)
**요구사항:** `ComparisonBlockSchema` SHALL define `title: z.string().min(1).max(120), cols: z.array(z.string().min(1)).min(2).max(5), rows: z.array(z.array(z.string())).min(1).max(30)` AND include a `.refine((data) => data.rows.every((r) => r.length === data.cols.length), { message: 'row length must equal cols length' })` check.
**근거:** handoff §8.6 ComparisonTable + research.md 리스크 4 (row/col 길이 mismatch 방어).
**검증 방법:** `cols: ['FDA', 'EU']`, `rows: [['a']]` 입력 시 refine 실패 확인. `cols`가 6개 또는 1개인 경우 min/max 실패.

#### REQ-STRUCT-014 (Ubiquitous)
**요구사항:** `TimelineBlockSchema` SHALL define `items: z.array(z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), title: z.string().min(1).max(120), description: z.string().max(300), current: z.boolean().optional() })).min(1).max(12)` AND include a `.refine((data) => data.items.filter((i) => i.current === true).length <= 1, { message: 'at most one current item' })` check.
**근거:** handoff §8.7 Timeline + research.md QA "`current: true` 1개 이하".
**검증 방법:** items 2개 모두 `current: true` 입력 시 refine 실패. `2026/01/15` 같은 잘못된 date 포맷 실패.

#### REQ-STRUCT-015 (Ubiquitous)
**요구사항:** `SourcesBlockSchema` SHALL match the `SourcesEvent` shape defined in regula-streaming-contract (`items: Source[]`) with `Source = { citeIndex: z.number().int().positive(), id: z.string().uuid(), orgLabel, title, year, type: z.enum(['Regulation','Guidance','Standard','Industry','Internal']), region: z.string(), url: z.string().url().optional() }`.
**근거:** regula-streaming-contract Source interface + FOUNDATION `sources.type` pgEnum 일치.
**검증 방법:** FOUNDATION `sourceType` pgEnum 값(5종)과 Zod enum 값 완전 일치 확인. `citeIndex=0` 또는 음수 입력 시 parse 실패.

#### REQ-STRUCT-016 (Ubiquitous)
**요구사항:** `RelatedBlockSchema` SHALL define `items: z.array(z.string().min(1).max(100)).min(3).max(5)`.
**근거:** REQ-STRUCT-008 item 개수 및 길이 제한.
**검증 방법:** 2개 아이템 입력 시 parse 실패, 6개 입력 시 parse 실패, 101자 아이템 입력 시 실패.

#### REQ-STRUCT-017 (Ubiquitous)
**요구사항:** The system SHALL implement `lib/ai/structured-prompts.ts` exporting 7 prompt builder functions: `buildChecklistClassifier`, `buildChecklistGenerator`, `buildComparisonClassifier`, `buildComparisonGenerator`, `buildTimelineClassifier`, `buildTimelineGenerator`, `buildRelatedGenerator`. Each function SHALL accept `{ question, prose, topSources, locale }` and return a single string prompt. All generator prompts SHALL end with the instruction `"응답은 오직 JSON 객체로만 출력하라. 코드 블록, 해설, 서문 금지."`.
**근거:** research.md Technical Decision #1 (분리 call) + Haiku JSON 출력 일관성.
**검증 방법:** 각 함수가 Korean prompt string을 반환하며 말미에 지정된 instruction 포함 확인.

#### REQ-STRUCT-018 (Unwanted)
**요구사항:** The structured prompts SHALL NOT instruct the LLM to include `<sup class="cite">` markup or any HTML in the JSON output. Checklist `ref` field SHALL be pure text (e.g., `"21 CFR §807.81(a)"`), not HTML anchor.
**근거:** research.md 리스크 3 — prose citation index와 structured ref 혼동 방지. regula-citation-contract: citation은 prose 구간에만 적용.
**검증 방법:** 각 prompt 소스를 읽어 `<sup` 또는 `data-source=` 문자열 부재 확인 (정적 grep).

---

### Group C: Frontend Components (REQ-STRUCT-019 ~ REQ-STRUCT-028)

**그룹 목적:** handoff §8.3 AnswerBlock 14-step composite를 완성하는 6개 신규 컴포넌트(Checklist, ComparisonTable, Timeline, Callout, SuggestionPill + AnswerBlock 확장). Phase 2가 제공한 prose+citation 렌더 위에 구조화 영역을 얹는다. 접근성(role, aria-label, aria-checked)을 기본 탑재. 관련 REQ: REQ-STRUCT-019~028 (렌더, 상호작용, readOnly prop, 11-section switch).

#### REQ-STRUCT-019 (Ubiquitous)
**요구사항:** The system SHALL implement `components/chat/Checklist.tsx` as a client component accepting `{ blockId: string, messageId: string, items: ChecklistItem[], readOnly?: boolean }` that renders 16×16 checkboxes (border-strong → success-fill on check) with item title + optional ref badge (mono font, `bg-surface-2`).
**근거:** handoff §8.5 Checklist Row 스펙.
**검증 방법:** Vitest + @testing-library/react로 3개 items 렌더 시 3개 `role="checkbox"` 존재, ref 배지는 `<code>` 또는 mono 클래스 확인.

#### REQ-STRUCT-020 (Event-driven)
**요구사항:** WHEN a user clicks a Checklist checkbox in non-readOnly mode, THEN the component SHALL (1) update local state optimistically (toggle `completed`), (2) issue `PATCH /api/ra/messages/:messageId/blocks/:blockId` with debounce 300ms, (3) on HTTP error roll back local state and display toast `"체크리스트 저장 실패 — 다시 시도하세요"`.
**근거:** Technical Decision #3 (block_json 내장) + research.md 리스크 6 (동시성).
**검증 방법:** MSW(Mock Service Worker)로 PATCH 500 응답 mock → 클릭 후 checkbox rollback, 토스트 메시지 DOM 확인. 300ms 내 연속 3클릭 시 PATCH 호출 1회.

#### REQ-STRUCT-021 (Ubiquitous)
**요구사항:** The `PATCH /api/ra/messages/:messageId/blocks/:blockId` endpoint SHALL (1) verify `session.user.id` matches `conversations.user_id` of the owning conversation, (2) Zod-parse the request body against `ChecklistBlockSchema`, (3) UPDATE `message_blocks.block_json` with the new value, (4) return `204 No Content` on success, `403` on ownership mismatch, `400` on Zod failure, `404` on block not found.
**근거:** Technical Decision #3 + handoff §16 audit 원칙 (소유권 검증).
**검증 방법:** Vitest 통합 테스트: 다른 유저 대화의 block PATCH 시도 → 403. 잘못된 JSON → 400. 정상 → 204 + DB row 변경 확인.

#### REQ-STRUCT-022 (Ubiquitous)
**요구사항:** The system SHALL implement `components/chat/ComparisonTable.tsx` as a client component accepting `{ title: string, cols: string[], rows: string[][] }` that renders `<table>` with `<th scope="col">` region chips in header, first-column sticky (`bg-surface-2`, right border), and `vertical-align: top` on cells with long content.
**근거:** handoff §8.6 + research.md 미해결 4 (접근성 `<th scope="col">`).
**검증 방법:** DOM 출력에 `<table>` + `<th scope="col">` 존재, cols=3/rows=2 입력 시 2×3 `<td>` 렌더 확인. CSS computed style에서 `position: sticky` 첫 컬럼 확인.

#### REQ-STRUCT-023 (Conditional)
**요구사항:** IF `cols.length !== row.length` for any row passed to `ComparisonTable`, THEN the component SHALL render a single fallback message `"표 데이터 형식 오류"` in `bg-warn-50` background instead of the table. (서버측 Zod가 1차 방어, 클라이언트는 심층 방어.)
**근거:** research.md 리스크 4 (row/col mismatch 이중 방어).
**검증 방법:** props로 `cols=['A','B'], rows=[['x']]` 전달 시 fallback 메시지 DOM 확인, `<table>` 미렌더 확인.

#### REQ-STRUCT-024 (Ubiquitous)
**요구사항:** The system SHALL implement `components/chat/Timeline.tsx` as a client component accepting `{ items: TimelineItem[] }` that renders a left-aligned 1px vertical line with 9px circular bullets (`bg-surface` fill + 2px brand border). Items where `current === true` SHALL render with full amber fill (`bg-accent-500`) and the date text SHALL use `aria-label` prefix `"현재 단계: "`.
**근거:** handoff §8.7 Timeline + research.md 미해결 4 (접근성 aria-label).
**검증 방법:** 3 items 중 1개 current 설정 시 해당 bullet에 `bg-accent-500` 클래스 적용 확인, `aria-label="현재 단계: 2026-06-15 ..."` DOM attr 확인.

#### REQ-STRUCT-025 (Ubiquitous)
**요구사항:** The system SHALL implement `components/chat/Callout.tsx` accepting `{ variant: 'info' | 'warn' | 'expert', title: string, children: ReactNode }` rendering an icon + bold title + body. Variant styling: `info` = `bg-brand-50 border-brand-200`, `warn` = `bg-accent-50 border-accent-400`, `expert` = `bg-accent-100 border-accent-600`.
**근거:** handoff §8.8 Callout 3 variants. Phase 2 AnswerBlock Step 2 (expert-review callout)에서도 재사용.
**검증 방법:** 3 variants 각각 렌더 시 해당 CSS 클래스(또는 token utility) 적용 확인.

#### REQ-STRUCT-026 (Ubiquitous)
**요구사항:** The system SHALL implement `components/chat/SuggestionPill.tsx` accepting `{ text: string, onClick: () => void }` rendering a rounded-full button (`border-subtle` → hover `border-brand-400 bg-brand-50`) with a Plus icon prefix (`lucide-react` `Plus`, 14×14). The button SHALL have `role="button"` and `aria-label={`이어서 질문하기: ${text}`}`.
**근거:** handoff §8.10 SuggestionPill + 접근성.
**검증 방법:** Vitest에서 클릭 시 `onClick` 호출 확인, `Plus` 아이콘 SVG 렌더 확인, `aria-label` attr 포함 확인.

#### REQ-STRUCT-027 (Event-driven)
**요구사항:** WHEN a user clicks a `SuggestionPill`, THEN the system SHALL (1) call `useComposerPrefill().prefill(text)` which populates the Composer textarea value + places focus, (2) SHALL NOT automatically submit the question, (3) SHALL scroll Composer into view if offscreen.
**근거:** research.md 해석 4 (Composer prefill, auto-submit 없음).
**검증 방법:** Vitest에서 mock Composer 상태 확인 — prefill 호출 후 textarea value = text, `document.activeElement === textarea`, SSE 요청 미발생.

#### REQ-STRUCT-028 (Ubiquitous)
**요구사항:** `components/chat/AnswerBlock.tsx` SHALL be extended from Phase 2 to render in the following exact order when corresponding `structured` state fields are populated:
1. Meta row (Phase 2 soft)
2. Expert-review Callout (`variant='expert'`) IF `structured.expertReviewRequired`
3. Section label `"요약 답변"` + prose (Phase 2)
4. Section label `"핵심 체크리스트"` + completion counter IF `structured.checklist`
5. `<Checklist />` IF `structured.checklist`
6. Section label `"주요 관할권별 비교"` IF `structured.comparison`
7. `<ComparisonTable />` IF `structured.comparison`
8. Section label `"실행 타임라인"` IF `structured.timeline`
9. `<Timeline />` IF `structured.timeline`
10. Section label `"출처 (N)"` + SourceCard grid (Phase 3가 grid UI 추가) IF `structured.sources`
11. Section label `"이어서 질문하기"` + `<SuggestionPill />` row IF `structured.related`

Absent structured fields SHALL skip both the section label and the component (no empty header rendering).
**근거:** handoff §8.3 AnswerBlock 14-step composite + Technical Decision #5 (UI 플리커 방지).
**검증 방법:** Vitest에서 `structured.comparison = undefined` 시나리오 → DOM에 `"주요 관할권별 비교"` 텍스트 부재 확인. 전체 structured 채운 시나리오 → 11개 영역 순서대로 렌더 확인.

---

### Group D: RightContextPanel (REQ-STRUCT-029 ~ REQ-STRUCT-033) — [v0.2.0 C5 수정]

**그룹 목적 (v0.2.0 C5 재정의):** handoff §7.4 Chat 페이지 우측 360px 컨텍스트 패널 3구역(현재 프로젝트 / 활용 출처 top 5 / 관련 규제 업데이트 3개)의 **스켈레톤 컴포넌트**를 구현. 실제 API 호출을 통한 데이터 연결은 Phase 4 BREADTH REQ-BREADTH-050 "실데이터 연결"에서 수행 (projects API는 Phase 4 owned). Phase 3는 3 섹션 구조, 빈 상태, 로딩 스피너, 반응형 breakpoint 1100px 경계, 컴포넌트 props interface만 안정화한다.

관련 REQ: REQ-STRUCT-029~033 (3 섹션 순서, 빈 상태/로딩 UI, responsive breakpoint, props interface).

#### REQ-STRUCT-029 (Ubiquitous) [v0.2.0 C5 수정]
**요구사항:** The system SHALL implement `components/chat/RightContextPanel.tsx` as a client component accepting `{ currentProjectId: string | null, latestMessageId: string | null }` that renders three sections in this exact order: (1) `"현재 프로젝트"`, (2) `"활용 출처"` (top 5), (3) `"관련 규제 업데이트"` (3 items). Phase 3는 **스켈레톤**만 구현하며 (3 섹션 헤더 + 빈 상태 + 로딩 스피너 UI), **실제 API 호출 및 데이터 fetch는 Phase 4 BREADTH REQ-BREADTH-050에서 wire-up**한다.
**근거:** handoff §7.4 우측 컨텍스트 패널 3구역 + cross-spec-audit C5 (Phase 3/4 dependency inversion 해소 — projects API는 Phase 4 owned).
**검증 방법:** DOM에 3개 섹션 헤더 uppercase(`text-transform: uppercase`) 존재 및 순서 확인. Phase 3 단독 테스트에서 API 호출 spy 0건 확인 (TanStack Query fetch 없음).

#### REQ-STRUCT-030 (Conditional) [v0.2.0 C5 수정]
**요구사항:** IF `currentProjectId` is non-null, THEN the panel SHALL render a **placeholder card** with project dot + text `"프로젝트 정보 로딩 중 (Phase 4)"` (Phase 4 BREADTH REQ-BREADTH-050에서 실제 project 데이터로 교체). IF `currentProjectId` is null, THEN the panel SHALL render a subdued placeholder `"프로젝트를 선택하세요"`.

**Phase 3 단독 UX (Phase 4 wire-up 이전):** 두 경우 모두 실제 projects API 호출 없이 정적 UI 렌더. Phase 4에서 `useProject(currentProjectId)` TanStack Query 훅 연결 후 colored card + project name + `"Class {device_class} · NB · {submission_date}"` meta line 표시로 교체 (BREADTH REQ-BREADTH-050).

**근거:** handoff §7.4 현재 프로젝트 카드 + FOUNDATION `projects` 테이블 컬럼 + cross-spec-audit C5 (STRUCTURED가 Phase 4 API에 의존하지 않도록 스켈레톤화).
**검증 방법:** Vitest에서 currentProjectId 주입 → 로딩 placeholder DOM 확인 (실 project 데이터 렌더 없음). null 주입 → "프로젝트를 선택하세요" placeholder 확인. Phase 4 통합 테스트에서는 실 데이터 카드 렌더로 전환 확인.

#### REQ-STRUCT-031 (Conditional) [v0.2.0 C5 수정]
**요구사항:** The `"활용 출처"` section SHALL render a loading skeleton (5개 empty row placeholder with pulse animation) in Phase 3. **실제 `GET /api/ra/messages/:messageId/sources?limit=5` API 호출 및 compact row rendering은 Phase 4 BREADTH wire-up에서 수행**. Phase 3는 API endpoint(`app/api/ra/messages/[messageId]/sources/route.ts`)는 구현하되(Deliverables #6 유지), RightContextPanel 내부 fetch는 호출하지 않는다.

**Phase 4 최종 동작 (참고):** `[citeIndex badge] + title (2-line clamp) + "{orgLabel} · {year}"` (mono font) 렌더 (BREADTH에서 실제 wire-up).

**근거:** handoff §7.4 활용 출처 compact list + cross-spec-audit C5 (Phase 3 API endpoint 존재하되 UI wire-up은 Phase 4 — `useMessageSources` 훅 추가는 BREADTH REQ-BREADTH-056의 TanStack Query hooks set과 일관).
**검증 방법:** Phase 3: loading skeleton 5-row DOM 확인. 실 API 호출 spy 0건 확인. Phase 4: MSW mock → 5개 row 렌더, index badge `1`~`5`, mono 클래스 확인 (BREADTH 검증 범위).

#### REQ-STRUCT-032 (Ubiquitous) [v0.2.0 C4/C5 수정]
**요구사항:** The `"관련 규제 업데이트"` section SHALL render a loading skeleton (3개 empty card placeholder) in Phase 3. **실제 `GET /api/ra/updates?relatedTo={projectId}&limit=3` API 호출 및 severity-colored card rendering은 Phase 4 BREADTH REQ-BREADTH-034/050 wire-up에서 수행**. `/api/ra/updates` endpoint는 **BREADTH 단일 오너** (v0.2.0 C4 — STRUCTURED Deliverables에서 제거됨). Phase 3는 fetch hook 미연결.

**Phase 4 최종 동작 (참고):** severity 색상 (critical/warning → `bg-accent-500`, info → `bg-brand-400`) 좌측 border 3px + `"{region} · {published_at}"` meta row (mono font) (BREADTH REQ-BREADTH-034 응답 + REQ-BREADTH-050 wire-up).

**근거:** handoff §7.4 관련 규제 업데이트 + §7.8 severity 색상 규칙 + cross-spec-audit C4 (updates endpoint BREADTH 단일 오너) + C5 (Phase 3 스켈레톤, Phase 4 wire-up).
**검증 방법:** Phase 3: loading skeleton 3-card DOM 확인, API 호출 spy 0건. Phase 4: MSW mock에 1 critical + 2 info item → severity 색상 border 클래스 확인 (BREADTH 검증 범위).

#### REQ-STRUCT-033 (State-driven)
**요구사항:** WHILE viewport width is less than 1100px, the system SHALL hide `RightContextPanel` via CSS (`display: none`) and expand the main chat column to full width. IF viewport width is between 900px and 1099px, THEN the sidebar remains visible but right panel is hidden. IF viewport width is less than 900px, THEN sidebar is also hidden (collapsed to burger menu — Phase 2 owned).
**근거:** handoff §9.7 responsive breakpoints.
**검증 방법:** Vitest + jsdom + `window.matchMedia` mock에서 1050px 설정 시 `RightContextPanel` 부재 확인.

---

### Group E: message_blocks Persistence (REQ-STRUCT-034 ~ REQ-STRUCT-037)

**그룹 목적:** FOUNDATION `message_blocks` 테이블에 6종 block_type(`prose`, `sources`, `checklist`, `comparison`, `timeline`, `related`)을 모두 INSERT — pgEnum의 모든 값을 실제로 활용하는 최초의 Phase. `order_index`로 AnswerBlock 렌더 순서를 직렬화. audit 확장은 수행하지 않음(FOUNDATION REQ-FND-049a scope discipline). 관련 REQ: REQ-STRUCT-034~037 (INSERT order, 실패 fallback, prose block, writeAudit 미호출).

#### REQ-STRUCT-034 (Event-driven)
**요구사항:** WHEN the `/api/ra/consult` handler emits a `checklist`, `comparison`, `timeline`, `sources`, or `related` SSE event, THEN the handler SHALL **before** enqueueing the event, persist it to `message_blocks` via a single INSERT with columns `(message_id, block_type, block_json, order_index, created_at)` where `block_type` matches the event type and `order_index` is determined by the emission order (0=prose, 1=sources, 2=checklist, 3=comparison, 4=timeline, 5=related).
**근거:** FOUNDATION REQ-FND-038 (`message_blocks` 테이블 + `order_index`) + Technical Decision #3.
**검증 방법:** Vitest 통합 테스트에서 mock conversation에 질문 제출 후 `SELECT block_type, order_index FROM message_blocks WHERE message_id=...` 결과가 방출 순서와 일치 확인.

#### REQ-STRUCT-035 (Conditional)
**요구사항:** IF the `message_blocks` INSERT fails (e.g., DB connection error), THEN the handler SHALL (1) abort emission of the corresponding SSE event, (2) emit `{ type: 'error', code: 'block_persist_failed', message: <redacted> }`, (3) continue with remaining blocks (other block INSERTs may still succeed).
**근거:** Fail-safe — DB 실패가 사용자에게 보이는 부분적 답변을 보존.
**검증 방법:** Vitest에서 Drizzle client에 INSERT throw mock 주입 → `checklist` event 미방출, `error` event 방출, 후속 `related` event 정상 방출 확인.

#### REQ-STRUCT-036 (Ubiquitous)
**요구사항:** The prose block (type `prose`) SHALL also be persisted to `message_blocks` with `order_index=0` and `block_json = { type: 'prose', text: <final prose with citations> }`. This INSERT happens after prose_delta stream completes, **before** the first structured block INSERT.
**근거:** `message_blocks.block_type` pgEnum의 `'prose'` 값을 실제로 사용하여 후속 History 렌더(Phase 4)가 block 목록만으로 전체 답변을 복원할 수 있도록 함.
**검증 방법:** 질문 제출 후 `SELECT block_json FROM message_blocks WHERE message_id=... AND block_type='prose'` 결과가 최종 prose와 일치 확인.

#### REQ-STRUCT-037 (Unwanted)
**요구사항:** The Phase 3 implementation SHALL NOT invoke `writeAudit(...)` for checklist toggle events, structured block generation, or block INSERT operations. These audit call-sites are explicitly deferred to Phase 5 per FOUNDATION REQ-FND-049a (scope discipline: Phase 3 does not add new `action` enum values to `audit_logs`).
**근거:** FOUNDATION REQ-FND-049 / REQ-FND-049a — Phase 3는 `llm.call`/`source.access`/`expert_review.flag` 외 새 action을 도입하지 않음. `checklist.toggle` action은 Phase 5 SPEC에서 enum 확장과 call-site 추가를 동시에 수행.
**검증 방법:** `grep -r "writeAudit(" app/api/ra/consult app/api/ra/messages lib/ai --include="*.ts"` 실행 결과 Phase 3 신규 코드에 0건. (Phase 2의 `llm.call` call-site는 Phase 3에서 수정 금지.)

---

## 의존성 (Dependencies)

### 상위 SPEC

| SPEC | 버전 | 상속 내용 |
|---|---|---|
| SPEC-REGULA-FOUNDATION-001 | v0.3.0 | `message_blocks` 테이블 + `block_type` pgEnum 6값, `block_json` jsonb, `order_index`, `messages.content_prose`, `message_sources.cite_index`, `sources.type` pgEnum, `writeAudit` helper signature, 21 CFR Part 11 audit_logs (Phase 3는 확장하지 않음), `<html lang="ko">`, Tailwind v4 `@theme` 토큰 |
| SPEC-REGULA-CHAT-001 | Wave 1 동시 작성 | `/api/ra/consult` SSE endpoint, 9종 SSE event type union, `useStreamingAnswer` 훅, Composer, prose streaming + citation 강제, `sources` event 발행, `expert_review_required` event 발행, audit `llm.call`/`source.access` call-sites |

### 하위 SPEC (Phase 4+에서 생성 예정)

- `SPEC-REGULA-BREADTH-001` (Phase 4) — History / Templates / Knowledge / Updates / Dashboard. `structured-schema.ts`를 read-only import, `message_blocks` 목록을 AnswerBlock으로 재렌더
- `SPEC-REGULA-ENTERPRISE-001` (Phase 5) — Expert review 패널, RBAC, 관측성 (Langfuse/Sentry), i18n(en), `checklist.toggle` audit action

### 외부 의존성 (사용자 과제)

| 의존성 | 설명 | 담당 |
|---|---|---|
| Anthropic Haiku API | `@anthropic-ai/sdk` Phase 2에서 이미 설치됨. 환경변수 `ANTHROPIC_API_KEY` 및 모델 ID `claude-haiku-*` 핀 | CHAT Phase 2 |
| Vercel AI SDK `ai` | FOUNDATION REQ-FND-004에서 이미 의존성 추가 | FOUNDATION |
| `lucide-react` | FOUNDATION에서 이미 포함 예상, 명시 없으면 Phase 3 추가 (Plus icon 등) | FOUNDATION or Phase 3 |

---

## 위험 및 가정 (Risks & Assumptions)

| 구분 | 항목 | 영향 | 대응 |
|---|---|---|---|
| 위험 | Haiku follow-up 지연이 P95 > 3s | 사용자 체감 "답변 미완" | "구조화 중..." 상태 표시 + P95 SLO 관측 (Langfuse Phase 5). Phase 3 본 SPEC에서는 상태 표시만 강제 |
| 위험 | Zod parse 실패로 빈 UI (event skip 후) | 기대한 checklist 없음 | REQ-STRUCT-006: 로그 남김 + 다음 block 계속. `related`는 재시도 1회 |
| 위험 | ComparisonTable 대형 데이터 시 SSE 8KB 초과 | Vercel Edge chunk 실패 | Zod에서 cols≤5, rows≤30 제한. 초과 시 parse 실패 → event skip |
| 위험 | Checklist 빠른 연속 토글로 `PATCH` 경합 | LWW로 data loss 가능 | 300ms debounce + Phase 5에서 ETag 도입 고려 |
| 위험 | FOUNDATION `block_type` pgEnum과 Zod `type` enum drift | 런타임 mismatch | CI에서 `migrations/*.sql`의 `block_type` enum 값과 `structured-schema.ts` BlockSchema discriminator 값 일치 검증 (Vitest) |
| 위험 | `related` 3개 최소 보장 실패 시 사용자 경험 저하 | follow-up 질문 없음 | 재시도 1회 후 skip → 프론트는 섹션 자체 미렌더 (플리커 없음) |
| 가정 | CHAT Phase 2가 prose 완료 시 내부 `prose_done` 플래그를 set한다 | Phase 3 order violation guard 동작 전제 | CHAT SPEC에서 해당 flag 공개 내부 API로 확정 (Wave 1 동시 작성 중 조정) |
| 가정 | FOUNDATION `message_blocks.block_json`이 jsonb NOT NULL default `{}`이다 | INSERT 로직 전제 | FOUNDATION REQ-FND-038에서 확인 완료 |
| 가정 | 사용자가 동일 conversation을 여러 탭에서 보지 않는다 (Phase 3 단순화) | 동시 토글 시나리오 희박 | Phase 5에서 realtime sync 검토 |
| 가정 | Haiku의 Korean JSON 출력 품질이 Sonnet 대비 충분하다 | 구조화 품질 저하 리스크 | 50+ eval set으로 kickoff 전 smoke, 미달 시 Technical Decision #1 재평가 |

---

## 테스트 전략 (Test Strategy)

Phase 3는 **구조화 블록 생성 + 렌더링 + persistence**가 중심이며, LLM 품질은 Phase 6 eval harness에서 체계적으로 검증한다.

### 단위 테스트 (Vitest)

- `lib/ai/structured-schema.ts` — 6종 Zod 스키마 × (정상 / min/max 경계 / refinement 실패) 테스트 매트릭스
- `lib/ai/structured-blocks.ts` — mock Haiku 주입 후 AbortSignal, classifier yes/no, parse 실패 skip, related 재시도 시나리오
- `lib/ai/structured-prompts.ts` — 7 prompt builder가 Korean + 지정 instruction 말미 포함 검증
- `components/chat/Checklist.tsx` — 토글 낙관적 업데이트 + rollback (MSW)
- `components/chat/ComparisonTable.tsx` — cols/rows mismatch 시 fallback 렌더, sticky first column
- `components/chat/Timeline.tsx` — current=true aria-label, bullet 색상 클래스
- `components/chat/Callout.tsx` — 3 variants CSS 클래스
- `components/chat/SuggestionPill.tsx` — 클릭 시 prefill 호출, auto-submit 미발생
- `components/chat/RightContextPanel.tsx` — 3 섹션 순서, null project placeholder, responsive breakpoint
- `components/chat/AnswerBlock.tsx` — 11 section 조건부 렌더 매트릭스 (structured 각 필드 undefined/populated 조합)
- `hooks/useComposerPrefill.ts` — prefill 호출 시 textarea value + focus

### 통합 테스트 (Vitest + 테스트용 Postgres + mock Anthropic)

- End-to-end SSE 타임라인 검증 (REQ-STRUCT-002, REQ-STRUCT-007): prose_delta → sources → checklist → comparison → timeline → related → done 순서
- Order violation guard (REQ-STRUCT-003): prose_done 전 structured enqueue 시 throw
- Zod parse 실패 event skip (REQ-STRUCT-006): mock Haiku가 malformed JSON → 해당 event 미방출
- `message_blocks` INSERT 6종 block_type 전부 수행 확인 (REQ-STRUCT-034/036)
- `PATCH /api/ra/messages/:messageId/blocks/:blockId` 소유권 검증 (REQ-STRUCT-021): 타 유저 403
- Abort 전파 (REQ-STRUCT-009): AbortController abort → generator return + DB INSERT 미수행
- `block_type` pgEnum ↔ Zod discriminator 일치 CI 검증
- `writeAudit` Phase 3 신규 call-site 0건 확인 (REQ-STRUCT-037): grep 기반 정적 테스트

### 계약 테스트 (regula-compliance-qa)

- Checklist `ref` 필드가 실제 규제 조문 번호 형식(`/^\d+ CFR|EU MDR|ISO|§/` 매칭)인지 sample 20건 검증
- Comparison `cols`이 사전 정의된 관할권 목록(FDA/EU MDR/MFDS/NMPA/PMDA + "International") 내에서만 생성되는지 — 예외 시 regula-compliance-qa 리뷰
- Timeline `current: true` 최대 1개 제약 모든 샘플 통과
- `related` 아이템이 3~5개, 각 ≤100자 샘플 통과
- SSE 타임라인에서 prose_delta 이후에만 structured event 등장 (50개 답변 회귀)
- Checklist HTML 태그 삽입 없음 (REQ-STRUCT-018): 모든 샘플에서 `<` 문자열 부재

### E2E (Playwright, 실제 작성은 Phase 6)

- 질문 제출 → prose 스트림 → structured 블록 순차 등장 → Checklist 체크 → 페이지 새로고침 → 완료 상태 유지
- SuggestionPill 클릭 → Composer 입력 채워짐, 자동 submit 없음
- Viewport 1050px → RightContextPanel 비표시 확인

### 접근성 (Phase 3에서 기본만, 본격 감사는 Phase 5)

- ComparisonTable `<th scope="col">` 자동 검증 (jest-axe 통합 가능)
- Timeline current item `aria-label` 포함
- Checklist `role="checkbox"` + `aria-checked` 동기화
- Callout `role="status"` 또는 `role="alert"` variant별

---

## 산출물 (Deliverables)

| # | 파일 경로 | 책임 에이전트 | handoff 섹션 |
|---|---|---|---|
| 1 | `lib/ai/structured-schema.ts` (6 Zod schemas + BlockSchema union) | regula-backend | §8.3, §11.1 |
| 2 | `lib/ai/structured-prompts.ts` (7 prompt builders) | regula-rag-pipeline | §11.1 |
| 3 | `lib/ai/structured-blocks.ts` (AsyncGenerator + AbortSignal) | regula-rag-pipeline | §9.1, §11.1 |
| 4 | `app/api/ra/consult/route.ts` (확장 — Phase 2 파일 수정: structured 파이프 연결 + order guard + block persist) | regula-backend | §11.1 |
| 5 | `app/api/ra/messages/[messageId]/blocks/[blockId]/route.ts` (PATCH endpoint) | regula-backend | — (§8.5 persist) |
| 6 | `app/api/ra/messages/[messageId]/sources/route.ts` (GET top sources for right panel — endpoint 구현만 Phase 3; UI wire-up은 Phase 4) | regula-backend | §7.4 |
| 7 | ~~`app/api/ra/updates/route.ts`~~ — **v0.2.0 C4: 본 파일은 BREADTH 단일 오너 (Phase 4 REQ-BREADTH-034). STRUCTURED Phase 3는 이 endpoint를 제공하지 않으며, RightContextPanel "관련 규제 업데이트" 섹션은 Phase 3 로딩 스켈레톤만 표시** | BREADTH-001 (Phase 4) | — |
| 8 | `components/chat/Checklist.tsx` | regula-frontend | §8.5 |
| 9 | `components/chat/ComparisonTable.tsx` | regula-frontend | §8.6 |
| 10 | `components/chat/Timeline.tsx` | regula-frontend | §8.7 |
| 11 | `components/chat/Callout.tsx` | regula-frontend | §8.8 |
| 12 | `components/chat/SuggestionPill.tsx` | regula-frontend | §8.10 |
| 13 | `components/chat/RightContextPanel.tsx` | regula-frontend | §7.4 |
| 14 | `components/chat/AnswerBlock.tsx` (Phase 2 확장 — 11 section switch) | regula-frontend | §8.3 |
| 15 | `hooks/useComposerPrefill.ts` | regula-frontend | §8.10, §9.1 |
| 16 | `types/streaming.ts` (Phase 2 공유 — 변경 없음, import만) | regula-frontend (read-only) | §11.1 |

---

## 완료 조건 (Definition of Done)

본 Phase 완료로 간주하려면 다음 조건을 **모두** 충족해야 한다:

- [ ] `pnpm typecheck` 0 오류 (6 Zod 스키마, AsyncGenerator, AnswerBlock switch 전부 타입 안전)
- [ ] Vitest 단위 테스트 전부 PASS (Group A~E 각 REQ에 최소 1개 테스트)
- [ ] Vitest 통합 테스트 전부 PASS (SSE 타임라인 + order guard + INSERT + PATCH 소유권)
- [ ] Biome lint 0 warnings / 0 errors
- [ ] Checklist 체크 → `PATCH` 204 → DB `block_json.items[i].completed = true` 확인
- [ ] mock Haiku로 40개 샘플 답변 생성 시 구조화 블록 Zod parse 성공률 ≥ 95%
- [ ] prose_done 이전 structured event 방출 시도 시 `OrderViolationError` throw 재현
- [ ] `message_blocks` 테이블에 `prose/sources/checklist/comparison/timeline/related` 6종 block_type row 각각 최소 1건 저장된 e2e 시나리오 녹화
- [ ] viewport 1050px에서 RightContextPanel 비표시, 1200px에서 표시 확인 (수동 QA 스크린샷)
- [ ] regula-compliance-qa 계약 테스트 (checklist ref 형식, current ≤ 1, related 3~5개) PASS
- [ ] Phase 3 신규 코드에 `writeAudit(` 호출 0건 (`grep` 확인)
- [ ] `structured-schema.ts`가 Phase 4 SPEC-REGULA-BREADTH-001에서 read-only import 가능하도록 export 안정성 확보 (public API 문서화)

---

## 성능 및 관측성 (Performance & Observability)

Phase 3는 본격 관측성 wiring(Langfuse/Sentry) 범위가 아니지만, Phase 5에서 붙이기 쉽도록 다음 훅 포인트를 확보한다.

### 성능 목표 (Phase 3 SLO)

| 지표 | 목표 | 측정 지점 |
|---|---|---|
| prose `done` → 첫 structured event 간 지연 | P50 ≤ 1.0s, P95 ≤ 3.0s | `/api/ra/consult` handler 내부 타이머 (로컬 console.log, Phase 5 Langfuse 대체) |
| Haiku follow-up 총 지연 (모든 블록 생성 합) | P95 ≤ 5.0s | 동일 |
| Checklist `PATCH` 요청 | P95 ≤ 200ms | Server Timing header |
| ComparisonTable/Timeline 렌더 (150 rows, 30 items) | P95 ≤ 50ms (React Profiler) | Vitest 성능 테스트 |
| SSE 단일 event 크기 | < 8KB | Zod 제약으로 보장 (REQ-STRUCT-013/014) |

### 관측성 훅 포인트 (Phase 5에서 wiring)

- `/api/ra/consult` handler에 `structured_start_at`, `structured_done_at` timestamp 로깅 (console.log 수준, Phase 5에서 `writeAudit` 또는 Langfuse span으로 승격)
- Zod parse 실패 이벤트를 `console.error` + `structured_parse_failed` 카운터로 export (Phase 5 Sentry)
- Checklist `PATCH` endpoint에 요청 카운트 + 실패율 카운터 hook (Phase 5 Prometheus)

### 용량 계획

Phase 3 kickoff 기준 1일 1000개 답변 기준:
- `message_blocks` row 증가: 1000 × 평균 4 blocks = 4000 rows/day, 연간 ~1.5M rows → pgvector 없으므로 table 크기는 B-tree index 포함 수백 MB 수준, 문제 없음
- Haiku follow-up 호출: 1000 × 평균 3.5 call (classifier + generator 조합) = 3500 call/day, 예상 비용 Haiku pricing 기준 관리 가능

---

## 마이그레이션 경로 (Migration Path)

Phase 3는 FOUNDATION 스키마 변경을 요구하지 않으므로 별도 마이그레이션 SQL 파일을 추가하지 않는다. 단, 다음 변경은 추적한다:

- `message_blocks.block_json` 스키마 shape이 Zod `BlockSchema`와 1:1 일치해야 함. 향후 shape 진화 시 `migrations/XXXX_block_json_evolution.sql` 추가 예정 (Phase 5 이후)
- Phase 4 (History) 도입 시 `GET /api/ra/conversations/:id` endpoint가 `blocks[]` 필드를 응답에 포함 — Phase 3는 DB 스키마만 준비, endpoint shape은 Phase 4 SPEC에서 확정

### 역호환성 (Backward Compatibility)

- Phase 2 SSE event type union 9종은 Phase 3에서 변경하지 않음. 새 event type 추가 없음
- Phase 2 `useStreamingAnswer` state shape은 Phase 3에서 유지 (기존 필드 제거/이름 변경 없음)
- FOUNDATION `message_blocks.block_json` 컬럼의 jsonb 허용 범위 내에서 shape 자유. 과거 저장된 row의 shape 변경 없음

### 롤백 계획 (Rollback Plan)

Phase 3 배포 후 심각한 이슈 발생 시 다음 순서로 롤백:

1. 서버: `/api/ra/consult` handler에서 `generateStructuredBlocks` 호출부 feature flag(`ENABLE_STRUCTURED_BLOCKS`)로 비활성화 → prose `done` 직후 SSE `done` 즉시 방출 (Phase 2 동작으로 복귀)
2. 프론트: `AnswerBlock.tsx`의 structured switch가 `structured.{field} === undefined`이면 섹션 미렌더하므로 자동으로 Phase 2 UX로 degrade
3. DB: 이미 INSERT된 `message_blocks` row는 그대로 유지 (역호환 보장)
4. Checklist `PATCH` endpoint: 404 Not Found 반환 설정 → 프론트는 rollback 토스트만 표시

---

## 보안 고려사항 (Security Considerations)

Phase 3는 신규 authentication/authorization boundary를 도입하지 않지만 다음 제약을 명시한다.

- **소유권 검증 (REQ-STRUCT-021)**: `PATCH /api/ra/messages/:messageId/blocks/:blockId`는 반드시 `session.user.id === conversations.user_id` 검증. 403 Forbidden 반환. 타 유저 대화의 block 수정 시도는 `conversation_id`/`message_id` 관계를 거쳐 차단
- **입력 검증**: 모든 SSE 입력과 `PATCH` body는 Zod parse를 통과한 후에만 DB에 반영. Zod 실패 시 400 Bad Request + 에러 메시지는 사용자에게 stack trace 노출 금지
- **LLM 출력 sanitization**: Haiku follow-up이 반환한 JSON의 string 필드는 저장 전 길이 제한(REQ-STRUCT-012/013/014/016) 적용. DOM 렌더 시 React JSX 기본 escaping으로 XSS 방지. `dangerouslySetInnerHTML` 사용 금지
- **SSE event 크기**: 단일 event < 8KB 제한으로 DoS/버퍼 공격 경로 축소. Zod refinement에서 집합 크기 제한(cols≤5, rows≤30, items≤20/12) 강제
- **LLM prompt injection 완화**: structured prompt는 사용자 입력을 template literal 바깥에서 주입하되, system instruction에 "응답은 오직 JSON 객체로만 출력하라"를 명시 (REQ-STRUCT-017). 프롬프트 내 사용자 텍스트는 명확한 구분자로 분리하여 instruction override 방지

---

## Phase 4 Handoff 포인트

Phase 3 완료 시점에 Phase 4(Breadth)로 이월되는 계약:

1. **`lib/ai/structured-schema.ts` public API 고정.** Phase 4는 이 파일의 `BlockSchema`, `ChecklistBlockSchema` 등을 read-only import하여 History 뷰에서 과거 대화의 `message_blocks` row를 파싱한다. Phase 4가 임의로 필드를 추가/제거하면 Phase 3 runtime과 drift. 새 필드 필요 시 Phase 4 SPEC에서 `.extend()` 패턴 사용.

2. **6종 block 컴포넌트의 `readOnly?: boolean` prop.** Checklist, ComparisonTable, Timeline 모두 `readOnly` prop을 지원. Phase 4 History 뷰는 `readOnly={true}`로 전달하여 체크박스 비활성화 상태로 렌더.

3. **`GET /api/ra/conversations/:id` 응답 shape (Phase 4 owned).** Phase 4가 이 endpoint를 확장할 때 `messages[].blocks: BlockSchema[]` 필드를 포함시킨다. Phase 3는 shape 정의만 제공, 구현은 Phase 4.

4. **AnswerBlock `readOnly` 모드.** Phase 4 History 뷰에서 AnswerBlock 재사용 시 Composer/submit 연동 제거 + SuggestionPill prefill 대신 새 대화 생성 흐름. Phase 3는 prop interface만 노출.

5. **`checklist_completions` 정규화 migration은 Phase 5로.** Phase 4는 여전히 `block_json` 내장 방식 사용. 다중 사용자 공유 도입 시점(Phase 5)에서 migration SPEC 별도 발행.

---

## 관련 문서

### Handoff 섹션
- §7.4 Chat / New Consultation (우측 패널 3구역, Composer 영역)
- §8.3 AnswerBlock (14-step composite — Phase 3 완성)
- §8.5 Checklist Row (16×16 checkbox + ref tag)
- §8.6 ComparisonTable (sticky first column + region chips)
- §8.7 Timeline (수직선 + current amber)
- §8.8 Callout (3 variants)
- §8.10 SuggestionPill (Plus 아이콘 + rounded-full)
- §9.1 Chat submission flow (Phase A→B→C 3단계)
- §11.1 POST /api/ra/consult (9종 SSE event 중 checklist/comparison/timeline/related 실제 방출)

### Regula 스킬 참조
- `regula-streaming-contract/SKILL.md` — SSE 3단계 순서, 9종 event type union, useStreamingAnswer 훅 시그니처, 계약 위반 감지 체크리스트
- `regula-citation-contract/SKILL.md` — Phase 3 구조화 블록이 citation regex에서 제외되는 경계 (prose 전용) 확인
- `regula-handoff-reader/SKILL.md` — handoff README §7/§8/§9/§11 재조회 경로

### FOUNDATION 상속 항목 (수정 금지)
- `lib/db/schema.ts` `messageBlocks` 테이블 (REQ-FND-038)
- `block_type` pgEnum 6값
- `messages.content_prose` (REQ-FND-036)
- `writeAudit` helper signature (REQ-FND-048/049/049a)
- `<html lang="ko">` + Korean fonts (REQ-FND-012, 023, 024)
- Tailwind v4 `@theme` 토큰 (REQ-FND-022, 029a)

### CHAT 상속 항목 (수정 금지 — Wave 1 동시 작성)
- `/api/ra/consult` SSE handler (Phase 2에서 prose 완료 + sources/confidence/expert_review_required/done 방출)
- `useStreamingAnswer` 훅 state shape (`structured` 필드 9개)
- Composer, 질문 submit 흐름
- citation 강제 post-processing (prose 전용)
- `meta` / `prose_delta` / `done` / `error` / `sources` / `confidence` / `expert_review_required` event 발행

### CLAUDE.md Non-Obvious Constraints ↔ REQ-STRUCT 매트릭스

| # | Constraint (CLAUDE.md) | Phase 3 대비 REQ-STRUCT | 상태 |
|---|---|---|---|
| 1 | 모든 LLM 주장에 inline citation 강제 | — | Phase 2 소관 (prose만). Phase 3 structured는 regex 제외 (REQ-STRUCT-018) |
| 2 | SSE 다단계 스트리밍 (trace → prose → structured) | REQ-STRUCT-002, 003, 007 | **Phase C 실제 구현** — order violation guard 포함 |
| 3 | Expert-review 자동 게이팅 (confidence < 0.7 또는 차단 키워드) | — | Phase 2에서 event 발행, Phase 5에서 패널 UI. Phase 3는 AnswerBlock Step 2에서 Callout 표시만 (REQ-STRUCT-025, 028) |
| 4 | 21 CFR Part 11 감사 — append-only, 7년 보존 | REQ-STRUCT-037 (writeAudit 미호출) | FOUNDATION scope discipline 준수 |
| 5 | Serif/Sans 타이포그래피 대비 (브랜드 요건) | REQ-STRUCT-028 (AnswerBlock section label) | section label은 serif, checklist title은 sans (토큰 활용) |
| 6 | 한/영 이중언어 first-class | REQ-STRUCT-004, 008, 018 | Phase 3는 ko 하드코딩. en 확장은 Phase 5 |
| 7 | Auth 뒤 → 전역 noindex (`/login` 제외) | — | FOUNDATION/CHAT 소관. Phase 3는 변경 없음 |

---

## Pending Cross-Audit Findings (v0.2.0)

cross-spec-audit.md(2026-04-22)의 High/Medium findings 중 본 iteration에서 해소되지 않고 후속 Wave에서 추적할 항목.

| ID | 요약 | 해당 SPEC | 추적 상태 |
|---|---|---|---|
| M1 | `checklist_completions` 정규화 테이블 migration (multi-user 공유 대화 분리) | ENTERPRISE 또는 Post-launch | Phase 5 kickoff 재검토 (STRUCTURED Technical Decision #3 재평가 조건 트리거 시) |

기타 Medium/Low findings는 각 Phase 진입 시 해당 SPEC 이터레이션에서 개별 결정.

---

Version: 0.2.0
Classification: draft (cross-audit patched)
Last Updated: 2026-04-23
