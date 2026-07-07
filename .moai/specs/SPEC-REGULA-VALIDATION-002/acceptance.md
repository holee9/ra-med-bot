---
artifact: acceptance
spec_id: SPEC-REGULA-VALIDATION-002
version: 0.1.0
status: completed
created: 2026-07-07
updated: 2026-07-07
author: manager-spec (plan-phase)
---

# Acceptance Criteria — SPEC-REGULA-VALIDATION-002

본 문서는 binary-testable acceptance criteria와 Given-When-Then 시나리오, 그리고
AC ↔ REQ ↔ evidence traceability matrix를 정의한다. 모든 AC는 관찰 가능한 증거
(test output, DB row, Markdown grep, HTTP status, stderr 출력)로 검증된다
(L-013 직검 원칙).

---

## §1 Acceptance Criteria (Binary-Testable)

| AC# | Criterion | Verification Method | 관련 REQ |
|-----|-----------|---------------------|----------|
| AC-1 | `classify-changes.ts`의 model/prompt 축 쿼리가 `created_at` window 범위 조건을 포함한다 | grep `created_at` + `gte` (또는 `between`) in `lib/validation/consumers/model-governance.ts`; 단위 테스트: window 내/외 change_request 로우 분류 결과 직검 | REQ-VAL2-001 |
| AC-2 | high-impact model/prompt change_control 행의 `evidence_ref` 컬럼에 `evalRunId` 값이 기록된다 | integration: change_request 1건 (evalRunId="run-abc") seed → classify-changes → `SELECT evidence_ref FROM change_control WHERE change_axis IN ('prompt','model') AND impact_level='high'` → `"run-abc"` 포함 | REQ-VAL2-002 |
| AC-3 | source_policy 축 change_control 행의 `residual_risk` 텍스트에 dashboard counts 문자열이 포함된다 | integration: sources 3건 (1 approved, 1 pending, 1 superseded) seed → classify-changes → `SELECT residual_risk FROM change_control WHERE change_axis='source_policy'` → `approved:1` / `superseded:1` 포함 | REQ-VAL2-004 |
| AC-4 | `build-report.ts` 출력 Markdown의 "Traceability Status" 섹션이 `totalRows` / `withGaps` / `stale` 숫자를 포함한다 | build-report 실행 → 출력 Markdown grep: `## Traceability Status` 섹션 하위에 `totalRows:` 또는 `total_rows:` 포함; `**Stub**` 부재 | REQ-VAL2-005 |
| AC-5 | 출력 Markdown의 "Source Governance Status" 섹션이 `approved` / `pendingReview` / `stale` / `superseded` 숫자를 포함한다 | grep `## Source Governance Status` 섹션 하위에 `approved:` + `superseded:` 포함; `**Stub**` 부재 | REQ-VAL2-006 |
| AC-6 | 출력 Markdown의 "Release Scope Status" 섹션이 IQ/OQ/PQ evidence count를 포함한다 | integration: evidence 6건 (IQ 2/OQ 2/PQ 2) seed → build-report → grep `## Release Scope Status` 하위에 `IQ:` 또는 `iq:` + count; `**Stub**` 부재 | REQ-VAL2-007 |
| AC-7 | "Review Ops Status" 섹션이 `not implemented` 문자열과 `#36` 이슈 참조를 포함한다 | grep `## Review Ops Status` 하위에 `not implemented` + `#36`; `**Stub**` 텍스트는 허용되지 않으나 `not implemented`는 필수 | REQ-VAL2-008 |
| AC-8 | release_id `v0.1.0`과 `v0.1.0-rc1`은 format 검증을 통과하고, `v0.1`, `invalid`, `0.1.0`, `v0.1.0.0`은 거부된다 | 단위 테스트: `validateReleaseIdFormat` 호출 결과 직검 (accept 2, reject 4) | REQ-VAL2-009 |
| AC-9 | git tag가 로컬에 없는 release_id 호출 시 stderr에 warning이 출력되지만 exit code는 0이다 | integration: `git tag --list v99.99.99-rc1` 빈 출력 상태에서 build-report `v99.99.99-rc1` 실행 → stderr에 `Warning: git tag v99.99.99-rc1 not found` 포함; exit 0 | REQ-VAL2-010 |
| AC-10 | `classify-changes.ts`와 `build-report.ts`가 `change_request` / `buildMatrix` / `getGovernanceDashboard`를 `lib/validation/consumers/`를 경유하여 소비한다 (직접 import 부재) | grep `from '../../lib/db/schema.ts'` + `changeRequest` in classify-changes.ts → 0 (consumer import로 대체); 동일하게 build-report.ts에서 `buildMatrix` / `getGovernanceDashboard` 직접 import 0 | REQ-VAL2-011 |
| AC-11 | release_registry 데이터베이스 테이블이 신규 생성되지 않는다 | `ls migrations/` 에서 본 SPEC 관련 migration 파일 0건; schema.ts에 `releaseRegistry` 심볼 부재 (grep 검증) | REQ-VAL2-012 |

