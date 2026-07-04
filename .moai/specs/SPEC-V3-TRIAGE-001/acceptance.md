---
id: SPEC-V3-TRIAGE-001
version: 1.0.0
status: draft
created: 2026-07-05
updated: 2026-07-05
author: abyz-lab
priority: high
issue_number: 0
labels:
  - component/backend
  - component/ai
  - component/api
  - domain/inbox
  - domain/triage
  - type/v3-new
---

# SPEC-V3-TRIAGE-001 — Acceptance Criteria

> 본 문서는 SPEC-V3-TRIAGE-001 spec.md의 모든 REQ-TRI-XXX에 대한 Given/When/Then 시나리오, 엣지 케이스, 품질 게이트, Definition of Done를 정의한다. 각 시나리오는 관련 REQ ID와 AC 번호로 추적 가능하다.

## HISTORY

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0.0 | 2026-07-05 | abyz-lab | Initial acceptance criteria (7 GWT scenarios + 11 edge cases + quality gates + DoD). Derived from spec.md REQ-TRI-001..008 and research.md §3 (TRIAGE 주입 시나리오 매트릭스). AC-TRI-02 = SPEC-V3-INBOX-001 AC-06 직접 이행. |

---

## 1. Acceptance Criteria (Given/When/Then)

### AC-TRI-01: TRIAGE RAG 자동 주입 정상 경로 (REQ-TRI-001, REQ-TRI-004)

**Given** `viewer` 역할의 사용자가 로그인되어 있고, organizationId가 유효하다.
**And** 질문 "MDR Article 61의 임상 평가 요건은?" (유효한 RAG 코퍼스 검색 결과가 있는 질문)을 준비한다.
**When** 사용자가 `POST /api/ask`로 `{question}`을 제출한다.
**Then** 서버가 (1) 티켓을 `triageState='auto'`로 생성하고, (2) TRIAGE RAG 파이프라인을 호출하여 `auto_answer`와 `auto_confidence`를 산출한다.
**And** 티켓 행이 `autoAnswer=<JSON>`, `autoConfidence=<0~1 사이 값>`, `triageState='needs-review'`로 갱신된다.
**And** 응답 body가 `{ticketId: string, triageState: 'needs-review', autoAnswer: {answer: string, citations: Array}, autoConfidence: number}` 형식이다 (REQ-TRI-004).
**And** `auto_answer` JSONB를 파싱하면 `{answer: string, citations: [{source, quote?}, ...]}` 구조를 따른다.

**Verification**: `app/api/ask/__tests__/route.test.ts`에서 RAG 파이프라인 mock이 citation 포함 결과를 반환하도록 설정 후 전체 흐름 단언. `SELECT autoAnswer, autoConfidence, triageState FROM inbox_tickets WHERE id=:ticketId` 직검.

---

### AC-TRI-02: AC-06 이행 — citation 없는 auto_answer 400 Bad Request (REQ-TRI-002, Charter [지양-2])

**Given** TRIAGE RAG 호출이 답변을 산출했으나 citations 배열이 빈 배열(`[]`)인 상황.
**When** RAG 파이프라인이 `auto_answer = {answer: "...", citations: []}`를 반환한다.
**Then** 서버가 400 Bad Request를 반환한다.
**And** 응답 body에 `{error: 'no_citations'}`가 포함된다.
**And** `auto_answer` 값이 티켓 행에 저장되지 않는다 (`SELECT autoAnswer FROM inbox_tickets WHERE id=:ticketId` → `null`).
**And** 티켓 자체는 `triageState='auto'`로 유지된다 (후속 수동 처리 허용).
**And** audit 로그에 `inbox.triaged` action과 `meta_json.auto_triage_rejected=true`, `meta_json.reason='no_citations'`가 기록된다 (21 CFR Part 11 — 자동 결함 거부 이력).

**Verification**: RAG mock이 `citations: []`를 반환하도록 설정 후 400 응답 + audit 메타 단언.

