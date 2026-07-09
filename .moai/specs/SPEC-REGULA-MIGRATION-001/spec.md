---
id: SPEC-REGULA-MIGRATION-001
version: 1.2.0
status: completed
phase: migration-debt
priority: High
created: 2026-07-09
updated: 2026-07-09
author: MoAI (manager-spec)
issue_number: 396
depends_on:
  - SPEC-REGULA-FOUNDATION-001
  - SPEC-REGULA-DOCINGEST-001
  - SPEC-REGULA-RLHF-001
  - SPEC-REGULA-KNOWLEDGE-PROMO-001
lifecycle_level: spec-anchored
labels:
  - component/db
  - component/cicd
  - type/migration-debt
---

# SPEC-REGULA-MIGRATION-001 — From-Scratch Migration Apply Drift 정정 및 CI 영구 Regression Gate

## HISTORY

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0.0 | 2026-07-09 | MoAI (manager-spec) | 초기 작성. Issue #396 기반. 11개 drift point + bootstrap role + fix-up idempotency + CI real-db gate 통합. |
| 1.1.0 | 2026-07-09 | MoAI (manager-spec) | plan-auditor review-1 FAIL 대응. MP-2: §3 AC를 Given/When/Then로 재작성 + REQ↔AC traceability column 추가(D5). D3: REQ-SAFETY-002에서 mechanism 제거(§4.3으로 이동). D4: AC-01 table count(96)·RLS policy set pin. D6: drift count 10→11(research.md D1-D11) 정정. D7: CI workflow 경로 standalone으로 확정. D8: bundled REQs에 명시 주석. D9: REQ-MIGRATION-006 acceptance lower-bound 추가. 신규 AC-08(REQ-MIGRATION-002 regula_app role 직접 커버). |
| 1.2.0 | 2026-07-09 | MoAI (run) | Run phase [DELTA] 정정. (1) AC-01 audit trigger명 `audit_log_hash_bi` → `audit_logs_no_mutation`(해시 체인은 lib/audit.ts app-side 계산이며 DB trigger 아님 — `audit_log_hash_bi`는 어떤 migration에도 미존재). (2) D11(0014) 원인 정정: 0014 트랜잭션 문제가 아니라 0017 §3이 ingest_jobs를 의도적 DROP 했으나 0083/0084가 여전히 참조 → dead reference 제거. (3) D3(0054): org_id 외 created_by도 text→uuid(원본 drift map은 org_id만 명시). (4) fix-up 0089/0090/0092는 이미 IF NOT EXISTS로 idempotent — 수정 불필요. status: draft → completed (AC-01~08 전부 실증 달성). |

> **Frontmatter convention note**: 본 SPEC은 `created_at`이 아닌 `created` 필드를 사용한다. 이는 프로젝트 관례(SPEC-REGULA-RLHF-001 외 전체 기존 SPEC이 `created` 사용, plan workflow Phase 2 명세 일치)이며, plan-auditor review-1 MP-3의 `created_at` 권장은 과도하게 일반화된 rubric의 false-positive로 판단하여 유지한다. 오케스트레이터 게이트에서 처리 예정.

---

## §1 Purpose (목적)

### 1.1 배경 (Background)

Regula의 `migrations/*.sql` 세트는 fresh PostgreSQL 16 + pgvector 컨테이너에 from-scratch로 적용되지 않는다. 두 개의 bootstrap path가 모두 깨져 있다:

1. `drizzle-kit push` (`pnpm db:migrate`): CI에서 interactive TTY prompt로 실패 + migration-only 객체(audit immutability trigger 등) 누락.
2. `migrations/*.sql` 순차 적용: drift — 11개 지점(D1-D11, research.md §2 drift map 참조)이 존재하지 않거나 잘못된 타입의 객체/컬럼을 참조.

`regula-test-db`는 historical accident로만 동작한다 (과거 증분 적용이 drift를 흡수). base schema dump가 없다.

