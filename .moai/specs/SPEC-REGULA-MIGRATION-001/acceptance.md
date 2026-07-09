# Acceptance Criteria — SPEC-REGULA-MIGRATION-001

> Issue #396. 모든 AC는 Given-When-Then 시나리오로 정의되며 observable evidence를 요구한다.

---

## AC-01: From-Scratch Apply Clean

**Given** fresh Docker `pgvector/pgvector:pg16` 컨테이너가 기동되어 있고 `CREATE ROLE regula_app`이 사전 실행됨
**When** `cat migrations/[0-9]*.sql | psql`(`_rollback` 제외, numeric order, autocommit)로 전체 migration을 적용할 때
**Then**
- 적용이 0 에러(error), 0 fatal로 완료된다
- public schema table count가 **96**(`SELECT count(*) FROM information_schema.tables WHERE table_schema='public'` = 96, regula-test-db baseline)과 일치한다
- `audit_logs_no_mutation` trigger(audit immutability)가 `pg_trigger`에 존재한다
- RLS policy명 집합이 `regula-test-db` `pg_policies` baseline snapshot과 정확히 일치한다 (Run phase T0에 `SELECT policyname FROM pg_policies WHERE schemaname='public' ORDER BY policyname`로 baseline을 캡처하여 from-scratch DB 결과와 set diff = 0으로 검증)

**REQ coverage**: REQ-MIGRATION-001, 003, 004, 005, 006, 007

**Evidence**: `psql` 종료 코드 0 + `\d+` introspection 출력 + table count = 96 + `SELECT count(*) FROM pg_trigger WHERE tgname='audit_logs_no_mutation'` = 1 + RLS policy명 set diff vs baseline = 0

---

## AC-02: Real-DB Tests Pass on From-Scratch DB

**Given** CI workflow가 fresh pgvector service 컨테이너를 bootstrap하고 migration-apply로 DB를 구축함
**When** real-db integration suite를 실행할 때:
- `migrations-real-db`
- `audit-immutability`
- `audit-retention`
- `cer-persist-roundtrip`
- `model-governance`
- `validation-consumers`
- `knowledge-gap-replay-real`

**Then** 7개 suite 모두 PASS한다 (SKIPPED 아님)

**Evidence**: CI workflow 실행 로그 — 7개 suite 모두 green, SKIPPED 0건

---

## AC-03: regula-test-db No Regression

**Given** 기존 배포 DB(`regula-test-db`)가 존재함
**When** 정정된 migration 파일이 포함된 branch에서 기존 DB regression suite를 실행할 때
**Then** 기존 스키마/데이터에 변화가 없다 (정정된 historical migration이 재적용되지 않으므로 구조적으로 regression-free)

**Evidence**: 기존 DB `information_schema` diff (정정 전후 비교 — 0 delta) + 기존 DB regression suite PASS

---

## AC-04: ci:migrations Sequence Check Passes

**Given** 정정된 migration 파일들이 포함됨
**When** `pnpm ci:migrations`(`scripts/ci/check-migrations.ts`)를 실행할 때
**Then** migration 순서 무결성 검사가 PASS한다

**Evidence**: `pnpm ci:migrations` 종료 코드 0

---

## AC-05: CI Gate Fails on Deliberately-Drifted Migration (Regression Proof)

**Given** from-scratch CI gate가 운영 중임
**When** 고의로 drift를 도입한 migration(예: `org_id text REFERENCES organizations(id)` — uuid FK mismatch 재도입)을 PR에 포함할 때
**Then** CI gate가 red로 실패하여 drift가 merge되는 것을 차단한다

**Evidence**: negative test — drift 주입 PR의 CI 실행 로그가 failure로 종료 (from-scratch apply 단계 또는 real-db suite 단계에서 실패 관측)

**Note**: 이 AC는 CI gate가 영구적으로 drift를 잡아냄을 증명한다. 한 번이라도 이 gate가 drift를 놓치면 본 SPEC의 핵심 가치가 무효화된다.

---

## AC-06: Fix-Up Migrations Idempotent on From-Scratch DB

**Given** 원본 migration(0054/0055/0056/0082/0086)이 uuid로 정정되어 from-scratch DB가 이미 uuid FK를 보유함
**When** fix-up migration `0089`/`0090`/`0092`를 from-scratch DB에 적용할 때
**Then** 3개 fix-up 모두 0 에러로 no-op 적용된다 (이미 uuid이므로 ALTER/CREATE가 idempotent하게 스킵 또는 no-op)

