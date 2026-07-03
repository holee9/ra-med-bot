---
id: SPEC-V3-INBOX-001
version: 1.1.0
status: draft
phase: C-1
priority: High
created: 2026-07-02
updated: 2026-07-02
author: manager-spec
issue_number: TBD
depends_on:
  - SPEC-V3-RESTRUCTURE-001
  - SPEC-REGULA-FOUNDATION-001
  - SPEC-REGULA-ESIG-001
blocks:
  - SPEC-V3-TRIAGE-001
  - SPEC-V3-CONSULT-001
lifecycle_level: spec-anchored
labels:
  - component/backend
  - component/db
  - component/api
  - domain/inbox
  - type/v3-new
---

# SPEC-V3-INBOX-001 — RA Inbox (4-column Kanban + Triage State Machine)

## HISTORY

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0.0 | 2026-07-02 | manager-spec | 초기 작성. v3 Phase C-1. docs/v3/02_data_model.md + 03_api_contract.md + 04_backlog.md 기반. |
| 1.1.0 | 2026-07-02 | manager-spec | Annotation cycle #1 — 사용자 결정 3종 반영. GAP-01 org_id 확정(Regula 표준 준수), GAP-02 approved_answers 본 SPEC 범위 편입(migration 0104에 inbox_tickets + approved_answers 두 테이블 동시 생성), GAP-04 /api/ask 신규 진입점 + /api/ra/consult는 C-5(SPEC-V3-CONSULT-001)로 이관. GAP-03/GAP-05는 run phase 이월. REQ 25→31 (+6: 026-029 approved_answers, 030-031 /api/ask), AC 11→13 (+2: AC-12 migration 직검, AC-13 /api/ask ticket 생성). audit_action enum 직검: answer_promoted/answer_unpromoted 이미 존재(SPEC-REGULA-KNOWLEDGE-PROMO-001, #50) → approved_answers 승격에 재사용. |

---

## §1 Purpose (목적)

### 1.1 배경 (Background)

Regula v3는 **RA 게이트웨이**로서, 전사 직원의 규제 Q&A 셀프서비스를 RA 담당자가 트리아지하는 단일 수렴점을 제공한다. 현재 Regula에는 사내 질의를 Kanban 보드로 트리아지하는 기능이 없으며 (`lib/inbox`, `lib/triage` 미존재 — 2026-07-02 직검), 질문-답변이 단발성 RAG 응답으로 끝난다.

v3 아키텍처 개편(Phase C)에서 **RA Inbox는 가장 독립적인 신규 도메인**이다 (kernel/db + audit + auth만 의존). Phase C-2 TRIAGE(Auto-Triage 파이프라인)의 전제 조건이며, Employee `/api/ask`의 티켓 종착지이다.

본 SPEC은 `inbox_tickets` 테이블, 4-column Kanban UI, triage_state 전이 머신, RA 승인(ESIG) → `approved_answers` 승격 워크플로우, 그리고 감사 로그(21 CFR Part 11 §11.10(e))를 정의한다.

### 1.2 페르소나 (Personas)

| 페르소나 | 역할 | Inbox 관점 |
|---|---|---|
| Employee / Viewer | `employee`, `viewer` | 질문 생성 (`POST /api/inbox`), 본인 질문 조회 (`GET /api/inbox?mine=1`) |
| RA Member | `ra-member` | Kanban 조회, 답변 초안 작성 (승인 불가) |
| RA Lead | `ra-lead` | triage 전이, assign, **final_answer 승인(ESIG)**, approved_answers 승격 |
| Admin | `admin` | 모든 권한 + 감사 로그 조회 |

### 1.3 규제·정책 근거 (Policy Anchor)

- **21 CFR Part 11 §11.10(e)**: `triage_state` 전이마다 append-only audit_log 기록 (hash chain).
- **21 CFR Part 11 §11.50/§11.70**: `final_answer` 발행(승인) 시 ESIG(전자서명) 필수. 서명은 의미(meaning)를 포함하고 재인증(password re-auth)이 요구된다.
- **ISO 13485 §4.2.5**: `inbox_tickets` (closed) 7년 보관.
- **Charter [지양-2] citation 강제**: `auto_answer` 필드는 RAG citation(source/provenance)을 포함해야 한다. citation 없는 답변 저장 금지.
- **Charter [지양-4] RA Lead 승인**: `final_answer` 발행은 ra-lead/admin 승인 필수. **proposal-only** (자동 발행 금지). approved_answers 승격 시 ESIG.
- **Charter [지양-1] 전사 도우미**: Employee는 본인 질문을 자유롭게 생성하고 상태를 조회할 수 있다.

### 1.4 본 SPEC의 범위 (In Scope)

