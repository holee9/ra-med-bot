---
id: SPEC-V3-TRIAGE-001
version: 1.0.0
status: completed
phase: C-2
priority: High
created: 2026-07-05
updated: 2026-07-05
author: manager-spec
issue_number: 0
depends_on:
  - SPEC-V3-INBOX-001
blocks:
  - SPEC-V3-CONSULT-001
  - SPEC-V3-UI-001
parent_spec: SPEC-V3-INBOX-001
lifecycle_level: spec-anchored
labels:
  - component/backend
  - component/ai
  - component/api
  - domain/inbox
  - domain/triage
  - type/v3-new
---

# SPEC-V3-TRIAGE-001 — RA Triage 자동응답 강화 (Phase C-2)

## HISTORY

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0.0 | 2026-07-05 | manager-spec | 초기 작성. SPEC-V3-INBOX-001 Follow-up #1 이월. AC-06 (citation 없는 auto_answer 400) 직접 이행. REQ 8종, AC 7종. 코드 직검 기반 (L-013). |

---

## §1 Purpose (목적)

### 1.1 배경 (Background)

본 SPEC은 SPEC-V3-INBOX-001에서 명시적으로 이월된 후속 SPEC이다. SPEC-V3-INBOX-001은 inbox_tickets 테이블 + triage state machine + ESIG 승인 워크플로우를 구현했으나, **자동 답변 주입(`auto_answer`/`auto_confidence`)과 citation 검증(AC-06)은 TRIAGE(C-2) 의존으로 이월**되었다 (`.moai/specs/SPEC-V3-INBOX-001/spec.md:256` As-Built 노트 직검).

현재 `/api/ask`는 티켓을 `triageState='auto'`, `autoAnswer=null`로 생성만 하고 끝난다 (`app/api/ask/route.ts:71-74` 직검). 본 SPEC은 이 티켓에 **C-5 consult RAG 파이프라인의 결과값을 주입**하고, **citation이 없는 자동 답변을 거부(AC-06)** 하며, **`triage_state`를 자동으로 `needs-review`로 전이**하는 것을 목적으로 한다.

### 1.2 페르소나 (Personas)

| 페르소나 | 역할 | TRIAGE 관점 |
|---|---|---|
| Employee / Viewer | `employee`, `viewer` | `/api/ask` 호출 시 RAG draft 답변을 응답으로 수신 (`auto_answer`). 단, 이것은 draft이며 final_answer가 아님을 UI가 명시 |
| RA Member | `ra-member` | TRIAGE가 주입한 `auto_answer`/`auto_confidence`를 칸반에서 조회. 검토 초안 작성 |
| RA Lead | `ra-lead` | TRIAGE 자동 주입 결과를 바탕으로 final_answer 승인(ESIG) 또는 reject/escalate 수동 판단 |
| Admin | `admin` | 감사 로그 조회 |

### 1.3 규제·정책 근거 (Policy Anchor)

- **Charter [지양-2] citation 강제**: `auto_answer`는 반드시 citation(source/provenance)을 포함한다. citation 없는 자동 답변 저장 시 400 Bad Request (AC-06 직접 이행).
- **Charter [지양-4] RA Lead 승인**: TRIAGE 자동 판정은 `auto→needs-review` 전이만 수행. 자동으로 escalated/closed/rejected를 결정하지 않는다 (AI 판단 대신 금지).
- **Charter [지양-1] 전사 도우미**: Employee가 질문 즉시 RAG draft 답변을 받아 자주 묻는 인허가 질문을 셀프서비스 해결.
- **21 CFR Part 11 §11.10(e)**: TRIAGE 자동 주입(자동 전이) 시 `inbox.triaged` audit log 기록. hash chain.
- **21 CFR Part 11 §11.70**: `auto_answer`는 ESIG 서명 대상이 아님 (draft). ESIG는 오직 `final_answer` 승인 시 요구(SPEC-V3-INBOX-001 REQ-V3-INBOX-012).

### 1.4 본 SPEC의 범위 (In Scope)

