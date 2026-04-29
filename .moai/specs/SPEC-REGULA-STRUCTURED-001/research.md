---
id: SPEC-REGULA-STRUCTURED-001
doc_type: research
created: 2026-04-22
updated: 2026-04-22
spec_version: 0.1.0
author: manager-spec
phase: 3
skill: regula
---

# Research — SPEC-REGULA-STRUCTURED-001 (Phase 3 Structured Outputs)

본 문서는 `spec.md`의 EARS 요구사항과 기술 결정의 **근거 기록**이다. Phase 3의 범위는 handoff §20 "Phase 3: Structured outputs (checklist, comparison, timeline blocks)"로 한정되며, Phase 2 CHAT core 위에 얹히는 구조화 출력 계층을 다룬다. Phase 4+ (History, Templates, Knowledge, Updates, Dashboard)는 의도적으로 배제한다.

---

## 조사 배경

handoff README §8.3 AnswerBlock은 LLM 답변을 **14단계의 composite 컴포넌트**로 정의한다. 이 중 prose 이후의 구조화 블록(checklist, comparison, timeline, suggestions)은 규제 도메인에서 LLM 답변의 실용성을 결정짓는 핵심 UX 자산이다. 구체적으로:

1. **Checklist (§8.5)**: RA 전문가가 "510(k) 제출을 위해 무엇을 준비해야 하나?"라고 물으면 prose 답변 아래에 체크박스 목록(각 항목에 §reference 태그)이 붙는다. 제출 실무는 이 체크리스트를 복사해 프로젝트 보드로 옮긴다.
2. **ComparisonTable (§8.6)**: "FDA vs EU MDR 임상 평가 요건 차이?"라는 질의는 표 형식이 가장 자연스럽다. Region chip header + sticky first column이 handoff에서 결정됨.
3. **Timeline (§8.7)**: "MDR 전환 일정?" 같은 질문은 시간축 시각화가 핵심. `current: true` 항목은 amber 강조.
4. **SuggestionPill (§8.10) / RightContextPanel**: "이어서 질문하기" 제안으로 세션 체류 시간을 늘리고, 우측 패널의 "현재 프로젝트 + 활용 출처 + 관련 규제 업데이트" 3구역은 Chat 페이지 전체 정보 설계의 절반 이상을 차지한다.

이들 블록은 **모두 handoff §11.1 SSE event로 도착**한다(checklist, comparison, timeline, sources, related, expert_review_required). Phase 2 CHAT core가 SSE transport, `useStreamingAnswer` 훅, prose streaming, citation 강제, audit wiring을 완성한 전제 위에서, Phase 3는 다음을 추가한다:

- **서버 측**: prose 완료 직후의 **follow-up LLM call** 파이프라인 (구조화 JSON 생성). 이 call은 prose와는 분리되며 Haiku를 사용한다.
- **프론트 측**: 9개 SSE event의 일부(`checklist`, `comparison`, `timeline`, `related`) 발행과 소비. Phase 2는 type 정의·soft handling만, 실제 생산은 Phase 3.
- **영속화**: `message_blocks` 테이블 INSERT 로직. block_type enum 6종을 모두 활용한다.
- **컴포넌트**: Checklist.tsx, ComparisonTable.tsx, Timeline.tsx, Callout.tsx, SuggestionPill.tsx, RightContextPanel.tsx.

Phase 1(FOUNDATION)은 스키마 컬럼(`message_blocks.block_type` enum 6값)만 확보했고, Phase 2(CHAT)는 SSE event type만 정의했다. Phase 3는 이 두 토대 위에서 **실제 값을 생산하고, 검증하고, 저장하고, 렌더링한다**.

---

## 기술 선택 근거

### 결정 1: 구조화 블록 생성 방식 — prose 완료 후 follow-up LLM call (Haiku)

**선택: 분리된 follow-up call (2-pass architecture)**

Phase 2의 Sonnet 4.5 prose call이 완료된 후, 동일 SSE stream 위에서 Haiku에게 **"다음 prose 답변에 적절한 구조화 블록(checklist/comparison/timeline)을 JSON으로 생성하라"**고 요청한다. 이 call은 Zod 스키마로 출력 파서를 강제하며, 결과를 SSE event(`checklist`, `comparison`, `timeline`, `related`)로 하나씩 방출한다.