---

## §2 Given-When-Then 시나리오

### AC-1: model/prompt window-scoped query

```gherkin
Scenario: window 내 change_request만 high-impact으로 분류된다
  Given change_request 테이블에 2건의 approved 로우가 있다
    # 로우 A: created_at=2026-06-01 (과거, window 외)
    # 로우 B: created_at=2026-07-05 (window 내, 직전 release tag 이후)
    And previous release tag "v0.1.0-rc0"가 2026-06-15에 생성되었다
  When POST /api/validation/changes { release_id: "v0.1.0-rc1", previous_ref: "v0.1.0-rc0" } 호출한다
  Then change_control 테이블에 change_axis='prompt' (또는 'model') 행 중
    And impact_level='high'인 행의 residual_risk에 "window 내" change_request B만 카운트된다
    And 로우 A는 무시된다 (residual_risk에 "0" 또는 미포함)
```

### AC-2: evidence_ref에 evalRunId 연결

```gherkin
Scenario: high-impact model change의 evidence_ref에 eval_run_id가 기록된다
  Given change_request 테이블에 1건의 approved model 변경 로우가 있다
    # evalRunId="eval-2026-007", evalResultRef="s3://bucket/eval-007.json"
    And 현재 release_id="v0.1.0-rc1"이다
  When classify-changes.ts 실행한다
  Then change_control 행의 evidence_ref 컬럼에 "eval-2026-007" 문자열이 포함된다
    And impact_level='high'이다
    And rerun_required=true이다
```

### AC-3: source_policy dashboard snapshot

```gherkin
Scenario: source_policy 축이 dashboard counts를 residual_risk에 기록한다
  Given sources 테이블에 3건의 로우가 있다
    # 1건 approved, 1건 pending_review, 1건 superseded (superseded_by != null)
  When classify-changes.ts 실행한다 (release_id="v0.1.0-rc1")
  Then change_control 행의 residual_risk 텍스트에 다음이 모두 포함된다:
    | 부분 문자열 |
    | "approved:1" |
    | "pending:1" (또는 pendingReview:1) |
    | "superseded:1" |
    | "snapshot at" (ISO timestamp) |
```

### AC-4: Traceability Status 섹션 실데이터

```gherkin
Scenario: report의 Traceability Status 섹션이 buildMatrix 결과를 렌더링한다
  Given evidence_nodes 5건 + evidence_edges 3건이 seed 되어 있다
    # deliverable 5건 중 2건은 derived_from edge 부재 (gap), 1건은 stale_flag 존재
  When build-report.ts 실행한다 (release_id="v0.1.0-rc1")
  Then 출력 Markdown의 "## Traceability Status" 섹션에 다음이 포함된다:
    | 기대 문자열 |
    | "totalRows" |
    | "5" (또는 totalRows=5) |
    | "withGaps" |
    | "stale" |
    And "**Stub**" 문자열이 해당 섹션에 등장하지 않는다
```

### AC-5: Source Governance Status 섹션 실데이터

```gherkin
Scenario: report의 Source Governance Status 섹션이 dashboard counts를 렌더링한다
  Given sources 테이블에 approved 10건, pending_review 3건, superseded 2건이 있다
  When build-report.ts 실행한다
  Then "## Source Governance Status" 섹션에 다음이 포함된다:
    | 기대 문자열 |
    | "approved" |
    | "10" |
    | "pendingReview" (또는 "pending") |
    | "superseded" |
    | "2" |
    And "**Stub**" 부재
```

### AC-6: Release Scope Status 섹션 실데이터

