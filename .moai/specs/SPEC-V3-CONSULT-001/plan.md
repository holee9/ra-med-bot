# Implementation Plan — SPEC-V3-CONSULT-001

**작성일**: 2026-07-05
**SPEC**: SPEC-V3-CONSULT-001 (RA Power Chat, v3 Phase C-5)
**의존**: SPEC-V3-TRIAGE-001 (완료)
**예상 작업 기간**: Priority High (M1..M6, 20-25 tasks)

---

## Technical Approach

### RAG 파이프라인 재사용 전략

TRIAGE SPEC-V3-TRIAGE-001에서 검증된 패턴을 그대로 재사용하여 회귀 리스크를 최소화합니다:

1. **run-consult.ts 래퍼 생성** (run-triage.ts 패턴)
   - consult.ts 하위 모듈 재사용: classifyIntent, parallelRetrieveAndMerge, composePrompt, streamText, enforceCitations, calculateConfidence
   - 15s timeout: AbortController + Promise.race
   - Citation 검증: empty citations → error

2. **SSE → JSON 변환**
   - consult.ts async generator를 소비하여 JSON 직렬화
   - StreamEvent 집계: prose_delta → full prose, sources 배열, confidence

3. **DB 스키마 설계**
   - consult_sessions: 5년 soft-delete (deletedAt)
   - consult_turns: turnNumber 누적, FK sessionId → consult_sessions.id

### Migration Strategy

**Phase M1: 테이블 생성 (Exchange 모델)**
```sql
-- Migration 01_create_consult_tables.sql
CREATE TABLE consult_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ra_member_id UUID NOT NULL REFERENCES users(id),
  project_id UUID REFERENCES projects(id),
  title TEXT NOT NULL,
  locale TEXT NOT NULL DEFAULT 'ko',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

-- Exchange 모델: 한 turn = 한 Q+A pair (role 컬럼 없음)
CREATE TABLE consult_turns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES consult_sessions(id),
  turn_number INTEGER NOT NULL,              -- 1, 2, 3, ... 단조 증가
  question TEXT NOT NULL,                    -- 사용자 입력 (항상 존재)
  answer TEXT,                                -- RAG 결과 HTML prose, 실패 시 NULL
  citations JSONB,                            -- citation 메타데이터 배열
  confidence REAL,                            -- 0.00 ~ 1.00, 실패 시 NULL
  sources JSONB,                              -- RAG source 메타데이터
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_consult_sessions_deleted ON consult_sessions(deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX idx_consult_turns_session ON consult_turns(session_id, turn_number);
```

**Phase M2: 권한 추가**
```typescript
// lib/auth/permissions.ts
export type PermissionAction =
  // ... existing
  | 'consult.session.create'
  | 'consult.session.view'
  | 'consult.session.delete'
  | 'consult.turn.create';
```

### RBAC Matrix

| 권한 | ra-member | ra-lead | admin | employee/viewer |
|------|-----------|---------|-------|------------------|
| consult.session.create | ✅ | ✅ | ✅ | ❌ |
| consult.session.view | 자신 세션만 | 전체 | 전체 | ❌ |
| consult.session.delete | 자신 세션만 | 전체 | 전체 | ❌ |
| consult.turn.create | ✅ (자신 세션) | ✅ (전체) | ✅ (전체) | ❌ |

---

## Implementation Milestones

### M1: Database Schema & Foundation (Priority High)

**목표**: consult_sessions/turns 테이블 생성 + 기존 호환성 확인

**Tasks**:
- T-01: Drizzle migration 작성 (01_create_consult_tables.sql, Exchange 모델: consult_turns.role 컬럼 없음, question NOT NULL + answer nullable + citations jsonb + confidence real + turnNumber integer NOT NULL)
- T-02: consult_sessions/turns 스키마 정의 (lib/db/schema.ts, Exchange 모델 반영: role 필드 제거, question/answer/citations 컬럼 구성)
- T-03: Migration 실행 및 FK 제약조건 검증
- T-04: 기존 conversations/messages 테이블과의 격리 확인 (v2 호환성)

**완료 기준**:
- Migration이 성공적으로 적용되고 rollback 가능
- consult_sessions/turns 테이블이 정상적으로 생성됨
- 기존 /api/ra/consult가 여전히 동작함 (regression test)

### M2: RAG Pipeline Wrapper (Priority High)

**목표**: run-consult.ts 래퍼 구현 (TRIAGE 패턴 재사용)

**Tasks**:
- T-05: run-consult.ts 래퍼 생성 (lib/domains/consult/run-consult.ts)
- T-06: consult.ts 하위 모듈 import (classifyIntent, parallelRetrieveAndMerge, etc.)
- T-07: 15s timeout 구현 (AbortController + Promise.race)
- T-08: Citation 검증 구현 (empty citations → error)
- T-09: RAG result → consult_turns DTO 매핑