**단일 call + JSON mode 방식 탈락 사유:**
- Sonnet에게 "prose 먼저 스트리밍하고, 완료되면 JSON 블록도 이어서 만들어라"를 단일 프롬프트로 요구하면 prose 중간에 JSON syntax가 섞이는 실패가 빈번 (관측된 hallucination 패턴).
- Citation 강제(`<sup class="cite" data-source="N">`)가 prose 말미에서 깨질 위험. prose와 JSON을 분리하면 citation 강제 regex는 prose 구간에만 적용하면 된다.
- Haiku follow-up은 모델 비용이 Sonnet 대비 ~1/5. 구조화 블록은 요약/재구성 task이므로 Haiku로 충분.

**트레이드오프:**
- 추가 지연: prose `done` 이후 1~3초 정도 structured 블록 방출. `useStreamingAnswer` 상태가 `status: 'structured_pending'` 중간 단계를 가진다.
- Race condition: 사용자가 prose 완료 직후 새 질문을 제출하면, 이전 질문의 structured call은 abort 되어야 한다. `AbortController` 체인을 구성한다.

**재평가 트리거:** Haiku follow-up 품질(구조화 블록의 사실 정합성)이 50+ RA eval set에서 hit rate < 80% 시 Sonnet 3.5 Haiku가 아닌 Sonnet으로 상향.

---

### 결정 2: Zod 스키마 위치 — `lib/ai/structured-schema.ts` 공유 모듈

**선택: 서버/클라이언트 모두에서 import되는 단일 파일**

`lib/ai/structured-schema.ts`는 6개 블록 타입 각각의 Zod 스키마를 export:

- `ProseBlockSchema` — `{ type: 'prose', text: string }`
- `ChecklistBlockSchema` — `{ type: 'checklist', items: [{ id, title, ref?, completed: boolean }] }`
- `ComparisonBlockSchema` — `{ type: 'comparison', title: string, cols: string[], rows: string[][] }`
- `TimelineBlockSchema` — `{ type: 'timeline', items: [{ date, title, description, current? }] }`
- `SourcesBlockSchema` — `{ type: 'sources', items: [Source (regula-streaming-contract 참조)] }`
- `RelatedBlockSchema` — `{ type: 'related', items: string[] }`

**탈락 사유:**
- 컴포넌트별 ad-hoc 타입 선언은 서버 생성 스키마와 프론트 소비 타입의 drift를 유발. FOUNDATION의 `message_blocks.block_type` enum과도 일관성이 깨짐.
- `types/streaming.ts`(Phase 2 regula-streaming-contract 소유)에 포함시키면 해당 파일이 비대해지고 SRP 위반.

**확장 원칙:** 새 block_type 추가 시 (1) `structured-schema.ts`에 Zod 스키마 추가, (2) FOUNDATION `message_blocks` pgEnum 값 추가 migration, (3) `Checklist`-스타일 컴포넌트 추가 순서.

---

### 결정 3: Checklist 완료 상태 영속화 — `message_blocks.block_json`에 완료 배열 저장

**선택: `block_json.items[].completed: boolean` 직접 저장 (Phase 3 범위 내)**

체크박스 완료는 사용자가 토글할 때마다 `PATCH /api/ra/message-blocks/:id` endpoint로 `block_json` 전체를 갱신. 낙관적 업데이트 + 서버 확정 패턴.

**탈락안: 별도 `checklist_completions` 테이블**
- `(block_id, item_id, user_id, completed_at)` 정규화 테이블. 장점: 여러 사용자가 같은 대화를 보면 개별 완료 상태 추적 가능.
- 탈락 사유: Phase 3는 1인 사용자(대화 소유자)만 체크 가능하다는 간소화 모델로 충분. 팀 공유 시나리오(Phase 5 enterprise) 도입 시 정규화 테이블로 migration. 현 단계에서 정규화는 over-engineering.

**FOUNDATION 호환성:** `message_blocks.block_json` 컬럼은 jsonb이며 NOT NULL default `'{}'::jsonb` (REQ-FND-038). 완료 상태 저장은 스키마 변경 없이 Phase 3에서 바로 시작 가능.

