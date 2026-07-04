## Task Decomposition

SPEC: SPEC-V3-TRIAGE-001
Development Mode: tdd | Execution: sub-agent sequential | Harness: thorough

> **Code-Authoritative Contract (verified against source 2026-07-05)**:
> - `/api/ask` 현재 구현: `app/api/ask/route.ts:1-94`. `triageState='auto'`, `autoAnswer: null` 하드코딩 (라인 71-74). 응답 `{ticketId}`만 반환 (라인 93).
> - `VALID_TRANSITIONS['auto'] = ['needs-review']` (유일한 자동 전이 경로) — `lib/domains/inbox/types.ts:45`. 코드가 SPEC-V3-INBOX-001 §4.3 다이어그램보다 권위 (L-013).
> - `assertValidTransition()` — `lib/domains/inbox/state-machine.ts:41-48` (부정 전이 throw).
> - `auditTransition()` — `lib/domains/inbox/audit.ts:39`. `triageAuditAction('needs-review')` → `'inbox.triaged'` 매핑 (audit.ts:19-29).
> - `inbox.triaged` audit_action 이미 존재 — `lib/db/schema.ts:423`. 본 SPEC 신규 enum 추가 불필요.
> - `extractCitations()` — `lib/domains/inbox/promote.ts:24-40`. `auto_answer` JSON 파서. 본 SPEC `auto_answer` 구조(`{answer, citations[]}`)는 이 파서와 호환 (research.md §2.1 직검).
> - `inboxTickets.autoAnswer`/`autoConfidence` 컬럼 — `lib/db/schema.ts:3275-3276`. 이미 존재 (migration 불필요).
> - consult RAG 핵심 — `lib/ai/consult.ts:340-388` (Stage 7), `lib/ai/citation-enforce.ts:73 enforceCitations()`, `lib/ai/confidence.ts:26 calculateConfidence()`.
> - `ask.create` 권한 — `lib/auth/permissions.ts:526`. minRole `viewer` (H-4 fix).
> - 기존 클라이언트 — `hooks/useStreamingAnswer.ts:217-219` (`/api/ask` 응답 `ticketId` 추출).

> **TDD discipline**: Each task = RED (failing test) → GREEN (minimal code) → REFACTOR. For `[MODIFY]` brownfield files, run a characterization-test task FIRST (DDD safety net) before any TDD cycle that changes behavior.

### M1 — Foundation: TRIAGE 모듈 스키마/타입 (Priority: High)

| Task ID | Description | Requirement | Dependencies | Planned Files | Status |
|---------|-------------|-------------|--------------|---------------|--------|
| T-001 | `lib/domains/triage/types.ts` — RED: `AutoAnswer`, `TriageResult`, `RagPipelineInput` 인터페이스 미존재 단언; GREEN: 최소 타입 정의. `AutoAnswer = {answer: string, citations: Array<{source: string, quote?: string}>}` (SPEC §4.3). `TriageResult = {autoAnswer: AutoAnswer \| null, autoConfidence: number \| null, error?: 'no_citations' \| 'timeout' \| 'runtime_error'}`. `@MX:NOTE [AUTO]` 부착 예정 | REQ-TRI-001 | - | `lib/domains/triage/types.ts` [NEW], `lib/domains/triage/__tests__/types.test.ts` [NEW] | pending |
| T-002 | `lib/domains/triage/` index.ts 공개 API — RED: `./run-triage` export 미존재 단언; GREEN: 빈 re-export (T-003 완료 후 채움) | - | T-001 | `lib/domains/triage/index.ts` [NEW] | pending |
| T-003 | `lib/env.ts` `TRIAGE_TIMEOUT_MS` 추가 — RED: env 스키마에 `TRIAGE_TIMEOUT_MS` 미존재 단언; GREEN: `z.coerce.number().default(15000)` 추가 (다른 env 패턴 준용). `.env.example` 갱신 | REQ-TRI-005 | T-001 | `lib/env.ts` [MODIFY], `.env.example` [MODIFY] | pending |