**완료 기준**:
- run-consult.ts가 consult.ts 하위 모듈을 성공적으로 재사용함
- Unit test: timeout, citation 검증, 런타임 에러 핸들링
- run-triage.ts와 동일한 패턴으로 회귀 리스크 완화

### M3: Session CRUD API (Priority High)

**목표**: POST/GET /api/consult/sessions + GET /api/consult/sessions/:id 구현

**Tasks**:
- T-10: POST /api/consult/sessions 라우트 생성 (app/api/consult/sessions/route.ts)
- T-11: consult_sessions CREATE handler (withPermission 'consult.session.create', 성공 시 `consult.session.create` audit log 기록 — 21 CFR Part 11 §11.10(e), REQ-CONS-013. meta_json: `{sessionId, raMemberId, projectId?, locale}`)
- T-12: GET /api/consult/sessions 라우트 생성 (withPermission 'consult.session.view')
- T-13: consult_sessions SELECT handler (ra-member: 자신 세션만, ra-lead/admin: 전체)
- T-14: GET /api/consult/sessions/:sessionId 라우트 생성 (RBAC 검증)
- T-15: consult_sessions + turns JOIN handler (turnCount 서브쿼리)

**완료 기준**:
- Integration test: 3종 API endpoint 정상 동작
- RBAC 검증: ra-member/ra-lead/admin 권한 분리 정확
- Zod validation: title 필수, UUID 형식 검증

### M4: Turn Creation API (Priority High)

**목표**: POST /api/consult/sessions/:sessionId/turns 구현

**Tasks**:
- T-16: POST /api/consult/sessions/:sessionId/turns 라우트 생성
- T-17: run-consult.ts 호출 및 JSON 직렬화
- T-18: consult_turns INSERT handler (turnNumber 할당, FK 검증)
- T-19: Citation 강제 검증 (citation 0개 또는 coverage 80% 미만 → 400, `lib/ai/citation-enforce.ts`의 `enforceCitations` 재사용, TRIAGE run-triage.ts:91-94 패턴)
- T-20: Audit log 기록 (consult.turn.create, consult.turn.failed)

**완료 기준**:
- Integration test: 턴 생성 성공 (AC-CONS-03)
- Integration test: citation 없는 답변 거부 (AC-CONS-04)
- Integration test: 타임아웃 핸들링 (AC-CONS-05)

### M5: Session Deletion API (Priority Medium)

**목표**: DELETE /api/consult/sessions/:sessionId 구현 (soft-delete)

**Tasks**:
- T-21: DELETE /api/consult/sessions/:sessionId 라우트 생성
- T-22: Soft-delete handler (deletedAt = NOW(), NOT DELETE)
- T-23: RBAC 검증 (ra-member: 자신 세션만, ra-lead/admin: 전체)
- T-24: Audit log 기록 (consult.session.delete)

**완료 기준**:
- Integration test: soft-delete 동작 (AC-CONS-06)
- Integration test: RBAC 권한 분리 (AC-CONS-07)
- Deleted 세션이 조회되지 않음 (404)

### M6: Retention Policy & QA (Priority Low)

**목표**: 5년 보관 정책 문서화 + E2E test

**Tasks**:
- T-25: 5년 보관 정책 문서화 (run phase에서 cron job 구현 여부 결정)
- T-26: E2E test: RA Member가 세션 생성 → 턴 생성 → 세션 삭제 흐름
- T-27: Regression test: 기존 /api/ra/consult 여전히 동작
- T-28: API 문서화 (Swagger/OpenAPI spec 업데이트)

**완료 기준**:
- E2E test 패스
- Regression test 패스
- API 문서 완료

---

## Risk Management

### HIGH Risks

**R-01: 기존 /api/ra/consult 깨짐**
- 완화: v3 API 경로 분리 (/api/consult/sessions), 기존 1-shot streaming 유지
- 계획: T-27 regression test로 확인

**R-02: consult_sessions/turns FK 제약조건 위배**
- 완화: Migration T-03에서 FK 검증, run-consult.ts에서 transaction 롤백
- 계획: T-03 FK 검증, T-18 transaction 핸들링

**R-03: RBAC 권한 누수**
- 완화: withPermission 미들웨어 사용, 테스트 커버리지 100%
- 계획: T-13, T-14, T-23 RBAC 검증 테스트

### MEDIUM Risks

**R-04: RAG 파이프라인 회귀**
- 완화: TRIAGE 패턴 재사용, consult.ts 하위 모듈만 호출
- 계획: T-06 하위 모듈 import 검증, T-09 unit test

