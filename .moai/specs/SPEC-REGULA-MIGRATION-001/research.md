# Research — SPEC-REGULA-MIGRATION-001

> Issue #396 (본 세션 전수 진단 완료). 본 문서는 #396의 진단을 정규화한 것으로, 원본 이슈가 권위 있는 소스(authoritative source)이다.

---

## 1. 문제 현상 (Empirically Proven)

`migrations/*.sql` 세트가 fresh PostgreSQL 16 + pgvector 컨테이너에 from-scratch로 적용되지 않는다. 두 개의 bootstrap path가 모두 깨져 있다:

1. **`drizzle-kit push` (`pnpm db:migrate`)**: CI에서 interactive TTY prompt로 실패하며, migration-only 객체(예: `0001_audit_append_only.sql`의 audit immutability trigger)를 누락한다.
2. **`migrations/*.sql` 순차 적용**: drift — 여러 migration이 존재하지 않거나 잘못된 타입의 객체/컬럼을 참조한다.

`regula-test-db`(로컬 개발 DB)는 historical accident로만 동작한다: 과거 증분 적용 과정에서 drift가 흡수되었기 때문. base schema dump가 존재하지 않는다.

### 영향 (Impact)

real-db integration test suite이 main CI gate(`.github/workflows/ci.yml`의 `ci:test` job에는 postgres service가 없음)에서 SKIPPED된다. 해당 suite:
- `migrations-real-db`
- `audit-immutability`
- `audit-retention`
- `cer-persist-roundtrip`
- `model-governance`
- `validation-consumers`
- `knowledge-gap-replay-real`

→ L-013 안전망(실DB 실행 검증)이 CI에서 절대 발화하지 않는다. 따라서 drift가 누적되어도 CI가 green이다.

---

## 2. Drift Map (10개 지점 — fresh pgvector container apply로 검증)

| # | File | Bug | Fix Direction | Class |
|---|------|-----|---------------|-------|
| D1 | `0002_chat_indexes.sql` | `idx_sources_corpus` — `sources.corpus` 컬럼이 schema.ts에서 제거됨(dead code) | 인덱스 생성문 삭제 (L28-31) | Trivial |
| D2 | `0004_user_role_enum.sql` | Step 3 `ALTER COLUMN role TYPE user_role` 시 기존 DEFAULT `'member'`가 enum cast 실패 | Step 3 전 `ALTER COLUMN role DROP DEFAULT` 삽입, 이후 재설정 | Trivial |
| D3 | `0054_samd_assessments.sql` | `org_id TEXT REFERENCES organizations(id)` (uuid) → FK 타입 불일치 | `org_id text→uuid` | FK-type |
| D4 | `0055_design_history_files.sql` | `org_id TEXT`, `created_by TEXT REFERENCES users(id)` → FK 불일치 (단 `id`/`dhf_id`는 text 자체 정합 유지) | `org_id`/`created_by text→uuid` | FK-type |
| D5 | `0056_submission_packages.sql` | 동일 (`org_id`/`created_by text→uuid`) | `text→uuid` | FK-type |
| D6 | `0082_rlhf.sql` | `answer_feedback.user_id text REFERENCES users(id)` | `text→uuid` | FK-type |
| D7 | `0086_knowledge_promo.sql` | `promoted_answers.promoted_by text REFERENCES users(id)` | `text→uuid` | FK-type |
| D8 | `0083_rls_with_check_clauses.sql` | RLS policy가 `organization_id` 참조 → 대상 테이블 미보유 (grep 확인: `organization_id` policy와 `org_id` policy 혼재, 대상 테이블이 실제로 `organization_id` 컬럼을 가지는지 정합 필요) | 컬럼명 정합 — Run 단계에서 정확한 대상 테이블 식별 | [DELTA] |
| D9 | `0087_project_memory.sql` | inline `UNIQUE ... WHERE` (partial) 불법 syntax → `CREATE UNIQUE INDEX ... WHERE` (`migrations-real-db`가 이미 INDEX를 기대) | `CONSTRAINT→INDEX` | Trivial |
| D10 | `0095_rlhf_calibration_candidates.sql` | `ON DELETE 'set null'` (따옴표) — syntax error (L88) | 따옴표 제거 | Trivial |
| D11 | `0014_docingest_schema.sql` | `BEGIN/COMMIT` 트랜잭션; 내부 에러 발생 시 전체 rollback → `ingest_jobs` 미생성 (0083/0084에서 미존재 참조) | 내부 에러 진단 후 수정 (Run 단계 진단 필요) | [DELTA] |

### Bootstrap 사전 조건

- **B1**: `0001_audit_append_only.sql`은 `regula_app` role이 사전 존재해야 함 (REVOKE/GRANT 수행). 그런데 `0085`가 해당 role을 CREATE ROLE함. → bootstrap sequence가 `CREATE ROLE regula_app`을 migration apply **이전**에 수행해야 함.

### Fix-up 상호의존성 (핵심 복잡성)

- `0089`, `0090`, `0092`는 기존 배포 DB용 fix-up migration (text→uuid ALTER 또는 fresh CREATE).
- **D3~D7 원본을 uuid로 정정하면**:
  - **기존 배포 DB**: 여전히 fix-up이 필요 (text 컬럼을 uuid로 ALTER). 단, 원본이 이미 text→uuid로 정정되었으므로 fix-up은 idempotent해야 함 (컬럼이 이미 uuid면 no-op).
  - **from-scratch DB**: 원본 CREATE가 이미 uuid이므로 fix-up의 ALTER는 no-op여야 함.