**재평가 트리거:** 다중 사용자 공유 대화가 도입되면 별도 테이블로 승격.

---

### 결정 4: follow-up prompt 토큰 예산 — prose 결과 + 원 질문 + top-3 sources만 재전달

**선택: 최소 컨텍스트 재전달**

Follow-up prompt 구성 예시:

```
[원 질문]
{question}

[prose 답변 (검증된 citation 포함)]
{prose_with_citations}

[활용된 상위 3개 출처 meta]
Source 1: FDA 21 CFR 807.81 (2023)
Source 2: EU MDR Article 61 (2017)
Source 3: MFDS 의료기기법 제15조 (2024)

위 맥락에서 다음 구조화 블록을 JSON으로 생성하라. 불필요한 블록은 null 반환:
- checklist: 답변이 "무엇을 해야 한다" 유형일 때만
- comparison: 답변이 여러 관할권을 비교할 때만
- timeline: 답변이 일정/단계를 포함할 때만
- related: 항상 3~5개의 follow-up 질문 생성
```

**탈락안: 전체 retrieval context 재전달** — 중복 토큰 소모. prose가 이미 retrieval 정보를 반영하므로 불필요.

**예산:** Haiku 입력 ≤ 4K 토큰, 출력 ≤ 2K 토큰. Phase 2의 prose 생성 예산(입력 ~20K, 출력 ~4K)과 별도로 관리.

---

### 결정 5: 구조화 블록 미발행 조건 — LLM "불필요" 판단 시 skip event만 방출

**선택: null 판정 시 해당 event 발행 생략**

Follow-up LLM이 "이 답변에는 checklist가 부적절"이라고 판단하면 `null`을 반환한다. 서버는 `checklist` event를 **발행하지 않고** 다음 블록으로 진행. `done` event는 예정대로 방출.

**탈락안: 빈 블록 발행 (`{ type: 'checklist', items: [] }`)**
- 프론트가 `items.length === 0` 체크로 렌더링 안 할 수는 있으나, 빈 섹션 헤더가 잠깐 깜박이는 UI 플리커 발생.
- `useStreamingAnswer.structured.checklist`를 `undefined | ChecklistItem[]`로 구분하여 명확성 확보.

**계약:** SSE stream에서 `checklist`, `comparison`, `timeline` event는 **선택적** (0 or 1번 방출). `related`는 항상 1회 방출 (최소 3개 제안 보장). `sources`, `confidence`, `done`은 Phase 2에서 이미 항상 방출.

---

## Handoff 해석 포인트

### 해석 1: §8.3 AnswerBlock 단계 vs §11.1 SSE event 매핑

§8.3의 14단계 중 Phase 3 소관은 Step 5~14 (체크리스트부터 suggested followup까지). Step 1~4(meta row, expert callout, 요약 답변 prose)는 Phase 2 소관.

| AnswerBlock Step | SSE Event | Phase |
|---|---|---|
| 1. Meta row (Confidence + duration + actions) | confidence, done | Phase 2 |
| 2. Expert-review callout | expert_review_required | Phase 2 (event) + Phase 5 (full UI) |
| 3-4. 요약 답변 section + prose | prose_delta | Phase 2 |
| 5-6. **핵심 체크리스트** | **checklist** | **Phase 3** |
| 7-8. **주요 관할권별 비교** | **comparison** | **Phase 3** |
| 9-10. **실행 타임라인** | **timeline** | **Phase 3** |
| 11-12. 출처 (N) + SourceCard grid | sources | Phase 2 (event) + Phase 3 (grid UI) |
| 13-14. **이어서 질문하기 (SuggestionPill)** | **related** | **Phase 3** |

**핵심:** Phase 2는 sources/confidence/expert_review_required event를 **수신·표시**하지만, AnswerBlock의 구조적 순서는 Phase 3에서 완성된다. sources grid(SourceCard)는 Phase 3가 소관이다 — Phase 2는 `type: 'sources'` 수신 시 스크롤 영역에 raw list로만 표시한다(backlog 처리).

### 해석 2: Checklist completion persistence 범위

handoff §8.5는 "toggleable rows"만 명시하고 persistence는 언급 없음. 결정 3에서 `block_json` 내장을 채택. 구체 API:

