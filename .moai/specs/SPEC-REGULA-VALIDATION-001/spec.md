---
id: SPEC-REGULA-VALIDATION-001
version: 1.0.0
status: draft
phase: system
priority: High
created: 2026-06-22
updated: 2026-06-22
author: manager-spec (batch-2026-06-22)
issue_number: 49
depends_on:
  - SPEC-REGULA-FOUNDATION-001
  - SPEC-REGULA-RELEASE-001
lifecycle_level: spec-anchored
labels:
  - component/backend
  - component/infra
---

# SPEC-REGULA-VALIDATION-001 — Regula 자체 검증 패키지 (IQ/OQ/PQ·변경통제·릴리즈 증거)

## HISTORY

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0.0 | 2026-06-22 | manager-spec (batch) | 초기 작성. Issue #49 기반. |

---

## §1 Purpose (목적)

### 1.1 배경 (Background)

Regula가 RA 의사결정, 제출 초안, 위험관리, 검토 승인에 사용된다면 Regula 자체도 검증 가능한(validated) 업무 시스템이어야 한다. 기능 이슈들은 제품 기능을 완성하지만, 운영 관점에서는 릴리즈마다 무엇이 검증됐고 어떤 제한 조건으로 사용 가능한지를 증거로 남겨야 한다.

본 SPEC은 내부용 CSV-lite 수준의 IQ/OQ/PQ(Installation/Operational/Performance Qualification) 기반 Regula system validation package를 정의한다. 이는 외부 인증 대행이나 FDA 제출용 소프트웨어 validation이 아니라, 내부 거버넌스를 위한 검증 증거 체계다.

검증 증거는 사람이 수기로 정리하는 것이 아니라 commit SHA, CI run, test command, artifact path를 자동 수집하여 신뢰 가능한 release validation report로 묶는다.

변경통제(change control)는 source policy, prompt, model, schema, retrieval, export, review workflow 변경의 영향을 평가하고, high-impact change에는 validation rerun을 강제한다.

### 1.2 규제 근거 (Regulatory Anchor)

- GAMP 5 / CSV (Computerized System Validation) — IQ/OQ/PQ 단계별 검증 증거 체계.
- 21 CFR Part 11 — validation sign-off는 electronic record로 audit_logs에 기록되어야 한다.
- ISO 13485 §4.1.6 — 소프트웨어 validation 및 변경통제 요구.

### 1.3 본 SPEC의 범위 (In Scope)

- A. Intended Use & Validation Scope: intended/prohibited use, human review boundary 문서화, 기능별 validation criticality 분류
- B. IQ/OQ/PQ Evidence: 환경/dependency/migration/config/secret 검증(IQ), core function requirement test(OQ), 대표 RA 시나리오 E2E evidence(PQ)
- C. Change Control: 릴리즈별 변경 영향 평가, high-impact change validation rerun, exception/residual risk 기록
- D. Release Validation Report: 릴리즈 결과 연결, traceability/source governance/review ops 상태 포함, final sign-off checklist

### 1.4 Out of Scope

- 외부 인증기관 검증 대행
- SOC 2 / ISO 27001 full certification
- FDA 제출용 소프트웨어 validation 패키지

---

## §2 Requirements (EARS Format)

| ID | EARS Statement | Priority |
|----|---------------|----------|
| REQ-VALIDATION-001 | THE SYSTEM SHALL Regula의 intended use, prohibited use, human review boundary를 문서로 관리해야 한다 | High |
| REQ-VALIDATION-002 | THE SYSTEM SHALL 각 기능(chat/RAG/workflow draft/review/submission package/risk management)에 validation criticality 등급을 분류해야 한다 | High |
| REQ-VALIDATION-003 | WHEN IQ가 실행되면 THE SYSTEM SHALL 환경, dependency, migration, config, secret presence를 검증하고 결과를 기록해야 한다 | High |
| REQ-VALIDATION-004 | WHEN OQ가 실행되면 THE SYSTEM SHALL core function requirement test 결과를 evidence bundle로 묶어야 한다 | High |
| REQ-VALIDATION-005 | WHEN PQ가 실행되면 THE SYSTEM SHALL 대표 RA 시나리오의 end-to-end evidence를 묶어야 한다 | High |
| REQ-VALIDATION-006 | THE SYSTEM SHALL 각 evidence에 commit SHA, CI run ID, test command, artifact path를 포함해야 한다 | High |
| REQ-VALIDATION-007 | WHEN 릴리즈가 준비되면 THE SYSTEM SHALL source policy/prompt/model/schema/retrieval/export/review workflow 변경 영향 평가를 생성해야 한다 | High |
| REQ-VALIDATION-008 | IF 변경이 high-impact로 분류되면 THEN THE SYSTEM SHALL validation rerun을 필수 조건으로 강제해야 한다 | High |
| REQ-VALIDATION-009 | THE SYSTEM SHALL validation exception과 residual risk를 기록해야 한다 | Medium |
| REQ-VALIDATION-010 | THE SYSTEM SHALL release validation report에 release/traceability/source governance/review ops 상태를 연결해야 한다 | High |
| REQ-VALIDATION-011 | WHEN release validation report가 export되면 THE SYSTEM SHALL Markdown 및 PDF 형식으로 생성해야 한다 | Medium |
| REQ-VALIDATION-012 | WHEN validation이 sign-off되면 THE SYSTEM SHALL 승인자, 타임스탬프를 audit_logs에 기록해야 한다 | High |
| REQ-VALIDATION-013 | IF final sign-off checklist 항목이 미충족이면 THEN THE SYSTEM SHALL release sign-off를 차단해야 한다 | High |
| REQ-VALIDATION-014 | THE SYSTEM SHALL CI/test/eval 결과를 validation report에 자동으로 링크해야 한다 | High |