**더 심각한 문제**: real-db integration test suite(`migrations-real-db`, `audit-immutability`, `audit-retention`, `cer-persist-roundtrip`, `model-governance`, `validation-consumers`, `knowledge-gap-replay-real`)이 main CI gate(`.github/workflows/ci.yml`의 `ci:test` job, postgres service 없음)에서 SKIPPED된다. 이것이 L-013 안전망(실DB 실행 검증)이 CI에서 절대 발화하지 않는 근본 원인이며, drift가 CI green 상태로 누적되게 만든 구조적 맹점이다.

### 1.2 규제 근거 (Regulatory Anchor)

- 21 CFR Part 11 §11.10(e) audit immutability: migration `0001_audit_append_only.sql`이 from-scratch apply에서 누락되면 audit 무결성 trigger가 부재한 DB가 production에 배포될 수 있다. 이것은 규제 위반이다.
- ISO 13485 지속적 개선: CI gate가 migration drift를 영구적으로 잡아내어 변경 통제(change control) 무결성을 보장한다.

### 1.3 본 SPEC의 범위 (In Scope)

- `migrations/*.sql` 11개 drift point 정정 (D1-D11, 원본 파일 직접 수정 방식)
- bootstrap sequence: `regula_app` role 사전 CREATE
- fix-up migration(`0089`/`0090`/`0092`) idempotency 보장 (deployed + from-scratch DB 모두 안전)
- `0014_docingest_schema.sql` 트랜잭션 내부 에러 진단 및 수정
- `0083_rls_with_check_clauses.sql` RLS policy 대상 테이블 컬럼 정합
- from-scratch-apply CI workflow 추가 (`.github/workflows/`, 매 PR 실행, postgres service + pgvector)

### 1.4 Out of Scope

- base schema dump 생성 (대안 접근이나 본 SPEC은 migration-apply 정정에 한정)
- historical DB(regula-test-db) 데이터 migration (기존 DB는 재적용 안 함 — regression-free)
- `drizzle-kit push` 경로 수정 (본 SPEC은 migration-apply 경로 정정; push는 보조 수단으로만 취급)
- schema.ts 재생성 또는 drizzle meta 동기화 (별도 작업)

---

## §2 Requirements (EARS Format)

### REQ-MIGRATION: From-Scratch Apply Cleanliness (drift 정정)

> **REQ-granularity note (D8)**: REQ-MIGRATION-001과 REQ-MIGRATION-005는 각각 2개의 separable outcome을 bundle한다(001: apply-clean + schema 생성; 005: FK 정정 + fix-up idempotency). 본 SPEC은 REQ-ID 안정성을 위해 bundle을 유지하되, 각 outcome은 별도 AC로 분리 검증한다(001→AC-01/AC-08, 005→AC-01/AC-06). atomic 분할은 Run 단계에서 필요 시 수행.

| ID | EARS Statement | Priority |
|----|---------------|----------|
| REQ-MIGRATION-001 | THE SYSTEM SHALL `migrations/*.sql`(`_rollback` 제외)을 numeric order로 fresh pgvector DB에 from-scratch 적용 시 0 에러로 완료하고, 모든 테이블 + audit immutability trigger + RLS policy를 생성한다 | High |
| REQ-MIGRATION-002 | THE SYSTEM SHALL bootstrap 시 `regula_app` role을 `0001` 적용 전에 CREATE하여 REVOKE/GRANT가 실패하지 않게 한다 | High |
| REQ-MIGRATION-003 | THE SYSTEM SHALL 이미 제거된 컬럼(`sources.corpus`)에 대한 dead index 참조(`idx_sources_corpus`)를 migration에서 제거한다 | High |
| REQ-MIGRATION-004 | THE SYSTEM SHALL 각 migration이 standalone-clean하게 적용되도록 ordering/type/syntax bug를 정정한다 (`0004` DROP DEFAULT 순서, `0087` CONSTRAINT→INDEX, `0095` 따옴표 제거) | High |
| REQ-MIGRATION-005 | THE SYSTEM SHALL `0054`/`0055`/`0056`/`0082`/`0086` 원본의 text→uuid FK mismatch를 uuid로 정정하고, fix-up `0089`/`0090`/`0092`는 deployed DB와 from-scratch DB 모두에서 idempotent(no-op when already uuid)하게 유지한다 | High |
| REQ-MIGRATION-006 | WHEN `0014_docingest_schema.sql`의 BEGIN/COMMIT 트랜잭션 내부 에러가 진단되면 THEN THE SYSTEM SHALL 해당 에러를 수정하여 `ingest_jobs`(및 의존 테이블)가 정상 생성되게 한다. **Acceptance lower-bound**: 진단 결과(단일/다중 root cause)에 상관없이, `ingest_jobs` 테이블이 from-scratch apply에서 0 에러로 생성됨을 AC-01이 보장한다 | High |
| REQ-MIGRATION-007 | WHEN `0083_rls_with_check_clauses.sql`의 RLS policy가 미존재 컬럼(`organization_id`)을 참조하면 THEN THE SYSTEM SHALL 대상 테이블의 실제 컬럼명으로 정합한다 | High |