- `/api/ask` 훅: 티켓 생성 후 TRIAGE RAG 호출 → `auto_answer`/`auto_confidence` 주입
- `auto_answer` JSONB 구조 정의: `{answer: string, citations: [{source, quote?}][]}`
- AC-06 이행: citation 없는 `auto_answer` 저장 시 400 Bad Request
- triage_state 자동 전이: `auto → needs-review` (유일한 자동 전이 경로)
- TRIAGE 자동 주입 감사: `inbox.triaged` action (`lib/domains/inbox/audit.ts` 재사용)
- `/api/ask` 응답 body 확장: `{ticketId, triageState, autoAnswer?, autoConfidence?}` (REQ-V3-INBOX-030 준수)
- RAG 호출 타임아웃 폴백: 타임아웃 시 `auto_answer=null`, `triage_state='auto'` 유지

### 1.5 Out of Scope

- **C-5 Consult (Power Chat) `/api/ra/consult`**: RA 전용 Power Chat은 SPEC-V3-CONSULT-001 (C-5)에서 분리. 본 SPEC은 consult.ts 하위 모듈 재사용만.
- **Kanban UI 표시**: `auto_answer` 표시 UI는 SPEC-V3-UI-001 (Phase D).
- **approved_answers 승격**: SPEC-V3-INBOX-001 REQ-V3-INBOX-028 (이미 구현).
- **TRIAGE 자동 escalated/closed/rejected 전이 금지**: Charter [지양-4]. 본 SPEC은 `auto→needs-review`만.
- **`auto_answer.citations[]` 항목별 상세 스키마(title, year, url 등) 정의**: run phase에서 확장 가능. 본 SPEC은 `{source, quote?}` 최소 스키마만 정의 (기존 `promote.ts:24 extractCitations()` 파서와 호환).
- **Inngest 비동기 TRIAGE 잡**: 본 SPEC은 동기 호출 기준. 비동기 잡은 Follow-up.

---

## §2 Requirements (EARS Format)

### RAG 주입 / 자동 답변

| ID | EARS Statement | Priority |
|----|----------------|----------|
| REQ-TRI-001 | **WHEN** `/api/ask`가 티켓을 생성한 후 **THEN** the system **SHALL** C-5 consult RAG 파이프라인을 호출하여 질문에 대한 RAG 답변(`auto_answer` JSONB)과 신뢰도 점수(`auto_confidence`)를 산출하여 해당 티켓 행에 주입한다. `auto_answer` 구조: `{answer: string, citations: [{source: string, quote?: string}][]}`. `auto_confidence`: NUMERIC(5,2) (0.00~1.00). 주입은 티켓 INSERT tx commit 이후 별도 tx에서 수행한다 (consult 호출이 느리므로 tx 분리) | High |
| REQ-TRI-002 | **IF** 산출된 `auto_answer`가 존재하나 `citations.length === 0`인 경우 **THEN** the system **SHALL** 400 Bad Request를 반환하고 해당 `auto_answer`를 티켓에 저장하지 않는다 (Charter [지양-2] citation 강제, SPEC-V3-INBOX-001 AC-06 이행). 단, 티켓 자체(`triage_state='auto'`)는 유지하여 후속 수동 처리를 허용한다 | High |
| REQ-TRI-003 | **WHEN** TRIAGE가 `auto_answer`를 정상 주입한 경우 **THEN** the system **SHALL** `triage_state`를 `auto`에서 `needs-review`로 자동 전이한다 (`lib/domains/inbox/types.ts:45 VALID_TRANSITIONS['auto']` 준수, `assertValidTransition()`으로 위변조 방어). TRIAGE는 `escalated`/`closed`/`rejected`로 자동 전이하지 않는다 (Charter [지양-4] AI 판단 대신 금지) | High |

### 응답 계약