```gherkin
Scenario: report의 Release Scope Status 섹션이 evidence count를 렌더링한다
  Given validation_evidence 테이블에 release_id="v0.1.0-rc1" evidence 6건이 있다
    # IQ 2건, OQ 2건, PQ 2건
  When build-report.ts 실행한다
  Then "## Release Scope Status" 섹션에 다음이 포함된다:
    | 기대 문자열 |
    | "IQ" 또는 "iq" |
    | "2" |
    | "OQ" 또는 "oq" |
    | "PQ" 또는 "pq" |
    And "**Stub**" 부재
    And release_id "v0.1.0-rc1" 표시
```

### AC-7: Review Ops stub 허구 데이터 부재

```gherkin
Scenario: Review Ops 섹션이 not implemented 사유를 명시한다
  Given #36 Review-Ops SPEC이 OPEN 상태이다 (구현 없음)
  When build-report.ts 실행한다
  Then "## Review Ops Status" 섹션에 다음이 포함된다:
    | 기대 문자열 |
    | "not implemented" |
    | "#36" |
    And "SLA" 또는 "review queue" 등의 **구체적 숫자/상태**가 등장하지 않는다 (허구 방지)
    And "Stub" 단어는 허용되나 "not implemented"가 우선
```

### AC-8: release_id regex 검증

```gherkin
Scenario: release_id 포맷이 정확히 검증된다
  When 다음 release_id들을 validateReleaseIdFormat에 전달한다:
    | 입력 | 기대 결과 |
    | "v0.1.0" | valid: true |
    | "v0.1.0-rc1" | valid: true |
    | "v1.2.3-rc99" | valid: true |
    | "v0.1" | valid: false |
    | "0.1.0" | valid: false |
    | "invalid" | valid: false |
    | "v0.1.0.0" | valid: false |
    | "v0.1.0-rc" | valid: false |
  Then 각 입력이 기대 결과를 반환한다
```

### AC-9: git tag 부재 warning (non-blocking)

```gherkin
Scenario: git tag가 없는 release_id는 warning만 출력하고 계속 진행한다
  Given 로컬 git 저장소에 "v99.99.99-rc1" tag가 존재하지 않는다
    # `git tag --list v99.99.99-rc1` → 빈 출력
  When build-report.ts "v99.99.99-rc1" 실행한다
  Then stderr에 "Warning: git tag v99.99.99-rc1 not found"가 출력된다
    And exit code는 0이다 (정상 완료)
    And report Markdown 파일이 정상 생성된다
```

### AC-10: consumer 경유 소비 (single seam)

```gherkin
Scenario: classify-changes.ts와 build-report.ts가 consumers/ 경유로 소비한다
  Given M0에서 lib/validation/consumers/ 가 생성되었다
  When classify-changes.ts 코드를 검사한다 (grep)
  Then 다음 직접 import가 부재한다:
    | 금지된 import 패턴 |
    | "from '../../lib/db/schema.ts'" 안의 changeRequest (consumers 경유로 대체) |
  And "from '../../lib/validation/consumers/model-governance'" 가 존재한다
  When build-report.ts 코드를 검사한다 (grep)
  Then 다음이 부재한다:
    | 금지된 import 패턴 |
    | "from '@/lib/traceability/matrix'" 의 buildMatrix 직접 호출 |
    | "from '@/lib/source-governance/dashboard'" 의 getGovernanceDashboard 직접 호출 |
  And "from '@/lib/validation/consumers/traceability'" 가 존재한다
  And "from '@/lib/validation/consumers/source-governance'" 가 존재한다
```

### AC-11: release_registry 테이블 부재

```gherkin
Scenario: 본 SPEC이 release_registry 테이블을 도입하지 않는다
  When migrations/ 디렉토리를 검사한다
  Then 본 SPEC 관련 migration 파일 (VALIDATION-002 또는 유사 명칭)이 0건이다
  And lib/db/schema.ts에 "releaseRegistry" pgTable 선언이 부재한다 (grep)
  And 단위/integration 테스트가 기존 VALIDATION-001 스키마만 사용한다
```

---

## §3 Edge Cases

### EC-1: change_request가 window 내 0건인 경우

```gherkin
Scenario: model/prompt 축에 window 내 change_request가 없다
  Given change_request 테이블에 approved 로우가 있으나 모두 window 외이다
  When classify-changes.ts 실행한다
  Then model/prompt 축은 impact_level='low', rerun_required=false로 기록된다
    And residual_risk에 "No window-scoped change_request rows" 포함
```

### EC-2: getGovernanceDashboard가 빈 결과를 반환하는 경우

