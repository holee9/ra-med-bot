---
id: SPEC-REGULA-ADOPTION-001
version: 1.0.0
status: draft
phase: wave4
priority: High
created: 2026-06-22
updated: 2026-06-22
author: manager-spec (batch-2026-06-22)
issue_number: 38
depends_on:
  - SPEC-REGULA-FOUNDATION-001
  - SPEC-REGULA-BREADTH-001
  - SPEC-REGULA-ENTERPRISE-001
lifecycle_level: spec-anchored
labels:
  - component/backend
  - component/frontend
  - component/infra
---

# SPEC-REGULA-ADOPTION-001 — 사용자 온보딩·성과 KPI·피드백 루프

## HISTORY

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0.0 | 2026-06-22 | manager-spec (batch) | 초기 작성. Issue #38 기반. |

---

## §1 Purpose (목적)

### 1.1 배경 (Background)

릴리즈/품질/고급 RA 기능이 모두 완료되면 제품은 강력해지지만, 6~20명 규모의 내부 사용자가 실제로 반복 사용하려면 온보딩, 역할별 첫 작업, 신뢰 피드백, 성과 지표가 필요하다. 기능이 존재하는 것과 사용자가 그 기능을 채택하는 것은 별개의 문제다.

본 SPEC은 Regula의 실사용 채택률(adoption rate)과 개선 우선순위를 측정하기 위한 제품 운영(product-ops) 시스템을 정의한다. 핵심은 역할별 온보딩, 답변별 in-product 피드백, PII-safe KPI 대시보드, 주간 success review export 네 가지다.

기존 onboarding은 브라우저 localStorage에 상태를 저장하므로 기기 간 동기화가 되지 않고 audit 추적이 불가능하다. 본 SPEC은 이를 user profile 기반 서버 상태로 승격하여 신뢰 가능한 채택 지표를 확보한다.

피드백 루프는 단순 별점 수집이 아니라 reason taxonomy(citation missing, outdated source 등)로 구조화하여, #35 Knowledge Gap Ops 또는 #36 Review Ops의 실제 action으로 전환 가능하게 한다.

### 1.2 규제 근거 (Regulatory Anchor)

- 21 CFR Part 11 — onboarding 완료/스킵/재시작 및 feedback 전환은 audit trail로 기록되어야 한다 (electronic records).
- 개인정보 보호 원칙 (data minimization) — KPI 및 analytics는 PII-safe aggregate만 저장하며 개인별 생산성 평가 목적으로 사용하지 않는다.

### 1.3 본 SPEC의 범위 (In Scope)

- A. 역할별 온보딩: RA, Dev/QA, Exec, External 역할별 first task preset, localStorage → user profile 서버 상태 승격, onboarding 이벤트 audit/analytics 기록
- B. In-Product Feedback: 답변별 useful/not useful + reason taxonomy 수집, #35/#36 action 전환
- C. KPI Dashboard: WAU, answered-with-citation, unanswered rate, review turnaround, replay pass rate 등 PII-safe aggregate 지표
- D. Success Review Export: 주간 내부 리뷰용 Markdown/CSV export

### 1.4 Out of Scope

- 외부 고객 과금/CRM 분석
- 세션 리플레이 녹화 (screen recording)
- 개인별 생산성 평가 (individual productivity scoring)
- 외부 마케팅 analytics 연동

---

## §2 Requirements (EARS Format)

| ID | EARS Statement | Priority |
|----|---------------|----------|
| REQ-ADOPTION-001 | WHEN 사용자가 최초 로그인하면 THE SYSTEM SHALL 사용자 역할(RA/Dev-QA/Exec/External)에 맞는 onboarding flow를 표시해야 한다 | High |
| REQ-ADOPTION-002 | THE SYSTEM SHALL onboarding 상태(완료/스킵/진행중)를 user profile 기반 서버 상태로 영속 저장해야 한다 | High |
| REQ-ADOPTION-003 | WHEN onboarding이 완료/스킵/재시작되면 THE SYSTEM SHALL 해당 이벤트를 audit_logs와 analytics에 기록해야 한다 | High |
| REQ-ADOPTION-004 | THE SYSTEM SHALL 각 역할별 first task preset을 제공하여 사용자가 첫 작업을 즉시 시작할 수 있게 해야 한다 | High |
| REQ-ADOPTION-005 | WHEN 사용자가 답변에 대해 useful/not useful을 선택하면 THE SYSTEM SHALL 해당 피드백을 답변 ID와 함께 저장해야 한다 | High |
| REQ-ADOPTION-006 | WHEN not useful 피드백이 제출되면 THE SYSTEM SHALL reason taxonomy(citation missing/outdated source/unclear answer/workflow too slow/needs expert review) 선택을 요청해야 한다 | High |
| REQ-ADOPTION-007 | WHERE 피드백이 citation/source 관련일 경우 THE SYSTEM SHALL 해당 피드백을 #35 Knowledge Gap Ops action으로 전환 가능하게 해야 한다 | Medium |
| REQ-ADOPTION-008 | WHERE 피드백이 expert review 관련일 경우 THE SYSTEM SHALL 해당 피드백을 #36 Review Ops action으로 전환 가능하게 해야 한다 | Medium |
| REQ-ADOPTION-009 | THE SYSTEM SHALL KPI 대시보드에 WAU, answered-with-citation rate, unanswered rate, review turnaround, replay pass rate를 표시해야 한다 | High |
| REQ-ADOPTION-010 | THE SYSTEM SHALL time-to-first-cited-answer, expert review SLA, knowledge gap resolution time 지표를 집계해야 한다 | Medium |
| REQ-ADOPTION-011 | THE SYSTEM SHALL 모든 KPI 및 analytics 데이터를 PII-safe aggregate 형태로만 저장해야 한다 | High |
| REQ-ADOPTION-012 | THE SYSTEM SHALL NOT 개인별 식별 가능한 생산성 점수를 저장하거나 표시해야 한다 | High |
| REQ-ADOPTION-013 | WHEN 주간 success review export가 요청되면 THE SYSTEM SHALL Markdown 및 CSV 형식으로 unresolved gap, high-value topics, failing eval scenario를 묶어 생성해야 한다 | Medium |
| REQ-ADOPTION-014 | IF KPI 대시보드 접근 권한이 없는 사용자가 요청하면 THEN THE SYSTEM SHALL 접근을 거부하고 audit_logs에 기록해야 한다 | High |

