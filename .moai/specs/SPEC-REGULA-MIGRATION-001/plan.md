# Implementation Plan — SPEC-REGULA-MIGRATION-001

> Issue #396. 본 plan은 brownfield [MODIFY]/[NEW] 작업이다. TDD brownfield enhancement: 각 drift fix에 대해 먼저 실패하는 테스트(from-scratch apply 실패 재현)를 작성한 후 정정한다.

---

## 1. Task Decomposition (4 Groups)

### Group A: Trivial Mechanical Fixes (우선순위 High — 난이도 Low)

| Task | File | Change | AC |
|------|------|--------|----|
| A1 | `migrations/0002_chat_indexes.sql` | `idx_sources_corpus` 생성문 삭제 (L28-31) | AC-01 |
| A2 | `migrations/0004_user_role_enum.sql` | Step 3 전 `ALTER COLUMN role DROP DEFAULT` 삽입, Step 4에서 재설정 | AC-01 |
| A3 | `migrations/0087_project_memory.sql` | inline `UNIQUE ... WHERE` → `CREATE UNIQUE INDEX ... WHERE` | AC-01 |
| A4 | `migrations/0095_rlhf_calibration_candidates.sql` | `ON DELETE 'set null'` 따옴표 제거 (L88) | AC-01 |

**검증**: 각 파일을 fresh container에 standalone apply 시 0 에러.

### Group B: FK-Type Class + Fix-Up Idempotency (우선순위 High — 난이도 Medium)

| Task | File | Change | AC |
|------|------|--------|----|
| B1 | `migrations/0054_samd_assessments.sql` | `org_id text→uuid` | AC-01, AC-06 |
| B2 | `migrations/0055_design_history_files.sql` | `org_id`, `created_by text→uuid` (`id`/`dhf_id` text 유지) | AC-01, AC-06 |
| B3 | `migrations/0056_submission_packages.sql` | `org_id`, `created_by text→uuid` | AC-01, AC-06 |
| B4 | `migrations/0082_rlhf.sql` | `answer_feedback.user_id text→uuid` | AC-01, AC-06 |
| B5 | `migrations/0086_knowledge_promo.sql` | `promoted_answers.promoted_by text→uuid` | AC-01, AC-06 |
| B6 | `migrations/0089_*.sql`, `0090_*.sql`, `0092_*.sql` | idempotency 가드 추가: `IF NOT EXISTS`, type-check; 특히 `0090`의 `answer_feedback` CREATE에 `IF NOT EXISTS` 가드 | AC-06 |

**검증**:
- from-scratch DB: 원본 정정 후 fix-up apply 시 no-op (0 에러).
- 기존 배포 DB(regula-test-db): fix-up이 여전히 text→uuid ALTER 수행 (회귀 없음).

### Group C: [DELTA] Diagnose-During-Run (우선순위 High — 난이도 High)

| Task | File | Change | AC |
|------|------|--------|----|
| C1 | `migrations/0014_docingest_schema.sql` | BEGIN/COMMIT 트랜잭션 내부 에러 진단(per-statement isolate) 후 수정. `ingest_jobs` 및 의존 테이블 정상 생성 확인 | AC-01 |
| C2 | `migrations/0083_rls_with_check_clauses.sql` | `organization_id` policy가 참조하는 각 테이블 grep으로 정합 → 미존재 컬럼 policy를 `org_id`로 정정하거나 policy에서 제외 | AC-01 |

**검증**: 정확한 fix 방향은 Run 단계에서 `progress.md`에 기록. 진단 결과에 따라 plan 업데이트 가능.

### Group D: CI Gate (우선순위 High — 난이도 Medium)

| Task | File | Change | AC |
|------|------|--------|----|
| D1 | `.github/workflows/migrations-real-db.yml` (standalone workflow 파일 — `ci.yml`에 job 추가하지 않음, 관심사 분리) | fresh pgvector service 컨테이너 → `CREATE ROLE regula_app` → `cat migrations/[0-9]*.sql \| psql` (autocommit) → real-db suite(7개) 실행. 매 PR 트리거. | AC-02, AC-05, AC-07, AC-08 |

**검증**:
- 정상 PR에서 green.
- 고의 drift 주입 시 red (AC-05 negative test).

---

## 2. Phased Ordering

```
Phase 1: Group A (trivial 4건) — 빠른 승리, from-scratch apply 진척도 가시화
   → [CHECKPOINT] fresh container apply로 A1~A4 각각 standalone-clean 확인
Phase 2: Group B (FK-type + fix-up idempotency) — 상호의존성 검증
   → [CHECKPOINT] from-scratch full apply + regula-test-db regression 동시 검증
Phase 3: Group C ([DELTA] 진단) — C1(0014), C2(0083) 순차
   → [CHECKPOINT] ingest_jobs 존재 + RLS policy 적용 확인
Phase 4: Group D (CI gate) — A+B+C 완료 후 from-scratch full clean 상태에서 CI workflow 추가
   → [CHECKPOINT] AC-05 negative test (고의 drift 주입 시 red)
```