```gherkin
Scenario: source-gov dashboard가 모든 count=0을 반환한다
  Given sources 테이블이 비어 있다 (또는 org에 속한 source가 없다)
  When classify-changes.ts 실행한다 (source_policy 축)
  Then residual_risk에 "approved:0, pending:0, stale:0, superseded:0" 포함
    And git-diff 카운트가 0이면 impact_level='low'
```

### EC-3: buildMatrix 호출이 실패하는 경우

```gherkin
Scenario: buildMatrix가 예외를 throw 한다
  Given traceability 데이터베이스 연결이 끊겨 있다 (또는 쿼리 타임아웃)
  When build-report.ts 실행한다
  Then report는 traceability 섹션에 "[traceability snapshot unavailable: <error>]" 기록
    And exit code 0 유지 (non-blocking, report 나머지 섹션은 정상)
    And stderr에 경고 로깅
```

### EC-4: release_id가 regex를 통과하나 git tag가 있는 경우 (정상 flow)

```gherkin
Scenario: 정식 release tag로 build-report 실행
  Given git tag "v0.1.0"이 존재한다
  When build-report.ts "v0.1.0" 실행한다
  Then stderr에 warning이 출력되지 않는다 (tag 존재)
    And exit code 0
    And report 정상 생성
```

### EC-5: previous_ref가 git history에 없는 경우

```gherkin
Scenario: classify-changes에 존재하지 않는 previous_ref 전달
  Given previous_ref="v0.0.0-nonexistent" 를 인자로 전달
  When classify-changes.ts 실행한다
  Then window_start 계산 실패 → warning 출력 + window_start=UNIX epoch (1970) fallback
    And 모든 change_request가 window 내로 간주됨 (보수적 과분류)
    And residual_risk에 "previous_ref not found, fallback to epoch" 포함
```

### EC-6: #36이 향후 구현된 경우 (post-VALIDATION-002)

```gherkin
Scenario: #36 Review-Ops가 별도 SPEC으로 구현 완료
  Given #36이 CLOSED 되었다
  When 본 SPEC의 후속 (VALIDATION-003 또는 patch)에서 renderReviewOpsSection 교체
  Then "not implemented" 사유 제거 → 실 review queue 데이터 렌더링
  Note: 본 SPEC 자체는 #36 OPEN을 가정하므로 AC-7이 지배
```

---

## §4 AC ↔ REQ ↔ Evidence Traceability Matrix

| AC# | 관련 REQ | Evidence (검증 산출물) | 소유 milestone |
|-----|---------|-----------------------|---------------|
| AC-1 | REQ-VAL2-001 | consumers/model-governance.ts 단위 테스트 + window query grep | M0, M1 |
| AC-2 | REQ-VAL2-002 | integration 테스트: change_control.evidence_ref DB query | M1 |
| AC-3 | REQ-VAL2-004 | integration 테스트: change_control.residual_risk 문자열 직검 | M2 |
| AC-4 | REQ-VAL2-005 | build-report 출력 Markdown grep (Traceability Status 섹션) | M3 |
| AC-5 | REQ-VAL2-006 | build-report 출력 Markdown grep (Source Governance Status 섹션) | M3 |
| AC-6 | REQ-VAL2-007 | build-report 출력 Markdown grep (Release Scope Status 섹션) | M3 |
| AC-7 | REQ-VAL2-008 | build-report 출력 Markdown grep (Review Ops "not implemented" + "#36") | M3 |
| AC-8 | REQ-VAL2-009 | validateReleaseIdFormat 단위 테스트 (8 케이스) | M0, M4 |
| AC-9 | REQ-VAL2-010 | integration 테스트: stderr + exit code 직검 | M4 |
| AC-10 | REQ-VAL2-011 | classify-changes.ts / build-report.ts grep (import 경로 검증) | M0, M1, M2, M3 |
| AC-11 | REQ-VAL2-012 | migrations/ ls + schema.ts grep (releaseRegistry 부재) | 전체 |

---

## §5 Quality Gate Criteria (Definition of Done)

본 SPEC은 다음 게이트를 모두 통과해야 completed로 전환된다:

### 5.1 코드 품질 (TRUST 5)

- **Tested**: 본 SPEC 관련 코드 (consumers/, classify-changes.ts 수정, build-report.ts
  수정) 단위 + integration 테스트 커버리지 85% 이상