- `inbox_tickets` 테이블 신규 생성 (migration `0104`)
- `approved_answers` 테이블 신규 생성 (migration `0104` — **GAP-02 결정으로 본 SPEC 범위 편입**, v3 02_data_model.md DDL 기준 + `org_id` 추가)
- `triage_state` enum 6종: `auto`, `needs-review`, `escalated`, `waiting`, `closed`, `rejected`
- 4-column Kanban UI (RA 페르소나): auto / needs-review / escalated / waiting
- triage_state 전이 머신 (허용 전이 매트릭스)
- RA 담당자 assign (`ra_assignee`)
- `final_answer` 승인 (ESIG) → `approved_answers` 승격 (동일 트랜잭션)
- `escalate_to` 외부 자문 에스컬레이션
- SLA deadline 관리 (`sla_deadline`)
- RBAC: `inbox.manage` (ra-lead), `inbox.view` (ra-member+), employee 본인 질문
- RLS: `org_id` org-isolation (Regula 표준 패턴 — GAP-01 결정: `org_id` 필수)
- audit_action enum 신규 8종: `inbox.created`, `inbox.triaged`, `inbox.assigned`, `inbox.escalated`, `inbox.answered`, `inbox.approved`, `inbox.closed`, `inbox.rejected`. 단, `answer_promoted`/`answer_unpromoted`은 기존 enum 재사용 (SPEC-REGULA-KNOWLEDGE-PROMO-001, #50 — 직검 완료)
- Employee `/api/ask` 신규 진입점 (자동 INBOX ticket 생성: `from_user`, `product_id`, `tags` 추출) — **GAP-04 결정**
- TRIAGE(C-2) 연동 지점: `/api/ask` 훅으로 TRIAGE가 `auto_answer`/`auto_confidence` 주입 (C-2 완료 후)
- waiting 티켓 5일 자동 취소 cron (Inngest `expire-waiting-tickets`)
- `approved_answers` 7년 보관 (ISO 13485 §4.2.5)

### 1.5 Out of Scope

- **Auto-Triage 파이프라인**: confidence 계산, RAG 검색, LLM 답변 생성, 위험 키워드 감지 → **SPEC-V3-TRIAGE-001** (본 SPEC은 티켓 CRUD + 전이 머신만)
- **Consult (Power Chat) — `/api/ra/consult`**: RA 전용 Power Chat은 **SPEC-V3-CONSULT-001 (C-5)** 로 이관 (GAP-04 결정). 본 SPEC의 Employee 진입점은 `/api/ask`만 해당
- **Impact Check 위저드**: SPEC-V3-IMPACT-001
- **Product Registry 자동 추출 (BK-033)**: `product_id` FK 참조만, `products` 테이블 생성은 별도
- **UI 컴포넌트 상세 구현** (Kanban 드래그앤드롭, 리스트 뷰 토글 등): Phase D, SPEC-V3-UI-001
- **WebSocket 실시간 알림** (`/api/inbox/subscribe`): Phase D
- **PATCH /api/inbox/[id] triage 전이 endpoint 상세 계약**: run phase에서 확정 (GAP-03 이월)
- **`approved_answers.citations` JSONB Zod 스키마 상세**: run phase에서 정의 (GAP-05 이월)

---

## §2 Requirements (EARS Format)

### 데이터 모델

| ID | EARS Statement | Priority |
|----|----------------|----------|
| REQ-V3-INBOX-001 | **THE SYSTEM SHALL** `inbox_tickets` 테이블을 생성하며 다음 컬럼을 포함한다: `id` (TEXT PK), `org_id` (UUID NOT NULL FK→organizations), `from_user` (UUID NOT NULL FK→users), `question` (TEXT NOT NULL), `product_id` (TEXT FK→products), `tags` (TEXT[]), `triage_state` (TEXT NOT NULL CHECK IN 6값), `auto_answer` (TEXT), `auto_confidence` (NUMERIC(5,2)), `ra_assignee` (UUID FK→users), `escalate_to` (TEXT), `final_answer` (TEXT), `approved_by` (UUID FK→users), `approved_at` (TIMESTAMPTZ), `sla_deadline` (TIMESTAMPTZ), `created_at` (TIMESTAMPTZ DEFAULT NOW()), `closed_at` (TIMESTAMPTZ) | High |
| REQ-V3-INBOX-002 | **THE SYSTEM SHALL** `triage_state`을 다음 6값으로 제한한다: `auto`, `needs-review`, `escalated`, `waiting`, `closed`, `rejected` | High |
| REQ-V3-INBOX-003 | **THE SYSTEM SHALL** 다음 인덱스를 생성한다: `(triage_state, sla_deadline)` 복합 인덱스, `(from_user)` 인덱스, `(org_id)` 인덱스 | High |
| REQ-V3-INBOX-004 | **THE SYSTEM SHALL** 모든 `inbox_tickets` 행에 `org_id`를 필수로 설정하며 `withTenantScope`를 통해 org-isolation을 적용한다 | High |

### Triage State 전이 머신

| ID | EARS Statement | Priority |
|----|----------------|----------|
| REQ-V3-INBOX-005 | **WHEN** 새 티켓이 생성될 때 **THEN** the system **SHALL** `triage_state`를 `auto` (TRIAGE가 자동 판정 전 임시) 또는 TRIAGE 파이프라인 결과값으로 초기화한다. 단, 생성 시점에는 TRIAGE가 아직 판정하지 않았다면 `needs-review`로 시작한다 (TRIAGE SPEC 연동 지점) | High |
| REQ-V3-INBOX-006 | **THE SYSTEM SHALL** 다음 triage_state 전이만 허용한다: `auto→needs-review`, `auto→escalated`, `auto→closed`, `needs-review→escalated`, `needs-review→waiting`, `needs-review→closed`, `escalated→waiting`, `escalated→closed`, `waiting→needs-review`, `waiting→closed`, `waiting→rejected`, `*(any)→rejected` (ra-lead만). 허용되지 않은 전이 시 409 Conflict를 반환한다 | High |
| REQ-V3-INBOX-007 | **WHEN** `triage_state`가 전이될 때 **THEN** the system **SHALL** audit_log에 `inbox.triaged` (또는 하위 액션) 이벤트를 동일 트랜잭션 내에 기록한다 | High |

### RBAC / 권한

| ID | EARS Statement | Priority |
|----|----------------|----------|
| REQ-V3-INBOX-008 | **THE SYSTEM SHALL** 다음 권한을 정의한다: `inbox.manage` (minRole: `ra-lead`, scope: `org`), `inbox.view` (minRole: `ra-member`, scope: `org`), `inbox.create` (minRole: `employee`, scope: `own` — 본인 질문만) | High |
| REQ-V3-INBOX-009 | **WHERE** 권한 없는 사용자가 `/api/inbox` 또는 `/api/inbox/:id`에 접근할 때 **THE SYSTEM SHALL** 403을 반환하고 audit_log에 `rbac.permission_deny`를 기록한다 | High |
| REQ-V3-INBOX-010 | **THE SYSTEM SHALL** Employee 역할은 `from_user = 본인 id`인 티켓만 생성·조회할 수 있도록 쿼리 레이어에서 강제한다 | High |

### 답변 / 승인 / ESIG

| ID | EARS Statement | Priority |
|----|----------------|----------|
| REQ-V3-INBOX-011 | **THE SYSTEM SHALL** `auto_answer` 필드에 RAG citation (source path, quote)을 포함한다. citation 없는 `auto_answer` 저장을 거부한다 (Charter [지양-2]) | High |
| REQ-V3-INBOX-012 | **WHEN** RA Lead가 `POST /api/inbox/:id/approve`를 호출할 때 **THEN** the system **SHALL** ESIG 재인증(password re-auth)을 검증한 후 `final_answer`를 확정하고 `approved_by`, `approved_at`을 기록한다 | High |
| REQ-V3-INBOX-013 | **WHEN** 승인이 완료될 때 **THEN** the system **SHALL** 동일 트랜잭션 내에서 `approved_answers` 테이블로 스냅샷을 승격(`from_ticket` FK 포함)하고 `triage_state`를 `closed`로 전이한다 | High |
| REQ-V3-INBOX-014 | **THE SYSTEM SHALL** `final_answer` 자동 발행을 금지한다. 모든 `final_answer`는 ra-lead/admin의 명시적 ESIG 승인이 필수이다 (Charter [지양-4] proposal-only) | High |
| REQ-V3-INBOX-015 | **WHEN** `POST /api/inbox/:id/reject`가 호출될 때 **THEN** the system **SHALL** `triage_state`를 `rejected`로 전이하고 audit_log에 `inbox.rejected`를 기록한다. reject는 ra-lead/admin만 가능하다 | High |

### 에스컬레이션 / SLA

| ID | EARS Statement | Priority |
|----|----------------|----------|
| REQ-V3-INBOX-016 | **WHEN** `POST /api/inbox/:id/escalate`가 호출될 때 **THEN** the system **SHALL** `escalate_to` 필드에 외부 자문/상급자 정보를 기록하고 `triage_state`를 `escalated`로 전이하며 audit_log에 `inbox.escalated`를 기록한다 | High |
| REQ-V3-INBOX-017 | **THE SYSTEM SHALL** 티켓 생성 시 SLA 임계값(adminSettings.sla)에 기반하여 `sla_deadline`을 계산하여 저장한다. 임계값 기본: `auto`=24h, `needs-review`=12h, `escalated`=48h | Medium |
| REQ-V3-INBOX-018 | **WHEN** 매일 04:00 KST cron이 실행될 때 **THEN** the system **SHALL** `waiting` 상태이고 5일간 회신이 없는 티켓을 자동으로 `closed`(또는 `rejected`)로 전이한다 (Inngest `expire-waiting-tickets`) | Medium |

### API 계약

| ID | EARS Statement | Priority |
|----|----------------|----------|
| REQ-V3-INBOX-019 | **THE SYSTEM SHALL** 다음 API endpoints를 제공한다: `POST /api/inbox` (employee 생성), `GET /api/inbox` (ra-member+ Kanban 조회, `?state=&assignee=&mine=` 필터), `GET /api/inbox/:id` (상세), `PATCH /api/inbox/:id` (triage 전이, ra-lead), `POST /api/inbox/:id/approve` (ESIG 승인, ra-lead), `POST /api/inbox/:id/escalate` (ra-lead), `POST /api/inbox/:id/reject` (ra-lead) | High |
| REQ-V3-INBOX-020 | **WHEN** `GET /api/inbox`가 호출될 때 **THEN** the system **SHALL** 페이지네이션(`?limit=20&offset=0`)과 `total` 필드를 포함한 응답을 반환한다 | Medium |

### 감사 / 무결성

| ID | EARS Statement | Priority |
|----|----------------|----------|
| REQ-V3-INBOX-021 | **THE SYSTEM SHALL** 다음 audit_action enum값을 신규 추가한다: `inbox.created`, `inbox.triaged`, `inbox.assigned`, `inbox.escalated`, `inbox.answered`, `inbox.approved`, `inbox.closed`, `inbox.rejected` (총 8종) | High |
| REQ-V3-INBOX-022 | **WHEN** 티켓이 생성될 때 **THEN** the system **SHALL** 동일 트랜잭션 내에서 audit_log에 `inbox.created`를 기록한다 (actor=from_user) | High |
| REQ-V3-INBOX-023 | **WHEN** assign이 변경될 때 **THEN** the system **SHALL** audit_log에 `inbox.assigned`를 기록한다 (이전/신규 assignee 메타포함) | Medium |
| REQ-V3-INBOX-024 | **THE SYSTEM SHALL** `inbox_tickets` (closed)를 7년간 보관한다 (ISO 13485 §4.2.5). audit_log는 10년 (21 CFR Part 11 + MDR Art. 10(8)) | Medium |

### RLS / org-isolation

| ID | EARS Statement | Priority |
|----|----------------|----------|
| REQ-V3-INBOX-025 | **THE SYSTEM SHALL** `inbox_tickets` 테이블에 RLS 정책을 적용하여 `app.current_org_id` GUC와 매칭되는 `org_id` 행만 접근 가능하도록 한다 (SPEC-REGULA-RLS-ENFORCE-001 패턴 준용 — 단, 현재 RLS는 inert #239 debt이므로 query-layer `eq(orgId)`가 실제 격리 경계이다). `approved_answers` 테이블도 동일한 RLS 정책을 적용한다 (#239 완료 시 FORCE 대상 명시) | High |

### approved_answers (승격 테이블 — GAP-02 결정으로 본 SPEC 범위)

| ID | EARS Statement | Priority |
|----|----------------|----------|
| REQ-V3-INBOX-026 | **THE SYSTEM SHALL** `approved_answers` 테이블을 `inbox_tickets`과 동일한 migration `0104`에서 생성하며 다음 컬럼을 포함한다: `id` (TEXT PK), `org_id` (UUID NOT NULL FK→organizations — GAP-01 원칙 동일), `category` (TEXT), `question` (TEXT NOT NULL), `answer` (TEXT NOT NULL), `citations` (JSONB DEFAULT '[]'), `hits` (INT DEFAULT 0), `state` (TEXT NOT NULL CHECK IN ('draft','published','deprecated')), `from_ticket` (TEXT FK→inbox_tickets), `published_by` (UUID FK→users), `published_at` (TIMESTAMPTZ), `updated_at` (TIMESTAMPTZ). `promoted_answers` 테이블(#50 KNOWLEDGE-PROMO)과는 **개념이 다름** — 본 테이블은 inbox ticket 승격이며, `promoted_answers`는 대화 메시지 승격(source_message_id 중심) | High |
| REQ-V3-INBOX-027 | **THE SYSTEM SHALL** `approved_answers`에 다음 인덱스를 생성한다: `(state)` 인덱스, GIN `to_tsvector('simple', question \|\| ' ' \|\| answer)` (full-text search) | High |
| REQ-V3-INBOX-028 | **WHEN** RA Lead 승인이 완료될 때 **THEN** the system **SHALL** 동일 트랜잭션 내에서 `approved_answers` 행을 생성(`from_ticket` FK, `state='published'`, `published_by`, `published_at=NOW()`)하거나 rollback한다. 부분 실패 시 티켓 상태도 롤백 (승격 트랜잭션 무결성) | High |
| REQ-V3-INBOX-029 | **WHEN** `approved_answers.state`가 전이될 때 **THEN** the system **SHALL** 기존 `answer_promoted` / `answer_unpromoted` audit_action enum을 재사용하여 감사 로그를 기록한다 (enum 직검: SPEC-REGULA-KNOWLEDGE-PROMO-001 #50에서 추가됨, schema.ts:401-402). 신규 enum 추가 불필요 | Medium |

### Employee `/api/ask` 진입점 (GAP-04 결정)

| ID | EARS Statement | Priority |
|----|----------------|----------|
| REQ-V3-INBOX-030 | **THE SYSTEM SHALL** `POST /api/ask` endpoint를 신규 제공한다. 요청 Body: `{question: string, product_id?: string, tags?: string[]}`. 응답: `{ticket_id, triage_state, auto_answer?, auto_confidence?}`. 이 endpoint는 Employee 질문 진입점이며, 호출 시 자동으로 `inbox_tickets` 행을 생성한다 (`from_user` = 세션 사용자, `triage_state` 초기값 = `needs-review` 또는 TRIAGE 주입값) | High |
| REQ-V3-INBOX-031 | **WHEN** TRIAGE 파이프라인(SPEC-V3-TRIAGE-001, C-2)이 완료될 때 **THEN** the system **SHALL** `/api/ask` 훅을 통해 `auto_answer` / `auto_confidence`를 티켓에 주입하고 `triage_state`를 TRIAGE 판정값으로 갱신한다. 본 SPEC은 훅 인터페이스만 정의하고, TRIAGE 구현은 C-2에서 처리한다 | Medium |

---

## §3 Acceptance Criteria

| AC# | Criterion | Verification |
|-----|-----------|--------------|
| AC-01 | migration `0104_inbox_tickets.sql` 적용 후 `inbox_tickets` 테이블이 6가지 `triage_state` CHECK 제약과 함께 생성된다 (`\d inbox_tickets` 직검) | 실DB psql `\d` |
| AC-02 | `triage_state` 값이 6종(`auto`, `needs-review`, `escalated`, `waiting`, `closed`, `rejected`) 중 하나가 아닌 경우 INSERT/UPDATE가 거부된다 | Test (CHECK 제약 위반) |
| AC-03 | Employee가 타인의 티켓을 조회하면 403 + `rbac.permission_deny` audit 로그가 기록된다 (RLS/query-layer 0행 단언) | Test |
| AC-04 | 허용되지 않은 triage_state 전이(예: `closed→auto`) 시도 시 409 Conflict 반환 | Test |
| AC-05 | `POST /api/inbox/:id/approve` 호출 시 ESIG password 재인증 실패면 401 + audit 미기록. 성공 시 `approved_by`/`approved_at` 기록 + `approved_answers` 행 생성(`from_ticket` FK, `state='published'` 단언) + `triage_state=closed` + audit `answer_promoted`(기존 enum 재사용) 가 단일 트랜잭션 내 발생. 부분 실패 시 전체 rollback (검증: approve 후 `SELECT * FROM approved_answers WHERE from_ticket = :id` 행 존재 단언) | Test (트랜잭션 원자성 + 승격 행 검증) |
| AC-06 | citation 없는 `auto_answer` 저장 시 400 Bad Request 반환 (Charter [지양-2]) | Test |
| AC-07 | 권한 매트릭스: `inbox.manage`=ra-lead/admin, `inbox.view`=ra-member+, `inbox.create`=employee(본인만)가 `lib/auth/permissions.ts`에 정의되고 route guard가 강제한다 | Test (각 역할별 호출) |
| AC-08 | 티켓 생성(`inbox.created`), 전이(`inbox.triaged`), assign(`inbox.assigned`), 에스컬(`inbox.escalated`), 승인(`inbox.approved`), 거절(`inbox.rejected`) 6종 audit 이벤트가 audit_log에서 조회된다 | Test |
| AC-09 | `GET /api/inbox?state=needs-review&assignee=me` 가 ra-member 컨텍스트에서 올바른 필터링 결과를 반환한다 | Test |
| AC-10 | `inbox_tickets.org_id`가 `withTenantScope`에 의해 설정되고, 타 org 티켓은 0행 반환된다 (cross-org isolation) | Test |
| AC-11 | migration 체인 선형성 유지: `pnpm drizzle-kit check` 통과, 기존 261 FK 보존, `pnpm test` 4229+ passed 회귀 0건 | test runner output + drizzle-kit check |
| AC-12 | migration `0104` 적용 후 `inbox_tickets` **및** `approved_answers` 두 테이블이 모두 생성됨 (`\d inbox_tickets` + `\d approved_answers` 직검). `approved_answers`는 `from_ticket` FK→`inbox_tickets`, `org_id` FK→`organizations`, `state` CHECK 제약 3값, GIN tsvector 인덱스 포함 | 실DB psql `\d` 2회 (테이블별) |
| AC-13 | `POST /api/ask` 호출 시 자동으로 `inbox_tickets` 행이 생성됨을 단언 (`from_user` = 세션 사용자, `triage_state` 초기값 확인). 응답에 `ticket_id` 포함 | Test (POST 후 `GET /api/inbox/:id` 로 행 존재 단언) |

---

## §4 Technical Approach

### 4.1 Migration (`0104_inbox_tickets_and_approved_answers.sql`)

현재 최신 migration: `0103_drop_pmcf_pms.sql` (2026-07-02 직검). 다음 번호 `0104` 사용. **GAP-02 결정** 으로 `inbox_tickets` + `approved_answers` 두 테이블을 단일 migration에서 생성.

**`migrations/0104_inbox_tickets_and_approved_answers.sql`** (신규):

1. **`inbox_tickets` 테이블** (REQ-V3-INBOX-001):
   - 컬럼: `id` TEXT PK, `org_id` UUID NOT NULL FK→organizations, `from_user` UUID NOT NULL FK→users, `question` TEXT, `product_id` TEXT FK→products, `tags` TEXT[], `triage_state` TEXT NOT NULL CHECK, `auto_answer` TEXT, `auto_confidence` NUMERIC(5,2), `ra_assignee` UUID FK→users, `escalate_to` TEXT, `final_answer` TEXT, `approved_by` UUID FK→users, `approved_at` TIMESTAMPTZ, `sla_deadline` TIMESTAMPTZ, `created_at` TIMESTAMPTZ DEFAULT NOW(), `closed_at` TIMESTAMPTZ
   - CHECK 제약: `triage_state IN ('auto','needs-review','escalated','waiting','closed','rejected')`
   - 인덱스 3종: `(triage_state, sla_deadline)`, `(from_user)`, `(org_id)`

2. **`approved_answers` 테이블** (REQ-V3-INBOX-026 — v3 02_data_model.md DDL 기준 + `org_id` 추가):
   - 컬럼: `id` TEXT PK, `org_id` UUID NOT NULL FK→organizations, `category` TEXT, `question` TEXT NOT NULL, `answer` TEXT NOT NULL, `citations` JSONB DEFAULT '[]', `hits` INT DEFAULT 0, `state` TEXT NOT NULL CHECK IN ('draft','published','deprecated'), `from_ticket` TEXT FK→inbox_tickets, `published_by` UUID FK→users, `published_at` TIMESTAMPTZ, `updated_at` TIMESTAMPTZ
   - 인덱스: `(state)`, GIN `to_tsvector('simple', question || ' ' || answer)`
   - 데이터 보관: 7년 (ISO 13485 §4.2.5)

3. **`audit_action` enum +8값** (REQ-V3-INBOX-021): `inbox.created`, `inbox.triaged`, `inbox.assigned`, `inbox.escalated`, `inbox.answered`, `inbox.approved`, `inbox.closed`, `inbox.rejected`. 현재 enum 값 수: 204개 (2026-07-02 직검). 본 SPEC +8 = 212개.
   - **주의**: `answer_promoted`/`answer_unpromoted`은 이미 존재 (schema.ts:401-402, SPEC-REGULA-KNOWLEDGE-PROMO-001 #50에서 추가). approved_answers 승격 감사 에는 이 기존 enum을 재사용 (REQ-V3-INBOX-029). 중복 추가 금지.

4. **RLS 정책** (REQ-V3-INBOX-025): `inbox_tickets` + `approved_answers` 양쪽에 `org_id` 기반 policy 추가. 단, 현재 RLS는 inert(#239 debt)이므로 query-layer `eq(orgId)`가 실제 격리 경계. RLS 정책은 미래 대비 추가만.

> **`promoted_answers` vs `approved_answers` 혼동 주의** (GAP-02 핵심):
> - `promoted_answers` (#50, schema.ts:998-1032): 대화 메시지 승격. `source_message_id` FK 중심, `tags`, `embedding` vector(1536), `status` enum. UNIQUE(source_message_id).
> - `approved_answers` (본 SPEC): inbox ticket 승격. `from_ticket` FK 중심, `category`, `question`, `answer`, `citations` JSONB, `state` enum, `hits`. GIN tsvector.
> - 둘 다 유지. 스키마 충돌 없음 (테이블명/컬럼명 상이).

### 4.2 파일 구조 (v3 구조 — kernel 추출 전 환경)

> **참고**: Phase B(kernel 추출, SPEC-V3-RESTRUCTURE-001)가 미실행 상태이므로, 현재는 `lib/db`, `lib/auth`, `lib/audit` 경로를 그대로 사용한다. kernel 추출 후 codemod로 경로 일괄 변경 예정.

- `lib/domains/inbox/schema-inbox.ts` — Drizzle pgTable 정의 (`inbox_tickets` + `approved_answers`)
- `lib/domains/inbox/types.ts` — TypeScript 타입 (TriageState, InboxTicket, ApprovedAnswer, ApprovedAnswerState)
- `lib/domains/inbox/repo.ts` — DB CRUD (`createTicket`, `getTicket`, `listTickets`, `updateTriageState`, `assignTicket`, `promoteToApproved`)
- `lib/domains/inbox/transitions.ts` — triage_state 전이 머신 (허용 전이 매트릭스)
- `lib/domains/inbox/approve.ts` — ESIG 승인 + `approved_answers` 승격 (단일 트랜잭션, REQ-V3-INBOX-028)
- `lib/domains/inbox/sla.ts` — SLA deadline 계산
- `lib/domains/inbox/index.ts` — 공개 API (re-export)
- `app/api/inbox/route.ts` — `GET` (RA Kanban 조회 — `inbox.view`)
- `app/api/inbox/[id]/route.ts` — `GET` (상세), `PATCH` (triage 전이 — GAP-03 run phase 확정)
- `app/api/inbox/[id]/approve/route.ts` — `POST` (ESIG 승인 + approved_answers 승격)
- `app/api/inbox/[id]/triage/route.ts` — `POST` (triage 전이 통합 엔드포인트 — **GAP-03 run phase 결정**: `escalate`/`reject`를 별도 라우트가 아닌 `triage_state` 전이 단일 엔드포인트로 통합. escalated/rejected 상태로의 전이는 state-machine.ts 허용 매트릭스로 강제)
- `app/api/ask/route.ts` — **`POST` (Employee 질문 진입점, GAP-04 결정)** — 자동 ticket 생성. TRIAGE(C-2) 완료 후 `auto_answer`/`auto_confidence` 주입 훅
- `lib/inngest/functions/expire-waiting-tickets.ts` — 5일 waiting 자동 취소 cron
- `lib/auth/permissions.ts` — `inbox.manage` (ra-lead/admin), `inbox.view` (ra-member+) 권한 추가

> **As-Built (run phase 반영, 2026-07-03 sync)**: 계획된 파일 구조(위)와 실제 구현 정합성 메모.
> - **스키마**: `lib/domains/inbox/schema-inbox.ts` (계획) → `lib/db/schema.ts` 내 `inboxTickets`/`approvedAnswers` pgTable으로 통합 (Step 1).
> - **도메인 모듈**: `repo.ts`/`transitions.ts`/`approve.ts` (계획) → `queries.ts`/`state-machine.ts`/`promote.ts` (+ `access.ts`/`audit.ts`/`sla.ts`/`index.ts`)로 분리 (Step 2).
> - **triage 라우트**: GAP-03 결정으로 `escalate`/`reject` 별도 라우트 → `triage/route.ts` 단일 전이 엔드포인트로 통합 (Step 3, 위 반영).
> - **권한 (AC-07)**: `inbox.create`/`ask.create` 명시적 권한 키는 미정의. `/api/ask`는 세션 사용자를 `from_user`로 강제하여 employee 본인 질문을 기능적으로 보장(AC-07 핵심 충족). 권한 키 명시 정의는 Follow-up #3(viewer→employee 페르소나 검토)에서 확정.
> - **AC-06 (citation 없는 `auto_answer` 400)**: TRIAGE(C-2) 의존. 현재 `/api/ask`는 `auto_answer=null` 고정이므로 citation 검증 분기 미도달. SPEC-V3-TRIAGE-001로 이월 (Follow-up #1).

### 4.3 triage_state 전이 매트릭스

```
              ┌─────────────────────────────────────────────┐
              │                                             │
   ( 생성 )──→ auto ──→ needs-review ──→ escalated         │
              │           │      ↑              │           │
              │           │      └──────────────┤           │
              │           ↓                     ↓           │
              │       waiting ─────────→ closed             │
              │           │                                 │
              │           ↓                                 │
              │       rejected ←──*(any, ra-lead)           │
              │                                             │
              └─────────────────────────────────────────────┘
```

허용 전이 (단방향):
- `auto → {needs-review, escalated, closed}`
- `needs-review → {escalated, waiting, closed}`
- `escalated → {waiting, closed}`
- `waiting → {needs-review, closed, rejected}`
- `*(any) → rejected` (ra-lead/admin만)

### 4.4 RBAC 권한 매트릭스

| 권한 키 | minRole | scope | resourceType | 비고 |
|---|---|---|---|---|
| `inbox.create` | `employee` | `own` | `inboxTicket` | 본인 질문만 (`from_user = session.user.id`) |
| `inbox.view` | `ra-member` | `org` | `inboxTicket` | Kanban 조회, 필터링 |
| `inbox.manage` | `ra-lead` | `org` | `inboxTicket` | triage 전이, assign, approve, escalate, reject |

> `admin`은 모든 권한 상속. `viewer`는 `employee`와 동일하게 `inbox.create`(own) 적용 (v3 페르소나 viewer→employee 확장 검토 — Follow-up).

### 4.5 API Endpoints 상세

| Method | Path | 권한 | Body / Query | 응답 |
|---|---|---|---|---|
| `POST` | `/api/ask` | `ask.create` (employee+) | `{question, product_id?, tags?[]}` | `{ticket_id, triage_state, auto_answer?, auto_confidence?}` (GAP-04 결정 — Employee 진입점. 자동 ticket 생성) |
| `GET` | `/api/inbox` | `inbox.view` | `?state=&assignee=&mine=&limit=20&offset=0` | `{items[], total}` |
| `GET` | `/api/inbox/:id` | `inbox.view` (또는 본인 질문) | — | `{...ticket}` |
| `PATCH` | `/api/inbox/:id` | `inbox.manage` | `{triage_state?, ra_assignee?}` | `{...ticket}` (GAP-03: run phase 계약 확정) |
| `POST` | `/api/inbox/:id/approve` | `inbox.manage` | `{final_answer, citations[], esig: {password, meaning}}` | `{approved_answer_id, ticket}` (AC-05: 동일 tx에서 approved_answers 행 생성) |
| `POST` | `/api/inbox/:id/escalate` | `inbox.manage` | `{escalate_to, reason?}` | `{...ticket}` |
| `POST` | `/api/inbox/:id/reject` | `inbox.manage` | `{reason?}` | `{...ticket}` |

> **이관 endpoint (본 SPEC 제외)**: `POST /api/ra/consult` (RA 전용 Power Chat) → **SPEC-V3-CONSULT-001 (C-5)** 에서 분리 (GAP-04 결정). 본 SPEC의 Employee 진입점은 `/api/ask` 단일.

### 4.6 의존성 (Dependencies)

- **kernel (Phase B 미실행)**: `lib/db` (client, withTenantScope), `lib/auth` (getSession, requireRole, withPermission), `lib/audit` (writeAudit) — 현재 경로 그대로 사용, kernel 추출 후 codemod
- **SPEC-REGULA-FOUNDATION-001**: audit_log, RBAC 프레임워크
- **SPEC-REGULA-ESIG-001**: 전자서명 재인증 메커니즘 (password re-auth)
- **products 테이블**: `product_id` FK — 현재 Regula DB에 products 테이블이 v3 형태로 미존재 가능 (`approved_answers`와 함께 Follow-up). product_id가 nullable이므로 FK 제약은 DEFERRABLE 또는 참조 누락 시 NULL 허용
- **Inngest**: `expire-waiting-tickets` cron (daily 04:00 KST)
- **후속 (blocks)**: SPEC-V3-TRIAGE-001 (Auto-Triage가 inbox 티켓 생성 및 triage_state 자동 판정), SPEC-V3-CONSULT-001

### 4.7 Regression-Risk Matrix

| 영역 | Risk | 완화 방안 |
|------|------|-----------|
| **신규 테이블 + enum 추가** | LOW — 순수 추가, 기존 테이블 영향 없음 | migration 후 `drizzle-kit check` + 실DB `\d` 직검 (L-010, L-013) |
| **audit_action enum 확장** | LOW — 기존 값 변경 없음, append-only | migration 적용 후 전체 enum 값 카운트 비교 |
| **RLS / org_id** | MEDIUM — 현재 RLS inert (#239), query-layer가 실제 격리 | query-layer `eq(orgId)` 강제, RLS 정책은 미래 대비 추가만 |
| **approved_answers 테이블 신규 생성 (GAP-02 결정)** | MEDIUM — 두 테이블 동시 migration. `promoted_answers`(#50)와 스키마 혼동 리스크 | migration `0104`에서 `inbox_tickets` + `approved_answers` 동시 생성. `promoted_answers` vs `approved_answers` 명확 분리 (§4.1 주석). AC-12 직검 |
| **next dev 500 에러** | LOW — 신규 라우트이므로 기존 페이지 영향 없음 | L-012 준수, next dev 구동 중 build 금지 |
| **kernel 경로 우회** | LOW — Phase B 완료 후 codemod 일괄 변경 | `lib/db`, `lib/auth`, `lib/audit` 직접 참조 (kernel 추출 전) |

---

## §5 모순 보고 (Contradictions / Gaps with v3 Source Documents)

> 본 섹션은 v3 원천 문서와의 모순 또는 불충분한 정의를 기록한다. **Annotation cycle #1 (2026-07-02)** 에서 3개 GAP 확정, 2개 GAP run phase 이월.

### 5.1 GAP-01: `inbox_tickets.org_id` 컬럼 누락 — ✅ 결정됨 (Regula 표준 준수)

- **원천**: `docs/v3/02_data_model.md:79-99`의 `inbox_tickets` DDL에 `org_id` 컬럼 없음.
- **결정 (2026-07-02)**: `org_id UUID NOT NULL REFERENCES organizations(id)` 추가. RLS 정책 + `withTenantScope` 적용. `approved_answers` 테이블에도 동일 원칙 적용.
- **근거**: schema.ts 직검 — Regula는 모든 테이블 org-scoped. RLS는 현재 inert(#239 debt)이나 query-layer `eq(orgId)`가 실제 격리 경계. v3 DDL은 단순 누락으로 판단.
- **SPEC 반영**: REQ-V3-INBOX-001, REQ-V3-INBOX-004, REQ-V3-INBOX-025, REQ-V3-INBOX-026 (approved_answers org_id).

### 5.2 GAP-02: `approved_answers` 테이블 — ✅ 결정됨 (본 SPEC 범위 편입)

- **원천**: `docs/v3/02_data_model.md:106-121`에 `approved_answers` DDL 정의. 현재 Regula DB에는 미존재 (schema.ts 직검 — `promoted_answers`만 존재).
- **결정 (2026-07-02)**: `approved_answers` 테이블을 **본 SPEC 범위에 포함**. migration `0104`에서 `inbox_tickets` + `approved_answers` 두 테이블을 함께 생성.
- **`promoted_answers` vs `approved_answers` 구분** (혼동 주의):
  - `promoted_answers` (#50 KNOWLEDGE-PROMO, 2026-06-26 머지, schema.ts:998-1032 직검): 대화 메시지 승격. `source_message_id` FK 중심, `tags` TEXT[], `embedding` vector(1536), `status` enum. UNIQUE(source_message_id).
  - `approved_answers` (본 SPEC 신규): inbox ticket 승격. `from_ticket` FK 중심, `category`, `question`, `answer`, `citations` JSONB, `state` enum('draft','published','deprecated'), `hits` INT. GIN tsvector.
  - **둘 다 유지**. 스키마 충돌 없음.
- **SPEC 반영**: REQ-V3-INBOX-026 (DDL), REQ-V3-INBOX-027 (인덱스), REQ-V3-INBOX-028 (승격 트랜잭션), REQ-V3-INBOX-029 (audit enum 재사용). §4.1 migration 스키마에 DDL 추가. AC-05 강화 (승격 행 검증). AC-12 (두 테이블 생성 단언).

### 5.3 GAP-03: `PATCH /api/inbox/:id` triage 전이 endpoint 상세 — ⏸ run phase 이월

- **원천**: `docs/v3/03_api_contract.md:122-145`에 triage_state 전이(`PATCH`) endpoint가 명시적으로 정의되지 않음.
- **결정 (2026-07-02)**: 본 SPEC은 `PATCH /api/inbox/:id`를 **추가 제안** (REQ-V3-INBOX-019)하되, **상세 API 계약은 run phase에서 확정**. 대안: 각 전이를 별도 POST endpoint로 분해 (`/triage`, `/assign` 등) 검토.
- **SPEC 반영**: 본 SPEC에는 "run phase 확정" 명시만.

### 5.4 GAP-04: `/api/ask` 신규 + `/api/ra/consult` C-5 분리 — ✅ 결정됨

- **원천**: `docs/v3/01_architecture.md:114-126` (Auto-Triage 로직), `03_api_contract.md:14-31` (`POST /api/ask`).
- **결정 (2026-07-02)**: Employee 질문 진입점 = 신규 `POST /api/ask`. 흐름: `/api/ask` → 자동 INBOX ticket 생성 (`from_user`, `product_id`, `tags` 추출). 기존 `/api/ra/consult`는 RA 전용 Power Chat으로 **C-5 (SPEC-V3-CONSULT-001)** 에서 분리 — 본 SPEC 범위 외.
- **SPEC 반영**: REQ-V3-INBOX-030 (`/api/ask` 명세), REQ-V3-INBOX-031 (TRIAGE 연동 훅). §4.5 API Endpoints에 추가. §1.5 Out of Scope에 consult 이관 명시. AC-13 (ticket 자동 생성 단언).

### 5.5 GAP-05: `approved_answers.citations` JSONB 구조 — ⏸ run phase 이월

- **원천**: `docs/v3/02_data_model.md:111`에 `citations JSONB`로만 정의.
- **결정 (2026-07-02)**: **Zod 스키마는 run phase에서 정의**. 권장 형태: `citations: [{source: string, quote: string, n?: number}]`. 본 SPEC은 요구사항 수준에서만 명시 (REQ-V3-INBOX-011).
- **SPEC 반영**: 본 SPEC에는 "Zod 스키마 run phase 정의" 명시만.

---

## §6 Exclusions (What NOT to Build)

본 SPEC은 **티켓 CRUD + 전이 머신 + 승인 워크플로우 + approved_answers 승격** 을 다룬다. 다음은 명시적으로 제외:

- **Auto-Triage 파이프라인 구현 금지**: confidence 계산, RAG 검색, LLM 답변 생성, 위험 키워드 감지는 SPEC-V3-TRIAGE-001. 본 SPEC은 `createTicket()` 함수 + `/api/ask` 진입점만 노출.
- **Consult (Power Chat) `/api/ra/consult` 구현 금지**: RA 전용 Power Chat은 SPEC-V3-CONSULT-001 (C-5)에서 분리 (GAP-04 결정).
- **`promoted_answers` 테이블 변경 금지**: 기존 #50 KNOWLEDGE-PROMO 테이블은 본 SPEC과 무관. `approved_answers`와 별개 유지.
- **Kanban UI 드래그앤드롭 구현 금지**: Phase D, SPEC-V3-UI-001.
- **WebSocket 실시간 알림 금지** (`/api/inbox/subscribe`): Phase D.
- **`final_answer` 자동 발행 금지**: 모든 승인은 ESIG 재인증 필수 (Charter [지양-4]).
- **citation 없는 `auto_answer` 저장 금지**: Charter [지양-2] 위반이므로 400 Bad Request.
- **타 org 티켓 접근 금지**: org_id RLS/query-layer 강제.
- **Employee 타인 질문 조회 금지**: `from_user = session.user.id` 강제.
- **`approved_answers.citations` JSONB Zod 스키마 상세 정의 금지**: run phase (GAP-05 이월).
- **`PATCH /api/inbox/:id` 상세 API 계약 확정 금지**: run phase (GAP-03 이월).

---

## §7 Follow-up Issues

1. **TRIAGE 연동 인터페이스 확정** (SPEC-V3-TRIAGE-001): `createTicket()` 함수 시그니처, `/api/ask` 훅 → `auto_answer`/`auto_confidence` 주입 흐름, confidence 임계값에 따른 초기 `triage_state` 판정 로직.
2. **`products` 테이블 v3 형태 생성** (SPEC-V3-REGISTRY-001): `product_id` FK의 참조 대상. 현재 Regula DB에 v3 형태 `products` 테이블이 없을 수 있음. product_id는 nullable이므로 FK 제약은 DEFERRABLE 또는 NULL 허용.
3. **viewer → employee 페르소나 확장 검토**: v3 페르소나 viewer(읽기 전용)가 질문 생성 권한을 가질지. 현재 본 SPEC은 `ask.create` / `inbox.create` minRole을 `employee`로 설정하되 viewer 포함 검토를 Follow-up으로 명시.
4. **`PATCH /api/inbox/:id` vs 개별 POST endpoints 분해** (GAP-03 — run phase 이월): triage_state 전이 + assign 변경 API 계약 확정.
5. **`approved_answers.citations` JSONB Zod 스키마 정의** (GAP-05 — run phase 이월): `citations: [{source: string, quote: string, n?: number}]` 권장.
6. **03_api_contract.md 갱신**: 본 SPEC의 API endpoints (`/api/ask`, `/api/inbox/*`)를 v3 문서에 반영 (sync phase). `/api/ra/consult`는 C-5 문서로 이관 표시.

---

## §8 References

- **v3 데이터 모델**: `docs/v3/02_data_model.md:76-99` (`inbox_tickets` DDL), `:106-121` (`approved_answers`), `:144-197` (`audit_log` hash chain)
- **v3 API 계약**: `docs/v3/03_api_contract.md:122-145` (RA Inbox endpoints), `:14-31` (`POST /api/ask` 티켓 자동 생성)
- **v3 아키텍처**: `docs/v3/01_architecture.md:114-126` (Auto-Triage 로직), `:82-101` (페르소나 Route Guard)
- **v3 백로그**: `docs/v3/04_backlog.md:39` (BK-002 RA Inbox 4-column Kanban, M-001)
- **v3 README**: `docs/v3/README.md:44` (RA Inbox 핵심 화면 정의)
- **마스터 계획**: `docs/proposals/v3-architecture-revamp-plan-2026-07-02.md` §5.1 (Phase C-1 매핑), §7 Phase C (INBOX 구현 순서)
- **Charter**: `~/.claude/projects/-home-abyz-lab-work-workspace-github-holee9-ra-med-bot/memory/product-charter.md` ([지양-2] citation, [지양-4] RA Lead 승인)
- **부모 SPEC**: `.moai/specs/SPEC-V3-RESTRUCTURE-001/spec.md` (Phase A+B, kernel 추출 전제)
- **참조 SPEC 패턴**: `.moai/specs/SPEC-REGULA-KNOWLEDGE-GAP-001/spec.md` (CRUD + audit + RBAC 패턴), `.moai/specs/SPEC-REGULA-PROJECT-MEMORY-001/spec.md` (schema + org_id + audit enum)
- **RLS 패턴**: `.moai/specs/SPEC-REGULA-RLS-ENFORCE-001/spec.md`, `lib/db/client.ts:54` (`withTenantScope`, `app.current_org_id`)
- **audit_action enum**: `lib/db/schema.ts:117-300` (pgEnum, 현재 ~113값, 본 SPEC +8 = ~121)
- **권한 프레임워크**: `lib/auth/permissions.ts` (도메인별 `domain.action` 패턴)
- **Lessons**: L-007(직검), L-010(migration 실DB), L-012(next dev build 금지), L-013(실DB 직검 3중 맹점)
