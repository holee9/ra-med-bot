# Acceptance Criteria — SPEC-V3-CONSULT-001

**작성일**: 2026-07-05
**SPEC**: SPEC-V3-CONSULT-001 (RA Power Chat, v3 Phase C-5)
**총 AC**: 8종 (AC-CONS-01, 02, 02b, 03, 04, 05, 06, 07)
**총 Edge Cases**: 11종

---

## Given-When-Then Scenarios

### AC-CONS-01: Power Chat 세션 생성 성공

**Given** RA Member가 로그인되어 있고
**When** POST /api/consult/sessions를 `{title: "EU MDR 분석", projectId: "uuid-proj", locale: "ko"}`로 호출하면
**Then** 시스템은 201 Created와 함께 다음을 반환한다:
```json
{
  "sessionId": "uuid-v4",
  "title": "EU MDR 분석",
  "projectId": "uuid-proj",
  "locale": "ko",
  "createdAt": "2026-07-05T00:00:00Z"
}
```
**And** consult_sessions 테이블에 해당 row가 존재하고 deletedAt은 null이다.
**And** audit_logs 테이블에 `consult.session.create` row가 존재한다 (orgId/sessionId 매칭, REQ-CONS-013).

### AC-CONS-02: Power Chat 세션 목록 조회 성공

**Given** RA Member가 3개의 세션을 생성하고 (turnCount 각각 5, 2, 0)
**When** GET /api/consult/sessions를 호출하면
**Then** 시스템은 200 OK와 함께 다음을 반환한다:
```json
{
  "sessions": [
    {
      "sessionId": "uuid-1",
      "title": "세션 1",
      "projectId": "uuid-proj",
      "createdAt": "2026-07-05T01:00:00Z",
      "turnCount": 5
    },
    {
      "sessionId": "uuid-2",
      "title": "세션 2",
      "projectId": null,
      "createdAt": "2026-07-04T12:00:00Z",
      "turnCount": 2
    },
    {
      "sessionId": "uuid-3",
      "title": "세션 3",
      "projectId": "uuid-proj",
      "createdAt": "2026-07-03T10:00:00Z",
      "turnCount": 0
    }
  ]
}
```
**And** 세션 목록은 createdAt 내림차순 정렬된다 (최신 first).

### AC-CONS-02b: Power Chat 세션 상세 조회 성공 (turns 배열 포함, REQ-CONS-003 직접 검증)

**Given** RA Member가 세션을 생성하고 2개의 턴을 추가하고(question→answer exchange 2회)
**When** GET /api/consult/sessions/:sessionId를 호출하면
**Then** 시스템은 200 OK와 함께 다음을 반환한다:
```json
{
  "sessionId": "uuid-session",
  "title": "EU MDR 분석",
  "projectId": "uuid-proj",
  "locale": "ko",
  "createdAt": "2026-07-05T00:00:00Z",
  "turns": [
    {
      "turnId": "uuid-turn-1",
      "turnNumber": 1,
      "question": "EU MDR Article 10 요구사항은?",
      "answer": "<p>EU MDR Article 10은 ...</p>",
      "confidence": 0.85,
      "sources": [{ "id": "src-eu-mdr", "citeIndex": 1 }],
      "citations": [{ "citeIndex": 1, "sourceId": "src-eu-mdr" }],
      "createdAt": "2026-07-05T01:00:00Z"
    },
    {
      "turnId": "uuid-turn-2",
      "turnNumber": 2,
      "question": "Article 11은?",
      "answer": "<p>...</p>",
      "confidence": 0.78,
      "sources": [{ "id": "src-eu-mdr", "citeIndex": 1 }],
      "citations": [{ "citeIndex": 1, "sourceId": "src-eu-mdr" }],
      "createdAt": "2026-07-05T02:00:00Z"
    }
  ]
}
```
**And** turns 배열은 turnNumber 오름차순(1, 2)으로 정렬된다.
**And** 각 turn은 question과 answer를 함께 포함한다 (Exchange 모델, role 필드 없음).