- **Readable**: 모든 신규 함수에 영문 코멘트 (code_comments: en), @MX:NOTE/ANCHOR
  태그 (fan_in >= 3 시)
- **Unified**: biome 포맷 + ESLint 규칙 준수
- **Secured**: read-only 소비 (SQL injection 불가 — Drizzle prepared statement);
  git CLI 호출 인자 검증 (release_id regex 통과한 값만)
- **Trackable**: 커밋 메시지에 `SPEC-REGULA-VALIDATION-002` + AC 번호 참조

### 5.2 회귀 게이트 (L-009 원칙)

- `pnpm test` 전체 스위트 green (기존 VALIDATION-001 테스트 포함)
- 기존 단위 테스트 중 회귀 0건
- classify-changes.ts / build-report.ts 시그니처 불변 (grep 비파괴 검증)

### 5.3 CI 게이트 (L-015 원칙 — main 머지 전 로컬 직검)

- `pnpm ci:typecheck` green
- `pnpm ci:lint` (lint:hex 포함, L-008) green
- `pnpm ci:format` green
- `pnpm ci:migrations` green (신규 migration 0건이지만 기존 migration 적재 확인)
- `pnpm ci:audit` green (본 SPEC이 audit에 영향 없음 — read-only)
- `pnpm ci:rbac` green (validation RBAC 변경 없음)

### 5.4 범위 통제 게이트

- `lib/validation/consumers/` 외的新 인프라 부재 (새 테이블, 새 harness)
- VALIDATION-001 public API 시그니처 불변
- PDF export 미구현 (REQ-VAL-011 Optional 계승)
- Review-Ops stub이 "not implemented" 유지 (#36 OPEN)

### 5.5 허구 데이터 방지 (Charter [지양-2])

- 모든 report 섹션이 실데이터 또는 명시적 "not implemented" 사유
- 허구 숫자 / 가짜 상태 string 금지
- self-report (단위 테스트 통과)에 의존하지 않고 실DB 직검 (L-013)

---

## §6 Test Scenarios Summary

| 시나리오 | 유형 | 소유 AC | 자동화 |
|---------|------|---------|--------|
| change_request window 내/외 분류 | integration | AC-1, AC-2 | vitest + 실DB |
| source_policy dashboard snapshot | integration | AC-3 | vitest + 실DB |
| build-report 3 섹션 실데이터 | integration | AC-4, AC-5, AC-6 | vitest + Markdown grep |
| Review Ops stub 유지 | 단위 | AC-7 | vitest + Markdown grep |
| release_id regex 8 케이스 | 단위 | AC-8 | vitest (pure function) |
| git tag 부재 warning | integration | AC-9 | child_process + stderr 캡처 |
| consumer 경유 (single seam) | grep | AC-10 | grep 스크립트 (CI 통합) |
| release_registry 부재 | grep | AC-11 | ls + grep 스크립트 |
| change_request window 0건 | 단위 (edge) | EC-1 | vitest mock |
| dashboard all-zero | 단위 (edge) | EC-2 | vitest mock |
| buildMatrix 실패 | 단위 (edge) | EC-3 | vitest mock throw |
| previous_ref 미존재 | integration (edge) | EC-5 | git + classify-changes |

---

## §7 Post-Implementation Review (Rule 3)

구현 완료 후 다음을 점검한다:

1. **잠재 이슈**:
   - `buildMatrix` 호출 비용이 크면 report 빌드 지연 → 타임아웃 5초 설정
   - change_request window query가 큰 org에서 느릴 수 있음 → 인덱스 확인
   - git tag CLI 호출이 CI 환경에서 차단될 수 있음 → fallback 경로
2. **추가 검증 권장**:
   - 실제 rc1 빌드 시나리오로 end-to-end smoke test
   - 대규모 change_request (100+ 로우) 환경에서 성능 프로파일링
3. **알려진 한계**:
   - source-gov snapshot이 cumulative (release 간 delta 불가) — post-v0.1 개선
   - #36 Review-Ops stub 영구화 가능성 (해당 SPEC 진행 전까지)
4. **후속 SPEC 제안**:
   - **RELEASE-002**: release_registry 테이블 + release lifecycle SSoT
   - **VALIDATION-003 (post-#36)**: Review-Ops 정식 연동
   - **SOURCE-GOV-002 (post-v0.1)**: snapshot-at-release 테이블로 delta 지원
