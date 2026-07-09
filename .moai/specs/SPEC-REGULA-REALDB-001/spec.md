---
id: SPEC-REGULA-REALDB-001
version: 1.0.0
status: draft
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

# SPEC-REGULA-REALDB-001 — (B)클래스 real-db 전환 잔여 5건 + Coverage 85% CI 게이트

## §1 Purpose

### 1.1 배경
#364(PR #394)가 real-db 통합 테스트 foundation(`tests/fixtures/database.ts`)과 cer-persist 패턴 입증을 완료. 본 SPEC은 직독 정정된 실질 대상 — (B)클래스 data/schema-dependent mock-db 통합 테스트 5건을 real-db로 전환하고, coverage 85%를 CI 게이트화한다. #395의 "real-db CI 별도 job" 항목은 SPEC-REGULA-MIGRATION-001(`.github/workflows/migrations-real-db.yml`)이 이미 흡수 완료.

### 1.2 규제/품질 근거
- L-013: mock-db는 FK type mismatch·schema drift·RLS 동작을 숨김. real-db INSERT/SELECT만이 프로덕션 INSERT 실패를 test time에 포착.
- ISO 13485 / 21 CFR 820.30: 회귀 테스트 커버리지 유지가 변경 통제 무결성의 전제. coverage 게이트 없으면 테스트 통과 상태에서 커버리지 음의 방향 변동이 무시됨.

### 1.3 In Scope
- 5건 real-db 전환: rlhf-reranking-flow · docingest-e2e · knowledge-gap-replay-real(확장) · rlhf-calibration · model-governance(확장)
- `vitest.config.ts` coverage `thresholds` 설정 + `ci:coverage` 스크립트 + CI 게이트 통합
- 전환된 5건을 `migrations-real-db.yml` real-db suite 목록에 추가