### REQ-CI: From-Scratch CI Gate (영구 regression 예방)

| ID | EARS Statement | Priority |
|----|---------------|----------|
| REQ-CI-001 | THE SYSTEM SHALL 매 PR마다 fresh postgres + pgvector service 컨테이너를 bootstrap하고 migration-apply(`drizzle-kit push` 아님)로 DB를 구축하는 CI workflow를 `.github/workflows/`에 추가한다 | High |
| REQ-CI-002 | WHEN from-scratch CI DB가 구축되면 THEN THE SYSTEM SHALL real-db integration suite(`migrations-real-db`, `audit-immutability`, `audit-retention`, `cer-persist-roundtrip`, `model-governance`, `validation-consumers`, `knowledge-gap-replay-real`)을 실행한다 | High |
| REQ-CI-003 | IF migration drift가 도입되면 THEN THE SYSTEM SHALL CI gate가 red로 실패하여 drift가 merge되는 것을 영구적으로 차단한다 | High |

### REQ-SAFETY: 기존 DB Regression-Free + CONCURRENTLY

| ID | EARS Statement | Priority |
|----|---------------|----------|
| REQ-SAFETY-001 | WHILE 원본 migration 파일이 정정되는 동안 THE SYSTEM SHALL 기존 배포 DB(`regula-test-db`)의 schema에 변화를 주지 않는다 (기존 DB는 historical migration을 재적용하지 않으므로 regression-free) | High |
| REQ-SAFETY-002 | THE SYSTEM SHALL `CREATE INDEX CONCURRENTLY` 문을 포함한 migration이 트랜잭션 블록 실패("cannot run inside a transaction block") 없이 적용된다 | Medium |
| REQ-SAFETY-003 | THE SYSTEM SHALL `pnpm ci:migrations` sequence check가 정정 후에도 PASS하도록 migration 순서 무결성을 유지한다 | Medium |

---

## §3 Acceptance Criteria

> 모든 AC는 Given/When/Then 시나리오로 정의된다 (상세 시나리오·evidence는 acceptance.md). 각 AC는 ≥1개 REQ를 직접 검증한다 (REQ ↔ AC traceability column 참조).