### AC-CONS-03: Power Chat 턴 생성 성공 (citation 포함)

**Given** RA Member가 세션을 생성하고
**When** POST /api/consult/sessions/:sessionId/turns를 `{question: "EU MDR 2017/745 Article 10 요구사항은?"}`로 호출하고
**And** RAG 파이프라인이 citation을 포함한 답변을 성공적으로 생성하면
**Then** 시스템은 201 Created와 함께 다음을 반환한다:
```json
{
  "turnId": "uuid-turn",
  "sessionId": "uuid-session",
  "turnNumber": 1,
  "answer": "<p>EU MDR Article 10은 <sup class=\"cite\" data-source=\"1\">제조사는 품질경영시스템을 수립해야 한다</sup>를 요구한다...</p>",
  "confidence": 0.85,
  "sources": [
    {
      "id": "src-eu-mdr",
      "citeIndex": 1,
      "orgLabel": "EU MDR",
      "title": "Regulation (EU) 2017/745",
      "year": 2017,
      "type": "Regulation",
      "anchor": "Article 10"
    }
  ],
  "createdAt": "2026-07-05T02:00:00Z"
}
```
**And** consult_turns 테이블에 해당 row가 존재한다 (Exchange 모델: question + answer가 같은 row에 저장, role 컬럼 없음).
**And** audit_logs 테이블에 `consult.turn.create` row가 존재한다.

### AC-CONS-04: Power Chat 턴 생성 실패 (citation 0개 또는 coverage 80% 미만)

**Given** RA Member가 세션을 생성하고
**When** POST /api/consult/sessions/:sessionId/turns를 호출하고
**And** RAG 파이프라인이 (a) citation을 0개 포함한 답변을 생성하거나 (b) citation coverage가 80% 미만(uncitedViolationCount/totalSentences > 0.2)인 답변을 생성하면
**Then** 시스템은 400 Bad Request와 함께 다음을 반환한다:
```json
{
  "error": "citation_required",
  "message": "Answer must include citations with coverage >= 80%"
}
```
**And** consult_turns 테이블에 새 row가 추가되지 않는다.
**And** 세션은 turnCount=0 상태로 유지된다 (후속 재시도 가능).
**And** citation 검증은 `lib/ai/citation-enforce.ts`의 `enforceCitations`를 재사용하여 80% 임계값을 적용한다 (TRIAGE run-triage.ts:91-94 패턴).

### AC-CONS-05: Power Chat 턴 생성 실패 (타임아웃)

**Given** RA Member가 세션을 생성하고
**When** POST /api/consult/sessions/:sessionId/turns를 호출하고
**And** RAG 파이프라인이 15s 타임아웃으로 실패하면
**Then** 시스템은 400 Bad Request와 함께 다음을 반환한다:
```json
{
  "error": "RAG timeout",
  "message": "RAG pipeline timed out after 15s"
}
```
**And** audit_logs 테이블에 `consult.turn.failed` row가 존재하고 meta_json에는 error: 'timeout'을 포함한다.

### AC-CONS-06: Power Chat 세션 삭제 성공 (RA Lead)

**Given** RA Lead가 세션을 생성하고
**When** DELETE /api/consult/sessions/:sessionId를 호출하면
**Then** 시스템은 200 OK와 함께 다음을 반환한다:
```json
{
  "sessionId": "uuid-session",
  "deletedAt": "2026-07-05T03:00:00Z"
}
```
**And** consult_sessions 테이블의 해당 row에서 deletedAt이 현재 timestamp로 설정되고 실제 row는 삭제되지 않는다 (soft-delete).
**And** audit_logs 테이블에 `consult.session.delete` row가 존재한다.

### AC-CONS-07: RBAC 권한 검증

**Given** RA Member가 다른 RA Member의 세션을 생성하고
**When** DELETE /api/consult/sessions/:sessionId를 호출하면
**Then** 시스템은 403 Forbidden를 반환한다.
**And** audit_logs 테이블에 `consult.session.delete` row가 존재하지 않는다.

---

## Edge Cases

### Edge-01: 빈 세션 목록 조회

