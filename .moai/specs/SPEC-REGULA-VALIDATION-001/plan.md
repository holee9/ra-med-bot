---
artifact: plan
spec_id: SPEC-REGULA-VALIDATION-001
version: 1.1.0
status: planned
created: 2026-07-06
updated: 2026-07-06
author: manager-spec (plan-phase)
development_mode: tdd
---

# Implementation Plan — SPEC-REGULA-VALIDATION-001

본 plan은 research.md의 자산 인벤토리를 소비하여 6개 milestone(M0~M5)로 구성된다. 각 milestone은 priority 기반 순서를 가지며, 시간 추정은 Charter [지양-5]와 moai-constitution Time Estimation 금지 원칙에 따라 phase ordering으로 표현한다.

---

## §1 Milestone 개요

| Milestone | 이름 | Priority | Depends On | 산출물 |
|-----------|------|----------|------------|--------|
| M0 | Evidence Schema & DB Migration | Critical (blocker) | — | migration 0NNN, Drizzle schema 3 테이블 |
| M1 | IQ Bundle Generator | High | M0 | `scripts/validation/collect-iq.ts` + API route |
| M2 | OQ Aggregator | High | M0 | `scripts/validation/collect-oq.ts` + API route |
| M3 | PQ E2E+Eval Bundle | High | M0 | `scripts/validation/collect-pq.ts` + API route |
| M4 | Change-Control Impact Assessment | High | M0 | `scripts/validation/classify-changes.ts` + rerun gate |
| M5 | Release Validation Report + Sign-off | Critical | M1, M2, M3, M4 | `scripts/validation/build-report.ts` + sign-off API + audit_logs write |

---

## §2 Milestone 상세

### M0 — Evidence Schema & DB Migration (Critical Blocker)

**목표**: 3개 신규 테이블 스키마 확정 + 마이그레이션 파일 + Drizzle ORM 모델.

**태스크**:
1. `migrations/0NNN_validation_evidence.sql` 작성 (research.md §6 참조)
2. `lib/db/schema.ts`에 `validationEvidence`, `changeControl`, `validationSignoff` 추가
3. Zod 검증 스키마 (`qualification_type`, `result`, `change_axis`, `impact_level` enum)
4. 단위 테스트: 테이블 생성 + enum 제약 + CHECK 제약 + index (TDD RED→GREEN)

**Gate (M0 → M1)**:
- `pnpm ci:migrations` 성공
- 로컬 Postgres에서 `pnpm seed-test-db` 후 테이블 존재 확인
- schema.ts Drizzle 타입 추론 성공

**Risks**:
- 기존 77+ migration과 충돌 → 최신 main 기준 번호 할당
- enum CHECK 제약 vs Postgres native enum → 본 SPEC은 CHECK 제약 사용 (rollback 용이)

---

### M1 — IQ Bundle Generator (High)

**목표**: IQ evidence 수집 스크립트 + API route. 5개 검증(env/deps/migrations/config/secret) 결과를 `validation_evidence`에 INSERT.

**태스크**:
1. `scripts/validation/collect-iq.ts` — 단일 진입점
   - `pnpm install --frozen-lockfile` 결과 + `pnpm-lock.yaml` sha256
   - `scripts/validate-runtime-env.ts` 호출 결과
   - `pnpm ci:migrations` exit code
   - `.env.example` vs 실제 env 키 diff
2. `app/api/validation/iq/route.ts` — POST handler (RBAC: `validation:run`)
3. 단위 테스트: 각 검증 항목별 pass/fail/skip 케이스 (TDD)
4. integration 테스트: 실DB INSERT + commit_sha/ci_run_id 필드 검증

**Reuse**: `scripts/validate-runtime-env.ts`, `scripts/ci/check-migrations.ts`, `lib/env.ts`

**Gate (M1 완료 조건)**:
- IQ bundle 실행 시 5개 evidence record 생성 (env/deps/migrations/config/secret)
- 각 record에 `commit_sha`, `test_command`, `result` non-null
- AC-2 충족

---

### M2 — OQ Aggregator (High)

**목표**: CI unit/integration test 결과를 `validation_evidence`에 매핑.

**태스크**:
1. `scripts/validation/collect-oq.ts`:
   - `gh run list --workflow=ci.yml --json databaseId,headSha,conclusion`로 CI run ID 획득
   - `pnpm ci:test` (vitest), `pnpm ci:rbac`, `pnpm ci:audit` 결과 매핑
   - artifact path: `gh run view <id> --json artifacts`에서 추출
2. `app/api/validation/oq/route.ts` — POST handler
3. 단위 테스트: CI run ID 매핑 정확도, artifact 만료 시 result=skip 처리
4. integration 테스트: 실 CI run 결과로 OQ bundle 생성

**Reuse**: `.github/workflows/ci.yml`, `scripts/qa/check-rbac.mjs`, `scripts/qa/audit-completeness.ts`, `tests/results/junit.xml` (있을 경우)