### M2 — TRIAGE RAG 파이프라인 래퍼 (Priority: High)

| Task ID | Description | Requirement | Dependencies | Planned Files | Status |
|---------|-------------|-------------|--------------|---------------|--------|
| T-004 | `lib/domains/triage/run-triage.ts` (옵션 B 기본 — 회귀 낮춤) — RED: `runTriage({question, orgId, signal})` 호출 시 `{autoAnswer, autoConfidence, error}` 반환 단언; GREEN: consult 하위 모듈(hybridSearch, generateProse, enforceCitations, calculateConfidence) 직접 조합 래퍼. 타임아웃(`TRIAGE_TIMEOUT_MS`) 적용. **GAP-TRI-01**: 옵션 A(consult.ts runRagPipeline 추출) vs B(하위 모듈 직접 조합) run phase 결정. 본 task는 옵션 B 기본, 옵션 A는 별도 PR에서 characterization tests 선행 | REQ-TRI-001, REQ-TRI-005 | T-001, T-003 | `lib/domains/triage/run-triage.ts` [NEW], `lib/domains/triage/__tests__/run-triage.test.ts` [NEW] | pending |
| T-005 | citation 검증 (AC-TRI-02 핵심) — RED: `runTriage()`가 citations 빈 배열 반환 시 `TriageResult.error='no_citations'` 단언; GREEN: `autoAnswer.citations.length === 0` 분기에서 error 설정. `autoAnswer.answer`는 폴백 메시지 유지 (사용자 기만 방지, E-01) | REQ-TRI-002 | T-004 | `lib/domains/triage/run-triage.ts` [MODIFY], `lib/domains/triage/__tests__/run-triage.test.ts` [MODIFY] | pending |
| T-006 | 타임아웃/예외 폴백 — RED: RAG 호출이 `TRIAGE_TIMEOUT_MS` 초과 시 `TriageResult.error='timeout', autoAnswer=null` 단언; 런타임 예외 시 `error='runtime_error'` 단언; GREEN: `AbortController` + `setTimeout` 또는 `Promise.race` 패턴. E-02 (LLM 실패) 포함 | REQ-TRI-005 | T-004 | `lib/domains/triage/run-triage.ts` [MODIFY], `lib/domains/triage/__tests__/run-triage.test.ts` [MODIFY] | pending |
| T-007 | extractCitations 호환성 — RED: `runTriage()` 산출 `autoAnswer` JSON을 `extractCitations()`에 전달 시 기존 파서가 정상 동작 단언 (AC-TRI-07); GREEN: `auto_answer = {answer, citations: [{source, quote?}]}` 구조 준수. `lib/domains/inbox/promote.ts:24-40` 파서와 정합 | REQ-TRI-001, AC-TRI-07 | T-004 | `lib/domains/triage/run-triage.test.ts` [MODIFY] (호환성 단언 추가) | pending |

### M3 — `/api/ask` TRIAGE 훅 + AC-06 검증 (Priority: High)

