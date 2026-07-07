---
id: SPEC-REGULA-VALIDATION-002
title: "Regula Validation 정식 연동 — Model-Gov / Traceability / Source-Gov / Release 통합"
version: 0.1.0
status: completed
phase: system-validation
priority: High
created: 2026-07-07
updated: 2026-07-07
author: manager-spec (plan-phase)
issue_number: null
depends_on:
  - SPEC-REGULA-VALIDATION-001
related_specs:
  - SPEC-REGULA-MODEL-GOVERNANCE-001
  - SPEC-REGULA-TRACEABILITY-001
  - SPEC-REGULA-SOURCE-GOVERNANCE-001
  - SPEC-REGULA-RELEASE-001
closes_issues: []
verifies_specs: []
lifecycle_level: spec-anchored
labels:
  - component/backend
  - csv-lite
  - iqqpq
  - change-control
  - integration
revision_history:
  - version: 0.1.0
    date: 2026-07-07
    author: manager-spec (plan-phase)
    notes: "초안 작성. VALIDATION-001 R2/R6/R7 리스크 해소 — 4개 선행 SPEC(#71/#47/#48/#31 모두 CLOSED)의 자산을 정식 소비. thin glue layer 원칙 유지 (Charter [지양-5]). release_registry 테이블은 RELEASE-002로 이월 (Exclusions §7)."
---

# SPEC-REGULA-VALIDATION-002 — Regula Validation 정식 연동

## HISTORY

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 0.1.0 | 2026-07-07 | manager-spec (plan-phase) | 초안. VALIDATION-001 fallback/stub → 정식 연동 전환. 12 EARS REQ. M0~M4 milestone. |

---

## §1 Purpose (목적)

### 1.1 배경 (Background)