| AC# | Given | When | Then | REQ IDs | Verification |
|-----|-------|------|------|---------|--------------|
| AC-01 | fresh Docker `pgvector/pgvector:pg16` 컨테이너가 기동되고 `regula_app` role이 사전 CREATE됨 | `cat migrations/[0-9]*.sql \| psql`(`_rollback` 제외, numeric order, autocommit)로 전체 migration을 적용할 때 | 적용이 0 에러로 완료되고, public schema table count가 **96**(regula-test-db baseline count)과 일치하며, `audit_logs_no_mutation` immutability trigger가 `pg_trigger`에 존재하고, RLS policy set이 `regula-test-db` `pg_policies` baseline snapshot과 동일한 policy명 집합을 생성한다 | REQ-MIGRATION-001, 003, 004, 005, 006, 007 | Test (fresh container apply + `\d+` introspection + `SELECT count(*) FROM information_schema.tables WHERE table_schema='public'` = 96 + RLS policy명 set diff vs baseline = 0) |
| AC-02 | CI workflow가 fresh pgvector service 컨테이너를 bootstrap하고 migration-apply로 DB를 구축함 | real-db integration suite(7개: `migrations-real-db`, `audit-immutability`, `audit-retention`, `cer-persist-roundtrip`, `model-governance`, `validation-consumers`, `knowledge-gap-replay-real`)를 from-scratch DB에서 실행할 때 | 7개 suite 모두 PASS한다 (SKIPPED 아님) | REQ-CI-001, 002 | Test (CI workflow 실행 로그 — 7개 suite green, SKIPPED 0건) |
| AC-03 | 기존 배포 DB(`regula-test-db`)가 존재함 | 정정된 migration 파일이 포함된 branch에서 기존 DB regression suite를 실행할 때 | 기존 스키마/데이터에 변화가 없다 (정정된 historical migration이 재적용되지 않으므로 regression-free) | REQ-SAFETY-001 | Test (기존 DB `information_schema` diff — 정정 전후 0 delta + regression suite PASS) |
| AC-04 | 정정된 migration 파일들이 포함됨 | `pnpm ci:migrations`(`scripts/ci/check-migrations.ts`)를 실행할 때 | migration 순서 무결성 검사가 PASS한다 | REQ-SAFETY-003 | Test (`pnpm ci:migrations` 종료 코드 0) |
| AC-05 | from-scratch CI gate가 운영 중임 | 고의로 drift를 도입한 migration(예: `org_id text REFERENCES organizations(id)` — uuid FK mismatch 재도입)을 PR에 포함할 때 | CI gate가 red로 실패하여 drift가 merge되는 것을 차단한다 | REQ-CI-003 | Test (negative test — drift 주입 PR의 CI 실행 로그가 failure 종료) |
| AC-06 | 원본 migration(0054/0055/0056/0082/0086)이 uuid로 정정되어 from-scratch DB가 이미 uuid FK를 보유함 | fix-up migration `0089`/`0090`/`0092`를 from-scratch DB에 적용할 때 | 3개 fix-up 모두 0 에러로 no-op 적용된다 (이미 uuid이므로 idempotent하게 스킵/ no-op) | REQ-MIGRATION-005 | Test (fix-up apply 후 `psql` 종료 코드 0 + `answer_feedback` 테이블 1개만 존재) |
| AC-07 | `CREATE INDEX CONCURRENTLY` 문을 포함한 migration이 존재함 | autocommit apply 방식으로 적용할 때 | CONCURRENTLY index가 트랜잭션 블록 실패 없이 정상 생성된다 | REQ-SAFETY-002 | Test (`SELECT count(*) FROM pg_indexes WHERE indexname LIKE '%concurrently%'` >= 1 + 로그에 "cannot run inside a transaction block" 에러 없음) |
| AC-08 | fresh pgvector 컨테이너가 기동됨 (role 미존재 상태) | migration apply **전** bootstrap 단계에서 `CREATE ROLE regula_app`을 실행한 뒤 `0001_audit_append_only.sql`을 적용할 때 | `0001`의 REVOKE/GRANT 문이 0 에러로 수행되고, `regula_app` role이 `pg_roles`에 존재한다 | REQ-MIGRATION-002 | Test (bootstrap 후 `SELECT count(*) FROM pg_roles WHERE rolname='regula_app'` = 1 + `0001` apply 0 에러) |

---

## §4 Technical Approach

### 4.1 수정 대상 파일 (Files to Modify — [MODIFY])