| ID | EARS Statement | Priority |
|----|----------------|----------|
| REQ-TRI-004 | **THE SYSTEM SHALL** `/api/ask`의 응답 body를 `{ticketId: string, triageState: TriageState, autoAnswer: {answer, citations[]} \| null, autoConfidence: number \| null}`로 반환한다 (SPEC-V3-INBOX-001 REQ-V3-INBOX-030 응답 스키마 준수). 기존 `{ticketId}`만 읽는 소비자(`hooks/useStreamingAnswer.ts:217`)와 하위 호환 (신규 필드 추가) | High |
| REQ-TRI-005 | **IF** TRIAGE RAG 호출이 타임아웃(기본 15초, 환경변수 `TRIAGE_TIMEOUT_MS`) 또는 런타임 에러로 실패한 경우 **THEN** the system **SHALL** `autoAnswer: null`, `autoConfidence: null`, `triageState: 'auto'`를 반환하고 201 Created를 유지한다 (RAG 실패가 티켓 생성을 실패시키지 않음 — 폴백 전략). 에러 메타를 audit 로그에 기록 | Medium |

### 감사 로그

| ID | EARS Statement | Priority |
|----|----------------|----------|
| REQ-TRI-006 | **WHEN** TRIAGE가 `triage_state`를 `auto → needs-review`로 자동 전이할 때 **THEN** the system **SHALL** 동일 트랜잭션 내에서 `inbox.triaged` audit_action을 기록한다 (기존 `lib/domains/inbox/audit.ts:39 auditTransition()` 재사용, 21 CFR Part 11 §11.10(e)). actor = 시스템(`system` 또는 세션 사용자 id — run phase 결정). 메타에 `auto_triage: true`, `confidence_score`, `citations_count`를 포함한다 (AC-TRI-06 단언 대상) | High |
| REQ-TRI-007 | **WHEN** AC-06 위반(citation 없는 auto_answer)으로 400을 반환할 때 **THEN** the system **SHALL** audit 로그에 `inbox.triaged` action과 함께 `auto_triage_rejected: true`, `reason: 'no_citations'` 메타를 기록한다 (21 CFR Part 11 — 자동 결함 거부 이력) | Medium |

### 권한 / 게이트

| ID | EARS Statement | Priority |
|----|----------------|----------|
| REQ-TRI-008 | **THE SYSTEM SHALL** TRIAGE 자동 주입 로직을 `ask.create` 권한 게이트 뒤에서만 실행한다 (기존 `app/api/ask/route.ts:39 withPermission('ask.create')` 재사용). TRIAGE 자체의 별도 권한 키는 정의하지 않는다 (시스템 내부 동작) | Medium |

---

## §3 Acceptance Criteria

| AC# | Criterion | Verification |
|-----|-----------|--------------|
| AC-TRI-01 | `POST /api/ask` 호출 시 (1) 티켓 생성 → (2) TRIAGE RAG 호출 → (3) `auto_answer`/`auto_confidence` 주입 → (4) `triage_state='needs-review'` 자동 전이 → (5) 응답 body `{ticketId, triageState, autoAnswer, autoConfidence}` 반환의 전체 흐름이 단일 엔드포인트에서 완료된다. `auto_answer`는 `{answer, citations[]}` 구조를 따른다 (JSON parse 단언) | Test (full pipeline mock) |
| AC-TRI-02 | citation 없는 `auto_answer` 산출 시 (RAG가 citations 빈 배열 반환) → 400 Bad Request + `auto_answer` 티켓 미저장 + audit `inbox.triaged` with `auto_triage_rejected: true, reason: 'no_citations'` (AC-06 직접 이행, Charter [지양-2]) | Test |
| AC-TRI-03 | TRIAGE 주입 후 티켓의 `triage_state`는 반드시 `needs-review`이며, DB 단언 + audit 로그 `inbox.triaged`의 `meta.from='auto'`, `meta.to='needs-review'` 확인. `auto→escalated`/`auto→closed`/`auto→rejected` 자동 전이 시도 시 `assertValidTransition()`이 throw (불변식 위반 = 서버 결함) | Test (DB + audit) |
| AC-TRI-04 | TRIAGE RAG 호출 타임아웃(15s 기본) 또는 예외 발생 시 → 201 응답 유지 + `autoAnswer: null, autoConfidence: null, triageState: 'auto'` 반환 + 티켓은 `auto` 상태로 DB에 존재 + audit 로그에 실패 메타 기록. 티켓 생성은 RAG 성공과 독립적 | Test (타임아웃/예외 주입) |
| AC-TRI-05 | `/api/ask` 응답 body의 `ticketId` 필드를 기존 소비자(`hooks/useStreamingAnswer.ts:217`)가 정상 읽고, 신규 필드(`triageState, autoAnswer, autoConfidence`) 추가로 인한 기존 클라이언트 회귀 0건 | Test (useStreamingAnswer 회귀 — ChatShell.ticketId.test.tsx 통과 유지) |
| AC-TRI-06 | TRIAGE 자동 전이 감사 로그가 `inbox.triaged` action으로 기록되며, `meta_json.auto_triage=true`, `confidence_score`, `citations_count`가 포함된다. 21 CFR Part 11 §11.10(e) append-only hash chain 보존 | Test (audit row 단언) |
| AC-TRI-07 | RAG 호출이 정상적으로 citation을 포함한 답변을 산출한 경우 → `auto_answer` JSONB가 `{answer, citations[{source, quote?}]}` 구조로 저장되며, 기존 `lib/domains/inbox/promote.ts:24 extractCitations()` 파서가 이를 정상 파싱함을 단언 (SPEC-V3-INBOX-001 AC-05 승격 경로와 호환) | Test (extractCitations 호환성) |

