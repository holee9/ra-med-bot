---
id: SPEC-V3-CONSULT-001
version: 1.1.0
status: completed
phase: C-5
priority: High
created: 2026-07-05
updated: 2026-07-05
author: manager-spec
issue_number: 341
depends_on:
  - SPEC-V3-TRIAGE-001
blocks:
  - SPEC-V3-UI-001
parent_spec: null
lifecycle_level: spec-anchored
labels:
  - component/backend
  - component/ai
  - component/api
  - domain/consult
  - type/v3-new
---

# SPEC-V3-CONSULT-001 — RA Power Chat (v3 Phase C-5)

## HISTORY

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0.0 | 2026-07-05 | manager-spec | 초기 작성. TRIAGE 완료 후 Power Chat 세션 저장 기능 구현. 신규 consult_sessions/turns 테이블, RA 전용 권한, 5년 보관 정책. REQ 12종, AC 7종. 코드 직검 기반 (L-013). |
| 1.1.0 | 2026-07-05 | manager-spec | plan-auditor 감사 결과 Critical 1 + High 3건 개정. (C-1) REQ-CONS-013 신설로 `consult.session.create` audit log 자기모순 해소, AC-CONS-01에 audit 단언 추가. (H-1) REQ-CONS-004 Exchange 모델 확정(role 필드 제거, question+answer 동일 row), AC-CONS-03 role 단언 수정. (H-2) AC-CONS-02b 신설로 REQ-CONS-003 positive AC 보강. (H-3) REQ-CONS-005 + AC-CONS-04 citation coverage 80% 임계값 강화(enforceCitations 재사용 명시). REQ 13종, AC 8종. |

---

## §1 Purpose (목적)

### 1.1 배경 (Background)

현재 `/api/ra/consult`는 1-shot streaming RAG만 제공하며 세션 저장이 없다 (`app/api/ra/consult/route.ts:217` 직검). 사용자는 매 질문마다 새로운 conversation을 생성하며 이전 답변을 참조할 방법이 없다. v3 Phase C-5에서는 **RA Member를 위한 Power Chat 세션 저장 기능**을 구현하여 다음을 가능하게 한다:

- 규제 딥리서치 세션을 영구 저장 (5년 보관)
- 관할권 다중 비교 질문 지원 (턴별 누적 context)
- 세션 명시적 삭제 (RA Lead 권한)
- LLM citation 강제 (Charter [지양-2])

TRIAGE SPEC-V3-TRIAGE-001 (C-2)가 완료되어 consult.ts 하위 모듈 재사용 패턴이 검증되었다. 본 SPEC은 TRIAGE와 동일한 패턴으로 **신규 consult_sessions/turns 테이블 + CRUD API**를 구현한다.

### 1.2 페르소나 (Personas)

| 페르소나 | 역할 | Power Chat 관점 |
|---|---|---|
| RA Member | `ra-member` | Power Chat 세션 생성/조회, 턴 추가, 자신의 세션만 관리 (RBAC) |
| RA Lead | `ra-lead` | 팀원 세션 조회, 세션 삭제 (명시적 삭제), 권한 검증 |
| Admin | `admin` | 감사 로그 조회, 전체 세션 모니터링 |
| Employee / Viewer | `employee`, `viewer` | Power Chat 접근 불가 (TRIAGE auto_answer 사용) |

### 1.3 규제·정책 근거 (Policy Anchor)

- **Charter [지양-2] citation 강제**: Power Chat 답변은 반드시 citation(source/provenance)을 포함한다. citation 없는 답변 저장 시 400 Bad Request (AC-07).
- **Charter [지양-4] RA Lead 승인**: AI는 초안만 제공한다. 자동 판정으로 승인/거절/에스컬레이션을 결정하지 않는다.
- **Charter [지양-1] 전사 도우미**: Employee는 TRIAGE auto_answer 사용. Power Chat은 RA Member 전용 (Charter [지양-3] RA 중심).
- **v3 01_architecture.md:95**: `/api/consult` 권한 `ra-member`/`ra-lead`/`admin`.
- **v3 02_data_model.md:238**: `consult_sessions` + `consult_turns` (Power Chat 저장), 5년 보관 (RA 개인 리서치 · 명시적 삭제 허용).
- **v3 03_api_contract.md:148-149**: `GET/POST /api/consult/sessions`, `GET /api/consult/sessions/:id`, `POST /api/consult/sessions/:id/turns`.
- **21 CFR Part 11 §11.10(e)**: Power Chat CRUD 시 `consult.session.create`, `consult.turn.create`, `consult.session.delete` audit log 기록.
- **21 CFR Part 11 §11.70**: Power Chat 답변은 ESIG 서명 대상이 아님 (draft). RA Lead 최종 승인은 별도 워크플로우 (run phase 미구현, SPEC 확장 가능).

### 1.4 본 SPEC의 범위 (In Scope)

