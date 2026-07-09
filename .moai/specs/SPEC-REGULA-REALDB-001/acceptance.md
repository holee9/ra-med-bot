# Acceptance Criteria — SPEC-REGULA-REALDB-001

> Issue #395. Given-When-Then 시나리오 + observable evidence.

---

## AC-01: 4건 real-db 전환 (cer-persist 패턴)

**Given** `tests/fixtures/database.ts` foundation (getDb/truncateTables/seedCoreActors/HAS_DATABASE_URL) 존재
**When** 4건(rlhf-reranking-flow·rlhf-calibration·knowledge-gap-replay-real·model-governance)을 `vi.mock(@/lib/db/client)` 제거 + `beforeAll seedCoreActors` + `beforeEach truncateTables([domain],{cascade:true})` + lazy route import + `describe.skipIf(!HAS_DATABASE_URL)` 패턴으로 전환 (model-governance는 placeholder DB section을 실 lifecycle 테스트로 교체)
**Then**
- 4건 모두 `DATABASE_URL` 설정 시 실DB INSERT/SELECT/FK 검증 PASS (regula-test-db 또는 fresh pgvector)
- `DATABASE_URL` 미설정 시 우아하게 skip
- 각 파일의 외부 부작용 mock(research.md §3 실측 목록)은 유지

**Evidence**: 4건 `pnpm env:test vitest run <file>` PASS + `grep vi.mock.*db/client` 0건 + skip 시 SKIP 카운트 관찰.

**REQ**: REALDB-001, 002, 003

---

## AC-02: 전환 4건 CI real-db job 실행 (post-state 9 suite)

**Given** `.github/workflows/migrations-real-db.yml`에 7 suite 등록됨. 이 중 model-governance·knowledge-gap-replay-real 2건은 본 전환 대상과 중복 (현재 mock-based로 실행 중).
**When** 2 신규 파일(rlhf-reranking-flow·rlhf-calibration)을 suite 실행 목록에 추가
**Then** CI real-db job에서 매 PR **9 suite**(7 기존 + 2 신규)이 실DB 실행되어 PASS (SKIPPED 0건). model-governance·knowledge-gap-replay-real은 전환 후 동일 suite가 real-db로 실행(중복 등록 아님).

**Evidence**: CI workflow 실행 로그 — 9 suite green. `gh run view` 로그 확인.

**REQ**: REALDB-004

---

## AC-03: full mock-based suite 회귀 0

**Given** 전환 전 test pass count를 Run M0에서 측정 (baseline, hardcoded 값 아님)
**When** DATABASE_URL 미설정 상태로 `pnpm test` (full) 실행
**Then** 회귀 0 (failed 0). 전환 4건의 real-db case가 skip로 전환되어 passed는 감소하되, **failed 증가 = 0**

**Evidence**: `pnpm test` 전환 전후 비교 — failed 0 유지, passed 감소분 = 전환 4건의 real-db case 수(M0 측정).

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
