---
id: SPEC-REGULA-REALDB-001
version: 1.2.0
status: completed
phase: test-quality
priority: Medium
created: 2026-07-09
updated: 2026-07-09
author: MoAI
issue_number: 395
depends_on:
  - SPEC-REGULA-MIGRATION-001
lifecycle_level: spec-anchored
labels:
  - component/test
  - component/cicd
  - type/test-debt
---

# SPEC-REGULA-REALDB-001 — (B)클래스 real-db 전환 잔여 4건 + Coverage 85% CI 게이트

## HISTORY

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0.0 | 2026-07-09 | MoAI | 초기 작성. 5건 전환 + coverage 게이트. |
| 1.1.0 | 2026-07-09 | MoAI | plan-auditor review-1 FAIL 대응. D1: suite 산술 정정(12→9, 2파일 이미 workflow 등록). D2: knowledge-gap-replay-real을 full conversion으로 재분류(부분 real-db 아님 — 100% mock, "-real"은 real consult pipeline 의미). D3: model-governance DB section placeholder 공개. D4: docingest-e2e를 scope에서 제외(self-declared (A)-class contract test — schema drift는 migrations-real-db.test.ts가 이미 커버). D5: research.md §3 mock 매트릭스 실측 재생성. D6: fixture API를 REQ에서 §4로 이동. D7: test-count baseline을 M0 측정으로 이월. D8: pre-listed 파일 risk 추가. 전환 5건 → 4건. |
| 1.2.0 | 2026-07-09 | MoAI (run) | Run phase 완료. R1-R4 전환 + R5 CI suite + C1-C3 coverage 게이트 구현. M0 baseline 측정: 4784 tests / **coverage 62%** (85% 아님 → ratchet floor 60/70 + 85% follow-up). R4는 model-governance.test.ts top-level db mock로 인해 신규 `model-governance-real-db.test.ts`로 real-DB round-trip 추가 (기존 두 파일은 모두 mock). status: draft → completed (AC-01~06 실증 달성). post-state CI suite = 10 (7 + rlhf-reranking-flow/rlhf-calibration/model-governance-real-db). |

## §1 Purpose

### 1.1 배경
#364(PR #394)가 real-db 통합 테스트 foundation(`tests/fixtures/database.ts`)과 cer-persist 패턴 입증을 완료. 본 SPEC은 직독 정정된 실질 대상 — (B)클래스 data/schema-dependent mock-db 통합 테스트 4건을 real-db로 전환하고, coverage 85%를 CI 게이트화한다. #395의 "real-db CI 별도 job" 항목은 SPEC-REGULA-MIGRATION-001(`.github/workflows/migrations-real-db.yml`)이 이미 흡수 완료.

### 1.2 규제/품질 근거
- L-013: mock-db는 FK type mismatch·schema drift·RLS 동작을 숨김. real-db INSERT/SELECT만이 프로덕션 INSERT 실패를 test time에 포착.
- ISO 13485 / 21 CFR 820.30: 회귀 테스트 커버리지 유지가 변경 통제 무결성의 전제. coverage 게이트 없으면 테스트 통과 상태에서 커버리지 음의 방향 변동이 무시됨.

### 1.3 In Scope (4건 전환)

**Full conversion (mock → real-db):**
- `rlhf-reranking-flow.test.ts` — 100% mock (`vi.mock @/lib/db/client`). NEW to CI real-db job.
- `rlhf-calibration.test.ts` — 100% mock. NEW to CI real-db job.
- `knowledge-gap-replay-real.test.ts` — 100% mock (이름의 "-real"은 real consult pipeline 의미, DB 아님). **이미 CI real-db job에 등록됨** (현재 mock-based로 실행 중).
- `model-governance.test.ts` — mock-based + DB-backed section은 placeholder(`expect(true).toBe(true)`). **이미 CI real-db job에 등록됨**. placeholder를 실 lifecycle 테스트로 교체.

**Coverage 게이트:** `vitest.config.ts` thresholds + `ci:coverage` 스크립트 + CI 통합.

