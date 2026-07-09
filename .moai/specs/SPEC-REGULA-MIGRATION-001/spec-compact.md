# SPEC-Compact — SPEC-REGULA-MIGRATION-001

> Issue #396 | v1.1.0 | From-Scratch Migration Apply Drift 정정 + CI 영구 Regression Gate

## Requirements (요구사항)

| ID | EARS Statement |
|----|---------------|
| REQ-MIGRATION-001 | `migrations/*.sql`(`_rollback` 제외) numeric order fresh pgvector DB apply 시 0 에러 + 전체 schema(audit trigger + RLS) 생성 |
| REQ-MIGRATION-002 | bootstrap 시 `regula_app` role을 0001 적용 전 CREATE |
| REQ-MIGRATION-003 | dead index 참조(`idx_sources_corpus`) 제거 |
| REQ-MIGRATION-004 | ordering/type/syntax bug 정정 (0004 DROP DEFAULT 순서, 0087 CONSTRAINT→INDEX, 0095 따옴표) |
| REQ-MIGRATION-005 | 0054/0055/0056/0082/0086 text→uuid FK 정정 + fix-up 0089/0090/0092 idempotent (bundle: D8 note) |
| REQ-MIGRATION-006 | 0014 트랜잭션 내부 에러 진단 후 수정 (ingest_jobs 생성) — lower-bound: 진단 결과 무관 AC-01 보장 |
| REQ-MIGRATION-007 | 0083 RLS policy 컬럼명 정합 |
| REQ-CI-001 | 매 PR fresh pgvector bootstrap + migration-apply CI workflow 추가 |
| REQ-CI-002 | real-db suite 7개(from-scratch DB) 실행 |
| REQ-CI-003 | drift 도입 시 CI red로 영구 차단 |
| REQ-SAFETY-001 | 기존 배포 DB regression-free |
| REQ-SAFETY-002 | CONCURRENTLY index 트랜잭션 블록 실패 없이 적용 (mechanism은 §4.3 autocommit) |
| REQ-SAFETY-003 | `pnpm ci:migrations` sequence check PASS |

## Acceptance Criteria (Given/When/Then — REQ ↔ AC traceability)

| AC# | Given | When | Then | REQ IDs |
|-----|-------|------|------|---------|
| AC-01 | fresh pgvector 컨테이너 + `regula_app` 사전 CREATE | `cat migrations/[0-9]*.sql \| psql` 전체 apply | 0 에러 + public table count=96 + `audit_log_hash_bi` trigger 존재 + RLS policy set = baseline | REQ-MIGRATION-001,003,004,005,006,007 |
| AC-02 | CI fresh pgvector service + migration-apply 구축 | real-db suite 7개 from-scratch DB 실행 | 7개 suite 모두 PASS (SKIPPED 아님) | REQ-CI-001,002 |
| AC-03 | 기존 `regula-test-db` 존재 | 정정 branch에서 regression suite 실행 | 기존 schema/data 변화 없음 (0 delta) | REQ-SAFETY-001 |
| AC-04 | 정정된 migration 포함 | `pnpm ci:migrations` 실행 | sequence check PASS (exit 0) | REQ-SAFETY-003 |
| AC-05 | from-scratch CI gate 운영 중 | 고의 drift 주입 PR (uuid FK mismatch 재도입) | CI red 실패로 drift merge 차단 | REQ-CI-003 |
| AC-06 | 원본 0054-0086 uuid 정정 완료 (from-scratch DB 이미 uuid) | fix-up 0089/0090/0092 from-scratch DB apply | 3개 fix-up 0 에러 no-op (idempotent) | REQ-MIGRATION-005 |
| AC-07 | CONCURRENTLY index 포함 migration 존재 | autocommit apply | CONCURRENTLY index 정상 생성 (트랜잭션 블록 실패 없음) | REQ-SAFETY-002 |
| AC-08 | fresh pgvector 컨테이너 (role 미존재) | bootstrap에서 `CREATE ROLE regula_app` 후 `0001` apply | `0001` REVOKE/GRANT 0 에러 + `regula_app` role `pg_roles` 존재 | REQ-MIGRATION-002 |

## Files to Modify ([MODIFY])

- `migrations/0002_chat_indexes.sql` — dead index 삭제 (D1)
- `migrations/0004_user_role_enum.sql` — DROP DEFAULT 순서 (D2)
- `migrations/0054_samd_assessments.sql` — org_id text→uuid (D3)
- `migrations/0055_design_history_files.sql` — org_id, created_by text→uuid (D4)
- `migrations/0056_submission_packages.sql` — org_id, created_by text→uuid (D5)
- `migrations/0082_rlhf.sql` — user_id text→uuid (D6)
- `migrations/0083_rls_with_check_clauses.sql` — RLS policy 컬럼 정합 (D8) [DELTA]
- `migrations/0086_knowledge_promo.sql` — promoted_by text→uuid (D7)
- `migrations/0087_project_memory.sql` — CONSTRAINT→INDEX (D9)
- `migrations/0089_*.sql`, `0090_*.sql`, `0092_*.sql` — idempotency 가드
- `migrations/0014_docingest_schema.sql` — 트랜잭션 내부 에러 수정 (D11) [DELTA]
- `migrations/0095_rlhf_calibration_candidates.sql` — 따옴표 제거 (D10)

> D1-D11 = 11개 drift point (research.md §2 drift map). B1 bootstrap role(`regula_app`)은 drift point가 아닌 사전 조건.

## Files to Create ([NEW])

- `.github/workflows/migrations-real-db.yml` (standalone — `ci.yml`에 job 추가하지 않음, 관심사 분리)

## Autocommit Apply (REQ-SAFETY-002 mechanism, §4.3)

- `CREATE INDEX CONCURRENTLY` 트랜잭션 블록 내 실행 불가 → `cat | psql` 파이프라인 또는 파일 단위 apply
- `BEGIN/COMMIT` 일괄 적용 금지 (CONCURRENTLY 실패 유발)

## Exclusions (What NOT to Build)

- base schema dump 생성
- 기존 배포 DB 데이터 migration
- `drizzle-kit push` 경로 수정
- schema.ts 재생성 / drizzle meta 동기화
- fix-up migration 신규 작성 (기존 fix-up idempotency 보강만)
- `migrations/*_rollback.sql` 수정