### 1.4 Out of Scope
- (A)클래스 route-unit-test 전환 (lib mock + route 인자 검증, 실DB 무관 → 전환 불필요)
- mock-db 57파일 전수 전환 (과잉 — #364 직독 정정: 실질 대상 (B)~6개 + 기존 real-db)
- coverage 100% 강제 (85% 임계값 + 점진적 ratchet)
- `migrations-real-db.yml` workflow 자체 수정 (SPEC-REGULA-MIGRATION-001 소유) — 본 SPEC은 suite 목록 확장만

---

## §2 Requirements (EARS)

### REQ-REALDB: (B)클래스 real-db 전환

| ID | EARS Statement | Priority |
|----|---------------|----------|
| REQ-REALDB-001 | THE SYSTEM SHALL `rlhf-reranking-flow`·`docingest-e2e`·`rlhf-calibration` mock-db 통합 테스트를 real-db로 전환하고 `knowledge-gap-replay-real`·`model-governance`의 real-db 경로를 확장한다 (`tests/fixtures/database.ts` foundation — seedCoreActors + truncateTables + lazy import + HAS_DATABASE_URL 가드, cer-persist 패턴 준용) | High |
| REQ-REALDB-002 | WHEN DATABASE_URL이 설정된 경우 THEN THE SYSTEM SHALL 전환된 5건이 실DB INSERT/SELECT/FK 검증을 수행하고, DATABASE_URL 미설정 시 `it.skipIf(!HAS_DATABASE_URL)`로 우아하게 skip된다 | High |
| REQ-REALDB-003 | WHILE 전환 중 THE SYSTEM SHALL route 로직 격리용 mock(audit/with-permission/project-ownership/inngest 등 외부 부작용)은 유지하고 data/schema-dependent 경로만 real-db로 전환한다 (cer-persist 패턴) | Medium |
| REQ-REALDB-004 | THE SYSTEM SHALL 전환된 5건을 `.github/workflows/migrations-real-db.yml`의 real-db suite 실행 목록에 추가하여 CI에서 매 PR 실DB 실행되게 한다 | High |

### REQ-COV: Coverage 85% CI 게이트

| ID | EARS Statement | Priority |
|----|---------------|----------|
| REQ-COV-001 | THE SYSTEM SHALL `vitest.config.ts`에 coverage `thresholds`를 설정한다 (lib/app/components, lines/branches/functions). 임계값은 Run M0 baseline 측정 후 max(85%, baseline)로 설정하되, baseline < 85% 시 baseline을 floor로 ratchet + 85% 도달 follow-up 이슈화 | High |
| REQ-COV-002 | THE SYSTEM SHALL `ci:coverage` 스크립트(`vitest run --coverage`)를 추가하고 CI 게이트에 통합하여 threshold 위반 시 머지를 블록한다 | High |
| REQ-COV-003 | WHILE coverage 게이트가 운영 중 IF 커버리지가 threshold 이하로 하락하면 THEN THE SYSTEM SHALL CI가 red로 실패한다 (회귀 테스트 없는 코드 축소 차단) | High |

---

## §3 Acceptance Criteria

> 상세 시나리오·evidence는 acceptance.md. 각 AC는 ≥1 REQ 직접 검증.

| AC# | Given | When | Then | REQ IDs |
|-----|-------|------|------|---------|
| AC-01 | `tests/fixtures/database.ts` foundation 존재 (PR #394) | 5건(rlhf-reranking-flow·docingest-e2e·knowledge-gap-replay-real·rlhf-calibration·model-governance)을 cer-persist 패턴으로 전환/확장 | 5건 모두 DATABASE_URL 설정 시 실DB에서 PASS, 미설정 시 skip (vi.mock @/lib/db 제거 확인) | REQ-REALDB-001, 002, 003 |
| AC-02 | `migrations-real-db.yml` real-db job 존재 (SPEC-REGULA-MIGRATION-001) | 전환된 5건을 suite 실행 목록에 추가 | CI real-db job에서 5건이 매 PR 실DB 실행되어 PASS (기존 7 suite + 5 = 12 suite green) | REQ-REALDB-004 |
| AC-03 | full mock-based test suite (DATABASE_URL 미설정) | `pnpm test` 실행 | 회귀 0 (전환된 5건 skip, 나머지 green) — 기존 4784 baseline 유지 | REQ-REALDB-002 |
| AC-04 | coverage baseline 측정 완료 (Run M0) | `vitest.config.ts` thresholds 설정 + `ci:coverage` 스크립트 추가 | threshold가 max(85%, baseline)로 설정되고 `pnpm ci:coverage`가 baseline에서 PASS | REQ-COV-001, 002 |
| AC-05 | coverage 게이트가 CI에 통합됨 | 고의로 커버리지 하락(테스트 삭제) 주입 시 | CI가 red로 실패 (negative test) | REQ-COV-003 |
| AC-06 | real-db 전환 5건 + coverage 게이트 완료 | regula-test-db(또는 fresh pgvector)에서 5건 실행 + CI coverage job 실행 | 5건 real-db PASS + coverage job green, full suite 회귀 0 | 전부 |

---

## §4 Technical Approach

### 4.1 수정 대상 ([MODIFY])
- `tests/integration/rlhf-reranking-flow.test.ts` — vi.mock(@/lib/db) 제거 → seedCoreActors + truncateTables([answer_feedback, ...]) + lazy import
- `tests/integration/docingest-e2e.test.ts` — 동일 패턴 (도메인: organization_documents/document_chunks)
- `tests/integration/knowledge-gap-replay-real.test.ts` — real-db 경로 확장 (unanswered_queue/knowledge_gaps)
- `tests/integration/rlhf-calibration.test.ts` — 동일 (calibration_candidates)
- `tests/integration/model-governance.test.ts` — real-db 경로 확장 (prompt_registry/model_pin/change_request/approved_combination)
- `vitest.config.ts` — `coverage.thresholds` 추가
- `package.json` — `ci:coverage` 스크립트 추가
- `.github/workflows/migrations-real-db.yml` — suite 목록에 5건 추가 (또는 tests/integration/** glob 전환 검토)

### 4.2 신규 ([NEW])
- (없음 — foundation은 PR #394에 이미 존재)

### 4.3 의존성
- 선행: SPEC-REGULA-MIGRATION-001 (real-db CI job + from-scratch apply 정확성) — 완료(main `d89b23a`)
- `tests/fixtures/database.ts` (PR #394 foundation)
- 외부: pgvector Docker (migrations-real-db.yml service)

---

## Exclusions
- (A)클래스 route-unit-test 전환 · mock-db 57파일 전수 전환 · coverage 100% · migrations-real-db.yml workflow 구조 수정(SPEC-REGULA-MIGRATION-001 소유)