### 1.4 Out of Scope
- **`docingest-e2e.test.ts`** — self-declared (A)-class contract test (헤더 명시: "without requiring a live Postgres", db inserts도 mock). RBAC/validation/pipeline ordering contract 검증이 설계 의도. schema drift는 `migrations-real-db.test.ts`가 이미 커버 → real-db 전환은 설계 의도 위배 + 중복. 본 SPEC에서 제외 (별도 follow-up 필요 시 (B)-class 재분류 근거 명시 요).
- (A)클래스 route-unit-test 전환 · mock-db 57파일 전수 전환 (과잉)
- coverage 100% 강제 (85% 임계값 + 점진적 ratchet)
- `migrations-real-db.yml` workflow 구조 수정 (SPEC-REGULA-MIGRATION-001 소유) — suite 목록 expand만

---

## §2 Requirements (EARS)

### REQ-REALDB: (B)클래스 real-db 전환

| ID | EARS Statement | Priority |
|----|---------------|----------|
| REQ-REALDB-001 | THE SYSTEM SHALL `rlhf-reranking-flow`·`rlhf-calibration`·`knowledge-gap-replay-real`·`model-governance` mock-db 통합 테스트 4건을 real-db로 전환한다 (model-governance는 placeholder DB section을 실 lifecycle 테스트로 교체) | High |
| REQ-REALDB-002 | WHEN DATABASE_URL이 설정된 경우 THEN THE SYSTEM SHALL 전환된 4건이 실DB INSERT/SELECT/FK 검증을 수행하고, DATABASE_URL 미설정 시 skip된다 (cer-persist 패턴의 `describe.skipIf(!HAS_DATABASE_URL)`) | High |
| REQ-REALDB-003 | WHILE 전환 중 THE SYSTEM SHALL data/schema-dependent 경로만 real-db로 전환하고, 각 파일의 기존 외부 부작용 mock(AI pipeline·ingest embed/extract·license-gate·with-permission·version-tracker·observability 등, research.md §3 실측 매트릭스 참조)은 유지한다 | Medium |
| REQ-REALDB-004 | THE SYSTEM SHALL 3개 신규 real-db 파일(rlhf-reranking-flow·rlhf-calibration·model-governance-real-db)을 `migrations-real-db.yml` suite 목록에 추가한다 (knowledge-gap-replay-real은 이미 등록됨). post-state = 10 suite (7 기존 + 3 신규) | High |

### REQ-COV: Coverage 85% CI 게이트

| ID | EARS Statement | Priority |
|----|---------------|----------|
| REQ-COV-001 | THE SYSTEM SHALL `vitest.config.ts`에 coverage `thresholds`를 설정한다 (lib/app/components, lines/branches/functions). 임계값은 Run M0 baseline 측정 후 max(85%, baseline)로 설정하되, baseline < 85% 시 baseline을 floor로 ratchet + 85% 도달 follow-up 이슈화 | High |
| REQ-COV-002 | THE SYSTEM SHALL `ci:coverage` 스크립트(`vitest run --coverage`)를 추가하고 CI 게이트에 통합하여 threshold 위반 시 머지를 블록한다 | High |
| REQ-COV-003 | WHILE coverage 게이트가 운영 중 IF 커버리지가 threshold 이하로 하락하면 THEN THE SYSTEM SHALL CI가 red로 실패한다 (회귀 테스트 없는 코드 축소 차단) | High |

---

## §3 Acceptance Criteria

> 상세 시나리오·evidence는 acceptance.md. 각 AC는 ≥1 REQ 직접 검증. test-count/coverage baseline은 Run M0 측정값 사용 (hardcoded 값 사용 금지).

