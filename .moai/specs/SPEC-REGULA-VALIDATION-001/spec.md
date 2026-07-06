---
id: SPEC-REGULA-VALIDATION-001
title: "Regula 자체 검증 패키지 — IQ/OQ/PQ·변경통제·릴리즈 증거"
version: 1.1.0
status: planned
phase: system-validation
priority: High
created: 2026-06-22
updated: 2026-07-06
author: manager-spec (plan-phase completion)
issue_number: 49
depends_on:
  - SPEC-REGULA-FOUNDATION-001
  - SPEC-REGULA-RELEASE-001
  - SPEC-REGULA-TRACEABILITY-001
  - SPEC-V3-AUDIT-CHAIN-001
related_specs:
  - SPEC-REGULA-MODEL-GOVERNANCE-001
  - SPEC-REGULA-SOURCE-GOVERNANCE-001
  - SPEC-REGULA-REVIEW-OPS-001
closes_issues: []
verifies_specs:
  - SPEC-REGULA-RELEASE-001
lifecycle_level: spec-anchored
labels:
  - component/backend
  - component/infra
  - csv-lite
  - iqqpq
  - change-control
revision_history:
  - version: 1.1.0
    date: 2026-07-06
    author: manager-spec (plan-phase)
    notes: "plan-phase 완료. status draft→planned. depends_on 보강 (TRACEABILITY, AUDIT-CHAIN). EARS 구문 정비 (한영 혼용→영문 EARS). 4-doc 셋 완성 (research/plan/acceptance 추가). CSV-lite 원칙 명시 (§1.5). #71 MODEL-GOVERNANCE와의 경계 §3.2 명확화. audit-chain foundation (PR #356) 활용."
  - version: 1.0.0
    date: 2026-06-22
    author: manager-spec (batch)
    notes: "초기 작성. Issue #49 기반."
---

# SPEC-REGULA-VALIDATION-001 — Regula 자체 검증 패키지 (IQ/OQ/PQ·변경통제·릴리즈 증거)

## HISTORY

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.1.0 | 2026-07-06 | manager-spec (plan-phase) | plan-phase 완료. 4-doc 셋 완성. EARS 정비. AUDIT-CHAIN·TRACEABILITY 의존성 추가. CSV-lite 원칙·경계 명시. |
| 1.0.0 | 2026-06-22 | manager-spec (batch) | 초기 작성. Issue #49 기반. |

---

## §1 Purpose (목적)

### 1.1 배경 (Background)

Regula가 RA 의사결정, 제출 초안, 위험관리, 검토 승인에 사용된다면 Regula 자체도 검증 가능한(validated) 업무 시스템이어야 한다. #31~#46은 제품 기능을 완성하지만, 운영 관점에서는 **릴리즈마다 무엇이 검증됐고 어떤 제한 조건으로 사용 가능한지**를 증거로 남겨야 한다.

본 SPEC은 내부용 **CSV-lite** 수준의 IQ/OQ/PQ(Installation/Operational/Performance Qualification) 기반 Regula system validation package를 정의한다. 이는 외부 인증 대행이나 FDA 제출용 소프트웨어 validation이 아니라, 내부 거버넌스를 위한 검증 증거 체계다.

검증 증거는 사람이 수기로 정리하는 것이 아니라 **commit SHA, CI run ID, test command, artifact path**를 자동 수집하여 신뢰 가능한 release validation report로 묶는다.

변경통제(change control)는 source policy, prompt, model, schema, retrieval, export, review workflow 변경의 영향을 평가하고, high-impact change에는 validation rerun을 강제한다.

### 1.2 규제 근거 (Regulatory Anchor)