---

## §3 Acceptance Criteria

| AC# | Criterion | Verification |
|-----|-----------|-------------|
| AC-01 | 최초 로그인 시 역할별 onboarding flow가 표시되고 first task preset이 제공됨 | E2E: 4개 역할 계정으로 로그인 후 각 preset 노출 확인 |
| AC-02 | onboarding 상태가 user profile에 서버 저장되어 기기 변경 후에도 유지됨 | Integration: 상태 저장 후 다른 세션에서 조회 |
| AC-03 | onboarding 완료/스킵/재시작 이벤트가 audit_logs에 기록됨 | DB 조회: audit_logs에 해당 action row 존재 확인 |
| AC-04 | 답변별 feedback이 reason taxonomy와 함께 저장됨 | Integration: feedback 제출 후 DB row + reason 분류 검증 |
| AC-05 | citation/expert 관련 feedback이 #35 또는 #36 action으로 전환됨 | Integration: 전환 API 호출 후 대상 큐에 항목 생성 확인 |
| AC-06 | KPI 대시보드가 PII-safe aggregate 지표만 표시함 | 수동 QA + 코드 리뷰: 개인 식별자 미포함 검증 |
| AC-07 | 권한 없는 사용자의 KPI 접근이 차단되고 audit에 기록됨 | E2E: External 계정으로 대시보드 접근 시 403 + audit row |
| AC-08 | 주간 success review가 Markdown 및 CSV로 export됨 | Integration: export 실행 후 두 형식 파일 생성 및 내용 검증 |

---

## §4 Technical Approach

### 4.1 파일 구조

```
src/
  app/
    api/
      onboarding/route.ts          # onboarding 상태 저장/조회
      feedback/route.ts            # 답변 피드백 수집
      feedback/convert/route.ts    # #35/#36 action 전환
      kpi/route.ts                 # KPI aggregate 조회
      success-review/export/route.ts
    (dashboard)/
      onboarding/page.tsx          # 역할별 onboarding UI
      kpi/page.tsx                 # KPI 대시보드
  lib/
    onboarding/role-presets.ts     # 역할별 first task preset 정의
    feedback/taxonomy.ts           # reason taxonomy 상수
    kpi/aggregator.ts              # PII-safe aggregate 계산
    kpi/success-review.ts          # Markdown/CSV export
  db/
    schema/onboarding.ts
    schema/feedback.ts
    schema/kpi-snapshots.ts
```

### 4.2 DB Schema

- `user_onboarding`: user_id (FK), role, status (completed/skipped/in_progress), completed_steps (jsonb), updated_at
- `answer_feedback`: id, answer_id (FK), user_id (FK), useful (boolean), reason_code (enum: citation_missing/outdated_source/unclear_answer/workflow_too_slow/needs_expert_review), comment (text, nullable), converted_to (enum: knowledge_gap/review_ops/null), created_at
- `kpi_snapshots`: id, period_start, period_end, metric_key, metric_value (numeric), aggregate_only (boolean, default true), created_at
- `audit_logs` (기존): onboarding 및 feedback 전환 이벤트 추가 기록

### 4.3 API Endpoints

- `GET/PUT /api/onboarding` — 역할별 onboarding 상태 조회/갱신
- `POST /api/feedback` — 답변 피드백 제출 (useful + reason_code)
- `POST /api/feedback/convert` — #35 Knowledge Gap 또는 #36 Review Ops로 전환
- `GET /api/kpi` — PII-safe aggregate KPI 조회 (RBAC: RA/Exec 한정)
- `POST /api/success-review/export` — Markdown/CSV export 생성

### 4.4 의존성

- 선행: SPEC-REGULA-FOUNDATION-001 (auth, audit_logs, user profile), SPEC-REGULA-BREADTH-001, SPEC-REGULA-ENTERPRISE-001
- 연계: #35 Knowledge Gap Ops, #36 Review Ops (feedback 전환 대상)
- 기술: Next.js 15 App Router, Auth.js v5 (역할/RBAC), Drizzle ORM, PostgreSQL