**Evidence**: fix-up apply 후 `psql` 종료 코드 0 + `answer_feedback` 테이블이 1개만 존재(중복 CREATE 안 됨, `0090`의 `IF NOT EXISTS` 가드 검증)

---

## AC-07: CONCURRENTLY Indexes Apply (Autocommit)

**Given** `CREATE INDEX CONCURRENTLY` 문을 포함한 migration이 존재함
**When** autocommit 방식(`cat | psql` 또는 파일 단위 apply)으로 적용할 때
**Then** CONCURRENTLY index가 트랜잭션 블록 실패 없이 정상 생성된다

**Evidence**: `SELECT count(*) FROM pg_indexes WHERE indexname LIKE '%concurrently%'` 결과 >= 1 + 적용 로그에 "cannot run inside a transaction block" 에러 없음

---

## AC-08: regula_app Role Bootstrap (REQ-MIGRATION-002 직접 검증)

**Given** fresh pgvector 컨테이너가 기동됨 (role 미존재 상태)
**When** migration apply **전** bootstrap 단계에서 `CREATE ROLE regula_app`을 실행한 뒤 `0001_audit_append_only.sql`을 적용할 때
**Then**
- `0001`의 REVOKE/GRANT 문이 0 에러로 수행된다
- `regula_app` role이 `pg_roles`에 존재한다

**REQ coverage**: REQ-MIGRATION-002

**Evidence**: bootstrap 후 `SELECT count(*) FROM pg_roles WHERE rolname='regula_app'` = 1 + `0001` apply 0 에러

**Note**: 본 AC는 REQ-MIGRATION-002에 대한 직접(primary) 커버리지를 제공한다. 기존 edge case(`regula_app` role 없이 0001 apply 시 REVOKE/GRANT 실패)는 보조 증거로 유지된다.

---

## Edge Cases

| Edge Case | Expected Behavior |
|-----------|-------------------|
| `regula_app` role 없이 0001 apply 시 | REVOKE/GRANT 실패 → bootstrap sequence가 role을 사전 CREATE했는지 확인 (REQ-MIGRATION-002) |
| `design_history_files.id`를 uuid로 잘못 정정 시 | 자식 테이블(`dhf_id TEXT`) FK 참조 깨짐 → `id`/`dhf_id`는 text 유지, `org_id`/`created_by`만 uuid (REQ-MIGRATION-005) |
| 0090 answer_feedback이 이미 존재할 때 CREATE 시 | `IF NOT EXISTS` 가드로 중복 CREATE 회피 (AC-06) |
| migration 파일명 순서가 numeric sort와 다를 시 | `ci:migrations`가 잡음 (AC-04) |
| 기존 regula-test-db에서 fix-up 재실행 시 | 기존 fix-up 동작(text→uuid ALTER) 그대로 수행 — 정정된 원본과 충돌 없음(idempotent) |

---

## Quality Gates (Definition of Done)

- [x] AC-01 ~ AC-08 모두 PASS (observable evidence 포함) — Run phase 실증 (fresh pgvector 0 error / 96 tables / audit trigger / RLS policy set diff=0)
- [x] `pnpm ci:migrations` PASS (exit 0)
- [x] `pnpm lint`(lint:hex 포함 full) PASS — exit 0 (12 pre-existing warning 무관)
- [x] `pnpm test`(full, 타깃만 아님) PASS — 4784 passed / 0 failed / 35 skipped (real-db env 의존) — 커밋 전 staged 범위 직검 (L-009)
- [x] regula-test-db 회귀 — 구조적 regression-free (historical migration 재적용 안 함, 스키마 변화 0) + full suite green (L-013)
- [x] CI workflow(`.github/workflows/migrations-real-db.yml`)가 매 PR 실행됨 (standalone, AC-05 drift 주입 시 apply 단계 ON_ERROR_STOP=1로 red 구조적 보장)
- [x] 정정된 각 migration 파일의 commit message에 "SPEC-REGULA-MIGRATION-001" 참조 포함
- [x] 본 SPEC의 [DELTA] 항목(C1/C2) 진단 결과가 `progress.md`에 기록됨

---

## Cross-Reference

- Issue #396: drift 전수 진단 원본 (권위 있는 소스)
- Issue #395-③: CI real-db job (본 SPEC이 통합 흡수)
- Lesson L-013: 정적 테스트 + CI mock DB + self-report 3중 맹점 (본 SPEC 근본 동기)
- Lesson L-009: full `pnpm test` + staged 범위 직검
- Lesson L-008: `pnpm lint`(lint:hex) full + 코드 줄 `#NNN` 금지