| Task ID | Description | Requirement | Dependencies | Planned Files | Status |
|---------|-------------|-------------|--------------|---------------|--------|
| T-008 | `/api/ask` characterization test (brownfield 안전망) — 기존 `app/api/ask/route.ts` 동작 스냅샷 캡처 (ticketId 반환, triageState='auto', audit inbox.created). T-009..T-012 수정 후에도 본 테스트는 통과해야 함. 기존 `app/api/ask/__tests__/route.test.ts`가 이미 존재하므로 [MODIFY] — 회귀 단언 보강 | (DDD safety) | - | `app/api/ask/__tests__/route.test.ts` [MODIFY] | pending |
| T-009 | `/api/ask` TRIAGE 훅 호출 (정상 경로) — RED: POST 후 (1) tx1 티켓 생성 → (2) `runTriage()` 호출 → (3) tx2 UPDATE 티켓(`autoAnswer`, `autoConfidence`, `triageState='needs-review'`) → (4) 응답 body `{ticketId, triageState, autoAnswer, autoConfidence}` 반환 단언; GREEN: TRIAGE 훅 추가. tx2에서 `assertValidTransition('auto', 'needs-review')` 단언. `db.transaction` 2개 분리 (tx1 커밋 후 TRIAGE, 그 후 tx2). AC-TRI-01/03 | REQ-TRI-001, REQ-TRI-003, REQ-TRI-004, AC-TRI-01, AC-TRI-03 | T-004, T-008 | `app/api/ask/route.ts` [MODIFY], `app/api/ask/__tests__/route.test.ts` [MODIFY] | pending |
| T-010 | AC-06 검증 (citation 없는 auto_answer 400) — RED: TRIAGE가 `error='no_citations'` 반환 시 400 Bad Request + `{error: 'no_citations'}` 응답 단언; `autoAnswer` 티켓 미저장(`SELECT autoAnswer FROM inbox_tickets WHERE id=:ticketId` → null) 단언; 티켓은 `triageState='auto'` 유지 단언; GREEN: error 분기 처리. AC-TRI-02 (SPEC-V3-INBOX-001 AC-06 직접 이행) | REQ-TRI-002, AC-TRI-02 | T-009 | `app/api/ask/route.ts` [MODIFY], `app/api/ask/__tests__/route.test.ts` [MODIFY] | pending |
| T-011 | 타임아웃/예외 폴백 — RED: TRIAGE `error='timeout'` 또는 `'runtime_error'` 시 201 Created 유지 + `{ticketId, triageState: 'auto', autoAnswer: null, autoConfidence: null}` 반환 단언; 티켓은 DB에 존재 단언; GREEN: 폴백 분기 처리. AC-TRI-04, E-02 | REQ-TRI-005, AC-TRI-04 | T-009 | `app/api/ask/route.ts` [MODIFY], `app/api/ask/__tests__/route.test.ts` [MODIFY] | pending |
| T-012 | 응답 body 확장 + 기존 호환성 — RED: 응답이 `ticketId`(기존) + `triageState, autoAnswer, autoConfidence`(신규) 모두 포함 단언; 기존 `useStreamingAnswer` 회귀 0 단언; GREEN: Response.json 확장 (기존 ticketId 필드 보존). `hooks/useStreamingAnswer.ts:217` 변경 없음. AC-TRI-05 | REQ-TRI-004, AC-TRI-05 | T-009, T-010, T-011 | `app/api/ask/route.ts` [MODIFY], `app/api/ask/__tests__/route.test.ts` [MODIFY], `components/chat/__tests__/ChatShell.ticketId.test.tsx` [MODIFY or 유지] | pending |

### M4 — 자동 전이 + 감사 로그 (Priority: High)

| Task ID | Description | Requirement | Dependencies | Planned Files | Status |
|---------|-------------|-------------|--------------|---------------|--------|
| T-013 | `triage_state auto→needs-review` 자동 전이 감사 — RED: TRIAGE 주입 성공 시 audit 로그에 `inbox.triaged` action + `meta.from='auto', to='needs-review', auto_triage=true, confidence_score, citations_count` 행 존재 단언; GREEN: 기존 `auditTransition()` 호출로 감사 기록 (audit.ts:39 재사용). 메타 확장은 GAP-TRI-02 — 직접 `writeAudit` 호출 또는 wrapper로 메타 추가. AC-TRI-06, REQ-TRI-006 | REQ-TRI-003, REQ-TRI-006, AC-TRI-03, AC-TRI-06 | T-009 | `app/api/ask/route.ts` [MODIFY], `app/api/ask/__tests__/route.test.ts` [MODIFY] | pending |
| T-014 | AC-06 거부 감사 — RED: citation 없는 auto_answer로 400 반환 시 audit 로그에 `inbox.triaged` action + `meta.auto_triage_rejected=true, reason='no_citations'` 행 존재 단언; GREEN: 400 분기에서 감사 기록. REQ-TRI-007, AC-TRI-02 audit 부분 | REQ-TRI-002, REQ-TRI-007 | T-010, T-013 | `app/api/ask/route.ts` [MODIFY], `app/api/ask/__tests__/route.test.ts` [MODIFY] | pending |
| T-015 | assertValidTransition 위변조 방어 — RED: 코드가 `auto→escalated` 등 부정 전이 시도 시 `assertValidTransition`이 throw 단언; GREEN: tx2에서 `assertValidTransition('auto', 'needs-review')` 명시적 호출 (방어 코드). AC-TRI-03 부정 전이 분기 | REQ-TRI-003, AC-TRI-03 | T-013 | `app/api/ask/route.ts` [MODIFY], `app/api/ask/__tests__/route.test.ts` [MODIFY] | pending |