**Given** RA Member가 세션을 하나도 생성하지 않고
**When** GET /api/consult/sessions를 호출하면
**Then** 시스템은 200 OK와 함께 빈 배열을 반환한다:
```json
{
  "sessions": []
}
```

### Edge-02: 존재하지 않는 세션 조회

**Given** RA Member가 세션을 생성하지 않고
**When** GET /api/consult/sessions/non-existent-session-id를 호출하면
**Then** 시스템은 404 Not Found를 반환한다.

### Edge-03: 존재하지 않는 세션에 턴 생성 시도

**Given** RA Member가 세션을 생성하지 않고
**When** POST /api/consult/sessions/non-existent-session-id/turns를 호출하면
**Then** 시스템은 404 Not Found를 반환한다.

### Edge-04: 삭제된 세션에 턴 생성 시도

**Given** RA Member가 세션을 생성하고
**When** RA Lead가 DELETE /api/consult/sessions/:sessionId를 호출하여 삭제하고
**And** RA Member가 POST /api/consult/sessions/:sessionId/turns를 호출하면
**Then** 시스템은 404 Not Found를 반환한다 (soft-delete된 세션은 조회되지 않음).

### Edge-05: title 없는 세션 생성

**Given** RA Member가 로그인되어 있고
**When** POST /api/consult/sessions를 `{projectId: "uuid-proj"}` (title 누락)로 호출하면
**Then** 시스템은 400 Bad Request를 반환한다:
```json
{
  "error": "Validation failed",
  "issues": [
    {
      "code": "invalid_type",
      "path": ["title"],
      "message": "Required"
    }
  ]
}
```

### Edge-06: 제목이 너무 긴 세션 생성 (>500자)

**Given** RA Member가 로그인되어 있고
**When** POST /api/consult/sessions를 `{title: "A"*500}` (500자 초과)로 호출하면
**Then** 시스템은 400 Bad Request를 반환하고 Zod validation error를 표시한다.

### Edge-07: 잘못된 sessionId UUID 형식

**Given** RA Member가 로그인되어 있고
**When** GET /api/consult/sessions/invalid-uuid-format를 호출하면
**Then** 시스템은 400 Bad Request를 반환하고 Zod validation error를 표시한다.

### Edge-08: RBAC 없는 유저의 세션 조회 시도

**Given** Employee (viewer role)가 로그인되어 있고
**When** GET /api/consult/sessions를 호출하면
**Then** 시스템은 403 Forbidden를 반환한다 (Power Chat은 ra-member+ 전용).

### Edge-09: Admin의 세션 삭제 시도

**Given** Admin이 로그인되어 있고
**When** DELETE /api/consult/sessions/:sessionId를 호출하면
**Then** 시스템은 200 OK를 반환하고 deletedAt을 설정한다 (admin도 삭제 권한 보유).

### Edge-10: RAG 파이프라인 런타임 에러 (LLM failure)

**Given** RA Member가 세션을 생성하고
**When** POST /api/consult/sessions/:sessionId/turns를 호출하고
**And** RAG 파이프라인이 LLM API 실패로 에러를 던지면
**Then** 시스템은 400 Bad Request와 함께 다음을 반환한다:
```json
{
  "error": "RAG runtime error",
  "message": "LLM generation failed"
}
```
**And** audit_logs 테이블에 `consult.turn.failed` row가 존재하고 meta_json에는 error: 'runtime_error'을 포함한다.

### Edge-11: 연속 턴 생성 (턴 번호 누적)

**Given** RA Member가 세션을 생성하고
**When** POST /api/consult/sessions/:sessionId/turns를 3회 연속 호출하면
**Then** 시스템은 각 호출에 대해 turnNumber=1, 2, 3을 할당하고 정상적으로 저장한다.
**And** GET /api/consult/sessions/:sessionId를 호출하면 turns 배열에 3개의 턴이 turnNumber 오름차순으로 정렬되어 반환된다.

---

## Quality Gates

### Functional Correctness