**Gate (M2 완료 조건)**:
- OQ bundle에 3개 test command 결과 포함
- `ci_run_id`가 GitHub Actions databaseId와 일치
- AC-3 충족

---

### M3 — PQ E2E + Eval Bundle (High)

**목표**: E2E 시나리오 + promptfoo eval 결과를 `validation_evidence`에 매핑.

**태스크**:
1. `scripts/validation/collect-pq.ts`:
   - `.github/workflows/e2e.yml`의 smoke + full suite 결과
   - `tests/eval/results/latest.json` 파싱 (스키마 Zod 검증)
   - 시나리오명 → artifact path 매핑 테이블
2. `app/api/validation/pq/route.ts` — POST handler
3. 단위 테스트: eval JSON 스키마 검증, E2E skip 시나리오 처리
4. integration 테스트: 실 e2e.yml 결과 + eval 결과로 PQ bundle 생성

**Reuse**: `.github/workflows/e2e.yml`, `tests/eval/promptfoo.config.yaml`, `scripts/run-eval.sh`

**Gate (M3 완료 조건)**:
- PQ bundle에 E2E 시나리오 결과 N건 + eval 결과 1건 포함
- 각 시나리오에 artifact path 또는 skip 사유 존재
- AC-4 충족

---

### M4 — Change-Control Impact Assessment (High)

**목표**: 릴리즈별 7축(source_policy/prompt/model/schema/retrieval/export/review_workflow) impact 평가 + high-impact rerun gate.

**태스크**:
1. `scripts/validation/classify-changes.ts`:
   - model/prompt 축: `lib/model-governance/change-workflow.ts` record 조회 (있을 경우)
   - schema 축: `migrations/` diff (이전 release tag 기준)
   - source_policy 축: `lib/source-governance/` 상태 (있을 경우) 또는 git diff 휴리스틱
   - retrieval/export/review_workflow 축: git diff 휴리스틱 (경로 패턴 매칭)
2. impact rating 로직: high = 사용자 가시 동작 변경 / 규제 근거 변경 / RBAC 변경; medium = 내부 로직; low = cosmetic
3. `app/api/validation/impact-assessment/route.ts` — POST handler
4. `lib/validation/rerun-gate.ts` — high-impact + rerun evidence 부재 시 차단
5. 단위 테스트: 7축 각각 high/medium/low 분류 정확도
6. integration 테스트: high-impact + rerun 부재 시 HTTP 409 (AC-5)

**Reuse**: `lib/model-governance/change-workflow.ts`, `lib/source-governance/` (있을 경우), git diff

**Fallback**: model-governance 미구현 시 git diff 휴리스틱만 동작 (단기 허용)

**Gate (M4 완료 조건)**:
- 7축 각각에 대해 impact_level + rerun_required + residual_risk 기록
- high-impact + rerun 부재 시 sign-off 차단 로직 동작
- AC-5 충족

---

### M5 — Release Validation Report + Sign-off (Critical)

**목표**: Release Validation Report Markdown 빌더 + sign-off API + audit_logs hash-chain write.