### M5 — 권한/게이트 + 엣지 케이스 (Priority: Medium)

| Task ID | Description | Requirement | Dependencies | Planned Files | Status |
|---------|-------------|-------------|--------------|---------------|--------|
| T-016 | 권한 게이트 유지 — RED: TRIAGE 훅이 `withPermission('ask.create')` 게이트 뒤에서만 실행 단언; 미인증 시 401 + TRIAGE 호출 안 됨 단언; viewer/employee/ra-member/ra-lead/admin 역할별 TRIAGE 실행 단언 (모두 허용 — 시스템 내부 동작); GREEN: 기존 `withPermission` 래퍼 내 TRIAGE 호출 배치. REQ-TRI-008, E-04/E-05 | REQ-TRI-008 | T-009 | `app/api/ask/route.ts` [MODIFY], `app/api/ask/__tests__/route.test.ts` [MODIFY] | pending |
| T-017 | E-01 (빈 topChunks) — RED: RAG가 0개 chunk 반환 시 `error='no_citations'` 또는 `error='empty_results'` 단언 + 400 응답 + `autoAnswer.answer`가 폴백 메시지 단언 (사용자 기만 방지); GREEN: run-triage.ts 분기 처리 | REQ-TRI-002, E-01 | T-005 | `lib/domains/triage/run-triage.ts` [MODIFY], `lib/domains/triage/__tests__/run-triage.test.ts` [MODIFY] | pending |
| T-018 | E-06 (tx2 실패) — RED: tx2 UPDATE 실패 시 티켓은 `triageState='auto', autoAnswer=null` 잔존 단언; 응답은 500 또는 201 폴백(run phase 결정); GREEN: try/catch 분기. 본 SPEC은 201 폴백 권장 (REQ-TRI-005 일관성) | REQ-TRI-005, E-06 | T-011 | `app/api/ask/route.ts` [MODIFY], `app/api/ask/__tests__/route.test.ts` [MODIFY] | pending |

### M6 — Quality Gates (Priority: High)