**참고**: 본 AC는 SPEC-V3-INBOX-001 AC-06 (`.moai/specs/SPEC-V3-INBOX-001/spec.md:193`)의 직접 이행이다. SPEC-V3-INBOX-001은 `/api/ask`가 `auto_answer=null` 고정이므로 이 검증 분기에 도달하지 못했으며, 본 SPEC에서 TRIAGE 주입 훅 추가로 분기가 활성화된다.

---

### AC-TRI-03: triage_state 자동 전이 auto → needs-review (REQ-TRI-003, REQ-TRI-006)

**Given** TRIAGE가 `auto_answer`와 `auto_confidence`를 정상 주입한 경우.
**When** 주입 트랜잭션이 커밋된다.
**Then** 티켓의 `triage_state`가 `auto`에서 `needs-review`로 전이된다 (`VALID_TRANSITIONS['auto'] = ['needs-review']`, types.ts:45).
**And** 동일 트랜잭션 내에서 `inbox.triaged` audit_action이 기록된다.
**And** audit `meta_json`에 `from='auto'`, `to='needs-review'`, `auto_triage=true`, `confidence_score=<값>`, `citations_count=<값>`이 포함된다.
**And** TRIAGE는 절대 `escalated`/`closed`/`rejected`로 자동 전이하지 않는다 (Charter [지양-4]).

**Given** 코드가 `auto→escalated` 자동 전이를 시도하는 경우 (버그/위변조).
**When** `assertValidTransition('auto', 'escalated')`가 호출된다.
**Then** `Error: Invalid triage state transition: auto → escalated`가 throw된다 (state-machine.ts:43).
**And** 이것은 서버 결함(500)으로 전파되어 명시적 위변조 시도를 노출한다.

**Verification**: 정상 전이 단언 + 부정 전이 시도 시 throw 단언 (`assertValidTransition` 직접 호출).

---

### AC-TRI-04: RAG 타임아웃/실패 폴백 (REQ-TRI-005)

**Given** TRIAGE RAG 호출이 타임아웃(기본 15초, `TRIAGE_TIMEOUT_MS`) 또는 런타임 예외로 실패하는 상황.
**When** 타임아웃 또는 예외가 발생한다.
**Then** 서버가 201 Created를 유지한다 (RAG 실패가 티켓 생성을 실패시키지 않음).
**And** 응답 body가 `{ticketId: string, triageState: 'auto', autoAnswer: null, autoConfidence: null}`를 반환한다.
**And** 티켓 행은 `triageState='auto'`, `autoAnswer=null`로 DB에 존재한다.
**And** audit 로그에 실패 메타(`auto_triage_failed: true`, `reason: 'timeout' | 'runtime_error'`)가 기록된다.

**Verification**: RAG mock이 `setTimeout` 기반 지연 후에도 응답 안 함 + `TRIAGE_TIMEOUT_MS=100` (테스트용 단축)로 폴백 단언.

---

### AC-TRI-05: 기존 클라이언트 하위 호환 (REQ-TRI-004)

**Given** 기존 `hooks/useStreamingAnswer.ts:217-219`가 `/api/ask` 응답에서 `ticketId`만 읽는 기존 동작.
**When** 본 SPEC의 확장된 응답 body(`{ticketId, triageState, autoAnswer, autoConfidence}`)를 수신한다.
**Then** `askData.ticketId`를 정상 추출하고 `state.ticketId`를 갱신한다 (기존 동작 보존).
**And** 신규 필드(`triageState, autoAnswer, autoConfidence`)는 무시되며 런타임 에러를 발생시키지 않는다.

**Given** `components/chat/__tests__/ChatShell.ticketId.test.tsx` 기존 회귀 테스트.
**When** 본 SPEC 변경 후 해당 테스트를 재실행한다.
**Then** 기존 테스트가 회귀 없이 통과한다 (회귀 0건).

**Verification**: `ChatShell.ticketId.test.tsx` + `useStreamingAnswer` 기존 테스트 suite 통과. 신규 응답 필드 회귀 없음.

---

### AC-TRI-06: TRIAGE 정상 전이 감사 로그 메타 (REQ-TRI-006, 21 CFR Part 11 §11.10(e))