- `PATCH /api/ra/messages/:messageId/blocks/:blockId` — body: `{ block_json }` 전체 교체
- 서버: 요청자가 message 소유자인지 검증 (audit: `expert_review.flag` 외 별도 action 불필요, Phase 5에서 `checklist.toggle` enum 추가 가능)
- 낙관적 업데이트: 프론트 `PATCH` 요청과 동시에 local state 업데이트, 실패 시 rollback

### 해석 3: RightContextPanel의 "활용 출처"가 chat sources event와 중복되는가

handoff §7.4 우측 패널 두 번째 섹션 "활용 출처 (top 5)"는 **현재 열린 대화의 가장 최근 메시지 sources**를 요약 표시. Chat main column의 sources grid(§8.3 Step 11-12)와는 다음 차이:

- Main column sources grid: **모든** 출처 (citation 달린 것 전체), SourceCard 3-col grid
- Right panel 활용 출처: **최근 메시지** top 5, compact list(index badge + title + org)

두 UI는 동일 데이터(message_sources 테이블)를 참조하되 주제가 다르다. 한 답변 내 주요 출처를 우측에서 상시 노출 → 사용자가 main prose 스크롤 위치 변경 시에도 출처 컨텍스트 유지.

### 해석 4: SuggestionPill 클릭 동작

handoff §8.10 "Rounded-full, Plus icon prefix". 클릭 시 동작이 §9에 명시 없음. 해석:

- 클릭 → Composer에 prefill (focus 포함)
- 자동 submit 하지 않음 (사용자가 수정 기회 가짐)
- analytics event `suggestion.click` (Phase 5 wiring)

### 해석 5: 다국어 및 History 렌더링 경계

- 다국어: Phase 3는 ko만. structured prompt가 한국어로 출력되도록 강제. en은 Phase 5 i18n에서 처리.
- History 뷰에서 이전 대화의 structured block 재렌더링: Phase 4 소관. 단, 스키마는 Phase 3에서 확정했으므로 Phase 4는 읽기만 하면 됨.

---

## 관련 아키텍처 결정 참조

### FOUNDATION 상속 (수정 금지)

| 상속 항목 | 출처 | Phase 3 활용 |
|---|---|---|
| `message_blocks` 테이블 (13 tables 중 하나) | REQ-FND-038 | block_type enum 6값 INSERT |
| `block_type` pgEnum (`prose`, `checklist`, `comparison`, `timeline`, `sources`, `related`) | REQ-FND-038 | 모두 활용 |
| `block_json` jsonb NOT NULL default `'{}'::jsonb` | REQ-FND-038 | Checklist 완료 상태 저장 |
| `order_index` integer | REQ-FND-038 | AnswerBlock 렌더링 순서 (AnswerBlock Step 순) |
| `messages.content_prose` text | REQ-FND-036 | follow-up LLM 입력 |
| `messages.confidence_level` / `_score` / `tokens_*` | REQ-FND-036 | Phase 2에서 기록됨, Phase 3는 읽기만 |
| `message_sources.cite_index` NOT NULL + UNIQUE(message_id, cite_index) | REQ-FND-037 | sources grid 렌더링 키 |
| citation HTML `<sup class="cite" data-source="N">` | regula-citation-contract | prose→follow-up 파이프에서 citation index 재사용 |
| `writeAudit` helper signature | REQ-FND-048/049/049a | Phase 3는 call-site 추가 없음 (checklist toggle은 Phase 5 후보) |

### CHAT 상속 (수정 금지, Phase 2에서 확정)

| 상속 항목 | 출처 (CHAT SPEC) | Phase 3 활용 |
|---|---|---|
| `/api/ra/consult` SSE endpoint | Phase 2 | Phase 3는 endpoint 재사용, handler 확장만 |
| SSE event 9종 type union | regula-streaming-contract + Phase 2 | checklist/comparison/timeline/related 실제 발행 시작 |
| `useStreamingAnswer` 훅 state shape | Phase 2 | `structured.checklist/comparison/timeline/related` 필드 채움 |
| prose streaming + citation 강제 | Phase 2 | prose 결과를 follow-up input으로 사용 |
| sources event 발행 | Phase 2 | Phase 3는 sources grid 컴포넌트만 추가 |
| `meta` / `done` / `error` event | Phase 2 | 변경 없음 |
| Composer, 질문 submit, 대화 생성 | Phase 2 | Phase 3는 SuggestionPill → Composer prefill 훅만 추가 |