**R-05: Turn 번호 누적 오류**
- 완화: MAX(turnNumber) + 1 할당, transaction 격리
- 계획: T-18 turnNumber 할당 로직 검증

**R-06: Soft-delete 된 세션 참조**
- 완화: deleted_at IS NULL 필터 추가
- 계획: T-13, T-14 SELECT에 WHERE deleted_at IS NULL 추가

### LOW Risks

**R-07: 5년 보관 cron job 미구현**
- 완화: 본 SPEC은 API contract만 명시, run phase에서 구현 여부 결정
- 계획: T-25 문서화로 대체

**R-08: 성능 저하 (turns JOIN)**
- 완화: 인덱스 생성 (idx_consult_turns_session)
- 계획: T-15 서브쿼리 최적화

---

## Task Breakdown (20-28 tasks)

| Task ID | Description | Priority | Dependencies | Estimate |
|---------|-------------|----------|--------------|----------|
| M1-T01 | Drizzle migration 작성 (Exchange 모델: role 컬럼 없음, question/answer/citations 컬럼 구성) | High | None | M1 |
| M1-T02 | consult_sessions/turns 스키마 정의 (lib/db/schema.ts, Exchange 모델 반영) | High | T01 | M1 |
| M1-T03 | Migration 실행 및 FK 검증 | High | T02 | M1 |
| M1-T04 | 기존 conversations/messages 격리 확인 | High | T03 | M1 |
| M2-T05 | run-consult.ts 래퍼 생성 | High | None | M2 |
| M2-T06 | consult.ts 하위 모듈 import | High | T05 | M2 |
| M2-T07 | 15s timeout 구현 | High | T06 | M2 |
| M2-T08 | Citation 검증 구현 (enforceCitations 80% coverage 임계값 포함) | High | T07 | M2 |
| M2-T09 | RAG result → DTO 매핑 | High | T08 | M2 |
| M3-T10 | POST /api/consult/sessions 라우트 생성 | High | M1 | M3 |
| M3-T11 | consult_sessions CREATE handler + consult.session.create audit log 기록 (REQ-CONS-013) | High | T10 | M3 |
| M3-T12 | GET /api/consult/sessions 라우트 생성 | High | T11 | M3 |
| M3-T13 | consult_sessions SELECT handler | High | T12 | M3 |
| M3-T14 | GET /api/consult/sessions/:sessionId 라우트 생성 | High | T13 | M3 |
| M3-T15 | consult_sessions + turns JOIN handler | High | T14 | M3 |
| M4-T16 | POST /api/consult/sessions/:sessionId/turns 라우트 생성 | High | M2, M3 | M4 |
| M4-T17 | run-consult.ts 호출 및 JSON 직렬화 | High | T16 | M4 |
| M4-T18 | consult_turns INSERT handler (Exchange 모델: question+answer 같은 row) | High | T17 | M4 |
| M4-T19 | Citation 강제 검증 (citation 0개 또는 coverage 80% 미만, enforceCitations 재사용) | High | T18 | M4 |
| M4-T20 | Audit log 기록 (turn) | High | T19 | M4 |
| M5-T21 | DELETE /api/consult/sessions/:sessionId 라우트 생성 | Medium | M3, M4 | M5 |
| M5-T22 | Soft-delete handler | Medium | T21 | M5 |
| M5-T23 | RBAC 검증 (삭제) | Medium | T22 | M5 |
| M5-T24 | Audit log 기록 (session.delete) | Medium | T23 | M5 |
| M6-T25 | 5년 보관 정책 문서화 | Low | M5 | M6 |
| M6-T26 | E2E test: 전체 흐름 | Low | T25 | M6 |
| M6-T27 | Regression test: 기존 /api/ra/consult | Low | T26 | M6 |
| M6-T28 | API 문서화 | Low | T27 | M6 |

**총 Task**: 28 tasks (예상)

---

## Testing Strategy

### Unit Tests (Target: 85%+ coverage)

- `lib/domains/consult/run-consult.test.ts`:
  - Timeout test: 15s 초과 시 error: 'timeout' 반환
  - Citation test: empty citations → error: 'no_citations'
  - Citation coverage test: uncitedViolationCount/totalSentences > 0.2 → error: 'citation_coverage_below_80' (enforceCitations 80% 임계값)
  - Runtime error test: LLM failure → error: 'runtime_error'
  - Normal flow test: RAG 성공 → {answer, confidence, sources, citations} 반환

- `lib/db/schema.test.ts`:
  - FK 제약조건 test: consult_turns.session_id → consult_sessions.id
  - Soft-delete test: deleted_at IS NULL 필터

### Integration Tests (Target: 모든 AC 커버)