---

## §4 Technical Approach

### 4.1 TRIAGE 호출 흐름 (권장 아키텍처)

```
POST /api/ask
├─ withPermission('ask.create')
├─ organizationId 가드 (403)
├─ rate limit (H-4, 30/min/user, 429) — 기존 유지
├─ Zod 검증 (question 1..5000) — 기존 유지
├─ tx1 (빠름):
│  ├─ INSERT inbox_tickets (triageState='auto', autoAnswer=null)
│  └─ writeAudit('inbox.created')
├─ commit tx1 → ticketId 확정
├─ TRIAGE 호출 (tx 없음, 타임아웃 15s):
│  ├─ RAG pipeline (consult 하위 모듈 재사용 또는 runRagPipeline 추출)
│  │  ├─ 검색 (topChunks)
│  │  ├─ LLM prose generation
│  │  ├─ enforceCitations(prose, availableSources) → {cleaned, violations}
│  │  └─ calculateConfidence({chunkScores, citedCount, totalSentences})
│  ├─ auto_answer = {answer: cleaned, citations: citedChunks.map(...)}
│  └─ AC-06 검증: citations.length === 0 → 400 처리 (아래)
├─ AC-06 검증:
│  if (auto_answer && citations.length === 0):
│    ├─ tx2: writeAudit('inbox.triaged', {auto_triage_rejected: true, reason: 'no_citations'})
│    └─ return 400 {error: 'no_citations'}
├─ tx2 (빠름):
│  ├─ UPDATE inbox_tickets SET autoAnswer=JSON, autoConfidence=score, triageState='needs-review'
│  │  WHERE id=ticketId AND orgId (defense-in-depth)
│  ├─ assertValidTransition('auto', 'needs-review') (불변식 단언)
│  └─ writeAudit('inbox.triaged', {from:'auto', to:'needs-review', auto_triage:true, ...})
└─ Response.json({ticketId, triageState:'needs-review', autoAnswer, autoConfidence}, 201)
```

### 4.2 consult.ts 재사용 방식 (GAP-TRI-01 — run phase 결정)

**옵션 A (권장)**: `lib/ai/consult.ts`에서 핵심 RAG 로직을 `runRagPipeline(input): Promise<RagResult>`로 추출. `/api/ask` 훅에서 호출. 회귀 리스크 HIGH → 별도 PR에서 characterization tests 선행.

**옵션 B (단기 MVP)**: `/api/ask` 훅에서 consult 하위 모듈(hybridSearch, generateProse, enforceCitations, calculateConfidence)을 직접 조합. 회귀 리스크 LOW, 코드 중복.

> 본 SPEC은 두 옵션 모두 허용. run phase에서 expert-backend가 회귀 리스크 평가 후 결정.

### 4.3 `auto_answer` JSONB 구조 (본 SPEC 정의)

```typescript
interface AutoAnswer {
  answer: string;  // HTML prose with <sup class="cite"> markers
  citations: Array<{
    source: string;  // sourceId (sources.id UUID 또는 식별자)
    quote?: string;  // 인용구 원문 (optional)
    // 확장 필드(title, year, url)는 run phase에서 허용
  }>;
}
```