- **신규 테이블 2종**: `consult_sessions` (세션), `consult_turns` (턴) — 5년 보관, soft-delete
- **Power Chat CRUD API**: 4종 (GET/POST /api/consult/sessions, GET /api/consult/sessions/:id, POST /api/consult/sessions/:id/turns)
- **RAG 파이프라인 재사용**: consult.ts 하위 모듈 → run-consult.ts 래퍼 (TRIAGE 패턴)
- **RBAC**: 신규 권한 3종 (consult.session.create, consult.session.view, consult.turn.create) — ra-member+
- **보관 정책**: 5년 retention (deletedAt 기반, cron job 또는 수동 정책)
- **Citation 강제**: enforceCitations 재사용 (Charter [지양-2])
- **명시적 삭제**: RA Lead 권한, deletedAt timestamp (명시적 삭제 허용)

### 1.5 Out of Scope

- **TRIAGE 자동 답변 주입**: SPEC-V3-TRIAGE-001 (C-2) 완료. 본 SPEC은 Power Chat 세션만.
- **Kanban UI 표시**: SPEC-V3-UI-001 (Phase D).
- **승인 워크플로우**: run phase 미구현. Power Chat은 draft 답변만 제공.
- **프로젝트 메모리 연동**: SPEC-V3-PROJECT-MEMORY-001 (이후 SPEC).
- **관할권 다중 비교 UI**: Power Chat backend만 제공. 프론트엔드 정렬은 SPEC-V3-UI-001.
- **Knowledge gap replay**: SPEC-V3-KNOWLEDGE-GAP-001 (이후 SPEC).
- **Inngest 비동기 잡**: run phase 미구현. 동기 API 기준.

---

## §2 Requirements (EARS Format)

### 세션 생성 / 조회

| ID | EARS Statement | Priority |
|----|----------------|----------|
| REQ-CONS-001 | **WHEN** RA Member가 POST /api/consult/sessions를 호출하여 `{title, projectId?, locale?}`를 전달하면 **THEN** the system **SHALL** consult_sessions 테이블에 새로운 세션을 생성하고 `{sessionId, title, projectId, locale, createdAt}`를 반환한다. sessionId는 UUID v4, title은 사용자 입력 또는 LLM 생성 기본값, locale는 'ko' 기본값 | High |
| REQ-CONS-002 | **WHEN** RA Member가 GET /api/consult/sessions를 호출하면 **THEN** the system **SHALL** 해당 RA Member가 생성한 모든 세션 목록을 `{sessionId, title, projectId, createdAt, turnCount}` 형태로 최신순 정렬하여 반환한다. (ra-member는 자신의 세션만 조회, ra-lead/admin는 전체 조회) | High |
| REQ-CONS-003 | **WHEN** RA Member가 GET /api/consult/sessions/:sessionId를 호출하면 **THEN** the system **SHALL** 해당 세션이 존재하고 RBAC 권한이 있으면 `{sessionId, title, projectId, locale, createdAt, turns: [{turnId, turnNumber, question, answer, confidence, sources, citations, createdAt}]}` 형태로 반환한다. turns는 turnNumber 오름차순 정렬 | High |

### 턴 생성 / 추가

| ID | EARS Statement | Priority |
|----|----------------|----------|
| REQ-CONS-004 | **WHEN** RA Member가 POST /api/consult/sessions/:sessionId/turns를 호출하여 `{question, locale?}`를 전달하면 **THEN** the system **SHALL** run-consult.ts RAG 파이프라인을 호출하여 답변을 생성하고 consult_turns 테이블에 새로운 턴을 삽입한다. RAG 파이프라인은 consult.ts 하위 모듈 재사용 (classifyIntent, parallelRetrieveAndMerge, composePrompt, streamText, enforceCitations, calculateConfidence). 턴 번호는 해당 세션의 마지막 turnNumber + 1. **데이터 모델(Exchange)**: 한 turn은 하나의 exchange(question→answer pair)로 저장된다. `role` 필드는 존재하지 않는다. 컬럼 구성: `question` (text NOT NULL, 사용자 입력), `answer` (text, RAG 결과 HTML prose, RAG 실패 시 null), `citations` (jsonb, citation 메타데이터 배열), `confidence` (real, 0.00~1.00), `turnNumber` (integer NOT NULL, 1부터 단조 증가) | High |
| REQ-CONS-005 | **IF** 생성된 답변이 citation을 0개 포함하거나 citation coverage가 80% 미만(uncitedViolationCount/totalSentences > 0.2)이면, 또는 RAG 파이프라인이 타임아웃/런타임 에러로 실패하면 **THEN** the system **SHALL** 400 Bad Request를 반환하고 해당 턴을 저장하지 않는다 (Charter [지양-2] citation 강제, 기존 `lib/ai/citation-enforce.ts`의 `enforceCitations` 80% 임계값 회귀 방지). 단, 세션 자체는 유지하여 후속 재시도를 허용한다 | High |

