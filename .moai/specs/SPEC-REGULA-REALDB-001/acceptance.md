# Acceptance Criteria — SPEC-REGULA-REALDB-001

> Issue #395. Given-When-Then 시나리오 + observable evidence.

---

## AC-01: 5건 real-db 전환/확장 (cer-persist 패턴)

**Given** `tests/fixtures/database.ts` foundation (getDb/truncateTables/seedCoreActors/HAS_DATABASE_URL) 존재
**When** 5건(rlhf-reranking-flow·docingest-e2e·knowledge-gap-replay-real·rlhf-calibration·model-governance)을 `vi.mock(@/lib/db/client)` 제거 + `beforeAll seedCoreActors` + `beforeEach truncateTables([domain],{cascade:true})` + lazy route import + `it.skipIf(!HAS_DATABASE_URL)` 패턴으로 전환/확장
**Then**
- 5건 모두 `DATABASE_URL` 설정 시 실DB INSERT/SELECT/FK 검증 PASS (regula-test-db 또는 fresh pgvector)
- `DATABASE_URL` 미설정 시 우아하게 skip
- route 로직 격리용 외부 mock(audit/with-permission/inngest)은 유지

**Evidence**: 5건 `pnpm env:test vitest run <file>` PASS + `grep vi.mock.*db/client` 0건 + skip 시 SKIP 카운트 관찰.

**REQ**: REALDB-001, 002, 003

---

## AC-02: 전환 5건 CI real-db job 실행

**Given** `.github/workflows/migrations-real-db.yml` (SPEC-REGULA-MIGRATION-001)이 fresh pgvector + from-scratch apply 후 real-db suite 실행
**When** 전환된 5건을 suite 실행 목록에 추가
**Then** CI real-db job에서 매 PR 5건이 실DB 실행되어 PASS (기존 7 suite + 5 = 12 suite green, SKIPPED 0건)

**Evidence**: CI workflow 실행 로그 — 12 suite green. `gh run view` 로직 확인.

**REQ**: REALDB-004

---

## AC-03: full mock-based suite 회귀 0

**Given** DATABASE_URL 미설정 환경
**When** `pnpm test` (full) 실행
**Then** 전환된 5건이 skip되고 나머지가 green — 회귀 0 (기존 4784 baseline 유지, skip 증가분 = 전환 5건의 real-db case)

**Evidence**: `pnpm test` 0 failed (전환 전후 비교 — passed 감소 = 0, skip 증가 = 전환 case 수).

**REQ**: REALDB-002

---

## AC-04: coverage threshold + ci:coverage 스크립트

**Given** Run M0에서 `pnpm vitest run --coverage`로 lib/app/components baseline 측정 완료
**When** `vitest.config.ts`에 `coverage.thresholds`({lines, branches, functions})를 max(85%, baseline)로 설정 + `package.json`에 `ci:coverage` 스크립트 추가
**Then** `pnpm ci:coverage`가 baseline에서 PASS (threshold 위반 0)

**Evidence**: `pnpm ci:coverage` exit 0 + thresholds config 직검. baseline < 85% 시 baseline floor + follow-up 이슈.

**REQ**: COV-001, 002

---

## AC-05: coverage negative test (하락 시 red)

**Given** coverage 게이트가 CI에 통합됨
**When** 고의로 커버리지 하락(테스트 1개 삭제 또는 threshold 상회 하락) 주입
**Then** CI가 red로 실패 (회귀 테스트 없는 코드 축소 차단)

**Evidence**: negative test — threshold 위반 시 `pnpm ci:coverage` exit ≠ 0 / CI job failure.

**REQ**: COV-003

---

## AC-06: 통합 (5건 real-db + coverage 게이트)

**Given** real-db 전환 5건 + coverage 게이트 완료
**When** regula-test-db(또는 fresh pgvector)에서 5건 실행 + CI coverage job 실행
**Then** 5건 real-db PASS + coverage job green + full suite 회귀 0

**Evidence**: 통합 CI 실행 로직 + 로컬 `pnpm env:test` 5건 PASS + `pnpm ci:coverage` exit 0.

**REQ**: 전부

---

## Edge Cases

| Edge Case | Expected Behavior |
|-----------|-------------------|
| 전환 파일의 INSERT 경로가 audit_logs 참조 시 | truncateTables에서 audit_logs 제외 (REQ-FND-044 immutability trigger). writeAudit은 mock. |
| 전환 파일의 도메인이 shared reference table(users/orgs) 참조 시 | truncate cascade는 domain-scoped만 — users/orgs/projects는 seedCoreActors가 onConflictDoNothing 유지 |
| coverage baseline이 85% 미만 시 | threshold를 baseline으로 ratchet, 85% 도달 follow-up 이슈화 (즉시 85% 강제 red 방지) |
| migrations-real-db.yml suite 목록 추가로 CI 시간 증가 시 | 5건은 실DB 의존도에 따라 순차 실행; 시간 임계값 초과 시 별도 job 분할 검토 |
| knowledge-gap-replay-real/model-governance의 기존 real-db case와 충돌 시 | 확장은 additive — 기존 case 보존, 신규 real-db case 추가 |

---

## Quality Gates (DoD)

- [ ] AC-01 ~ AC-06 모두 PASS (observable evidence)
- [ ] `pnpm test` 회귀 0 (전환 전후 0 failed)
- [ ] `pnpm ci:coverage` exit 0
- [ ] `pnpm ci:*` (lint/typecheck/audit/rbac/migrations) 전 0
- [ ] CI real-db job 12 suite green (7 기존 + 5 전환)
- [ ] commit message에 "SPEC-REGULA-REALDB-001" + issue #395 참조