**Given** TRIAGE 자동 전이(`auto→needs-review`)가 정상 수행된 경우.
**When** audit 로그를 조회한다.
**Then** `audit_action='inbox.triaged'`, `resource_type='inbox_ticket'`, `resource_id=<ticketId>` 행이 존재한다.
**And** `meta_json`에 다음이 포함된다: `from='auto'`, `to='needs-review'`, `auto_triage=true`, `confidence_score=<number>`, `citations_count=<number>` (GAP-TRI-02 — run phase에서 메타 확장 방식 확정).
**And** 감사 로그는 append-only이며 기존 hash chain을 보존한다 (21 CFR Part 11 §11.10(e)).

> 참고: AC-06 위반(citation 없음) 시의 감사 메타(`auto_triage_rejected=true`, `reason='no_citations'`)는 AC-TRI-02 (REQ-TRI-007)에서 단언하므로 본 AC에서는 중복 단언하지 않는다.

**Verification**: `SELECT action, meta_json FROM audit_logs WHERE resource_id=:ticketId ORDER BY created_at` 단언.

---

### AC-TRI-07: auto_answer JSON 구조 extractCitations 호환 (REQ-TRI-001, SPEC-V3-INBOX-001 AC-05)

**Given** TRIAGE가 산출한 `auto_answer`가 `{answer: "<HTML prose>", citations: [{source: 'src-uuid-1', quote: '...'}, {source: 'src-uuid-2'}]}` 형식으로 저장된 경우.
**When** `lib/domains/inbox/promote.ts:24 extractCitations()`가 이 JSONB를 파싱한다.
**Then** `parsed.citations` 배열이 추출되며, `[{source: 'src-uuid-1', quote: '...'}, {source: 'src-uuid-2'}]`를 반환한다.
**And** 기존 `promoteToApproved()` 흐름(SPEC-V3-INBOX-001 AC-05 승격 경로)이 이 `auto_answer`로부터 citations를 정상 추출함을 단언한다.
**And** `auto_answer.answer` HTML에 `<sup class="cite" data-source="N">` 마커가 포함된다 (Citation provenance).

**Verification**: `extractCitations(JSON.stringify({answer, citations}))` 단위 테스트. `promoteToApproved` 통합 테스트에서 TRIAGE 주입 `auto_answer` 사용.

---

## 2. Edge Cases (E1..E11)

> 본 섹션은 SPEC-V3-UI-001 패턴을 준용하여 11개 엣지 케이스를 정의한다. 각 엣지는 관련 AC/REQ와 연결된다.

### E-01: 질문이 RAG 코퍼스와 매칭 안 됨 (empty topChunks)

**상황**: RAG 검색이 0개 chunk 반환.
**기대**: `auto_answer = {answer: '(검색 결과가 없습니다)', citations: []}`. citations.length === 0이므로 **AC-TRI-02 (400 Bad Request)** 경로로 진입. 단, answer가 빈 문자열이 아닌 폴백 메시지인 점이 핵심 (사용자 기만 방지).
**관련**: AC-TRI-02, REQ-TRI-002.

### E-02: LLM 호출 실패 (consult.ts:329 fallback path)

**상황**: LLM API 호출 실패. consult.ts:329는 "citations only" fallback.
**기대**: TRIAGE는 `auto_answer` 산출 실패로 처리. `autoAnswer: null`, `triageState: 'auto'` 유지 (AC-TRI-04 폴백). audit에 `auto_triage_failed: true, reason: 'llm_failed'`.
**관련**: AC-TRI-04, REQ-TRI-005.

### E-03: 질문이 5000자 초과

**상황**: Zod 검증(`z.string().max(5000)`) 실패.
**기대**: 기존 동작 유지 (400 invalid input). TRIAGE 호출 도달 않음. 본 SPEC 영향 없음.
**관련**: 기존 `app/api/ask/route.ts:16`.

### E-04: rate limit 초과 (H-4, 30/min/user)

**상황**: 동일 사용자 1분 내 31번째 요청.
**기대**: 429 rate_limit_exceeded. TRIAGE 호출 도달 않음. 본 SPEC 영향 없음.
**관련**: 기존 `app/api/ask/route.ts:46-48`.

