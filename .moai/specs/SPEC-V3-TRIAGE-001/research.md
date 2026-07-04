---
id: SPEC-V3-TRIAGE-001
version: 1.0.0
status: draft
phase: C-2
priority: High
created: 2026-07-05
updated: 2026-07-05
author: manager-spec
parent_spec: SPEC-V3-INBOX-001
labels:
  - component/backend
  - component/ai
  - component/api
  - domain/inbox
  - domain/triage
  - type/v3-new
---

# SPEC-V3-TRIAGE-001 — research.md (Phase C-2 Auto-Triage)

> 본 research.md는 Phase C-2 RA Triage 자동응답 강화를 위한 코드베이스 심층 분석 결과를 기술한다.
> 모든 파일 경로·라인 인용은 **2026-07-05 main HEAD 기준 직검 결과**이다 (L-013).
> 코드가 SPEC 텍스트보다 권위를 가진다 (본 프로젝트 L-013 / Core Behavior #2).

---

## 1. 이월 배경 및 현 상태 갭

### 1.1 이월 근거 (SPEC-V3-INBOX-001 명시)

- `.moai/specs/SPEC-V3-INBOX-001/spec.md:256` (As-Built 노트):
  > "AC-06 (citation 없는 `auto_answer` 400): TRIAGE(C-2) 의존. 현재 `/api/ask`는 `auto_answer=null` 고정이므로 citation 검증 분기 미도달. SPEC-V3-TRIAGE-001로 이월 (Follow-up #1)."
- `.moai/specs/SPEC-V3-INBOX-001/spec.md:193` (AC-06 원문):
  > "citation 없는 `auto_answer` 저장 시 400 Bad Request 반환 (Charter [지양-2])"
- `.moai/specs/SPEC-V3-INBOX-001/spec.md:180` (REQ-V3-INBOX-031):
  > "WHEN TRIAGE 파이프라인(SPEC-V3-TRIAGE-001, C-2)이 완료될 때 THEN the system SHALL `/api/ask` 훅을 통해 `auto_answer` / `auto_confidence`를 티켓에 주입..."

### 1.2 현재 코드 갭 (직검 2026-07-05)

**`app/api/ask/route.ts` (94 lines 전체 직검)**:

```ts
// 라인 63-64:
// Insert ticket with auto_answer=null (C-5 consult will RAG-generate)
// REQ-V3-INBOX-001: triageState starts at 'auto' (initial state)

// 라인 71-74:
triageState: 'auto',
autoAnswer: null, // RAG generation in C-5 consult
autoConfidence: null,

// 라인 93:
return Response.json({ ticketId }, { status: 201 });
```

**현 상태 요약**:
1. `/api/ask`는 티켓 생성 후 RAG 답변을 전혀 주입하지 않음 (`autoAnswer: null` 하드코딩).
2. `triageState: 'auto'`로 시작하나, 자동 전이 로직 미존재 (TRIAGE 파이프라인이 주입해야 함).
3. AC-06 citation 검증 분기 (400 Bad Request)는 `autoAnswer`가 null이므로 **실행 자체가 불가능** — 테스트 미작성 상태.
4. 응답 body에 `triage_state`, `auto_answer`, `auto_confidence`가 누락되어 있음 (REQ-V3-INBOX-030 명시 응답 스키마 미충족).

---

## 2. C-5 Consult RAG 파이프라인 분석 (답변 생성 소스)

### 2.1 consult.ts 아키텍처 (`lib/ai/consult.ts` 직검)

consult.ts는 8단계 비동기 제네레이터로, SSE 스트림 이벤트를 yield한다. 본 SPEC은 이 파이프라인의 **최종 결과값**을 inbox `auto_answer`로 주입해야 한다.

**핵심 단계 (lib/ai/consult.ts 직검)**:

| 단계 | 라인 | 산출 | inbox 주입 관점 |
|------|------|------|-----------------|
| Stage 1: intent classify | ~119 | `intentTraceActive` 이벤트 | 사용 안 함 |
| Stage 2: corpus search | ~130-168 | `topChunks[]` (chunk score 포함) | citation source 후보 |
| Stage 4: LLM prose generation | ~190-336 | `fullProse` (HTML, `<sup class="cite">` 포함) | `auto_answer.answer` |
| Stage 7: citation enforcement | ~340-352 | `enforceCitations(fullProse, availableSources)` → `{cleaned, violations}` | `auto_answer.answer` 최종 |
| Stage 7: confidence calc | ~351 | `confidenceScore = calculateConfidence({chunkScores, citedCount, totalSentences})` | `auto_confidence` (NUMERIC(5,2)) |
| Stage 7: sources emission | ~388, ~457 | `yield {type:'confidence', score}` / `yield {type:'sources', items}` | `auto_answer.citations[]` |

**`auto_answer` JSON 구조 (본 SPEC 제안, GAP-05 run phase 위임 해소)**:

```json
{
  "answer": "<p>...HTML prose with <sup class=\"cite\" data-source=\"1\">...</sup>...</p>",
  "citations": [
    { "source": "source-uuid-1", "quote": "...", "title": "...", "url": "..." },
    { "source": "source-uuid-2", "quote": "..." }
  ]
}
```

> **Note**: `promote.ts:24-40 extractCitations()`는 이미 이 구조를 파싱한다 (`parsed.citations` 추출). 본 SPEC의 `auto_answer` 구조는 기존 `promote.ts` 파서와 호환되어야 한다.

### 2.2 consult 재사용 vs 신규 TRIAGE 호출

**옵션 A (권장)**: `/api/ask` 훅에서 consult.ts를 직접 비-스트리밍 모드로 재호출
- 장점: consult 8단계 전체 재사용 (citation enforcement, confidence, authority gate, post-rerank gate 등)
- 단점: consult는 `conversationId`/`messageId` 영속화 기반 (라인 796-803 `getOrCreateConversation`). `/api/ask`는 티켓만 생성하고 대화 메시지는 생성하지 않으므로, **별도 메시지 영속화 없이 consult 로직의 핵심(검색→생성→citation→confidence)만 재사용**하는 함수 추출 필요.
- 구조조정: `lib/ai/consult.ts`에서 "stage 2~7 핵심"을 `runRagPipeline(input): Promise<RagResult>`로 추출 (yield는 SSE caller가 담당). 단, 이 리팩토링은 **큰 회귀 리스크**를 가지므로 본 SPEC은 run phase에서 별도 PR로 분리 검토.

**옵션 B (단기 MVP)**: `/api/ask` 훅에서 consult의 하위 모듈들을 직접 조합 (검색 → LLM → citation enforcement → confidence)
- 장점: consult.ts 회귀 리스크 없음
- 단점: 코드 중복 (8단계 로직 재구현)

> **본 SPEC은 옵션 A를 원칙으로 하되, 구현 디테일(함수 추출 범위)은 run phase에서 확정** (GAP-TRI-01 이월). 단, `auto_answer` JSON 구조와 citation/confidence 추출 계약은 본 SPEC이 정의한다.

### 2.3 기존 citation 후처리 코드 (재사용 가능)

- `lib/ai/citation-enforce.ts:73` — `enforceCitations(prose, availableSources): {cleaned, violations}` — htmlparser2 기반 uncited claim detection. **핵심 재사용 대상**.
- `lib/ai/confidence.ts:26` — `calculateConfidence({chunkScores, citedCount, totalSentences}): number` (0~1).
- `lib/source-governance/retrieval-gate.ts` — `rankByAuthority`, `assessLowAuthority` (consult.ts:543-554에서 lazy import).

---

## 3. triage_state 자동 전이 분석

### 3.1 VALID_TRANSITIONS 매트릭스 (코드 단일 진실원)

`lib/domains/inbox/types.ts:44-51` 직검:

```ts
export const VALID_TRANSITIONS: Record<TriageState, TriageState[]> = {
  auto: ['needs-review'],                    // ← TRIAGE 주입 시 유일한 탈출 경로
  'needs-review': ['escalated', 'waiting', 'closed', 'rejected'],
  escalated: ['waiting', 'closed', 'rejected'],
  waiting: ['needs-review', 'closed'],
  closed: [],     // Terminal
  rejected: [],   // Terminal
};
```

**주의**: SPEC-V3-INBOX-001 §4.3 다이어그램은 `auto→escalated`, `auto→closed`를 표시하지만, **코드(types.ts:45)는 `auto→needs-review`만 허용**. 코드가 권위(L-013, Core Behavior #2). TRIAGE 자동 전이는 반드시 `auto→needs-review` 경로만 사용.

### 3.2 TRIAGE 주입 시나리오별 자동 전이

| 시나리오 | 조건 | 결과 triage_state | 근거 |
|----------|------|-------------------|------|
| RAG 성공 + citation 있음 + confidence ≥ 임계값 | `auto_answer.citations.length > 0 && auto_confidence >= threshold` | `needs-review` | auto→needs-review 유효 전이 |
| RAG 성공 + citation 있음 + confidence < 임계값 | 위와 같되 confidence 낮음 | `needs-review` | RA 검토 필요 (Charter [지양-4]) |
| RAG 실패 또는 citation 0개 | `auto_answer == null OR citations.length == 0` | `needs-review` | citation 없으면 자동 신뢰 금지 (Charter [지양-2]) |
| 위험 키워드 감지 | `shouldAutoFlag()` true | `needs-review` | escalated 자동 전이 금지 — RA가 수동 판단 (Charter [지양-4]) |

> **핵심 불변식**: TRIAGE는 **절대 `auto→escalated`/`auto→closed`/`auto→rejected` 자동 전이를 수행하지 않는다**. 모든 자동 판정은 `needs-review`로 수렴하며, RA Lead의 수동 판단이 escalated/closed/rejected를 결정한다 (Charter [지양-4] AI 판단 대신 금지).

### 3.3 assertValidTransition 활용

`lib/domains/inbox/state-machine.ts:41-48` — `assertValidTransition(from, to)`:
- TRIAGE 주입 시 반드시 `assertValidTransition('auto', 'needs-review')` 호출로 위변조 방어.
- lib 단에서 단언하므로 route에서는 자연스럽게 500 전파 (불변식 위반 = 서버 결함).

---

## 4. 기존 ask/route.ts 분석 (수정 대상)

### 4.1 현재 구조 (94 lines)

```
POST /api/ask (withPermission 'ask.create')
├─ organizationId 가드 (403)
├─ rate limit (H-4, 30/min/user, 429)
├─ Zod 검증 (question 1..5000)
├─ ticketId = `it_${randomUUID()}`  (L-3 fix)
├─ db.transaction
│  ├─ INSERT inbox_tickets (triageState='auto', autoAnswer=null, autoConfidence=null)
│  └─ writeAudit('inbox.created')
└─ Response.json({ticketId}, 201)
```

### 4.2 수정 포인트 (본 SPEC 범위)

1. **티켓 INSERT 후 TRIAGE 훅 호출**: `auto_answer`/`auto_confidence` 주입 + `triageState` 갱신 (별개 트랜잭션 — consult가 느리므로 티켓 생성을 먼저 확정).
2. **AC-06 citation 검증**: TRIAGE 훅 결과 `auto_answer`가 있으나 `citations.length === 0`이면 **400 Bad Request** 반환 + 티켓 행 삭제(또는 상태 유지 + 에러 메타). Charter [지양-2].
3. **응답 body 확장**: `{ticketId, triageState, autoAnswer?, autoConfidence?}` (REQ-V3-INBOX-030 준수).
4. **감사 로그 추가**: TRIAGE 자동 주입 시 `inbox.triaged` action 기록 (auto→needs-review 전이분).

### 4.3 트랜잭션 경계 설계

**옵션 1 (단일 tx)**: 티켓 INSERT + TRIAGE 주입 + audit을 하나의 tx로.
- 단점: consult RAG 호출(수 초)이 tx를 물고 있어 연결 고갈 위험.

**옵션 2 (분리 tx, 권장)**:
```
tx1 (빠름): INSERT ticket (triageState='auto', autoAnswer=null) + audit 'inbox.created'
↓ commit (티켓 ID 확정)
TRIAGE 호출 (비동기, tx 없음): RAG → autoAnswer/autoConfidence 산출
↓
tx2 (빠름): UPDATE ticket SET autoAnswer, autoConfidence, triageState='needs-review' + audit 'inbox.triaged'
```

- 장점: tx 짧게 유지, RAG 실패 시에도 티켓은 존재(후속 수동 처리 가능).
- 단점: tx1과 tx2 사이 일관성 창 (티켓은 있으나 autoAnswer=null 구간). 칸반에서는 `auto` 상태로 표시되므로 수용 가능.

---

## 5. 감사 로그 분석

### 5.1 기존 audit_action enum (schema.ts:414-430 직검)

이미 SPEC-V3-INBOX-001에서 9종 추가됨:
- `inbox.created` (이미 사용 중 — ask/route.ts:80)
- `inbox.triaged` (TRIAGE 자동 전이용 — 본 SPEC에서 사용 예정)
- `inbox.assigned`, `inbox.escalated`, `inbox.answered`, `inbox.approved`, `inbox.closed`, `inbox.rejected`
- `inbox.approve_failed` (H-2 fix)

**본 SPEC은 신규 audit enum 추가 불필요**. TRIAGE 자동 주입은 `inbox.triaged` 재사용 (`lib/domains/inbox/audit.ts:39 auditTransition()` 호출 시 `triageAuditAction('needs-review')` → `inbox.triaged` 자동 매핑, audit.ts:19-29 직검).

### 5.2 감사 메타 확장 제안

TRIAGE 자동 주입 감사 메타:
```json
{
  "from": "auto",
  "to": "needs-review",
  "auto_triage": true,
  "confidence_score": 0.82,
  "citations_count": 3,
  "trigger": "auto"
}
```

기존 `auditTransition()` 시그니처(`lib/domains/inbox/audit.ts:39`)는 `TriageTransitionInput`만 받으므로, 메타 확장이 필요한 경우 별도 wrapper 또는 `auditTransition` 확장 검토 (GAP-TRI-02 run phase).

---

## 6. RBAC / 권한 분석

### 6.1 권한 매트릭스 (lib/auth/permissions.ts 직검)

- `ask.create` (라인 526): minRole `viewer` (H-4 fix). Employee 질문 진입점.
- `inbox.view` (라인 516): minRole `ra-member`. 칸반 조회.
- `inbox.manage` (라인 507): minRole `ra-lead`. 전이/승인.

### 6.2 TRIAGE 자동 주입 게이트

TRIAGE 자동 주입은 **시스템 내부 동작**이므로 별도 권한 키 불필요. 단, `auto_answer`가 주입된 티켓을 볼 수 있는 권한은 기존 `inbox.view`/`inbox.manage`로 충분.

### 6.3 Employee 자기 티켓 조회

`/api/ask` 응답에 `autoAnswer`가 포함되므로, Employee는 자신의 질문에 대한 RAG 자동 답변을 즉시 확인 가능. 단, **이것은 "draft" 자동 답변이며 final_answer가 아님**을 UI가 반드시 명시해야 함 (Charter [지양-2] fake trust 방지 — 본 SPEC 범위 외, SPEC-V3-UI-001에서 표시).

---

## 7. 의존성 매트릭스

### 7.1 상향 의존성 (본 SPEC이 의존)

| 대상 | 경로 | 용도 |
|------|------|------|
| SPEC-V3-INBOX-001 | `.moai/specs/SPEC-V3-INBOX-001/spec.md` | inbox_tickets 테이블, state machine, audit 프레임워크 |
| consult RAG pipeline | `lib/ai/consult.ts` | RAG 답변 생성 (stage 2~7) |
| citation enforcement | `lib/ai/citation-enforce.ts:73 enforceCitations()` | citation 없는 claim 검증 (Charter [지양-2]) |
| confidence calc | `lib/ai/confidence.ts:26 calculateConfidence()` | auto_confidence 산출 |
| state machine | `lib/domains/inbox/state-machine.ts:41 assertValidTransition()` | auto→needs-review 전이 검증 |
| audit | `lib/domains/inbox/audit.ts:39 auditTransition()` | inbox.triaged 감사 기록 |
| schema | `lib/db/schema.ts:3259 inboxTickets`, `:3297 approvedAnswers` | autoAnswer/autoConfidence 컬럼 |
| permissions | `lib/auth/permissions.ts` | ask.create, inbox.view/manage |

### 7.2 하향 의존성 (본 SPEC이 차단/해금)

| 대상 | 영향 |
|------|------|
| SPEC-V3-CONSULT-001 (C-5) | RA Power Chat. 본 SPEC과 독립적이나, consult.ts 리팩토링 시 영향. |
| SPEC-V3-UI-001 (Phase D) | `auto_answer` 표시 UI. 본 SPEC 완료 후 활성화. |
| approved_answers 승격 (SPEC-V3-INBOX-001 AC-05) | `promote.ts:24 extractCitations()`가 본 SPEC `auto_answer.citations[]` 구조와 호환되어야 함. |

---

## 8. Charter 매핑

| Charter 항목 | 본 SPEC 적용 |
|--------------|--------------|
| [지양-2] citation 강제 | REQ-TRI-002: citation 없는 auto_answer 저장 시 400 Bad Request. **AC-06 직접 이행**. |
| [지양-4] RA Lead 승인 | REQ-TRI-003: TRIAGE는 auto→needs-review만 수행. 자동 escalated/closed/rejected 금지. |
| [지양-1] 전사 도우미 | REQ-TRI-001: Employee `/api/ask`에서 즉시 RAG draft 답변 제공. |

---

## 9. 회귀 리스크 매트릭스

| 영역 | Risk | 완화 |
|------|------|------|
| `/api/ask` 응답 body 확장 | LOW — 기존 클라이언트(`useStreamingAnswer.ts:217`)는 `ticketId`만 읽으므로 신규 필드 호환. | 응답에 신규 필드 추가 시 기존 소비자 영향 0 검증 |
| consult.ts 리팩토링 (옵션 A) | HIGH — consult.ts는 페르소나 챗의 핵심. 회귀 폭발. | run phase에서 별도 PR로 분리, characterization tests 선행 (L-013) |
| `auto_answer` JSON 구조 변경 | MEDIUM — `promote.ts:24 extractCitations()` 파서와 호환성. | 본 SPEC 구조(`{answer, citations[]}`)가 기존 파서와 일치함 직검 |
| triage_state 자동 전이 | LOW — `auto→needs-review`는 단일 경로, state-machine.ts가 강제. | assertValidTransition 단언 |
| AC-06 400 반환 시 티켓 처리 | MEDIUM — 티켓은 남고 auto_answer만 거부, 또는 티켓도 롤백. | run phase 결정 (티켓 유지 + 수동 전이 권장) |

---

## 10. GAP 보고 (run phase 이월)

### GAP-TRI-01: consult.ts 재사용 방식 (옵션 A vs B)

- **상황**: TRIAGE 자동 주입을 위해 consult RAG 파이프라인 재사용 필요.
- **옵션 A**: `lib/ai/consult.ts`에서 핵심 함수 `runRagPipeline()` 추출 후 `/api/ask` 훅에서 호출. 회귀 리스크 HIGH.
- **옵션 B**: `/api/ask`에서 consult 하위 모듈 직접 조합 (검색 → LLM → citation → confidence). 코드 중복.
- **결정**: run phase에서 expert-backend 위임 시 결정. 본 SPEC은 `auto_answer` JSON 계약만 정의.

### GAP-TRI-02: auditTransition 메타 확장

- **상황**: TRIAGE 자동 주입 감사에 `auto_triage`, `confidence_score` 등 메타 추가 필요 가능성.
- **결정**: 기존 `auditTransition()` 시그니처 유지 + meta_json 확장은 별도 wrapper에서 처리. run phase에서 결정.

### GAP-TRI-03: 동기 vs 비동기 TRIAGE

- **상황**: `/api/ask` 응답에 `auto_answer`를 포함하려면 동기 호출 필요. 응답 지연(수 초) 발생.
- **대안**: `/api/ask`는 티켓만 생성(201), TRIAGE는 Inngest 비동기 잡으로 처리, 완료 시 SSE/UI 폴링으로 갱신.
- **결정**: v3 03_api_contract.md:14-31가 동기 응답에 `auto_answer` 포함을 명시. 본 SPEC은 **동기 호출**을 기본으로 하되, 타임아웃(예: 15s) 초과 시 `auto_answer=null`로 폴백 + 티켓은 `auto` 상태 유지. run phase에서 타임아웃 값 확정.

---

## 11. References (직검 라인 인용)

- `app/api/ask/route.ts:1-94` — POST /api/ask 전체 (본 SPEC 수정 대상)
- `lib/ai/consult.ts:340-388` — Stage 7 citation enforcement + confidence calc
- `lib/ai/consult.ts:457` — `yield {type:'sources', items}` (citations 산출)
- `lib/ai/consult.ts:531-605` — expert_review_required 게이트 + post-rerank gate (재사용 가능)
- `lib/ai/citation-enforce.ts:73` — `enforceCitations()` 핵심
- `lib/ai/confidence.ts:26` — `calculateConfidence()`
- `lib/domains/inbox/types.ts:20-51` — `TRIAGE_STATES`, `VALID_TRANSITIONS` (코드 권위)
- `lib/domains/inbox/state-machine.ts:19-48` — `canTransition`, `assertValidTransition`
- `lib/domains/inbox/audit.ts:19-58` — `triageAuditAction`, `auditTransition`
- `lib/domains/inbox/promote.ts:24-40` — `extractCitations()` (`auto_answer` 파서, 본 SPEC 구조와 호환)
- `lib/db/schema.ts:3259-3280` — `inboxTickets` (autoAnswer/autoConfidence 컬럼)
- `lib/db/schema.ts:3297-3335` — `approvedAnswers`
- `lib/db/schema.ts:414-430` — `inbox.*` audit_action enum (9종, 본 SPEC 추가 불필요)
- `lib/auth/permissions.ts:172-177, 507-528` — `ask.create`, `inbox.view`, `inbox.manage`
- `hooks/useStreamingAnswer.ts:217-219` — `/api/ask` 응답 `ticketId` 소비
- `.moai/specs/SPEC-V3-INBOX-001/spec.md:180-181` — REQ-V3-INBOX-030/031 (`/api/ask` 계약)
- `.moai/specs/SPEC-V3-INBOX-001/spec.md:193` — AC-06 (citation 없는 auto_answer 400)
- `.moai/specs/SPEC-V3-INBOX-001/spec.md:256` — As-Built 노트 (본 SPEC 이월 명시)
- Charter: `~/.claude/projects/.../memory/product-charter.md` [지양-1/2/4]
- Lessons: L-007(직검), L-013(self-report 3중 맹점 — 본 research는 전부 코드 직검)