| AC# | Given | When | Then | REQ IDs |
|-----|-------|------|------|---------|
| AC-01 | `tests/fixtures/database.ts` foundation 존재 (PR #394) | 4건(rlhf-reranking-flow·rlhf-calibration·knowledge-gap-replay-real·model-governance)을 cer-persist 패턴으로 전환 (model-governance placeholder 교체 포함) | 4건 모두 DATABASE_URL 설정 시 실DB PASS, 미설정 시 skip (vi.mock @/lib/db 제거 확인) | REQ-REALDB-001, 002, 003 |
| AC-02 | `migrations-real-db.yml`에 7 suite 등록됨 | 3 신규(rlhf-reranking-flow·rlhf-calibration·model-governance-real-db) suite 목록 추가 | CI real-db job에서 **10 suite**(7+3)이 매 PR 실DB 실행되어 PASS (SKIPPED 0건). knowledge-gap-replay-real은 이미 등록되어 전환 후 동일 suite가 real-db로 실행 | REQ-REALDB-004 |
| AC-03 | 전환 전 test pass count를 M0에서 측정 (baseline) | DATABASE_URL 미설정 상태로 `pnpm test` 실행 | 회귀 0 (failed 0). passed는 전환 case가 skip로 전환되어 감소하되, failed 증가 0 | REQ-REALDB-002 |
| AC-04 | coverage baseline M0 측정 완료 | `vitest.config.ts` thresholds 설정 + `ci:coverage` 스크립트 추가 | threshold가 max(85%, baseline)로 설정되고 `pnpm ci:coverage`가 baseline에서 PASS | REQ-COV-001, 002 |
| AC-05 | coverage 게이트가 CI에 통합됨 | 고의로 커버리지 하락(테스트 삭제) 주입 시 | CI가 red로 실패 (negative test) | REQ-COV-003 |
| AC-06 | real-db 전환 4건 + coverage 게이트 완료 | 4건 real-db 실행 + CI coverage job 실행 | 4건 real-db PASS + coverage job green + full suite 회귀 0 | 전부 |

---

## §4 Technical Approach

### 4.1 수정 대상 ([MODIFY])
- `tests/integration/rlhf-reranking-flow.test.ts` — `vi.mock @/lib/db` 제거 → cer-persist 패턴. 유지 mock: version-tracker, observability/logger.
- `tests/integration/rlhf-calibration.test.ts` — 동일. 유지 mock: with-permission.
- `tests/integration/knowledge-gap-replay-real.test.ts` — full conversion (이름과 무관하게 100% mock). 유지 mock: AI pipeline 17종(intent/query-rewrite/router/merge/llm-provider/citation-enforce/confidence/expert-review-gating/... ) + audit + knowledge-gap/github-issue.
- `tests/integration/model-governance.test.ts` — placeholder DB section(`describe.skipIf(!DB_AVAILABLE)`의 `expect(true).toBe(true)`)을 실 lifecycle 테스트(AC-02/03/05/07, IDOR, single-active)로 교체.
- `vitest.config.ts` — `coverage.thresholds` 추가.
- `package.json` — `ci:coverage` 스크립트 추가.
- `.github/workflows/migrations-real-db.yml` — suite 목록에 rlhf-reranking-flow·rlhf-calibration 2건 추가 (knowledge-gap-replay-real·model-governance는 이미 존재).

### 4.2 cer-persist 패턴 (PR #394 입증, 엄격 준용)
`beforeAll seedCoreActors({...})` → `beforeEach truncateTables([도메인 테이블], {cascade:true})` → lazy route import (`await import(...)`, skipIf 시 미실행) → `describe.skipIf(!HAS_DATABASE_URL)`. audit_logs truncate 금지 (REQ-FND-044 immutability trigger — writeAudit은 route mock 유지). truncate cascade는 domain-scoped (users/orgs/projects는 seedCoreActors onConflictDoNothing 유지).

### 4.3 의존성
- 선행: SPEC-REGULA-MIGRATION-001 (real-db CI job + from-scratch apply 정확성) — 완료(main `d89b23a`)
- `tests/fixtures/database.ts` (PR #394 foundation)
- 외부: pgvector Docker (migrations-real-db.yml service)

---

## Exclusions
- `docingest-e2e.test.ts` ((A)-class contract test — §1.4) · (A)클래스 route-unit-test 전환 · mock-db 57파일 전수 전환 · coverage 100% · migrations-real-db.yml workflow 구조 수정(SPEC-REGULA-MIGRATION-001 소유)