### E-05: organizationId 누락

**상황**: 세션에 organizationId 없음.
**기대**: 403 (기존 동작 유지). TRIAGE 호출 도달 않음.
**관련**: 기존 `app/api/ask/route.ts:41-43`.

### E-06: TRIAGE 주입 tx2 실패 (예: DB 일시 장애)

**상황**: tx1(티켓 생성)은 성공, TRIAGE RAG는 성공, tx2(주입 UPDATE) 실패.
**기대**: tx2 롤백 → 티켓은 `triageState='auto'`, `autoAnswer=null`로 잔존. 에러 로깅 + 201 with `autoAnswer: null` 폴백 응답 (REQ-TRI-005 폴백 전략 단일화, tasks.md T-018 권장).
**관련**: REQ-TRI-005 (폴백 전략).

### E-07: 타 org 사용자가 티켓 ID로 RAG 결과 접근 시도

**상황**: 공격자가 타 org 티켓 ID로 `/api/ask` 응답을 가로채려 시도.
**기대**: `/api/ask`는 세션 기반 티켓 생성만 하므로 타 org 티켓 조회 불가. 기존 inbox 권한 게이트(`assertTicketInOrg`)가 승격/조회 경로 방어.
**관련**: SPEC-V3-INBOX-001 REQ-V3-INBOX-010 (이미 구현).

### E-08: TRIAGE 자동 주입 후 RA Lead가 즉시 reject

**상황**: TRIAGE가 `auto→needs-review`로 전이한 직후, RA Lead가 수동으로 `needs-review→rejected` 전이.
**기대**: 정상 동작. TRIAGE의 `needs-review`는 종착지가 아니라 수동 판단 대기 상태. RA Lead의 reject는 기존 SPEC-V3-INBOX-001 워크플로우 따름.
**관련**: Charter [지양-4], SPEC-V3-INBOX-001.

### E-09: 동일 질문 반복 (캐싱 미사용 상태)