| Task ID | Description | Requirement | Dependencies | Planned Files | Status |
|---------|-------------|-------------|--------------|---------------|--------|
| T-019 | `pnpm ci:lint` 로컬 직검 (L-008/L-015) — `pnpm ci:lint`(lint:hex full) 로컬 실행; noUnusedVariables 등 CI=error 항목 0 위반; unused import/vars 제거; 코드 줄에 `#NNN` 금지 (L-008). TRIAGE 모듈 + ask route 전부 | (L-008, L-015) | T-001..T-018 | (수정만) | pending |
| T-020 | `pnpm ci:typecheck` + 전 `pnpm ci:*` 단계 로컬 직검 (L-015) — TypeScript 0 신규 에러; ci:audit (lib 내부 tx audit 시 override — lib/domains/triage/ 포함), ci:rbac, ci:tokens, ci:i18n, ci:glossary, ci:contrast, ci:module-boundaries 전 단계 로컬 green. 일부 green=전체 green 아님 (L-015) | (L-015) | T-019 | (수정만) | pending |
| T-021 | `pnpm ci:audit` TRIAGE 도메인 검증 (L-015 핵심) — TRIAGE 주입 감사가 `lib/domains/triage/` 또는 `app/api/ask/route.ts`에서 tx 내 기록되는지 직검. route가 `writeAudit(...)` literal 호출 시 ci:audit 통과. lib 내부 호출 시 `audit-check-ignore` override 필요 (L-015 — 주석에 `*` 금지, 구체적 단어). `inbox.triaged` action 명시 | (L-015, ci:audit) | T-013, T-014, T-020 | (수정만) | pending |
| T-022 | 전체 `pnpm test` 실행 (L-009) — 타깃만이 아닌 전체 `pnpm test` 실행; 기존 4400+ passed 회귀 0; staged 범위 직검; 11 엣지 케이스(E-01..E-11) 처리 확인; `useStreamingAnswer`/`ChatShell.ticketId.test.tsx` 회귀 0 단언 | (L-009) | T-020 | (수정만) | pending |
| T-023 | 실DB 직검 (L-010/L-013) — `SELECT autoAnswer, autoConfidence, triageState FROM inbox_tickets WHERE id=<test-ticket>` 직검; `\d inbox_tickets` (autoAnswer/autoConfidence 컬럼 기존 존재 확인, migration 불필요); `SELECT action, meta_json FROM audit_logs WHERE resource_id=<ticket> ORDER BY created_at` 직검 (`inbox.triaged` + 메타) | (L-010, L-013) | T-022 | (수정만) | pending |
| T-024 | `pnpm build` 로컬 직검 (L-012) — `next dev` 중지 확인 후 `pnpm build` 실행; `.next` chunk 충돌(페이지 500) 방지; 빌드 성공 단언 | (L-012) | T-023 | (수정만) | pending |
| T-025 | Pre-submission self-review — 전체 변경셋 단순성 검토 ("더 단순한 접근인가?", "제거해도 SPEC 만족하는가?"); @MX 태그 최종 검증 (ANCHOR: run-triage.ts fan_in ≥ 3 예상, NOTE: route TRIAGE 훅, WARN: AC-06 검증 분기 21 CFR Part 11); 불필요한 추상화 제거 | (workflow-modes Pre-submission) | T-024 | (수정만) | pending |

---

## Coverage Verification

### REQ Coverage (8 REQs → Tasks)

| REQ ID | Covered By | Status |
|--------|------------|--------|
| REQ-TRI-001 | T-001, T-004, T-007, T-009 | ⏳ |
| REQ-TRI-002 | T-005, T-010, T-014, T-017, AC-TRI-02 | ⏳ |
| REQ-TRI-003 | T-009, T-013, T-015, AC-TRI-03 | ⏳ |
| REQ-TRI-004 | T-009, T-012, AC-TRI-01 | ⏳ |
| REQ-TRI-005 | T-003, T-006, T-011, T-018, AC-TRI-04 | ⏳ |
| REQ-TRI-006 | T-013, AC-TRI-06 | ⏳ |
| REQ-TRI-007 | T-014 | ⏳ |
| REQ-TRI-008 | T-016 | ⏳ |

**8/8 REQs covered.** ⏳

### AC Coverage (7 ACs → Tasks)

| AC ID | Covered By | Status |
|-------|------------|--------|
| AC-TRI-01 | T-009 | ⏳ |
| AC-TRI-02 | T-005, T-010, T-014, T-017 (SPEC-V3-INBOX-001 AC-06 이행) | ⏳ |
| AC-TRI-03 | T-009, T-013, T-015 | ⏳ |
| AC-TRI-04 | T-006, T-011, T-018 | ⏳ |
| AC-TRI-05 | T-012 | ⏳ |
| AC-TRI-06 | T-013, T-014 | ⏳ |
| AC-TRI-07 | T-007 | ⏳ |

**7/7 ACs covered.** ⏳

### Edge Case Coverage (11 → Tasks)