---

## §3 Acceptance Criteria

| AC# | Criterion | Verification |
|-----|-----------|-------------|
| AC-01 | intended use / prohibited use 문서가 생성되고 버전 관리됨 | 문서 존재 + git history 확인 |
| AC-02 | IQ/OQ/PQ evidence template과 자동 수집 스크립트가 동작함 | 스크립트 실행 후 evidence bundle 생성 확인 |
| AC-03 | CI/test/eval 결과가 validation report에 링크됨 | report 내 CI run ID/artifact path 검증 |
| AC-04 | prompt/model/source/schema 변경 시 impact assessment가 생성됨 | 변경 시뮬레이션 후 assessment 문서 자동 생성 |
| AC-05 | release validation report가 Markdown 및 PDF로 export됨 | export 실행 후 두 형식 파일 생성 검증 |
| AC-06 | validation sign-off가 audit_logs에 승인자/타임스탬프로 기록됨 | DB 조회: audit_logs sign-off row 확인 |
| AC-07 | final sign-off checklist 미충족 시 release가 차단됨 | Integration: 미충족 상태에서 sign-off 시도 시 거부 |

---

## §4 Technical Approach

### 4.1 파일 구조

```
src/
  app/api/
    validation/iq/route.ts
    validation/oq/route.ts
    validation/pq/route.ts
    validation/impact-assessment/route.ts
    validation/report/export/route.ts
    validation/signoff/route.ts
  lib/
    validation/criticality.ts        # 기능별 criticality 분류
    validation/evidence-collector.ts # commit SHA/CI run/artifact 수집
    validation/change-control.ts     # 변경 영향 평가
    validation/report-builder.ts     # Markdown/PDF report 생성
  db/schema/
    validation-evidence.ts
    change-control.ts
    validation-signoff.ts
scripts/
  collect-validation-evidence.ts     # CI 연동 자동 수집
docs/validation/
  intended-use.md
```

### 4.2 DB Schema

- `validation_evidence`: id, qualification_type (enum: IQ/OQ/PQ), commit_sha, ci_run_id, test_command, artifact_path, result (enum: pass/fail/skip), created_at
- `change_control`: id, release_id, change_axis (enum: source_policy/prompt/model/schema/retrieval/export/review_workflow), impact_level (enum: low/medium/high), rerun_required (boolean), residual_risk (text), exception_note (text, nullable), created_at
- `validation_signoff`: id, release_id, checklist_state (jsonb), approver_id (FK), signed_at, report_artifact_path
- `audit_logs` (기존): sign-off 이벤트 기록

### 4.3 API Endpoints

- `POST /api/validation/iq|oq|pq` — qualification 실행 및 evidence 수집
- `POST /api/validation/impact-assessment` — 변경 영향 평가 생성
- `POST /api/validation/report/export` — Markdown/PDF report export
- `POST /api/validation/signoff` — final sign-off (checklist gate 적용)

### 4.4 의존성

- 선행: SPEC-REGULA-FOUNDATION-001 (audit_logs, RBAC), SPEC-REGULA-RELEASE-001 (release scope SSoT)
- 연계: #31~#34 Release, #47 Traceability, #48 Source Governance, #36 Review Ops
- 기술: Next.js 15, Drizzle ORM, PostgreSQL, CI (GitHub Actions) 연동, promptfoo eval 결과 연결