- **`0090` 특별 주의**: `answer_feedback`에 대한 fresh CREATE 포함 → D6(0082 원본 정정) 후 충돌 회피 필요 (`IF NOT EXISTS` 가드 확인 필수).
- **`design_history_files.id`**: 자식 테이블(`dhf_id TEXT`)이 참조 → `id`는 text 자체 정합 유지 (`org_id`/`created_by`만 uuid로).

---

## 3. 아키텍처 통찰 (Ultrathink Core)

**Drift fix(교정)와 CI real-db job(#395-③, 예방)은 하나의 capability이다.**

CI gate가 from-scratch DB를 migration-apply(_push 아님_)로 bootstrap하여 real-db suite를 매 PR마다 실행하면, drift fix는 선행 조건이 되고 from-scratch-apply CI gate는 영구 regression 예방 메커니즘이 된다. drift가 단 한 번이라도 재발하면 CI gate가 즉시 red로 잡는다.

**따라서 본 SPEC은 두 가지를 통합(unify)한다:**
1. 10개 drift point 정정 (교정)
2. from-scratch-apply CI gate 추가 (영구 regression 예방)

CI gate 없이 drift fix만 하면 drift는 재발한다. 이것이 본 SPEC이 CI gate를 AC/regression 메커니즘으로 요구하는 이유이다.

---

## 4. 접근 방식 결정 (User Decision — Codified)

**접근**: 원본 migration 파일을 직접 수정(편집)하여 from-scratch correctness 확보.

이것은 프로젝트의 fixup-migration 관례에서 벗어나는 결정이다. 그러나 fixup-migration으로 from-scratch **ORDERING** 문제를 해결할 수 없기 때문에 (예: `0002`가 later fixup보다 먼저 실패함) 필수적이다. 기존 배포 DB(`regula-test-db`)는 historical migration을 재실행하지 않으므로, 원본 편집은 미래 from-scratch apply에만 영향을 미친다 → 기존 DB regression-free.

본 변경은 구조적 migration 부채 상환(structural migration-debt payoff)이며, SPEC 기반 신중 접근이 정당하다.

---

## 5. 의존성 매트릭스 (Fix-Idempotency)

| 원본 수정 | 관련 fix-up | 기존 배포 DB | from-scratch DB | 검증 |
|-----------|------------|-------------|-----------------|------|
| 0054 (org_id→uuid) | 0089/0092 | ALTER 필요 (text→uuid) | 이미 uuid → fix-up no-op | fix-up `IF NOT EXISTS` / type-check 가드 |
| 0055 (org_id, created_by→uuid) | 0092 | ALTER 필요 | 이미 uuid → no-op | 동일 |
| 0056 (org_id, created_by→uuid) | 0092 | ALTER 필요 | 이미 uuid → no-op | 동일 |
| 0082 (user_id→uuid) | 0090 (fresh CREATE 포함) | ALTER 또는 CREATE | 이미 uuid → CREATE 충돌 | `0090`의 CREATE에 `IF NOT EXISTS` 가드 필수 |
| 0086 (promoted_by→uuid) | — | — | — | 단독 |

---

## 6. CONCURRENTLY 색인 주의

`CREATE INDEX CONCURRENTLY`는 트랜잭션 블록 내에서 실행할 수 없다. migration 적용 시 `cat migrations/*.sql | psql` 파이프라인(autocommit) 또는 파일 단위 apply 방식이 필요하다. `BEGIN/COMMIT`으로 감싼 일괄 적용은 CONCURRENTLY 실패를 유발한다.

---

## 7. [DELTA] — Run 단계 진단 필요 항목

정확한 수정은 Run 단계에서 실 코드를 읽고 진단해야 확정된다:

- **D8 (0083)**: `organization_id` policy가 참조하는 각 테이블이 실제로 `organization_id` 컬럼을 보유하는지 grep으로 정합. 누락된 테이블 식별 후 (a) policy에서 제외하거나 (b) 컬럼명을 `org_id`로 정정.
- **D11 (0014)**: `BEGIN/COMMIT` 내부에서 어떤 statement가 에러를 발생시키는지 per-statement isolate 실행으로 진단. 수정 후 `ingest_jobs`(및 의존 테이블)가 정상 생성되는지 확인.

이 항목들은 본 SPEC의 plan.md에서 별도 phase로 분리되며, 정확한 fix 방향은 Run 단계에서 `progress.md`에 기록된다.

---

## 8. 검증 환경 (Acceptance)

- fresh Docker `pgvector/pgvector:pg16` 컨테이너
- `CREATE ROLE regula_app` 사전 실행
- `cat migrations/[0-9]*.sql | psql` (autocommit, `_rollback` 제외)
- numeric order 보장은 filename prefix로 — `ci:migrations`(`scripts/ci/check-migrations.ts`)가 sequence check 담당

---

## 9. 참조

- Issue #396 (권위 있는 진단 소스)
- Issue #395-③ (CI real-db job — 본 SPEC이 통합 흡수)
- Lesson L-013 (정적 테스트 + CI mock DB + self-report 3중 맹점 — 본 SPEC의 근본 동기)
- SPEC-REGULA-RLHF-001 (FORMAT TEMPLATE 참조)