### Phase 4로 이월 (Phase 3에서 생성만, 렌더링 읽기는 Phase 4)

| 항목 | Phase 4 대응 |
|---|---|
| History 뷰에서 이전 대화의 structured block 재렌더 | SPEC-REGULA-BREADTH-001 |
| Templates 화면에서 checklist 블록 복사해 템플릿화 | SPEC-REGULA-BREADTH-001 |

### Phase 5로 이월

| 항목 | Phase 5 대응 |
|---|---|
| Expert review 패널과 structured block 통합 (reviewer가 block 단위로 코멘트) | SPEC-REGULA-ENTERPRISE-001 |
| `checklist.toggle` audit action enum 추가 | SPEC-REGULA-ENTERPRISE-001 |
| i18n: English structured 생성 + 기존 블록 재번역 | SPEC-REGULA-ENTERPRISE-001 |
| RBAC: team member가 같은 대화 보면 개별 완료 상태 분리 | SPEC-REGULA-ENTERPRISE-001 |

---

## Handoff Divergence Log (Phase 3 한정)

| # | SPEC 기술 | handoff 원문 | 상태 | 비고 |
|---|---|---|---|---|
| D-1 | 2-pass 아키텍처 (prose Sonnet, structured Haiku) | §11.1 "Stream answer from Sonnet 4.5" (단일 call 암시) | Diverges — Technical Decision #1 | citation 안전성 + 비용 최적 |
| D-2 | checklist 완료 상태 `block_json` 내장 | §8.5 "toggleable" 만 명시, persistence 언급 없음 | Supplements — handoff 미결 해석 | Phase 5에서 정규화 가능 |
| D-3 | `PATCH /api/ra/messages/:id/blocks/:id` endpoint | §11에 없음 | Supplements — Phase 3 신규 API | Zod 스키마 `structured-schema.ts` 공유 |
| D-4 | related block 항상 1회 발행 (3~5개 보장) | §11.1 "related" event 선택적인지 명시 없음 | Interprets — 항상 방출로 확정 | UX 일관성 |
| D-5 | checklist/comparison/timeline 선택 발행 (불필요 시 event skip) | §11.1 조건부 언급 있으나 skip 여부 미결 | Interprets — event 생략으로 확정 | plicker 방지 |
| D-6 | SuggestionPill 클릭 동작 (Composer prefill, auto-submit 하지 않음) | §8.10 상호작용 언급 없음 | Supplements — 해석 | 사용자 편집 여지 |

---

## 리스크 및 미해결 사항

### 리스크 1: follow-up LLM call 추가 지연

**영향:** 사용자는 prose `done` 이후 1~3초 추가 대기. 체감상 "답변 완료"와 "구조화 완료" 사이의 틈.

**완화:**
- Phase 2에서 이미 trace steps 애니메이션으로 대기 경험 훈련됨 (700ms/step)
- prose 중에도 우측 "분석 중" → "구조화 중" 상태 표시 (`useStreamingAnswer.status: 'structured_pending'`)
- P95 지연 < 3s를 내부 SLO로 관리

### 리스크 2: Zod parse 실패 시 빈 UI 렌더링

**영향:** Haiku follow-up JSON이 스키마와 다르면 서버가 `error` event 발행하거나 event skip. 프론트는 빈 섹션 헤더가 보이면 안 됨.

**완화:**
- 서버: Zod parse 실패 시 **event 발행 생략** (결정 5)
- 프론트: `structured.checklist === undefined` 체크 후 섹션 헤더 자체 미렌더
- 관측: `writeAudit({ action: 'llm.call', meta: { phase: 'structured_followup', parse_failed: true } })` 기록 (Phase 2에서 `llm.call` enum 확보됨)

### 리스크 3: prose와 structured 사이 citation index 재사용

**쟁점:** prose는 `<sup data-source="3">`로 citation을 표시. structured checklist의 `ref` 필드가 이 index와 겹치지 않아야 함.