**하위 호환성 직검**: `lib/domains/inbox/promote.ts:24-40 extractCitations()`는 `parsed.citations` 배열을 추출하며, 각 항목의 `source`/`quote`를 읽는다. 본 구조는 기존 파서와 호환 (research.md §2.1 검증).

### 4.4 파일 구조 (예상)

- `app/api/ask/route.ts` [MODIFY] — TRIAGE 훅 추가, 응답 body 확장, AC-06 검증
- `lib/domains/triage/` [NEW] — TRIAGE 파이프라인 모듈
  - `run-triage.ts` — RAG 호출 + auto_answer 산출 + citation 검증 래퍼
  - `types.ts` — `AutoAnswer`, `TriageResult` 인터페이스
  - `index.ts` — 공개 API
- `lib/ai/consult.ts` [MODIFY, 옵션 A 시] — `runRagPipeline()` 추출 (별도 PR)
- `lib/env.ts` [MODIFY] — `TRIAGE_TIMEOUT_MS` (기본 15000) 추가
- `app/api/ask/__tests__/route.test.ts` [MODIFY] — AC-TRI-01..07 단언 추가

### 4.5 As-Built (run phase 완료 — 2026-07-05)

**구현 일관성 (계획 vs 코드)**:

| 항목 | 계획 | 구현 (commit) | 비고 |
|---|---|---|---|
| GAP-TRI-01 | 옵션 B (하위 모듈 직접 조합) | `lib/domains/triage/run-triage.ts` — `classifyAndRoute` + `parallelRetrieveAndMerge` + `composePrompt` + `streamText` + `enforceCitations` + `calculateConfidence` 조합 | 옵션 A(consult.ts runRagPipeline 추출)는 별도 PR 이월 유지 |
| GAP-TRI-02 | auditTransition 메타 확장 | route에서 `writeAudit` 직접 호출로 `{auto_triage, confidence_score, citations_count}` 메타 추가 — `auditTransition` 시그니처(`{from, to}`) 유지 | route 레벨 audit → ci:audit 통과 (L-015) |
| GAP-TRI-03 | 동기 호출 기본 | 동기 + `Promise.race` 전체 타임아웃 (검색 단계 hang도 `TRIAGE_TIMEOUT_MS` 내 폴백) | run-triage.ts |
| tx1 → TRIAGE → tx2 분리 | ✓ | route.ts tx1(insert + `inbox.created`) 커밋 → `runTriage()` → 결과 분기 | |
| migration 불필요 | ✓ | `autoAnswer`/`autoConfidence` 컬럼 + `inbox.triaged` enum 기존 존재 직검 (schema.ts:423 + migration 0104 + 실DB) | L-010/L-013 직검 확정 |
| autoConfidence numeric(5,2) | - | route에서 `toFixed(2)` 문자열 변환 (drizzle numeric string mode) | |

**검증 (L-007/L-008/L-009/L-010/L-013/L-015 직검)**:
- typecheck EXIT 0 / biome 0 errors / lint:hex PASS / ci:audit·rbac·tokens·module-boundaries PASS.
- full `pnpm test` **4438 passed | 0 failed** (+16 TRIAGE 신규, useStreamingAnswer 회귀 0).
- 실DB `inbox_tickets` 컬럼 + `inbox.triaged` enum 존재 확인 (regula-test-db).
- AC-TRI-01..07 전부 테스트 단언 (route.test.ts 16 + run-triage.test.ts 6).