**태스크**:
1. `scripts/validation/build-report.ts`:
   - 섹션: Intended Use 요약, IQ/OQ/PQ evidence 표, Change-Control 7축 표, Release Scope Status (#31~#34), Traceability Status (#47), Source Governance Status (#48), Review Ops Status (#36), Sign-off Checklist
   - Markdown 출력 → `docs/validation/release-report-<release_id>.md`
2. `app/api/validation/report/export/route.ts` — POST handler
3. `app/api/validation/signoff/route.ts` — POST handler:
   - checklist_state 검증 (모든 항목 true)
   - change-control rerun gate 재확인 (M4)
   - `lib/audit.ts writeAudit(action_type: 'validation.signoff')` 호출 → audit_log_ref 저장
4. `lib/validation/checklist.ts` — checklist 항목 정의 (IQ/OQ/PQ pass, change-control resolved, report exported)
5. 단위 테스트: checklist 항목 누락 시 HTTP 409 (AC-8)
6. integration 테스트: sign-off 성공 시 `audit_logs` 행 1건 추가, hash chain 연속성 유지 (AC-7)

**Reuse**: `lib/audit.ts writeAudit` (hash chain), `scripts/release-rc1/` 패턴

**Gate (M5 완료 / SPEC 완료 조건)**:
- 모든 AC-1~AC-8 통과
- `pnpm test` 전체 green
- `docs/validation/intended-use.md` git history 존재
- sign-off audit_logs 행 hash chain 검증 통과 (`lib/audit/verify-chain.ts`)

---

## §3 게이트 (Phase Gates)

| Gate | 위치 | 통과 조건 | 실패 시 |
|------|------|-----------|---------|
| Gate-A | M0 직후 | migration + schema + 테이블 생성 테스트 green | M1~M5 착수 불가 |
| Gate-B | M1~M4 각 milestone | AC-2, AC-3, AC-4, AC-5 각각 통과 | 다음 milestone 착수 보류 + plan 재검토 |
| Gate-C | M5 완료 | AC-1~AC-8 모두 통과 + hash chain 검증 | SPEC 완료 불가, plan-auditor 재검토 |

---

## §4 리스크 레지스터 (상세)

| ID | Risk | Probability | Impact | Mitigation | Owner |
|----|------|-------------|--------|-----------|-------|
| R1 | CI artifact 90일 만료 → evidence 누락 | 중 | 중 | artifact 만료 전 snapshot 수집; 만료 시 result=skip + 사유 | M2/M3 담당 |
| R2 | model-governance change-workflow 미구현 | 중 | 높음 | M4 fallback 모드 (git diff 휴리스틱); #71 완료 후 정식 연동 | M4 담당 |
| R3 | 7축 자동 분류 정확도 낮음 | 중 | 중 | high는 보수적 판정(과분류 허용); 사람이 residual_risk로 override | M4 담당 |
| R4 | audit_logs chain 실패 → sign-off 불가 | 낮 | 높음 | writeAudit 실패 시 500 + retry 3회; SPEC-V3-AUDIT-CHAIN-001 verifyDaily 선행 | M5 담당 |
| R5 | PDF export 범위 확장 요구 | 중 | 중 | REQ-VAL-011 Optional 고정; §8 Exclusions 명시 | SPEC owner |
| R6 | TRACEABILITY-001(#47) 지연 → report 내 섹션 누락 | 중 | 낮음 | report에 stub 섹션 허용; #47 완료 후 보강 | M5 담당 |
| R7 | release_id 체계 미정의 (RELEASE-001이 관리 안 함) | 중 | 중 | 본 SPEC에서 release_id 포맷 제안 (예: `v0.1.0-rc1`); RELEASE-001 sync | M0 담당 |

---

## §5 테스트 전략

### 5.1 단위 테스트 (vitest)

- 스키마 검증 (enum, CHECK, FK)
- Evidence collector 함수 (각 검증 항목 pass/fail/skip)
- 7축 분류 로직 (high/medium/low)
- Checklist 항목 평가
- Report builder 섹션별 출력

### 5.2 Integration 테스트

- 실DB 마이그레이션 + INSERT/SELECT
- CI run ID 매핑 (`gh` CLI mock 또는 fixture)
- API route happy/negative path (RBAC 거부, checklist 미충족 409)
- audit_logs chain 연속성 (writeAudit 후 verify-chain 통과)

### 5.3 E2E (제한적)

- Validation workflow 시나리오: IQ 수집 → OQ → PQ → change-control → report → sign-off 전 주기
- `tests/e2e/validation-signoff.spec.ts` (신규)

### 5.4 수동 QA (Gate 4 도메인 UAT)

- intended-use.md RA Lead 검토
- criticality 분류 RA Lead + QA Lead 합의
- residual risk 서술 검토

---

## §6 범위 통제 원칙 (Scope Discipline)

Charter [지양-5] 준수:

1. **신규 테스트 harness 금지** — 기존 CI 집계
2. **신규 QMS 워크플로우 금지** — model-gov, source-gov 재사용
3. **PDF 라이브러리 도입 금지** (M5에서는 Markdown only)
4. **다중 관할권 matrix 금지** (post-v0.1)
5. **real-time dashboard 금지** (별도 observability SPEC)

구현 중 scope creep 발견 시 §8 Exclusions로 이월하고 milestone을 재조정한다.

---

## §7 의존성 타임라인

```
AUDIT-CHAIN-001 (PR #356, MERGED) ──┐
                                     ├─→ M0 (schema) ─→ M5 (sign-off writes audit_logs)
FOUNDATION-001 (기존) ───────────────┤
                                     │
RELEASE-001 (기존) ──────────────────┼─→ M5 (report links release scope)
                                     │
TRACEABILITY-001 (#47, 진행중) ──────┼─→ M5 (report section, stub 허용)
                                     │
MODEL-GOVERNANCE-001 (#71, 진행중) ──┼─→ M4 (change-control 7축 중 model/prompt, fallback 허용)
                                     │
SOURCE-GOVERNANCE-001 (#48) ─────────┼─→ M4 (change-control 7축 중 source_policy, fallback 허용)
```

Non-blocking 의존성은 fallback 모드로 동작하며, 완료 후 정식 연동 PR로 전환.

---

## §8 Definition of Done (SPEC 완료 조건)

- [ ] AC-1~AC-8 모두 통과 (acceptance.md)
- [ ] M0~M5 모든 milestone Gate 통과
- [ ] `pnpm test` 전체 green
- [ ] `pnpm ci:migrations`, `pnpm ci:typecheck`, `pnpm ci:lint`, `pnpm ci:format` green
- [ ] `docs/validation/intended-use.md` git history 존재
- [ ] sign-off audit_logs 행 hash chain 검증 (`lib/audit/verify-chain.ts`)
- [ ] SPEC 문서 4종(spec/plan/acceptance/research) 최신 상태
- [ ] PR 본문에 QA evidence 섹션 (이슈 #49 MoAI 교차검증 기준)