**결정:**
- Checklist `ref` 필드는 규제 조문 번호 (예: `"21 CFR §807.81(a)"`)만. source index는 포함하지 않음.
- source index 참조가 필요하면 `refSourceIndex?: number` 선택 필드 추가 (Phase 3에서 정의). 클릭 시 DocViewer 오픈.

### 리스크 4: comparison 행 col 불일치

**영향:** Haiku가 `{ cols: [FDA, EU], rows: [[A], [B, C]] }`처럼 row 길이가 cols 길이와 다른 JSON을 반환할 수 있음.

**완화:**
- Zod refinement: `z.array(z.array(z.string())).refine((rows) => rows.every((r) => r.length === cols.length))`
- 실패 시 event skip

### 리스크 5: SSE buffer 크기 초과

**영향:** ComparisonTable 큰 경우 단일 JSON event가 수 KB가 될 수 있음. Vercel Edge Runtime의 SSE chunk 버퍼 한계 존재.

**완화:**
- 각 event < 8KB 제한 (Vercel 안전 기본값)
- 대형 comparison은 행을 잘라 여러 `comparison_delta` event로 분할하는 전략을 Phase 5에서 검토. Phase 3는 단일 event 전제.

### 리스크 6: Checklist toggle 요청 동시성

**영향:** 빠른 토글로 `PATCH` 요청 경합 → 마지막 요청이 이긴다(LWW). 이론상 data loss 가능.

**완화:**
- 클라이언트 debounce 300ms
- 서버는 `messages.updated_at` 또는 block row version 체크 (Phase 3는 단순 LWW, Phase 5에서 ETag 도입 고려)

### 미해결 1: `related` 클릭 후 자동 모델 선택

사용자가 SuggestionPill 클릭 시 Composer에 prefill. 자동 submit 여부는 해석 4에서 결정(하지 않음). 다만 UX A/B 테스트로 검증 여지.

### 미해결 2: Checklist 초기 완료 상태

follow-up LLM이 `items[].completed: false`로 생성. "이미 완료된" 항목을 추정하는 기능은 Phase 5 (프로젝트 맥락 연계) 대상.

### 미해결 3: 다국어 block 내용 번역

ko 대화에 생성된 block을 en 사용자가 읽을 때 번역. Phase 5 i18n SPEC 대상.

### 미해결 4: Accessibility 심화

- ComparisonTable: `<table>` semantic + `<th scope="col">` 사용 (Phase 3 포함)
- Timeline: `aria-label`로 current step 명시 (Phase 3 포함)
- Checklist: checkbox → `role="checkbox" aria-checked` + keyboard toggle (Phase 3 포함)
- 스크린리더 "분석 중" 안내 live region: Phase 5 접근성 감사에서 강화.

---

## Phase 2 CHAT handoff 포인트 재확인

본 SPEC은 CHAT SPEC과 **동시 작성** 중이므로 다음 전제를 가정한다. 전제 위반 시 양 SPEC 간 조정 필요:

1. **CHAT SPEC의 SSE handler**는 `checklist`/`comparison`/`timeline`/`related` event를 **방출하지 않는다** (type 정의만 포함). Phase 3가 handler 내부의 post-prose hook을 확장해 방출 시작.
2. **CHAT SPEC의 `useStreamingAnswer`**는 9개 event 모두에 대한 `applyEvent` switch case를 포함한다. Phase 3는 새 case를 추가하지 않고 payload 해석만 정교화.
3. **CHAT SPEC의 AnswerBlock 컴포넌트**는 prose + citation + sources raw list까지만 렌더링. Phase 3가 Checklist/ComparisonTable/Timeline section을 추가.
4. **Citation index**: CHAT이 `message_sources` INSERT 책임자. Phase 3의 structured 블록은 이 테이블을 **읽기만** 수행.

---

## Phase 4 handoff 포인트

Phase 4 Breadth는 다음을 구현한다:

1. History (§7.5): 대화 목록에서 과거 대화 클릭 → `GET /api/ra/conversations/:id` 응답에 포함된 `blocks: MessageBlock[]`을 Phase 3 컴포넌트로 재렌더. **Phase 3가 컴포넌트 + 스키마를 확정했으므로 Phase 4는 읽기만.**
2. Templates (§7.6): Checklist block을 템플릿으로 변환하는 "저장" 기능. Phase 3의 `block_json`을 Templates 테이블로 복사하는 matching 로직 필요.
3. Knowledge Base (§7.7): 출처 메타만 다루므로 Phase 3 의존 없음.
4. Updates (§7.8): 규제 업데이트 피드 → 대시보드. Phase 3 의존 없음.
5. Dashboard (§7.9): 통계. Phase 3의 `message_blocks` row 수 COUNT 가능.

**Phase 3 → Phase 4 handoff 체크리스트:**
- [ ] `lib/ai/structured-schema.ts` Zod 스키마가 stable (Phase 4가 import)
- [ ] `GET /api/ra/conversations/:id` 응답에 blocks 포함 (API shape은 Phase 4 SPEC에서 확정, schema는 Phase 3 완료)
- [ ] 6개 block 컴포넌트가 `readOnly?: boolean` prop 지원 (History에서는 편집 불가)
- [ ] Checklist `completed` 상태 저장 방식이 Phase 4 History 렌더에서 일관 (read-only 모드에서도 완료 항목 체크 유지)

---

## Testing 전략 (Phase 3)

### 단위 테스트 (Vitest)

- `lib/ai/structured-schema.ts` Zod 스키마 parse/reject 케이스 (각 블록 타입 × 정상/잘못된 JSON)
- `lib/ai/structured-blocks.ts`의 `generateStructured(prose, question, sources): AsyncGenerator<BlockEvent>` 단위
- `components/chat/Checklist.tsx` — 토글 클릭 시 낙관적 업데이트 + rollback (MSW로 PATCH mock)
- `components/chat/ComparisonTable.tsx` — cols/rows 길이 mismatch 시 "표 데이터 오류" fallback
- `components/chat/SuggestionPill.tsx` — 클릭 시 Composer prefill 함수 호출 (mock)

### 통합 테스트 (Vitest + 테스트용 Postgres + mock LLM)

- prose 완료 후 structured 생성 → `message_blocks` INSERT 6종 row 확인 (block_type 모두 커버)
- checklist PATCH endpoint: 본인 block 수정 성공, 타인 block 수정 403
- Zod parse 실패 시 event skip (checklist event 미수신) 검증
- prose_done 이벤트 이전에 structured 블록 발행 시도 → 서버 throw (order violation guard)

### E2E (Playwright, Phase 6에서 작성 예정)

- 질문 제출 → prose 스트리밍 → structured 블록 순차 등장 → Checklist 체크 → 페이지 새로고침 → 완료 상태 유지

### QA (regula-compliance-qa)

- Checklist ref 필드가 실제 규제 조문 번호 형식인지 sampling 검증
- Comparison cols이 사전 정의된 관할권 목록(FDA/EU MDR/MFDS/NMPA/PMDA) 외로 임의 생성되지 않는지
- Timeline `current: true` 항목이 1개 이하인지

---

## Definition of Done (Phase 3)

Phase 3 완료는 다음을 모두 충족할 때:

- [ ] `lib/ai/structured-schema.ts` 6종 Zod 스키마 export
- [ ] `lib/ai/structured-prompts.ts` 3종 system prompt (checklist/comparison/timeline) + related prompt
- [ ] `lib/ai/structured-blocks.ts` generator가 prose 완료 후 호출되는 파이프라인 완성
- [ ] `/api/ra/consult` SSE handler가 `checklist`/`comparison`/`timeline`/`related` event 방출 시작
- [ ] `message_blocks` INSERT 로직이 6종 block_type 모두 커버
- [ ] Checklist/ComparisonTable/Timeline/Callout/SuggestionPill/RightContextPanel 6개 컴포넌트 구현
- [ ] AnswerBlock에서 block_type switch 기반 렌더링 통합
- [ ] `PATCH /api/ra/messages/:id/blocks/:id` endpoint로 checklist 완료 상태 저장
- [ ] Vitest 통합 테스트 전부 PASS (특히 prose_done 이전 structured 발행 guard)
- [ ] regula-compliance-qa QA 체크리스트 PASS
- [ ] Phase 4로의 handoff 포인트(structured-schema.ts stability) 확인

---

Version: 0.1.0
Source: SPEC-REGULA-STRUCTURED-001 Phase 3 research