- `app/api/consult/sessions/route.test.ts`:
  - POST /api/consult/sessions: 201 Created (AC-CONS-01, REQ-CONS-013 audit 단언 포함)
  - GET /api/consult/sessions: 200 OK + 세션 목록 (AC-CONS-02)
  - GET /api/consult/sessions/:sessionId: 200 OK + turns 배열 (AC-CONS-02b 직접 검증, REQ-CONS-003 positive AC)
  - RBAC test: 403 Forbidden (Edge-08, Edge-09)

- `app/api/consult/sessions/[id]/turns/route.test.ts`:
  - POST /api/consult/sessions/:sessionId/turns: 201 Created (AC-CONS-03)
  - Citation 없는 답변: 400 Bad Request (AC-CONS-04)
  - Timeout: 400 Bad Request (AC-CONS-05)

- `app/api/consult/sessions/[id]/route.test.ts`:
  - DELETE /api/consult/sessions/:sessionId: 200 OK (AC-CONS-06)
  - RBAC test: 403 Forbidden (AC-CONS-07, Edge-04, Edge-09)

### E2E Tests (Target: 핵심 흐름)

- `tests/e2e/consult-flow.spec.ts`:
  - RA Member 로그인 → 세션 생성 → 턴 생성 → 세션 삭제
  - RA Lead 로그인 → 팀원 세션 삭제
  - Employee 로그인 → 403 Forbidden (Edge-08)

### Regression Tests (Target: v2 호환성)

- `tests/e2e/legacy-consult.spec.ts`:
  - POST /api/ra/consult (1-shot streaming) 여전히 동작
  - consult.ts async generator SSE stream 깨지지 않음

---

## Code Authority Verification Checklist

### L-013 직검 요구사항 준수

본 plan.md의 모든 코드 인용은 main HEAD 기준 직검입니다:
- `lib/ai/consult.ts`: 831줄 (@MX:ANCHOR 확인 완료)
- `app/api/ra/consult/route.ts`: 262줄 (withPermission 'consult.create' 확인 완료)
- `lib/domains/triage/run-triage.ts`: 100줄 (@MX:ANCHOR 확인 완료)
- `lib/db/schema.ts`: 100줄 (pgEnum, pgTable 패턴 확인 완료)
- `lib/auth/permissions.ts`: 79줄 (consult.create 권한 확인 완료)

### Runtime grep 검증 (run phase 시행)

- **consult.ts fan_in >= 3**: `grep -r "from.*consult" app/ lib/ | wc -l` (예상 >= 3)
- **run-triage.ts 재사용 패턴**: `grep -r "from.*run-triage" app/ lib/ | wc -l` (예상 0, 본 SPEC에서 생성)
- **기존 /api/ra/consult 호출처**: `grep -r "api/ra/consult" app/` (예상 1: route.ts만)
- **permissions.ts consult 권한**: `grep -A 5 "consult.create" lib/auth/permissions.ts` (확인 완료)

### manager-strategy 보고 수치 검증

Run phase에서 다음 수치를 runtime grep으로 검증합니다:
- consult_sessions/turns 테이블 생성 확인: `drizzle-kit push`
- run-consult.ts 생성 확인: `ls -la lib/domains/consult/run-consult.ts`
- API 라우트 생성 확인: `ls -la app/api/consult/sessions/`

---

## Definition of Done

### M1 완료 기준
- [ ] Migration이 성공적으로 적용되고 rollback 가능
- [ ] consult_sessions/turns 테이블이 정상적으로 생성됨
- [ ] 기존 /api/ra/consult가 여전히 동작함 (regression test)

### M2 완료 기준
- [ ] run-consult.ts가 consult.ts 하위 모듈을 성공적으로 재사용함
- [ ] Unit test: timeout, citation 검증, 런타임 에러 핸들링
- [ ] run-triage.ts와 동일한 패턴으로 회귀 리스크 완화

### M3 완료 기준
- [ ] Integration test: 3종 API endpoint 정상 동작
- [ ] RBAC 검증: ra-member/ra-lead/admin 권한 분리 정확
- [ ] Zod validation: title 필수, UUID 형식 검증

### M4 완료 기준
- [ ] Integration test: 턴 생성 성공 (AC-CONS-03)
- [ ] Integration test: citation 없는 답변 거부 (AC-CONS-04)
- [ ] Integration test: 타임아웃 핸들링 (AC-CONS-05)

### M5 완료 기준
- [ ] Integration test: soft-delete 동작 (AC-CONS-06)
- [ ] Integration test: RBAC 권한 분리 (AC-CONS-07)
- [ ] Deleted 세션이 조회되지 않음 (404)

### M6 완료 기준
- [ ] E2E test 패스
- [ ] Regression test 패스
- [ ] API 문서 완료

---

**본 plan.md는 SPEC-V3-CONSULT-001 plan phase 산출물의 일부입니다.**