**상황**: 동일 사용자가 같은 질문을 1분 내 2번 제출.
**기대**: 각각 별도 티켓 생성 + 별도 TRIAGE 호출 (rate limit 30/min 범위 내). 본 SPEC은 캐싱 미지원 (Follow-up #3). RAG 호출 비용 증가 수용.
**관련**: Follow-up #3.

### E-10: TRIAGE가 `auto_answer.citations[].source`에 유효하지 않은 UUID 반환

**상황**: consult RAG가 `citedChunks[].sourceId`에 대해 존재하지 않는 source id 반환 (예: 코퍼스 삭제 후 stale).
**기대**: AC-TRI-02 위반 아님 (citations.length > 0). 주입은 성공하나, 이후 `promoteToApproved` 시 FK 검증 또는 source 조회 실패 가능. 본 SPEC 범위 외 — Follow-up에서 source 유효성 검증 추가 검토.
**관련**: Follow-up #5 (citations 상세 스키마).

### E-11: TRIAGE RAG 호출 중 사용자가 연결 끊음

**상황**: 클라이언트가 `/api/ask` 요청 후 응답 대기 중 브라우저 종료.
**기대**: 서버는 tx1(티켓 생성) 커밋까지는 완료. TRIAGE 호출은 진행 중단 여부가 서버 구현에 따라 다름 (AbortSignal 전파 여부). 티켓은 `triageState='auto'`로 DB에 잔존 (후속 Inngest 잡 또는 수동 처리 대상).
**관련**: Follow-up #2 (비동기 TRIAGE 잡).

---

## 3. Quality Gates (TRUST 5)

### 3.1 Tested

- 단위 테스트: `app/api/ask/__tests__/route.test.ts` 확장 (AC-TRI-01..07 단언 추가).
- 통합 테스트: TRIAGE 주입 후 `promoteToApproved` 연동 호환성 단언 (AC-TRI-07).
- 회귀 테스트: `useStreamingAnswer`/`ChatShell.ticketId.test.tsx` 기존 통과 유지 (AC-TRI-05).
- 커버리지: 신규 `lib/domains/triage/` 모듈 85%+.

### 3.2 Readable

- TRIAGE 호출 흐름 명확한 주석 (`@MX:NOTE [AUTO]`).
- `auto_answer` JSON 구조 TypeScript 인터페이스 명시.
- 한국어 주석은 금지 (code_comments: en).

### 3.3 Unified

- biome 포맷팅 (`pnpm lint` 통과).
- 기존 camelCase 컨벤션 준수 (`autoAnswer`, `ticketId`, `triageState`).

### 3.4 Secured

- AC-06 citation 강제 (Charter [지양-2]).
- `assertValidTransition` 불변식 강제 (Charter [지양-4]).
- 기존 `ask.create` 권한 게이트, org_id 소유권, rate limit 유지.
- 21 CFR Part 11 §11.10(e) audit append-only.

### 3.5 Trackable

- `Fixes #<issue>` 커밋 footer (이슈 등록 시).
- SPEC-V3-TRIAGE-001 참조.
- @MX 태그: `@MX:SPEC SPEC-V3-TRIAGE-001` 부착.

---

## 4. Definition of Done

- [ ] 8/8 REQs (REQ-TRI-001..008) 구현 완료
- [ ] 7/7 ACs (AC-TRI-01..07) 테스트 통과
- [ ] 11/11 Edge Cases (E-01..E-11) 처리 검증
- [ ] `pnpm typecheck` EXIT 0
- [ ] `pnpm lint` (lint:hex 포함) EXIT 0
- [ ] `pnpm test` (FULL) 통과 — 기존 4400+ passed 회귀 0건
- [ ] `pnpm ci:*` 전 단계 로컬 직검 (L-015)
- [ ] 실DB `\d inbox_tickets` 직검 (autoAnswer/autoConfidence 컬럼 기존 존재, 본 SPEC migration 불필요)
- [ ] audit_action enum 직검 (`inbox.triaged` 기존 존재, 신규 추가 불필요)
- [ ] `useStreamingAnswer`/`ChatShell` 기존 테스트 회귀 0 (AC-TRI-05)
- [ ] Charter [지양-2] (AC-TRI-02 citation 강제) + [지양-4] (auto→needs-review만) 매핑 검증
- [ ] sync phase: README/CHANGELOG/implementation-status 갱신
- [ ] PR 생성 + `Fixes #<issue>` + CI green

---

## 5. Test Strategy (TDD)

### 5.1 RED 단계 (failing tests first)

1. `app/api/ask/__tests__/route.test.ts` 확장:
   - AC-TRI-01: TRIAGE 주입 정상 경로 단언 (응답 body + DB 갱신).
   - AC-TRI-02: citation 0개 시 400 단언 + audit 메타.
   - AC-TRI-03: triage_state 전이 단언 + 부정 전이 throw.
   - AC-TRI-04: 타임아웃 폴백 단언.
   - AC-TRI-06: audit 메타 단언.
2. `lib/domains/triage/__tests__/run-triage.test.ts` [NEW]:
   - AC-TRI-07: `auto_answer` 구조 + extractCitations 호환성.

### 5.2 GREEN 단계 (minimal implementation)

- `lib/domains/triage/run-triage.ts`: RAG 호출 래퍼.
- `app/api/ask/route.ts`: TRIAGE 훅 + 응답 body 확장.

### 5.3 REFACTOR 단계

- consult.ts 재사용 방식 (옵션 A/B) run phase 결정 후 정리.
- `@MX:ANCHOR` 부착 (`run-triage.ts` fan_in ≥ 3 예상).

---

## 6. References

- `spec.md` REQ-TRI-001..008
- `research.md` §3 (TRIAGE 주입 시나리오 매트릭스)
- `.moai/specs/SPEC-V3-INBOX-001/spec.md:193` (AC-06 원문)
- `.moai/specs/SPEC-V3-INBOX-001/acceptance.md` (AC-05 승격 경로 호환성)
- Charter: [지양-2] citation 강제, [지양-4] RA Lead 승인
- SPEC-V3-UI-001 `acceptance.md` (11 엣지 케이스 패턴 준용)