### 세션 삭제 (명시적 삭제)

| ID | EARS Statement | Priority |
|----|----------------|----------|
| REQ-CONS-006 | **WHILE** RA Lead가 DELETE /api/consult/sessions/:sessionId를 호출할 때 **THEN** the system **SHALL** 해당 세션의 deletedAt을 현재 timestamp로 설정하고 200 OK를 반환한다. (실제 row는 삭제하지 않음 — soft-delete). RBAC 검증: ra-member는 자신의 세션만 삭제, ra-lead/admin는 모든 세션 삭제 가능 | Medium |

### 보관 정책

| ID | EARS Statement | Priority |
|----|----------------|----------|
| REQ-CONS-007 | **THE SYSTEM SHALL** consult_sessions/turns 테이블의 deletedAt이 5년 이상인 row를 자동으로 삭제하는 retention 정책을 갖는다. (run phase에서 cron job 또는 수동 정책으로 구현, 본 SPEC은 API contract만 명시) | Low |

### 감사 로그

| ID | EARS Statement | Priority |
|----|----------------|----------|
| REQ-CONS-008 | **WHEN** POST /api/consult/sessions/:sessionId/turns가 성공하면 **THEN** the system **SHALL** `consult.turn.create` audit log를 기록한다. meta_json에는 `{sessionId, turnId, questionHash, confidenceScore, sourceCount}`를 포함한다 (21 CFR Part 11 §11.10(e)) | High |
| REQ-CONS-009 | **WHEN** DELETE /api/consult/sessions/:sessionId가 성공하면 **THEN** the system **SHALL** `consult.session.delete` audit log를 기록한다. meta_json에는 `{sessionId, deletedBy, deletedAt}`를 포함한다 (21 CFR Part 11 §11.10(e)) | High |
| REQ-CONS-010 | **IF** RAG 파이프라인이 타임아웃 또는 런타임 에러로 실패하면 **THEN** the system **SHALL** `consult.turn.failed` audit log를 기록하고 error 메타를 포함한다 (디버깅용) | Medium |
| REQ-CONS-013 | **WHEN** POST /api/consult/sessions가 성공(201 Created)하면 **THEN** the system **SHALL** `consult.session.create` audit log를 기록한다. meta_json에는 `{sessionId, raMemberId, projectId?, locale}`를 포함한다 (21 CFR Part 11 §11.10(e)). 본 REQ는 §1.3 Policy Anchor에서 명시한 audit log 3종(create/turn.create/delete) 중 create 축을 채운다 | High |

### 기술 제약사항

| ID | EARS Statement | Priority |
|----|----------------|----------|
| REQ-CONS-011 | **THE SYSTEM SHALL** run-consult.ts 래퍼를 사용하여 RAG 파이프라인을 호출하고, 그 결과를 JSON 직렬화하여 consult_turns 테이블에 저장한다. run-consult.ts는 consult.ts와 동일한 하위 모듈을 재사용하며 (TRIAGE 패턴), 15s timeout + citation 검증 로직을 포함한다 (TRIAGE run-triage.ts:51-79 패턴 재사용) | High |
| REQ-CONS-012 | **THE SYSTEM SHALL** consult_sessions/turns 테이블의 FK 제약조건을 준수한다. consult_turns.sessionId → consult_sessions.id, consult_sessions.raMemberId → users.id, consult_sessions.projectId → projects.id (nullable) | High |

---

## §3 Acceptance Criteria

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

**Given** RA Member가 3개의 세션을 생성하고
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
      "Title": "세션 3",
      "projectId": "uuid-proj",
      "createdAt": "2026-07-03T10:00:00Z",
      "turnCount": 0
    }
  ]
}
```
**And** 세션 목록은 createdAt 내림차순 정렬된다 (최신 세션 first).

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

## §4 Exclusions (What NOT to Build)

- [E-001] **TRIAGE 자동 답변**: SPEC-V3-TRIAGE-001 (C-2)에서 이미 구현됨. 본 SPEC은 Power Chat 세션 저장만.
- [E-002] **Kanban UI**: SPEC-V3-UI-001 (Phase D). 본 SPEC은 backend API만 제공.
- [E-003] **승인 워크플로우**: run phase 미구현. Power Chat은 draft 답변만 제공.
- [E-004] **프로젝트 메모리**: SPEC-V3-PROJECT-MEMORY-001 (이후 SPEC).
- [E-005] **Knowledge gap replay**: SPEC-V3-KNOWLEDGE-GAP-001 (이후 SPEC).
- [E-006] **Inngest 비동기 잡**: run phase 미구현. 동기 API 기준.
- [E-007] **5년 보관 cron job**: 본 SPEC은 API contract만 명시. run phase에서 구현 여부 결정.
- [E-008] **관할권 다중 비교 정렬**: 프론트엔드 정책. backend는 턴 순서만 반환.
