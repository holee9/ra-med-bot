---
id: SPEC-REGULA-SOURCE-GOVERNANCE-001
version: 1.0.0
status: completed
phase: wave3
priority: High
created: 2026-06-22
updated: 2026-06-22
author: manager-spec (batch-2026-06-22)
issue_number: 48
depends_on:
  - SPEC-REGULA-FOUNDATION-001
  - SPEC-REGULA-CHAT-001
  - SPEC-REGULA-DOCINGEST-001
  - SPEC-REGULA-KNOWLEDGE-GAP-001
lifecycle_level: spec-anchored
labels:
  - component/backend
  - component/rag
  - component/governance
---

# SPEC-REGULA-SOURCE-GOVERNANCE-001 — 규제·SOP 출처 권위도·버전·유효일·폐기 상태 관리

## HISTORY

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0.0 | 2026-06-22 | manager-spec (batch) | 초기 작성. Issue #48 기반. |

---

## §1 Purpose (목적)

### 1.1 배경 (Background)

Delta Sync(#45)가 코퍼스를 최신화하더라도, RA 업무에서는 단순 최신화만으로는 충분하지 않다. RA 답변과 제출 문서는 유효한 출처, 올바른 버전, 적용 가능한 관할권(jurisdiction), 폐기되지 않은 문서를 근거로 삼아야 한다. 최신 문서라도 권위도가 낮거나, 이미 superseded된 버전이거나, 적용 관할권이 다르면 RA 산출물의 근거로 부적합하다.

규제 기관 공식 문서, 조화된 표준(harmonized standard), 내부 SOP, 과거 제출물, 공개 데이터베이스, 2차 참고자료는 서로 권위도가 다르다. 동일한 주제에 대해 여러 출처가 검색될 때, 시스템은 권위도가 높고 유효한 출처를 우선해야 하며 폐기된 출처를 근거로 삼아서는 안 된다.

본 SPEC은 Regula의 모든 RAG/워크플로우 산출물이 출처 품질 정책을 통과하도록 만드는 source governance SPEC이다. Source Authority Model, Retrieval Policy Gate, Source Review Workflow, Governance Dashboard의 4개 축을 구현하여 출처의 권위도·버전·유효일·폐기 상태를 통제한다.

특히 draft 작성 및 export 단계에서 stale source citation을 차단하여, 규제 제출물이 유효하지 않은 근거로 작성되는 것을 원천 방지한다.

### 1.2 규제 근거 (Regulatory Anchor)

- ISO 13485 및 21 CFR Part 820의 문서 통제(Document Control) 요구사항은 유효 버전 관리, 폐기 문서 식별, 승인 상태 관리를 의무화한다. 본 SPEC의 source authority/version/sunset 관리가 이를 디지털로 구현한다.
- RA 제출물은 적용 관할권의 현행 규제(예: FDA 21 CFR, EU MDR, 식약처 고시)를 근거로 해야 하며, superseded된 규정 인용은 제출 거부 사유가 될 수 있다.
- 내부 SOP는 승인된(approved) 상태이고 담당 부서(owner department)가 명시되어야 품질 시스템 근거로 인정된다.

### 1.3 본 SPEC의 범위 (In Scope)

- Source Authority Model: 6단계 권위 등급 + jurisdiction/effective_date/sunset_date/superseded_by/owner/review_cycle 필드 관리
- 내부 SOP의 owner department 및 approval status 필수화
- Retrieval Policy Gate: 권위 우선 검색, superseded 기본 제외, stale citation 차단, 저권위 출처 시 expert review
- Source Review Workflow: pending_review 상태, 변경 영향 표시, periodic review 알림
- Governance Dashboard: approved/pending/stale/superseded count, review due 목록, stale citation 포함 산출물 목록
- Delta Sync(#45) 결과와 source governance 상태 연동

### 1.4 Out of Scope

- 유료 표준 원문 자동 구매/라이선스 관리
- 외부 QMS(Quality Management System) master data 동기화
- 법무 검토 워크플로우
- 출처 권위 등급의 자동 추론 (RA owner가 명시적으로 설정하는 것을 전제)

---

## §2 Requirements (EARS Format)

### REQ-SOURCE-GOV: 권위 모델·검색 정책·리뷰·대시보드

| ID | EARS Statement | Priority |
|----|---------------|----------|
| REQ-SOURCE-GOV-001 | THE SYSTEM SHALL 각 source에 대해 authority 등급(regulator official, harmonized standard, internal SOP, prior submission, public database, secondary reference)을 저장한다 | High |
| REQ-SOURCE-GOV-002 | THE SYSTEM SHALL 각 source에 jurisdiction, effective_date, sunset_date, superseded_by, owner, review_cycle 필드를 관리한다 | High |
| REQ-SOURCE-GOV-003 | WHERE source가 internal SOP일 때 THE SYSTEM SHALL owner department와 approval status를 필수로 요구한다 | High |
| REQ-SOURCE-GOV-004 | WHEN 검색을 수행할 때 THE SYSTEM SHALL regulator official과 internal approved SOP를 우선 순위로 검색한다 | High |
| REQ-SOURCE-GOV-005 | WHEN 일반 질의를 검색할 때 THE SYSTEM SHALL superseded source를 기본 검색 대상에서 제외한다 | High |
| REQ-SOURCE-GOV-006 | WHERE 질의가 historical question으로 명시될 때 THE SYSTEM SHALL superseded source 검색을 허용한다 | Medium |
| REQ-SOURCE-GOV-007 | WHEN draft 작성 또는 export 단계가 진행될 때 THE SYSTEM SHALL stale source citation을 차단한다 | High |
| REQ-SOURCE-GOV-008 | IF 검색 결과가 authority 등급이 낮은 출처만 포함하면 THEN THE SYSTEM SHALL expert review required로 표시한다 | High |
| REQ-SOURCE-GOV-009 | WHEN 새 source가 ingestion될 때 THE SYSTEM SHALL RA owner approval 전까지 해당 source를 `pending_review` 상태로 둔다 | High |
| REQ-SOURCE-GOV-010 | WHEN source가 변경될 때 THE SYSTEM SHALL 관련 knowledge gap, eval scenario, submission package에 영향을 표시한다 | High |
| REQ-SOURCE-GOV-011 | WHEN source의 review_cycle 기한이 도래할 때 THE SYSTEM SHALL source owner에게 periodic review 알림을 발송한다 | Medium |
| REQ-SOURCE-GOV-012 | THE SYSTEM SHALL governance dashboard에서 corpus별 approved/pending/stale/superseded count를 표시한다 | High |
| REQ-SOURCE-GOV-013 | THE SYSTEM SHALL 30일 내 review due인 source 목록을 dashboard에 표시한다 | Medium |
| REQ-SOURCE-GOV-014 | THE SYSTEM SHALL stale citation이 포함된 answer/draft/package 목록을 dashboard에 표시한다 | High |
| REQ-SOURCE-GOV-015 | WHEN source approval workflow가 진행될 때 THE SYSTEM SHALL 승인/반려 이벤트를 audit_logs에 기록한다 | High |
| REQ-SOURCE-GOV-016 | WHEN #45 delta sync가 완료될 때 THE SYSTEM SHALL sync 결과에 따라 source governance 상태(effective_date, supersession 등)를 갱신한다 | High |

---

## §3 Acceptance Criteria

| AC# | Criterion | Verification |
|-----|-----------|-------------|
| AC-01 | source authority 등급, effective_date, sunset_date, superseded_by 상태가 저장되고 조회된다 | Test |
| AC-02 | superseded source가 일반 검색에서 제외되고, historical question일 때만 포함된다 | Test |
| AC-03 | stale citation을 포함한 draft/export 시도가 차단되고 사유가 사용자에게 표시된다 | Test |
| AC-04 | internal SOP가 owner department/approval status 없이 ingestion되면 pending_review로 강제되고 검색에서 제외된다 | Test |
| AC-05 | source approval/반려 이벤트가 audit_logs에 기록된다 | Test |
| AC-06 | governance dashboard가 corpus별 approved/pending/stale/superseded count와 30일 내 review due 목록을 표시한다 | Test / Review |
| AC-07 | #45 delta sync 완료 후 source governance 상태가 갱신된다 | Test |
| AC-08 | 저권위 출처만 검색된 답변에 expert review required 플래그가 부여된다 | Test |

---

## §4 Technical Approach

### 4.1 파일 구조

- `lib/db/schema/source-governance.ts` — source authority/version 스키마
- `lib/source-governance/authority-model.ts` — 권위 등급 정의 및 평가
- `lib/source-governance/retrieval-gate.ts` — 검색 정책 게이트 (우선순위, superseded 제외, stale 차단)
- `lib/source-governance/review-workflow.ts` — pending_review 상태 관리, 영향 표시
- `lib/source-governance/review-notifier.ts` — periodic review 알림
- `app/api/source-governance/approve/route.ts` — source 승인 API
- `app/(app)/governance/page.tsx` — Governance Dashboard UI
- `lib/source-governance/delta-sync-hook.ts` — #45 delta sync 연동

### 4.2 DB Schema

- 신규/확장 테이블 `sources` (또는 기존 source 테이블 확장): authority_grade(enum), jurisdiction, effective_date, sunset_date, superseded_by(self-ref), owner, owner_department, approval_status(enum: pending_review/approved/rejected), review_cycle, last_reviewed_at
- citation/source_sections 연결 테이블에 source governance 상태 참조 추가
- audit_logs 활용: 신규 action `source_approved`, `source_rejected`, `source_review_due`, `source_superseded`

### 4.3 API Endpoints

- `POST /api/source-governance/approve` — source 승인/반려 (RBAC: ra-owner/admin)
- `GET /api/source-governance/dashboard` — governance dashboard 데이터
- `GET /api/source-governance/review-due` — review due source 목록
- retrieval 파이프라인 내부 통합: Retrieval Policy Gate 미들웨어

### 4.4 의존성

- 기존 SPEC: SPEC-REGULA-FOUNDATION-001(audit_logs, RBAC), SPEC-REGULA-DOCINGEST-001(ingestion 시 source 등록), SPEC-REGULA-CHAT-001(retrieval/citation), SPEC-REGULA-KNOWLEDGE-GAP-001(#35, source 변경 시 knowledge gap 영향)
- 외부 이슈 의존: #45 Delta Sync(governance 상태 갱신 트리거), #47 Traceability(submission package 영향)
- 외부: 알림 채널(periodic review)