| Edge | Covered By | Status |
|------|------------|--------|
| E-01 (빈 topChunks) | T-017 | ⏳ |
| E-02 (LLM 실패) | T-006 | ⏳ |
| E-03 (5000자 초과) | 기존 route 유지 (영향 없음) | ⏳ |
| E-04 (rate limit) | 기존 route 유지 + T-016 권한 | ⏳ |
| E-05 (orgId 누락) | 기존 route 유지 + T-016 | ⏳ |
| E-06 (tx2 실패) | T-018 | ⏳ |
| E-07 (타 org 접근) | 기존 inbox 게이트 (SPEC-V3-INBOX-001) | ⏳ |
| E-08 (즉시 reject) | 기존 state machine | ⏳ |
| E-09 (동일 질문 반복) | Follow-up #3 | ⏳ |
| E-10 (잘못된 source UUID) | Follow-up #5 | ⏳ |
| E-11 (사용자 연결 끊음) | Follow-up #2 | ⏳ |

**11/11 Edge Cases addressed.** ⏳

---

## Code Authority Verification (L-013)

본 tasks.md의 모든 코드 라인 인용은 2026-07-05 main HEAD 기준 직검이다. run phase 시작 시 아래 항목 재직검 필수:

- [ ] `app/api/ask/route.ts:71-74` (triageState='auto', autoAnswer=null 하드코딩) — 본 SPEC 수정 直接 대상
- [ ] `lib/domains/inbox/types.ts:45` (`VALID_TRANSITIONS.auto = ['needs-review']`) — 코드 권위
- [ ] `lib/domains/inbox/audit.ts:39` (`auditTransition()` 시그니처)
- [ ] `lib/db/schema.ts:414-430` (`inbox.*` audit enum, 본 SPEC 추가 불필요)
- [ ] `lib/db/schema.ts:3275-3276` (autoAnswer/autoConfidence 컬럼 기존 존재)
- [ ] `lib/domains/inbox/promote.ts:24-40` (`extractCitations` 파서 호환성)
- [ ] `lib/auth/permissions.ts:526` (`ask.create` minRole viewer)
- [ ] `hooks/useStreamingAnswer.ts:217-219` (기존 ticketId 소비, 회귀 0 단언)

---

## Risks & Mitigations (run phase 참고)

| Risk | Mitigation |
|------|------------|
| consult.ts 리팩토링 (옵션 A) 회귀 폭발 | T-004는 옵션 B 기본. 옵션 A는 별도 PR + characterization tests 선행 (L-013) |
| AC-06 400 시 티켓 처리 (유지 vs 롤백) | 본 SPEC은 티켓 유지 + audit 기록 (수동 후속 처리 허용). run phase에서 확정 |
| TRIAGE 호출 동기 응답 지연 (수 초) | 15s 타임아웃 + 폴백(AC-TRI-04). 비동기 Inngest 잡은 Follow-up #2 |
| audit 메타 확장 (auto_triage 등) 기존 auditTransition 시그니처 영향 | GAP-TRI-02 — 직접 writeAudit 호출 또는 wrapper로 메타 추가 (기존 시그니처 유지) |
| ci:audit route vs lib 감사 위치 (L-015) | T-021에서 직검. lib 내부 tx audit 시 `audit-check-ignore` override (주석에 `*` 금지) |

---

## References

- `spec.md` §2 (REQ-TRI-001..008), §3 (AC-TRI-01..07)
- `acceptance.md` (7 GWT + 11 edge + quality gates + DoD)
- `research.md` §2 (consult RAG 분석), §3 (TRIAGE 주입 시나리오 매트릭스), §10 (GAP-TRI-01..03)
- `.moai/specs/SPEC-V3-INBOX-001/spec.md:180-181` (REQ-V3-INBOX-030/031 원문), `:193` (AC-06 원문), `:256` (이월 명시)
- `.moai/specs/SPEC-V3-UI-001/tasks.md` (본 tasks.md 양식 준용)
- Charter: [지양-2] citation 강제, [지양-4] RA Lead 승인
- Lessons: L-007 (직검), L-008 (lint:hex), L-009 (full test), L-010 (실DB), L-012 (next dev build 금지), L-013 (3중 맹점), L-015 (CI Gates 다단계)