**의존성**: Phase 4는 Phase 1-3 완료 전제. Phase 3은 Phase 1-2와 병렬 가능하나 C2(0083)는 ingest_jobs(0014) 생성에 의존하므로 C1→C2 순서.

---

## 3. Technical Constraints

1. **원본 migration 직접 수정 방식 채택** (fixup-migration 관례에서 벗어남). 근거: fixup-migration으로 from-scratch ORDERING 문제(예: 0002가 later fixup보다 먼저 실패) 해결 불가.
2. **기존 DB regression-free**: 정정된 migration은 기존 배포 DB에서 재적용되지 않으므로 schema 변화 없음.
3. **autocommit apply**: `CREATE INDEX CONCURRENTLY`가 트랜잭션 블록 내에서 실패하므로 `cat | psql` 또는 파일 단위 apply.
4. **fix-up idempotency**: `0089`/`0090`/`0092`는 deployed DB(ALTER 수행)와 from-scratch DB(이미 uuid → no-op) 모두에서 안전해야 함.
5. **sequence 무결성**: `pnpm ci:migrations`(`scripts/ci/check-migrations.ts`)가 정정 후에도 PASS.

---

## 4. Risk Analysis & Mitigation

| Risk | Impact | Likelihood | Mitigation |
|------|--------|-----------|------------|
| 원본 migration 수정이 프로젝트 관례(fixup-migration)에서 벗어남 → 향후 기여자 혼란 | Medium | Medium | 본 SPEC + commit message에 이유 명시; fixup-migration으로 from-scratch ORDERING 해결 불가 문서화 |
| fix-up idempotency 상호의존(0089/0090/0092) — 원본 정정 시 충돌 | High | Medium | Group B에서 from-scratch DB + 기존 DB 양쪽 동시 검증(AC-03, AC-06); 특히 0090의 answer_feedback CREATE에 IF NOT EXISTS 가드 |
| `CREATE INDEX CONCURRENTLY` in transaction → 적용 실패 | Medium | Low | autocommit apply(`cat \| psql`) 방식 채택; AC-07로 검증 |
| 0014 트랜잭션 내부 에러 원인이 복잡할 수 있음 | Medium | Medium | [DELTA] Run 단계 per-statement isolate 진단; 진단 결과에 따라 plan 업데이트(C1) |
| 0083 RLS policy 대상 테이블 식별 누락 | Medium | Medium | [DELTA] Run 단계에서 grep으로 각 policy의 대상 테이블과 실제 컬럼명 정합(C2) |
| CI gate 추가로 PR당 실행 시간 증가 | Low | High | real-db suite는 분리된 job으로 비동기 실행; main blocker는 ci:test job만 유지 |
| 정정 후 기존 regula-test-db에서 예상치 못한 부작용 | High | Low | AC-03 regression suite로 검증; 기존 DB는 historical migration 재적용 안 하므로 구조적으로 regression-free |

---

## 5. Milestones (Priority-based, 시간 추정 없음)

| Milestone | Priority | 완료 조건 |
|-----------|----------|----------|
| M1: Trivial fixes | High | Group A 4건 정정 후 fresh container standalone apply 0 에러 |
| M2: FK-type + fix-up idempotency | High | Group B 완료 후 from-scratch full apply + regula-test-db regression 양쪽 PASS |
| M3: [DELTA] 진단 수정 | High | Group C 완료 후 ingest_jobs 존재 + RLS policy 적용 확인 |
| M4: CI gate | High | Group D 완료 후 AC-02(real-db suite PASS) + AC-05(drift 주입 시 red) |
| M5: 전체 회귀 | High | AC-01~AC-08 모두 PASS |

---

## 6. Brownfield TDD Enhancement

각 drift fix에 대해:
1. **(Pre-RED)** 현재 migration 파일 읽고 drift 동작 이해
2. **RED**: fresh container apply 실패를 재현하는 테스트 작성 (예: `migrations-real-db` 확장 — drift point별 standalone apply 시도)
3. **GREEN**: 원본 migration 정정하여 테스트 PASS
4. **REFACTOR**: 정정 후에도 기존 동작 보존 확인

---

## 7. 검증 체크리스트 (Run 단계)

- [ ] fresh pgvector 컨테이너 기동 스크립트 확보
- [ ] `CREATE ROLE regula_app` bootstrap 단계 문서화
- [ ] 각 Group A-D 완료 시 [CHECKPOINT] fresh apply 재검증
- [ ] AC-05 negative test: 고의 drift(FK 타입 틀리게) 주입 후 CI red 관측
- [ ] `pnpm ci:migrations` sequence check PASS (AC-04)
- [ ] regula-test-db 회귀 suite PASS (AC-03)
