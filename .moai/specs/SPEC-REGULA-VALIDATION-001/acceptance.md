---
artifact: acceptance
spec_id: SPEC-REGULA-VALIDATION-001
version: 1.1.0
status: planned
created: 2026-07-06
updated: 2026-07-06
author: manager-spec (plan-phase)
---

# Acceptance Criteria — SPEC-REGULA-VALIDATION-001

본 문서는 binary-testable acceptance criteria와 Given-When-Then 시나리오, 그리고 AC ↔ REQ ↔ evidence traceability matrix를 정의한다. 모든 AC는 관찰 가능한 증거(test output, file 존재, DB row, HTTP status)로 검증된다.

---

## §1 Acceptance Criteria (Binary-Testable)

| AC# | Criterion | Verification Method | 관련 REQ |
|-----|-----------|---------------------|----------|
| AC-1 | `docs/validation/intended-use.md` 파일이 존재하고 git history에 최소 1건 commit이 있다 | `test -f docs/validation/intended-use.md && git log --oneline docs/validation/intended-use.md` | REQ-VAL-001 |
| AC-2 | 임의의 release_id에 대해 IQ evidence 레코드가 5개(env/deps/migrations/config/secret) 존재하며 각각 `commit_sha`, `test_command`, `result`가 non-null이다 | DB query: `SELECT qualification_type, commit_sha, test_command, result FROM validation_evidence WHERE release_id=? AND qualification_type='iq'` → 5행 | REQ-VAL-003, REQ-VAL-006 |
| AC-3 | OQ evidence 레코드가 `ci_run_id` 필드를 포함하고, 해당 ID가 GitHub Actions ci.yml run과 일치한다 | DB query + `gh run view <ci_run_id> --json headSha,conclusion` 교차 검증 | REQ-VAL-004, REQ-VAL-006, REQ-VAL-014 |
| AC-4 | PQ evidence 레코드가 `.github/workflows/e2e.yml` 시나리오 결과 N건과 `tests/eval/results/latest.json` eval 결과 1건을 링크한다 | DB query: `SELECT artifact_path FROM validation_evidence WHERE release_id=? AND qualification_type='pq'` → e2e artifact + eval JSON path 존재 | REQ-VAL-005, REQ-VAL-006 |
| AC-5 | high-impact change_control 행이 존재하고 rerun evidence가 부재할 때, sign-off API 호출이 HTTP 409를 반환한다 | integration test: high-impact 행 INSERT → sign-off POST → 409 응답 + 실패 항목 목록 | REQ-VAL-008, REQ-VAL-013 |
| AC-6 | Release Validation Report Markdown 파일에 #31-34, #47, #48, #36 상태 섹션이 각각 존재한다 | `grep -c "## " docs/validation/release-report-<id>.md` ≥ 8 (8개 섹션), 각 이슈 번호 grep | REQ-VAL-010 |
| AC-7 | sign-off 성공 시 `audit_logs` 테이블에 action_type=`validation.signoff` 행 1건이 추가되고, `approver_id`, `signed_at`, `report_artifact_path`가 기록된다 | DB query before/after signoff + `lib/audit/verify-chain.ts` chain 연속성 통과 | REQ-VAL-012 |
| AC-8 | checklist 미충족 상태에서 sign-off POST 호출 시 HTTP 409 + 실패한 checklist 항목 배열이 응답 body에 포함된다 | integration test: checklist 1개 false → sign-off → 409 + `{"failed":["iq:deps",...]}` | REQ-VAL-013 |

---

## §2 Given-When-Then 시나리오

### AC-1: Intended Use 문서 존재

```gherkin
Scenario: intended-use.md가 존재하고 버전 관리된다
  Given docs/validation/intended-use.md 파일이 작성되어 있다
  When git에 commit한다
  Then git log에 해당 파일의 commit 이력이 존재한다
  And 파일 내용에 "Intended Use", "Prohibited Use", "Human Review Boundary" 섹션이 모두 있다
```

### AC-2: IQ Evidence Bundle 생성

```gherkin
Scenario: IQ bundle 실행 시 5개 evidence 레코드가 생성된다
  Given release_id="v0.1.0-rc1"로 마이그레이션이 적용된 DB가 있다
  When POST /api/validation/iq { release_id: "v0.1.0-rc1" } 호출한다
  Then validation_evidence 테이블에 release_id="v0.1.0-rc1", qualification_type='iq'인 행이 5개 생성된다
  And 각 행의 commit_sha, test_command, result 필드가 non-null이다
  And 5개의 test_command는 각각 env/deps/migrations/config/secret 검증을 가리킨다
```

### AC-3: OQ CI Run 매핑

```gherkin
Scenario: OQ bundle이 CI run ID를 정확히 매핑한다
  Given ci.yml의 최신 run이 databaseId=123456, conclusion=success, headSha=<release commit>이다
  When POST /api/validation/oq { release_id: "v0.1.0-rc1" } 호출한다
  Then validation_evidence에 ci_run_id=123456인 행이 3개(test/rbac/audit) 생성된다
  And 각 행의 commit_sha가 <release commit>과 일치한다
```