- [ ] 모든 AC (AC-CONS-01 ~ AC-CONS-07, AC-CONS-02b)가 Given-When-Then 형식으로 검증됨
- [ ] RAG 파이프라인이 consult.ts 하위 모듈을 재사용하여 회귀 리스크 완화됨
- [ ] Citation 강제가 Charter [지양-2]를 준수하여 enforceCitations로 검증됨
- [ ] RBAC이 v3 01_architecture.md:95를 준수하여 ra-member/ra-lead/admin 분리됨

### Data Integrity

- [ ] consult_sessions/turns 테이블 FK 제약조건 준수 (REQ-CONS-012)
- [ ] Soft-delete가 정확히 동작 (deletedAt 설정, 실제 row 유지)
- [ ] Turn 번호 누적이 정확함 (MAX(turnNumber) + 1 할당)
- [ ] Audit log가 21 CFR Part 11 §11.10(e)를 준수하여 기록됨

### Performance

- [ ] 세션 목록 조회가 turnCount 서브쿼리로 최적화됨 (N+1 query 방지)
- [ ] RAG 파이프라인 15s 타임아웃이 정확히 동작함 (TRIAGE 패턴 재사용)
- [ ] GET /api/consult/sessions/:sessionId가 turns JOIN을 효율적으로 수행함

### Security

- [ ] RBAC 권한 검증이 모든 엔드포인트에 적용됨
- [ ] RA Member가 자신의 세션만 삭제/조회할 수 있음
- [ ] RA Lead/Admin가 모든 세션에 접근할 수 있음
- [ ] Employee/Viewer가 Power Chat에 접근할 수 없음 (403)

### Observability

- [ ] 모든 CRUD 작업이 audit_logs에 기록됨 (REQ-CONS-008, REQ-CONS-009, REQ-CONS-010, REQ-CONS-013)
- [ ] RAG 실패가 consult.turn.failed audit로 기록됨
- [ ] Audit meta_json에 sessionId, turnId, confidenceScore, sourceCount 포함됨

---

## Definition of Done

### Code Complete

- [ ] 모든 REQ-CONS-001 ~ REQ-CONS-013가 구현됨 (REQ-CONS-013: consult.session.create audit log)
- [ ] 모든 AC-CONS-01 ~ AC-CONS-07, AC-CONS-02b가 Given-When-Then로 검증됨
- [ ] consult_sessions/turns 테이블이 migration으로 생성됨
- [ ] run-consult.ts 래퍼가 consult.ts 하위 모듈을 재사용함
- [ ] RBAC 권한 3종이 permissions.ts에 추가됨

### Test Complete

- [ ] Unit test: run-consult.ts RAG 파이프라인 (citation 검증, 타임아웃)
- [ ] Unit test: consult_sessions/turns CRUD (FK 제약조건)
- [ ] Integration test: 4종 API endpoint (/sessions, /sessions/:id, /sessions/:id/turns, DELETE)
- [ ] E2E test: RA Member가 세션 생성 → 턴 생성 → 세션 삭제 흐름
- [ ] Regression test: 기존 /api/ra/consult가 깨지지 않음 (v2 호환성)

### Documentation Complete

- [ ] API 문서화: 4종 endpoint에 대한 Swagger/OpenAPI spec
- [ ] DB 스키마 문서화: consult_sessions/turns 테이블 컬럼 설명
- [ ] Migration guide: v2 conversations → v3 consult_sessions 마이그레이션 (선택)
- [ ] RBAC matrix 업데이트: consult.session.create/view/delete 권한

### Quality Gates Passed

- [ ] Type check: `pnpm tsc --noEmit` — 0 errors
- [ ] Lint: `pnpm lint` (biome) — 0 errors, 0 warnings
- [ ] Unit test: `pnpm test` — 85%+ coverage (new code만)
- [ ] Integration test: `pnpm test:integration` — 모든 테스트 패스
- [ ] E2E test: `pnpm test:e2e` — Power Chat 흐름 패스

---

**본 acceptance.md는 SPEC-V3-CONSULT-001 plan phase 산출물의 일부입니다.**