**사전 존재 결합 fix (본 PR에 포함)**:
- `isOverdue(now)` ms 타이밍 경쟁 flaky (PR #322 a3b057f 도입) — 1초 미래 오프셋으로 안정화. TRIAGE와 무관.


### 4.6 의존성 (Dependencies)

- **SPEC-V3-INBOX-001**: inbox_tickets 테이블, state machine, audit 프레임워크 (구현 완료)
- **`lib/ai/consult.ts`**: RAG 파이프라인 (재사용)
- **`lib/ai/citation-enforce.ts`**: citation 강제 (Charter [지양-2])
- **`lib/ai/confidence.ts`**: confidence 계산
- **`lib/domains/inbox/audit.ts`**: `auditTransition()` 재사용
- **후속 (blocks)**: SPEC-V3-CONSULT-001 (C-5), SPEC-V3-UI-001 (Phase D — auto_answer 표시 UI)

### 4.7 Regression-Risk Matrix

| 영역 | Risk | 완화 |
|------|------|------|
| `/api/ask` 응답 body 확장 | LOW — 신규 필드 추가, 기존 ticketId 소비자 호환 | useStreamingAnswer 회귀 테스트 (AC-TRI-05) |
| consult.ts 리팩토링 (옵션 A) | HIGH — 페르소나 챗 회귀 폭발 가능 | 별도 PR, characterization tests 선행 (L-013) |
| AC-06 400 반환 시 티켓 처리 | MEDIUM — 티켓 유지(auto 상태) vs 롤백 | 티켓 유지 + audit 기록 (수동 후속 처리 허용) |
| TRIAGE 자동 전이 불변식 | LOW — assertValidTransition 단언 | lib 단에서 위변조 방어 |
| `auto_answer` JSON 파싱 호환성 | LOW — extractCitations 파서와 구조 일치 직검 완료 | AC-TRI-07 단언 |
| RAG 타임아웃 | MEDIUM — 응답 지연 (수 초) | 15s 타임아웃 + 폴백(AC-TRI-04) |

---

## §5 모순 보고 (Contradictions / Gaps)

### GAP-TRI-01: consult.ts 재사용 방식 — ⏸ run phase 이월

- **상황**: TRIAGE 자동 주입을 위해 consult RAG 파이프라인 재사용 필요.
- **결정**: run phase에서 expert-backend가 옵션 A(`runRagPipeline` 추출) vs 옵션 B(하위 모듈 직접 조합) 결정. 본 SPEC은 `auto_answer` JSON 계약만 정의.

### GAP-TRI-02: auditTransition 메타 확장 — ⏸ run phase 이월

- **상황**: TRIAGE 자동 주입 감사에 `auto_triage`, `confidence_score`, `citations_count` 메타 추가 권장.
- **결정**: 기존 `auditTransition()` 시그니처 유지 + 메타 확장은 별도 wrapper 또는 직접 writeAudit 호출로 처리. run phase에서 결정.

### GAP-TRI-03: 동기 vs 비동기 TRIAGE — ✅ 결정 (동기 기본)

- **상황**: `/api/ask` 응답에 `auto_answer` 포함하려면 동기 호출 필요. 응답 지연(수 초) 발생.
- **결정**: v3 03_api_contract.md:14-31가 동기 응답에 `auto_answer` 포함을 명시. **본 SPEC은 동기 호출 기본**, 타임아웃(15s) 초과 시 `auto_answer=null` 폴백(REQ-TRI-005). 비동기 Inngest 잡은 Follow-up.

---

## §6 Exclusions (What NOT to Build)

본 SPEC은 **TRIAGE 자동 주입 + citation 검증(AC-06) + 자동 전이(auto→needs-review)** 만 다룬다. 다음은 명시적으로 제외:

- **C-5 Consult `/api/ra/consult` 구현 금지**: RA 전용 Power Chat은 SPEC-V3-CONSULT-001 (C-5). 본 SPEC은 consult 하위 모듈 재사용만.
- **`auto→escalated`/`auto→closed`/`auto→rejected` 자동 전이 금지**: Charter [지양-4] AI 판단 대신 금지. TRIAGE는 `auto→needs-review`만.
- **`auto_answer`에 대한 ESIG 요구 금지**: ESIG는 오직 `final_answer` 승인 시(SPEC-V3-INBOX-001 REQ-V3-INBOX-012). `auto_answer`는 draft.
- **Inngest 비동기 TRIAGE 잡 금지**: 본 SPEC은 동기 호출. 비동기는 Follow-up.
- **`auto_answer.citations[]` 항목별 상세 스키마(title/year/url) 강제 금지**: 본 SPEC은 `{source, quote?}` 최소 스키마만. 확장은 run phase 허용.
- **Kanban UI에서 `auto_answer` 표시 금지**: SPEC-V3-UI-001 (Phase D).
- **타 org 티켓 RAG 호출 금지**: org_id 소유권 검증은 `/api/ask` 레벨에서 이미 강제 (SPEC-V3-INBOX-001).
- **신규 audit_action enum 추가 금지**: 기존 `inbox.triaged` 재사색 (SPEC-V3-INBOX-001에서 이미 추가).

---

## §7 Follow-up Issues

1. **C-5 Consult 분리 (SPEC-V3-CONSULT-001)**: RA 전용 Power Chat. 본 SPEC의 consult.ts 재사용 방식과 충돌 시 조정.
2. **비동기 TRIAGE 잡 (Inngest)**: 동기 호출 응답 지연이 문제될 경우, Inngest `triage-auto-answer` 잡으로 전환 검토.
3. **`auto_answer` 캐싱**: 동일/유사 질문의 RAG 호출 비용 절감을 위한 캐싱 (`approved_answers` hit 우선 조회 후 RAG fallback). 성능 최적화.
4. **TRIAGE 신뢰도 임계값 설정**: `auto_confidence >= threshold` 시 자동으로 `needs-review` 생략(직접 `closed`?) 검토 — **Charter [지양-4] 위반이므로 현 SPEC 범위 외**. 모든 자동 주입은 `needs-review` 강제.
5. **`auto_answer.citations[]` 상세 스키마 확장**: title/year/url/type/sourceHost 등 consult sourceItems 필드 동기화 (run phase).
6. **부모 SPEC-V3-INBOX-001 모순 정정 (별도 이슈 등록)**: 부모 `SPEC-V3-INBOX-001/spec.md` §4.3 다이어그램(line 276)과 REQ-V3-INBOX-006(line 115)은 `auto → {needs-review, escalated, closed}` 3종 전이를 허용하나, 코드 `lib/domains/inbox/types.ts:45`는 `auto: ['needs-review']` 1종만 허용. 본 SPEC은 **코드가 권위**(L-013)로 `auto → needs-review` 단일 전이를 채택. 부모 SPEC의 §4.3 다이어그램과 REQ-V3-INBOX-006 텍스트를 코드에 맞게 정정하는 별도 이슈 등록 필요 (run phase 이전 또는 sync 단계에서 처리).

---

## §8 References

- **부모 SPEC**: `.moai/specs/SPEC-V3-INBOX-001/spec.md:180-181` (REQ-V3-INBOX-030/031), `:193` (AC-06), `:256` (이월 명시)
- **v3 데이터 모델**: `docs/v3/02_data_model.md:79-99` (inbox_tickets DDL)
- **v3 API 계약**: `docs/v3/03_api_contract.md:14-31` (`POST /api/ask` 응답 스키마)
- **v3 아키텍처**: `docs/v3/01_architecture.md:114-126` (Auto-Triage 로직)
- **Charter**: `~/.claude/projects/.../memory/product-charter.md` ([지양-1] 전사 도우미, [지양-2] citation 강제, [지양-4] RA Lead 승인)
- **consult RAG**: `lib/ai/consult.ts:340-388` (Stage 7), `lib/ai/citation-enforce.ts:73`, `lib/ai/confidence.ts:26`
- **inbox state machine**: `lib/domains/inbox/types.ts:20-51`, `lib/domains/inbox/state-machine.ts:41-48`
- **inbox audit**: `lib/domains/inbox/audit.ts:19-58` (`triageAuditAction`, `auditTransition`)
- **promote 호환성**: `lib/domains/inbox/promote.ts:24-40` (`extractCitations`, `auto_answer` 파서)
- **schema**: `lib/db/schema.ts:3259-3335` (`inboxTickets`, `approvedAnswers`), `:414-430` (`inbox.*` audit enum)
- **permissions**: `lib/auth/permissions.ts:507-528` (`ask.create`, `inbox.view/manage`)
- **ask route**: `app/api/ask/route.ts:1-94` (본 SPEC 수정 대상)
- **streaming consumer**: `hooks/useStreamingAnswer.ts:217-219` (`/api/ask` 응답 `ticketId` 소비)
- **Lessons**: L-007 (직검), L-013 (self-report 3중 맹점 — research.md 전부 코드 직검)