```gherkin
Scenario: CI artifact가 만료된 경우 result=skip으로 기록된다
  Given ci_run_id=123456의 artifact가 만료되어 다운로드 불가하다
  When POST /api/validation/oq 호출한다
  Then 해당 evidence 행의 result='skip'이다
  And metadata.reason 필드에 "artifact_expired"가 기록된다
```

### AC-4: PQ E2E + Eval 매핑

```gherkin
Scenario: PQ bundle이 E2E 시나리오와 eval 결과를 링크한다
  Given e2e.yml의 최신 run이 5개 smoke 시나리오를 통과했다
  And tests/eval/results/latest.json이 존재한다
  When POST /api/validation/pq { release_id: "v0.1.0-rc1" } 호출한다
  Then validation_evidence에 qualification_type='pq'인 행이 6개(5 E2E + 1 eval) 생성된다
  And 각 행의 artifact_path가 유효한 경로를 가리킨다
```

### AC-5: High-Impact Rerun Gate

```gherkin
Scenario: high-impact change + rerun 부재 시 sign-off 차단
  Given release_id="v0.1.0-rc1"의 change_control에 change_axis='model', impact_level='high', rerun_required=true 행이 있다
  And validation_evidence에 rerun 증거가 없다
  When POST /api/validation/signoff { release_id: "v0.1.0-rc1", checklist_state: {...} } 호출한다
  Then HTTP 409가 반환된다
  And 응답 body의 failed 배열에 "change_control:model:rerun_required"가 포함된다
```

```gherkin
Scenario: high-impact change + rerun 완료 시 sign-off 진행 가능
  Given 동일한 change_control 행이 있고
  And rerun evidence가 qualification_type='oq'로 추가되어 있다
  When sign-off POST 호출한다
  Then checklist 통과 시 HTTP 200이 반환된다
```

### AC-6: Release Validation Report 섹션

```gherkin
Scenario: Report에 4개 이슈 그룹 상태 섹션이 존재한다
  Given M1~M4가 완료되어 evidence와 change_control이 채워져 있다
  When POST /api/validation/report/export { release_id: "v0.1.0-rc1" } 호출한다
  Then docs/validation/release-report-v0.1.0-rc1.md 파일이 생성된다
  And 파일에 다음 섹션이 존재한다:
    | ## Intended Use |
    | ## IQ Evidence |
    | ## OQ Evidence |
    | ## PQ Evidence |
    | ## Change Control |
    | ## Release Scope Status (#31-#34) |
    | ## Traceability Status (#47) |
    | ## Source Governance Status (#48) |
    | ## Review Ops Status (#36) |
    | ## Sign-off Checklist |
```

### AC-7: Sign-off Audit Log 기록

```gherkin
Scenario: sign-off 성공 시 audit_logs에 hash-chain 행 추가
  Given 모든 checklist 항목이 충족되었다
  When sign-off POST 호출이 성공한다 (HTTP 200)
  Then audit_logs 테이블에 action_type='validation.signoff' 행이 1건 추가된다
  And 해당 행의 metadata에 approver_id, release_id, report_artifact_path가 포함된다
  And lib/audit/verify-chain.ts 실행 시 해당 행까지 chain 연속성이 유지된다
```

### AC-8: Checklist Gate

```gherkin
Scenario: checklist 미충족 시 409 반환
  Given release_id="v0.1.0-rc1"의 checklist_state가 { iq: false, oq: true, pq: true, change_control: true } 이다
  When sign-off POST 호출한다
  Then HTTP 409가 반환된다
  And 응답 body의 failed 배열에 "iq"가 포함된다
  And audit_logs에 새 행이 추가되지 않는다
```

---

## §3 Edge Cases (경계 케이스)