**Trivial fixes (mechanical):**
- `migrations/0002_chat_indexes.sql` — `idx_sources_corpus` 생성문 삭제 (L28-31)
- `migrations/0004_user_role_enum.sql` — Step 3 전 `ALTER COLUMN role DROP DEFAULT` 삽입
- `migrations/0087_project_memory.sql` — inline `UNIQUE ... WHERE` → `CREATE UNIQUE INDEX ... WHERE`
- `migrations/0095_rlhf_calibration_candidates.sql` — `ON DELETE 'set null'` 따옴표 제거 (L88)

**FK-type class + fix-up idempotency:**
- `migrations/0054_samd_assessments.sql` — `org_id text→uuid`
- `migrations/0055_design_history_files.sql` — `org_id`, `created_by text→uuid` (`id`/`dhf_id`는 text 유지)
- `migrations/0056_submission_packages.sql` — `org_id`, `created_by text→uuid`
- `migrations/0082_rlhf.sql` — `answer_feedback.user_id text→uuid`
- `migrations/0086_knowledge_promo.sql` — `promoted_answers.promoted_by text→uuid`
- `migrations/0089_*.sql`, `migrations/0090_*.sql`, `migrations/0092_*.sql` — idempotency 가드 추가 (`IF NOT EXISTS`, type-check; 특히 `0090`의 `answer_feedback` fresh CREATE)

**[DELTA] Diagnose-during-run:**
- `migrations/0014_docingest_schema.sql` — 트랜잭션 내부 에러 진단 후 수정
- `migrations/0083_rls_with_check_clauses.sql` — RLS policy 대상 테이블 컬럼 정합 (`organization_id` vs `org_id`)

### 4.2 신규 파일 (Files to Create — [NEW])

- `.github/workflows/migrations-real-db.yml` — standalone workflow 파일로 생성(`ci.yml`에 job을 추가하지 않음 — 관심사 분리: 기존 `ci:test` mock-DB job과 from-scratch real-DB job을 독립 운영). fresh pgvector service 컨테이너 bootstrap → migration-apply → real-db suite 실행. 매 PR 트리거.

### 4.3 Bootstrap Sequence + Autocommit Apply 방식 (REQ-SAFETY-002 mechanism)

CI workflow 내 setup 단계:
1. `pgvector/pgvector:pg16` 컨테이너 기동
2. `CREATE ROLE regula_app` 사전 실행 (migration apply 전 — REQ-MIGRATION-002)
3. `cat migrations/[0-9]*.sql | psql` (autocommit, `_rollback` 제외, numeric order)
4. real-db suite 실행

**Autocommit apply (REQ-SAFETY-002 구현 방식)**: `CREATE INDEX CONCURRENTLY`가 트랜잭션 블록 내에서 실행 불가하므로, `cat | psql` 파이프라인(각 statement가 autocommit으로 실행) 또는 파일 단위 apply 방식을 사용한다. `BEGIN/COMMIT`으로 감싼 일괄 적용은 CONCURRENTLY 실패를 유발하므로 금지.

### 4.4 의존성

- 기존 SPEC: SPEC-REGULA-FOUNDATION-001(audit immutability trigger, RBAC), SPEC-REGULA-DOCINGEST-001(0014 트랜잭션 진단 맥락), SPEC-REGULA-RLHF-001(0082/0095 RLHF schema), SPEC-REGULA-KNOWLEDGE-PROMO-001(0086)
- 외부: pgvector Docker image, GitHub Actions postgres service
- 연계 이슈: #396(drift 본체), #395-③(CI real-db job — 본 SPEC이 통합 흡수)

---

## Exclusions (What NOT to Build)

- base schema dump 생성 (migration-apply 정정만 수행)
- 기존 배포 DB 데이터 migration (regula-test-db 재적용 안 함)
- `drizzle-kit push` 경로 수정 (보조 수단이며 본 SPEC 범위 외)
- schema.ts 재생성 / drizzle meta 동기화 (별도 작업)
- migration 파일 추가 생성 (fix-up migration 신규 작성 금지 — 기존 fix-up idempotency 보강만)
- `migrations/*_rollback.sql` 수정 또는 적용 (rollback path는 범위 외)