- **GAMP 5 / CSV (Computerized System Validation)** — IQ/OQ/PQ 단계별 검증 증거 체계.
- **21 CFR Part 11 §11.10(i)** — 컴퓨터 시스템 검증 문서화; **§11.50 / §11.70** — 전자기록 서명자·타임스탬프, e-signature binding (audit-chain foundation PR #356이 tamper-evidence 담당).
- **ISO 13485:2016 §4.1.6** — 소프트웨어 validation 및 변경통제 요구.
- **ISO 14971:2019** — 잔여 위험(residual risk) 기록 요구 (change control과 연계).

### 1.3 본 SPEC의 범위 (In Scope)

- **A. Intended Use & Validation Scope**: intended/prohibited use, human review boundary 문서화, 기능별 validation criticality 분류
- **B. IQ/OQ/PQ Evidence**:
  - IQ — 환경/dependency/migration/config/secret presence 검증 번들 (기존 `scripts/validate-runtime-env.ts`, `pnpm ci:migrations`, `pnpm install --frozen-lockfile` 결과 집계)
  - OQ — core function requirement test 결과 번들 (기존 `pnpm ci:test`, `pnpm ci:rbac`, `pnpm ci:audit` 집계)
  - PQ — 대표 RA 시나리오 end-to-end evidence 번들 (기존 `.github/workflows/e2e.yml`, `tests/eval/promptfoo.config.yaml` 집계)
- **C. Change Control**: 릴리즈별 변경 영향 평가 (7축: source_policy/prompt/model/schema/retrieval/export/review_workflow), high-impact → validation rerun, residual risk 기록
- **D. Release Validation Report**: 릴리즈 결과 연결 (#31~#34), traceability (#47), source governance (#48), review ops (#36) 상태 포함, final sign-off checklist

### 1.4 Out of Scope (Non-Goals)

- 외부 인증기관 검증 대행 (SOC 2 / ISO 27001 / FDA 510(k) software validation)
- Full QMS (Quality Management System) 워크플로우 — 본 SPEC은 CSV-lite 내부 거버넌스 범위
- `audit_logs` hash chain 자체 구현 (PR #356 SPEC-V3-AUDIT-CHAIN-001이 담당; 본 SPEC은 chain에 write하는 소비자)
- LLM/prompt 변경관리 워크플로우 자체 (Issue #71 / SPEC-REGULA-MODEL-GOVERNANCE-001이 담당; 본 SPEC은 결과를 7축 중 하나로 집계)
- 외부 e-QMS 양방향 동기화

### 1.5 CSV-Lite 원칙 (Over-Engineering 방지)

Charter [지양-5]에 따라 본 SPEC은 다음을 금지한다:

- **금지**: 새로운 테스트 harness/프레임워크 도입 — 기존 CI(`.github/workflows/ci.yml`, `e2e.yml`, `security.yml`) 결과를 집계
- **금지**: 독자적 QMS 워크플로우 — 기존 `lib/model-governance/`, `lib/audit/` 재사용
- **금지**: 수기 문서 작성 — 모든 evidence는 commit SHA + CI run ID로 자동 수집
- **금지**: PDF 전용 외부 라이브러리 (Pandoc/PrinceXML) 도입 — Markdown 우선, PDF는 post-v0.1 후순위 (REQ-VAL-011 Optional)

---

## §2 Intended Use (제품 사용 범위 선언)

### 2.1 Intended Use (허용 사용)

Regula는 다음 용도로 사용된다:

1. RA 전문가의 의사결정 보조 (chat, RAG 기반 인용 응답)
2. 규제 전략·제출 초안 작성 보조 (workflow drafts: 510(k), CER, PCCP)
3. 위험관리 문서화 보조 (risk register, FMEA)
4. 전문가 검토 워크벤치 (expert review, citation 추적)
5. 제출 패키지 증거 묶음 (submission packaging)

### 2.2 Prohibited Use (금지 사용)

1. 자율 규제 의사결정 (human review 없는 최종 판단 금지)
2. 의료 진단·치료 권고
3. 환자 식별정보(PII/PHI) 처리 (SPEC-REGULA-PHI-REMOVAL-001 준수 전제)
4. FDA/EMA 등 규제 당국 직접 제출 (사람의 최종 검토·승인 필수)

### 2.3 Human Review Boundary

- 모든 RA claim은 citation과 reviewer sign-off 없이 제출 불가
- 자동 생성 draft는 human review 게이트 통과 후에만 export
- 검토자 책임은 SPEC-REGULA-REVIEW-OPS-001 (#36)에 정의

---

## §3 Requirements (EARS Format)

### 3.1 Requirements 매트릭스

| ID | Pattern | EARS Statement | Priority |
|----|---------|----------------|----------|
| REQ-VAL-001 | Ubiquitous | The system **shall** maintain a version-controlled `intended-use.md` document declaring intended use, prohibited use, and human review boundary (§2). | High |
| REQ-VAL-002 | Ubiquitous | The system **shall** classify each functional capability (chat, RAG, workflow draft, review, submission package, risk management) with a validation criticality tier (critical / support / ancillary). | High |
| REQ-VAL-003 | Event-Driven | **When** a release is prepared, the system **shall** produce an IQ (Installation Qualification) evidence bundle aggregating environment, dependency, migration, config, and secret-presence verification results. | High |
| REQ-VAL-004 | Event-Driven | **When** a release is prepared, the system **shall** produce an OQ (Operational Qualification) evidence bundle linking the `pnpm ci:test`, `pnpm ci:rbac`, and `pnpm ci:audit` CI run results. | High |
| REQ-VAL-005 | Event-Driven | **When** a release is prepared, the system **shall** produce a PQ (Performance Qualification) evidence bundle linking the `.github/workflows/e2e.yml` scenario results and `tests/eval/promptfoo.config.yaml` eval output. | High |
| REQ-VAL-006 | Ubiquitous | The system **shall** attach to every evidence record: `commit_sha`, `ci_run_id`, `test_command`, `artifact_path`, and `result` (pass/fail/skip). | High |
| REQ-VAL-007 | Event-Driven | **When** a release is prepared, the system **shall** generate a change-impact assessment covering the 7 axes (source_policy, prompt, model, schema, retrieval, export, review_workflow). | High |
| REQ-VAL-008 | Unwanted | **If** any change axis is classified `high-impact` and validation rerun evidence is absent, **then** the system **shall** block release sign-off. | High |
| REQ-VAL-009 | Ubiquitous | The system **shall** record residual risk and validation exception notes for every high-impact change with explicit justification. | Medium |
| REQ-VAL-010 | Ubiquitous | The system **shall** emit a Release Validation Report linking release scope (#31~#34), traceability status (#47 / SPEC-REGULA-TRACEABILITY-001), source governance status (#48), and review ops status (#36). | High |
| REQ-VAL-011 | Optional | **Where** PDF export is requested, the system **shall** emit the Release Validation Report in both Markdown and PDF formats. | Low |
| REQ-VAL-012 | Event-Driven | **When** a validation sign-off is recorded, the system **shall** write an entry to `audit_logs` (hash-chained per SPEC-V3-AUDIT-CHAIN-001) containing approver id, timestamp, and report artifact path. | High |
| REQ-VAL-013 | Unwanted | **If** any final sign-off checklist item is unmet, **then** the system **shall** reject the sign-off request with HTTP 409 and surface the failed checklist items. | High |
| REQ-VAL-014 | Ubiquitous | The system **shall** auto-link CI/test/eval results to the validation report by CI run ID and artifact path without manual transcription. | High |

### 3.2 경계: SPEC-REGULA-MODEL-GOVERNANCE-001 (#71)과의 분담

| 소유권 | SPEC | 책임 |
|--------|------|------|
| MODEL-GOVERNANCE (#71) | LLM model registry, prompt versioning, eval gate enforcement, rollback procedure 자체 |
| VALIDATION (본 SPEC, #49) | 릴리즈 시점 impact assessment의 7축 중 하나로 MODEL-GOVERNANCE change record를 **소비** |
| SOURCE-GOVERNANCE (#48) | source authority, version, effective date 관리 자체 |
| VALIDATION (본 SPEC, #49) | 릴리즈 시점 source_policy 축의 변경여부 판단을 위해 SOURCE-GOVERNANCE 상태를 **참조** |

본 SPEC은 중복 구현을 금지하며, 기존 change-tracking 시스템의 결과를 집계하는 얇은(aggregator) 계층이다.

---

## §4 Technical Approach (Sketch)

> 상세는 `plan.md`와 `research.md` 참조. 본 절은 개요만.

### 4.1 증거 수집 재사용 맵 (Reuse Map)

| Evidence | 재사용 자산 | 신규 구현 |
|----------|------------|-----------|
| IQ env | `scripts/validate-runtime-env.ts` | bundle record 조립 |
| IQ deps | `pnpm install --frozen-lockfile` + `pnpm-lock.yaml` hash | lockfile hash 기록 |
| IQ migrations | `pnpm ci:migrations` (`scripts/ci/check-migrations.ts`) | 결과 메타데이터 저장 |
| IQ config/secret | `lib/env.ts` Zod 검증 + `.env.example` diff | 누락 키 목록 기록 |
| OQ unit/integration | `pnpm ci:test` (vitest), `pnpm ci:rbac`, `pnpm ci:audit` | CI run ID 매핑 |
| PQ E2E | `.github/workflows/e2e.yml` (smoke + full) | 시나리오별 artifact path |
| PQ eval | `tests/eval/promptfoo.config.yaml`, `pnpm eval:ci` | eval 결과 JSON 링크 |
| Change-control | `lib/model-governance/change-workflow.ts` + `git diff` classify | 7축 분류 + impact rating |
| Sign-off | `lib/audit.ts writeAudit` (hash chain, PR #356) | sign-off action type 추가 |
| Report | Markdown builder (신규, 경량) | PDF는 post-v0.1 |

### 4.2 DB Schema (신규 3 테이블, 마이그레이션 1건)

- `validation_evidence` (id, release_id, qualification_type enum[iq/oq/pq], commit_sha, ci_run_id, test_command, artifact_path, result enum[pass/fail/skip], metadata jsonb, created_at)
- `change_control` (id, release_id, change_axis enum[7], impact_level enum[low/medium/high], rerun_required boolean, residual_risk text, exception_note text null, evidence_ref uuid null, created_at)
- `validation_signoff` (id, release_id, checklist_state jsonb, approver_id fk users, signed_at, report_artifact_path, audit_log_ref uuid)

`audit_logs`는 기존 테이블 재사용 (hash chain 포함).

### 4.3 API Endpoints (최소 4종)

- `POST /api/validation/iq|oq|pq` — qualification 실행 및 evidence upsert
- `POST /api/validation/impact-assessment` — 변경 영향 평가 생성/갱신
- `POST /api/validation/report/export` — Markdown (PDF optional) report 생성
- `POST /api/validation/signoff` — final sign-off (checklist gate, audit_logs write)

### 4.4 RBAC

- `validation:run` — IQ/OQ/PQ 실행 (admin, qa_lead)
- `validation:approve` — sign-off (admin only)
- `validation:read` — report 열람 (admin, qa_lead, ra_lead)

---

## §5 Acceptance Criteria (요약)

> 상세는 `acceptance.md`. 요약:

| AC# | Criterion (binary-testable) |
|-----|-----|
| AC-1 | `docs/validation/intended-use.md` 존재 + git history 존재 |
| AC-2 | 릴리즈별 IQ evidence bundle이 DB에 존재 (5 필드 모두 non-null) |
| AC-3 | OQ evidence가 `ci_run_id`와 `pnpm ci:test` 결과 매핑 포함 |
| AC-4 | PQ evidence가 e2e.yml 시나리오 결과 + promptfoo eval 결과 링크 |
| AC-5 | high-impact change + rerun 미실시 상태에서 sign-off 시도 → HTTP 409 |
| AC-6 | Release Validation Report에 #31-34/#47/#48/#36 상태 섹션 존재 |
| AC-7 | sign-off 성공 시 `audit_logs` 행 1건 추가 (approver + timestamp + report path) |
| AC-8 | checklist 미충족 상태에서 sign-off → 409 + 실패 항목 목록 반환 |

---

## §6 의존성 (Dependencies)

### 6.1 선행 (Blocking)

- `SPEC-REGULA-FOUNDATION-001` — `audit_logs` 테이블, RBAC 기반
- `SPEC-REGULA-RELEASE-001` — release scope SSoT (§2.1) — 본 SPEC이 release_id를 참조
- `SPEC-REGULA-TRACEABILITY-001` (#47) — evidence graph 노드/엣지 (validation evidence가 노드 타입 중 하나로 연결)
- `SPEC-V3-AUDIT-CHAIN-001` (PR #356) — `audit_logs` hash chain (sign-off 무결성 기반)

### 6.2 연계 (Non-blocking, 참조)

- `SPEC-REGULA-MODEL-GOVERNANCE-001` (#71) — model/prompt change record (change-control 7축 중 model/prompt 소스)
- `SPEC-REGULA-SOURCE-GOVERNANCE-001` (#48) — source authority/version (change-control 7축 중 source_policy 소스)
- `SPEC-REGULA-REVIEW-OPS-001` (#36) — review SLA 상태 (Release Report에 참조)
- `.moai/specs/_shared/qa-gate-roadmap.md` — QA 게이트 0~5 SSoT (본 SPEC은 Gate 5 운영 QA 입력)

### 6.3 기술 스택

- Next.js 15 (App Router), Drizzle ORM, PostgreSQL
- CI: GitHub Actions (`.github/workflows/{ci,e2e,security,deploy}.yml`)
- eval: promptfoo (`tests/eval/`)
- audit: `lib/audit.ts` writeAudit (hash chain)

---

## §7 Risks (요약, 상세 plan.md §4)

| Risk | Impact | Mitigation |
|------|--------|-----------|
| CI run ID 매핑 실패 (artifact 만료) | OQ/PQ evidence 누락 | 만료 전 snapshot 시점에 즉시 수집; 만료 시 result=skip 기록 |
| Change-control 7축 자동 분류 정확도 | 위분류 → rerun 누락 | `lib/model-governance/change-workflow.ts` 기록 우선, `git diff` 휴리스틱은 보조 |
| PDF export 라이브러리 도입 범위 확장 | Charter [지양-5] 위반 | REQ-VAL-011을 Optional/Low로 강제, Markdown 우선 |
| audit_logs chain 실패 시 sign-off 블록 | sign-off 불가 | SPEC-V3-AUDIT-CHAIN-001 verifyDaily가 선행; 본 SPEC은 write 실패 시 500 + retry |

---

## §8 Exclusions (What NOT to Build)

> Charter [지양-5] 및 Issue #49 "내부용 CSV-lite" 원칙에 따른 제외 항목.

- **배제**: 외부 QMS 시스템(SAP, Veeva Vault, MasterControl) 연동
- **배제**: FDA 510(k) / CE / PMDA 공식 제출용 software validation 패키지
- **배제**: SOC 2 Type II / ISO 27001 인증 증거
- **배제**: 자체 PDF 렌더링 파이프라인 (Pandoc/PrinceXML/headless Chrome) — Markdown 우선, PDF는 post-v0.1 별도 SPEC
- **배제**: Real-time validation dashboard (별도 observability SPEC)
- **배제**: 다중 규제 관할권별 validation matrix (post-v0.1)
- **배제**: 사전 승인된 validation template 자동 생성 (사람이 작성하는 intended-use.md가 SSoT)