| EC# | 시나리오 | 기대 동작 |
|-----|---------|-----------|
| EC-1 | release_id에 해당하는 evidence가 전혀 없는 상태에서 sign-off 시도 | HTTP 409 + failed: all checklist items |
| EC-2 | approver가 `validation:approve` 권한이 없는 경우 | HTTP 403 |
| EC-3 | writeAudit 호출 실패 (DB 연결 끊김) | HTTP 500 + signoff 취소 (부분 성공 금지) |
| EC-4 | model-governance change-workflow가 비어있는 경우 (fallback 모드) | 7축 중 model/prompt 축은 git diff 휴리스틱으로 동작, metadata.fallback=true |
| EC-5 | 동일 release_id에 대해 sign-off 중복 호출 | HTTP 409 + "already signed off" (validation_signoff unique 제약) |
| EC-6 | TRACEABILITY-001(#47) 미완료 상태에서 report export | report의 traceability 섹션은 stub("Traceability SPEC pending")으로 채워짐 |
| EC-7 | CI run이 아직 running 중인 상태에서 OQ 수집 | result='skip', metadata.reason='ci_running', 30분 후 재시도 권장 메시지 |
| EC-8 | promptfoo eval 결과 JSON 스키마 불일치 | Zod 검증 실패 → result='skip', metadata.reason='eval_schema_mismatch' |

---

## §4 AC ↔ REQ ↔ Evidence Traceability Matrix

| AC | REQ | Evidence Artifact | 검증 위치 |
|----|-----|-------------------|-----------|
| AC-1 | REQ-VAL-001 | `docs/validation/intended-use.md` + git log | 단위 테스트 + 수동 |
| AC-2 | REQ-VAL-003, 006 | `validation_evidence` IQ 행 5개 | integration 테스트 |
| AC-3 | REQ-VAL-004, 006, 014 | `validation_evidence` OQ 행 + `gh run view` 결과 | integration 테스트 |
| AC-4 | REQ-VAL-005, 006 | `validation_evidence` PQ 행 + e2e/eval artifact path | integration 테스트 |
| AC-5 | REQ-VAL-008, 013 | HTTP 409 응답 + failed 배열 | integration 테스트 |
| AC-6 | REQ-VAL-010 | `docs/validation/release-report-<id>.md` 섹션 | 단위 테스트 (grep) |
| AC-7 | REQ-VAL-012 | `audit_logs` 행 + `verify-chain.ts` 통과 | integration 테스트 |
| AC-8 | REQ-VAL-013 | HTTP 409 + failed checklist | integration 테스트 |

---

## §5 Definition of Done (Quality Gate)

SPEC 완료 선언을 위한 8개 품질 게이트:

| Gate# | 항목 | 측정 방법 |
|-------|------|-----------|
| QG-1 | AC-1~AC-8 모두 통과 | 본 문서 §1 매트릭스 |
| QG-2 | 단위 테스트 커버리지 ≥ 85% | `pnpm ci:test` coverage report |
| QG-3 | lint/format green | `pnpm ci:lint && pnpm ci:format` |
| QG-4 | typecheck green | `pnpm ci:typecheck` |
| QG-5 | 마이그레이션 실DB 적용 성공 | `pnpm ci:migrations` + 로컬 Postgres |
| QG-6 | RBAC 권한 검증 | `pnpm ci:rbac` (validation:run/approve/read 3권한) |
| QG-7 | audit_logs hash chain 연속성 | `lib/audit/verify-chain.ts` sign-off 행 포함 통과 |
| QG-8 | Charter [지양-5] 준수 | §8 Exclusions 항목 위반 0건 (수동 리뷰) |

---

## §6 수동 QA (Gate 4 도메인 UAT)

이슈 #49 MoAI 교차검증 기준 Gate 4 (RA 도메인 UAT) 항목:

- [ ] `intended-use.md`를 RA Lead가 검토하고 intended/prohibited/boundary가 실제 운영과 일치하는지 확인
- [ ] criticality 분류를 RA Lead + QA Lead가 합의 (chat=critical, RAG=critical, workflow draft=critical, review=critical, submission package=critical, risk management=critical; support/ancillary 분류 명확화)
- [ ] residual risk 서술 1건 이상 실 운영 시나리오로 검증
- [ ] Release Validation Report를 RA Lead가 읽고 "이해 가능한 문서"인지 확인
- [ ] sign-off 절차를 admin 계정으로 end-to-end 수행

---

## §7 비기능 요구사항 (NFR 검증)

| NFR | 기준 | 측정 |
|-----|------|------|
| 성능 | IQ bundle 수집 ≤ 30초 | `time pnpm validation:collect:iq` |
| 성능 | Report export ≤ 10초 | `time pnpm validation:report:build` |
| 보안 | sign-off API는 admin 권한 필수 | RBAC 단위 테스트 |
| 보안 | PII/PHI는 evidence 메타데이터에 저장 금지 | 단위 테스트 (PII 패턴 검증) |
| 가용성 | writeAudit 실패 시 sign-off rollback | integration 테스트 |
| 감사 | 모든 evidence 변경은 audit_logs 기록 | 단위 테스트 |

---

## §8 Charter 준수 검증

| Charter 원칙 | 본 SPEC 적용 | 검증 |
|--------------|-------------|------|
| [핵심 가치] RA 전문가 시간 절약 | 자동 evidence 수집으로 수기 작업 제거 | AC-2, AC-3, AC-4 |
| [주 사용자] RA Lead | sign-off 주체, report 독자 | AC-6, AC-7 |
| [지양-1] over-engineering 금지 | aggregator/glue 설계, 신규 harness 금지 | §8 Exclusions |
| [지양-2] 모방 아닌 적합 | CSV-lite 내부용 (외부 인증 아님) | §1.4 |
| [지양-3] 수동→자동 역순 | 기존 CI/eval 먼저, 본 SPEC은 집계 | research.md §1 |
| [지양-4] mock/fallback 명시 | model-gov fallback 모드 metadata.fallback=true | EC-4 |
| [지양-5] 범위 이탈 방지 | §8 Exclusions + REQ-VAL-011 Optional | QG-8 |