SPEC-REGULA-VALIDATION-001 (#49, PR #359 머지)은 Regula 자체 검증 패키지
(IQ/OQ/PQ · 변경통제 · 릴리즈 증거)를 정의했으나, plan-phase 시점에 4개
선행 의존성이 "진행중"이었다. 현재 이들 의존성은 **모두 CLOSED** 상태다:

- **#71 SPEC-REGULA-MODEL-GOVERNANCE-001** — CLOSED (코드 구현 완료, SPEC 문서는 draft)
- **#47 SPEC-REGULA-TRACEABILITY-001** — CLOSED (status: completed)
- **#48 SPEC-REGULA-SOURCE-GOVERNANCE-001** — CLOSED (코드 구현 완료, SPEC 문서는 draft)
- **#31 SPEC-REGULA-RELEASE-001** — CLOSED (status: completed, 단 release lifecycle 테이블은 없음)

VALIDATION-001은 이들을 fallback/stub 모드로 소비했다 (plan.md §4 R2/R6/R7
리스크). 본 SPEC-VALIDATION-002는 이제 이들을 **정식 연동**으로 전환하여
검증 증거의 신뢰성을 높인다.

### 1.2 규제 근거 (Regulatory Anchor)

VALIDATION-001 §1.2를 그대로 계승한다:

- **GAMP 5 / CSV** — IQ/OQ/PQ 단계별 검증 증거 체계.
- **21 CFR Part 11 §11.10(i)** — 컴퓨터 시스템 검증 문서화.
- **ISO 13485:2016 §4.1.6** — 소프트웨어 validation 및 변경통제.
- **ISO 14971:2019** — 잔여 위험 기록.

본 SPEC은 추가로 **검증 증거의 추적성(traceability)**과 **변경 통제의 정밀도**
를 강화하여 위 규제 요구사항의 실질적 충족도를 높인다.

### 1.3 본 SPEC의 범위 (In Scope)

VALIDATION-001의 R2/R6/R7 리스크를 해소하는 4개 연동 영역:

- **A. R2 해소 — model/prompt 축 정식 연동** (M1)
  - `change_request` 조회를 window-scoped + org-scoped로 정밀화
  - `evalRunId` / `evalResultRef`를 `change_control.evidence_ref`에 연결
- **B. R2 확장 — source_policy 축 정식 연동** (M2)
  - 순수 git-diff heuristic을 `getGovernanceDashboard` snapshot 결합으로 강화
- **C. R6 해소 — report stub → 실데이터** (M3)
  - Release Scope Status (#31-34): evidence count + git tag
  - Traceability Status (#47): `buildMatrix` snapshot
  - Source Governance Status (#48): `getGovernanceDashboard` snapshot
  - Review Ops Status (#36): stub 유지 (OPEN, not implemented 사유 명시)
- **D. R7 해소 — release_id 정식 체계** (M4)
  - regex convention `^v\d+\.\d+\.\d+(-rc\d+)?$` 정의
  - git tag 교차 검증 (non-blocking warning)

### 1.4 Out of Scope (Non-Goals)

- **release_registry 테이블 도입** — Charter [지양-5] 준수; RELEASE-002 후속
  SPEC으로 이월 (Exclusions §7).
- **Review-Ops (#36) 정식 연동** — #36이 OPEN 상태이므로 stub 유지.
- **Traceability release-dim delta** — release 간 snapshot 비교 기능 (post-v0.1).
- **Source-gov snapshot-at-release 테이블** — cumulative snapshot 문자열 기록으로
  대체 (post-v0.1 테이블 도입 검토).
- **PDF report** — VALIDATION-001 REQ-VAL-011 Optional (post-v0.1).
- **다중 관할권 validation matrix** — post-v0.1.
- **Real-time validation observability dashboard** — 별도 SPEC.

### 1.5 CSV-Lite 원칙 (Charter [지양-5] 계승)

VALIDATION-001 §1.5를 그대로 계승한다:

- **금지**: 신규 테스트 harness — 기존 CI 집계 유지
- **금지**: 신규 QMS 워크플로우 — model-gov / traceability / source-gov 재사용
- **금지**: 신규 DB 테이블 (release_registry 포함) — read-only 소비 only
- **금지**: 외부 라이브러리 도입 — 기존 Drizzle + git CLI only

---

## §2 Intended Use (제품 사용 범위 선언)

VALIDATION-001 §2를 그대로 계승한다. 본 SPEC은 검증 증거의 **정밀도와 추적성**을
강화할 뿐, 제품 사용 범위 자체를 변경하지 않는다.

---

## §3 Requirements (EARS Format)

### 3.1 Requirements 매트릭스

| ID | Pattern | EARS Statement | Priority |
|----|---------|----------------|----------|
| REQ-VAL2-001 | Event-Driven | **When** the change-control classifier runs for a release window, the system **shall** select `change_request` rows with `created_at` between the previous release tag date and the current release cutoff, rather than selecting all approved rows globally. | High |
| REQ-VAL2-002 | Event-Driven | **When** a model or prompt `change_request` is classified as high-impact in a release window, the system **shall** record the `eval_run_id` and `eval_result_ref` from the `change_request` row into the corresponding `change_control.evidence_ref` field. | High |
| REQ-VAL2-003 | Ubiquitous | The system **shall** scope all `change_request` consumer queries by `org_id` via explicit `WHERE org_id = $1`, independent of RLS enforcement, to keep the validation domain boundary auditable in code. | Medium |
| REQ-VAL2-004 | Event-Driven | **When** the source_policy axis classifier runs, the system **shall** combine the git-diff heuristic with a `getGovernanceDashboard` snapshot, recording both signals in the `change_control.residual_risk` text. | Medium |
| REQ-VAL2-005 | Event-Driven | **When** the release validation report is built, the system **shall** call `buildMatrix` from `lib/traceability/matrix.ts` and render the traceability summary (`totalRows`, `withGaps`, `stale`) in the Traceability Status section. | High |
| REQ-VAL2-006 | Event-Driven | **When** the release validation report is built, the system **shall** call `getGovernanceDashboard` from `lib/source-governance/dashboard.ts` and render the source-governance counts table in the Source Governance Status section. | High |
| REQ-VAL2-007 | Event-Driven | **When** the release validation report is built, the system **shall** render the Release Scope Status section from `validation_evidence` counts per qualification type plus git tag info, replacing the stub text. | High |
| REQ-VAL2-008 | Unwanted | **If** the Review-Ops SPEC (#36) is not implemented, **then** the system **shall** keep the Review Ops section as an explicit "not implemented" stub with the issue reference, and **shall not** fabricate review-ops data. | High |
| REQ-VAL2-009 | State-Driven | **While** a `release_id` is supplied to any validation API or script, the system **shall** validate it matches the regex `^v\d+\.\d+\.\d+(-rc\d+)?$` before processing. | High |
| REQ-VAL2-010 | Event-Driven | **When** a `release_id` is validated, the system **shall** cross-check it against `git tag --list` and emit a non-blocking warning to stderr when the tag is absent from the local repository. | Medium |
| REQ-VAL2-011 | Ubiquitous | The system **shall** route every read from the four dependency SPECs (`change_request`, `buildMatrix`, `getGovernanceDashboard`, git tags) through the `lib/validation/consumers/` wrapper module so that the integration seam is single-sourced. | High |
| REQ-VAL2-012 | Unwanted | The system **shall not** introduce a `release_registry` database table in this SPEC; full release lifecycle ownership is deferred to a future RELEASE-002 SPEC. | High |

### 3.2 경계: 선행 SPEC과의 분담 (Revised)

| 소유권 | SPEC | 책임 | 본 SPEC의 소비 방식 |
|--------|------|------|---------------------|
| MODEL-GOVERNANCE (#71) | change_request CRUD + 승인 워크플로우 | read-only SELECT (window-scoped) |
| TRACEABILITY (#47) | evidence graph + matrix builder | `buildMatrix` 1회 호출 (snapshot) |
| SOURCE-GOVERNANCE (#48) | source authority + dashboard | `getGovernanceDashboard` 1회 호출 (snapshot) |
| RELEASE (#31) | release 산출물 ( rc1 스크립트 등) | release_id regex + git tag 교차 검증 |
| REVIEW-OPS (#36) | 전문가 검토 큐 (미구현) | stub 유지 + 사유 명시 |

본 SPEC은 VALIDATION-001 §3.2 원칙을 계승하여 **중복 구현을 금지**하며,
`lib/validation/consumers/`를 단일 진입점으로 하는 얇은 소비 계층이다.

---

## §4 Technical Approach (Sketch)

> 상세는 `plan.md`와 `research.md` 참조. 본 절은 개요만.

### 4.1 신규 모듈 (lib/validation/consumers/, 4 파일)

```
lib/validation/consumers/
├── model-governance.ts   # window-scoped change_request SELECT
├── traceability.ts        # buildMatrix snapshot wrapper
├── source-governance.ts   # getGovernanceDashboard snapshot wrapper
└── release.ts             # release_id regex + git tag cross-check
```

각 wrapper는:
- read-only (SELECT 또는 git CLI 호출 only)
- 순수 함수 (side-effect 없음, 호출 시점 상태 반환)
- 단위 테스트 가능 (mock DB / mock child_process)

### 4.2 기존 코드 수정 (비파괴)

| 파일 | 수정 내용 | 비파괴 여부 |
|------|-----------|------------|
| `scripts/validation/classify-changes.ts` | `classifyModelGovernanceAxis` / `classifySourcePolicyAxis`가 consumer 경유 | 시그니처 불변 |
| `scripts/validation/build-report.ts` | 3 stub 섹션 → 실데이터 렌더링 함수 호출 | Markdown 출력 확장만 |

### 4.3 DB 변경

**없음** (Charter [지양-5] 준수). 모든 연동은 기존 테이블 read-only 소비.

### 4.4 API Endpoints 변경

**없음**. 기존 VALIDATION-001 API route 시그니처 유지. 내부 로직만 consumer
경유로 전환.

---

## §5 Acceptance Criteria (요약)

> 상세는 `acceptance.md`. 요약:

| AC# | Criterion (binary-testable) |
|-----|-----|
| AC-1 | `classify-changes.ts` 실행 시 change_request 조회가 `created_at` 범위 조건을 포함한다 (grep `created_at` + `gte`/`between`) |
| AC-2 | high-impact model/prompt change_control 행의 `evidence_ref`에 eval_run_id가 기록된다 (DB query) |
| AC-3 | source_policy 축의 `residual_risk`에 dashboard counts 문자열이 포함된다 |
| AC-4 | build-report 출력 Markdown의 Traceability Status 섹션에 `totalRows`/`withGaps`/`stale` 숫자가 포함된다 (stub 문자열 부재) |
| AC-5 | build-report 출력의 Source Governance Status 섹션에 `approved`/`pendingReview`/`stale`/`superseded` 숫자가 포함된다 |
| AC-6 | build-report 출력의 Release Scope Status 섹션에 IQ/OQ/PQ evidence count가 포함된다 (stub 부재) |
| AC-7 | Review Ops 섹션은 "not implemented" 사유와 #36 참조를 포함한다 (허구 데이터 부재) |
| AC-8 | release_id `v0.1.0-rc1`은 accept, `invalid-id`는 reject (단위 테스트) |
| AC-9 | git tag가 없는 release_id 호출 시 stderr에 warning이 출력된다 (exit 0 유지, non-blocking) |
| AC-10 | 모든 외부 SPEC 소비가 `lib/validation/consumers/`를 경유한다 (grep 검증: classify-changes.ts/build-report.ts에 consumers/ import 존재, 직접 change_request/buildMatrix/getGovernanceDashboard import 부재) |

---

## §6 의존성 (Dependencies)

### 6.1 선행 (Blocking)

- `SPEC-REGULA-VALIDATION-001` (completed) — 본 SPEC이 consumer wrapper를 붙이는
  기반 코드 (`classify-changes.ts`, `build-report.ts`)의 소유자.

### 6.2 연계 (Integration, 모두 CLOSED)

- `SPEC-REGULA-MODEL-GOVERNANCE-001` (#71, CLOSED) — `change_request` 테이블 SSoT.
- `SPEC-REGULA-TRACEABILITY-001` (#47, CLOSED) — `buildMatrix` API SSoT.
- `SPEC-REGULA-SOURCE-GOVERNANCE-001` (#48, CLOSED) — `getGovernanceDashboard` API SSoT.
- `SPEC-REGULA-RELEASE-001` (#31, CLOSED) — release 산출물 + git tag 관행.

### 6.3 후속 (Follow-up, 본 SPEC이 권고)

- **RELEASE-002 (제안)** — release_registry 테이블 + release lifecycle 관리.
  본 SPEC REQ-VAL2-012가 이를 Exclusions로 명시적으로 이월.

### 6.4 기술 스택

VALIDATION-001 §6.3을 동일하게 적용 (Next.js 15, Drizzle ORM, PostgreSQL, GitHub Actions CI).

---

## §7 Risks (요약, 상세 plan.md §4)

| Risk | Impact | Mitigation |
|------|--------|-----------|
| Traceability `buildMatrix` 시그니처 진화 | consumer wrapper 재작성 | wrapper interface가 완충 (single seam) |
| Source-gov dashboard counts cumulative only | release 간 delta 불가 | snapshot 문자열 기록 (post-v0.1 테이블 검토) |
| release_id regex가 RELEASE-001 관행과 불일치 | 일부 release_id 거부 | git tag 기반 관행 매핑 + regex 완화 |
| change_request 대량 누적 시 window 쿼리 성능 | classify-changes 지연 | `idx_change_request_org_status` + `created_at` range scan |
| #36 Review-Ops 장기 미구현 | stub 영구화 | REQ-VAL2-008이 사유 명시를 강제 (허구 방지) |

---

## §8 Exclusions (What NOT to Build)

> Charter [지양-5] 및 본 SPEC §1.4 원칙에 따른 제외 항목.

- **배제**: `release_registry` 데이터베이스 테이블 — RELEASE-002로 이월
  (REQ-VAL2-012).
- **배제**: Review-Ops (#36) 정식 연동 — #36 OPEN 상태이므로 stub 유지
  (REQ-VAL2-008).
- **배제**: Traceability release-dim delta (release 간 snapshot 비교) — post-v0.1.
- **배제**: Source-gov snapshot-at-release 테이블 — cumulative 문자열 기록으로 대체.
- **배제**: PDF report export — VALIDATION-001 REQ-VAL-011 Optional 준수 (post-v0.1).
- **배제**: 다중 관할권 validation matrix — post-v0.1.
- **배제**: Real-time validation observability dashboard — 별도 SPEC.
- **배제**: validation_evidence.releaseId에 FK 제약 추가 — release_registry
  부재로 불가; RELEASE-002에서 검토.
- **배제**: VALIDATION-001 public API 시그니처 변경 — 비파괴 원칙.
