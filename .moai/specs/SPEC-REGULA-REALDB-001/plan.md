# Implementation Plan — SPEC-REGULA-REALDB-001

> Issue #395. brownfield [MODIFY] 작업. cer-persist 패턴(PR #394) 준용. 각 전환은 독립적 — 도메인별 분할 가능.

---

## 1. Task Decomposition (2 Groups)

### Group R: real-db 전환 4건 (우선순위 High — 난이도 Medium)

> plan-auditor D4 정정: `docingest-e2e.test.ts` 제외 (self-declared (A)-class contract test, schema drift는 migrations-real-db.test.ts가 커버).

| Task | File | Change | AC |
|------|------|--------|----|
| R1 | `tests/integration/rlhf-reranking-flow.test.ts` | vi.mock(@/lib/db) 제거 → seedCoreActors + truncateTables([answer_feedback,...],cascade) + lazy import + describe.skipIf(HAS_DATABASE_URL). 유지 mock: version-tracker, logger. | AC-01, AC-03 |
| R2 | `tests/integration/rlhf-calibration.test.ts` | 동일 (calibration_candidates). 유지 mock: with-permission. | AC-01, AC-03 |
| R3 | `tests/integration/knowledge-gap-replay-real.test.ts` | full conversion (100% mock). 유지 mock: AI pipeline 17종 + audit + github-issue + logger. | AC-01, AC-03 |
| R4 | `tests/integration/model-governance.test.ts` | placeholder DB section(expect(true))을 실 lifecycle 테스트로 교체. | AC-01, AC-03 |
| R5 | `.github/workflows/migrations-real-db.yml` | suite 목록에 R1·R2 2건 추가 (R3·R4는 이미 등록) | AC-02 |

**검증**: 각 파일 `pnpm env:test vitest run <file>` PASS (regula-test-db) + DATABASE_URL 미설정 시 skip + full `pnpm test` 회귀 0.

### Group C: Coverage 85% 게이트 (우선순위 High — 난이도 Low-Medium)

| Task | File | Change | AC |
|------|------|--------|----|
| C0 | (측정) `pnpm vitest run --coverage` | lib/app/components baseline % 측정 → threshold 값 확정 | AC-04 |
| C1 | `vitest.config.ts` | `coverage.thresholds` 추가 (lines/branches/functions = max(85%, baseline)) | AC-04 |
| C2 | `package.json` | `ci:coverage` 스크립트 추가 (`vitest run --coverage`) | AC-04 |
| C3 | CI 통합 | coverage 게이트 red 시 머지 블록 (ci.yml 또는 migrations-real-db.yml 에 coverage step) | AC-04, AC-05 |

**검증**: `pnpm ci:coverage` exit 0 (baseline) + 고의 하락 주입 시 red (AC-05 negative test).

---

## 2. Phased Ordering

```
Phase 1: Group C0 (baseline 측정) — test-count + coverage % 측정 (AC-03/04 전제)
Phase 2: Group R1~R4 (전환 4건) — 도메인별 독립, 병렬/순차 가능
   → [CHECKPOINT] 각 전환 후 pnpm env:test PASS + full pnpm test 회귀 0
Phase 3: Group R5 (CI suite 추가) — R1~R4 완료 후 (2 신규 추가; R3·R4는 이미 등록). post-state 9 suite
Phase 4: Group C1~C3 (coverage 게이트) — baseline 기반 threshold 설정
   → [CHECKPOINT] ci:coverage PASS + AC-05 negative test
```

**의존성**: C1은 C0(baseline) 전제. R5은 R1·R2(신규 2건) 전제. Group R과 Group C는 서로 독립(병렬 가능).

---

## 3. Technical Constraints

1. **cer-persist 패턴 엄격 준수**: `beforeAll seedCoreActors` → `beforeEach truncateTables([domain],{cascade:true})` → lazy route import → `it.skipIf(!HAS_DATABASE_URL)`. 신규 패턴 발명 금지.
2. **audit_logs truncate 금지** (REQ-FND-044 immutability trigger). writeAudit은 route-level mock 유지.
3. **truncate cascade는 domain-scoped**: shared reference table(users/orgs/projects)는 seedCoreActors가 onConflictDoNothing으로 유지 — cascade가 이들을 건드리지 않도록 truncate 대상 세트 신중 설계.
4. **coverage threshold는 ratchet**: baseline < 85% 시 즉시 85% 강제(red) 대신 baseline floor + follow-up. 즉시 적용은 baseline ≥ 85%일 때만.
5. **migrations-real-db.yml 구조 수정 금지** (SPEC-REGULA-MIGRATION-001 소유) — suite 목록 expand만.

---

## 4. Risk Analysis

| Risk | Impact | Likelihood | Mitigation |
|------|--------|-----------|------------|
| 전환 파일의 INSERT 경로 복잡(다중 FK/의존 테이블) → truncate 세트 설계 오류 | Medium | Medium | cer-persist 선례 직독 + 각 파일의 db.insert 경로 grep으로 truncate 세트 확정; cascade 옵션으로 child FK 회피 |
| route-level mock과 real-db 전환의 경계 혼동 (과도한 mock 제거) | High | Low | REQ-REALDB-003: data/schema-dependent 경로만 전환, 외부 부작용(LLM/inngest/audit) mock 유지 |
| coverage baseline이 예상보다 낮아 85% 즉시 적용 불가 | Medium | Medium | C0 baseline 측정 우선; ratchet 전략(baseline floor + follow-up) |
| CI real-db job suite 9건(7+2 신규)으로 실행 시간 증가 | Low | Medium | real-db suite는 이미 분리된 job; 시간 임계 초과 시 별도 split 검토 |
| knowledge-gap-replay-real·model-governance는 이미 CI real-db job에 등록 (plan-auditor D8) — 전환 시 현재 green cell 동작 변경 | Medium | High | 두 suite가 mock-based → real-db로 전환. knowledge-gap-replay-real은 현재 unit + real-db job 양쪽 mock-based 실행(중복) — 전환으로 real-db job이 canonical path |
| model-governance placeholder 교체 (plan-auditor D3) | Low | Low | 기존 `expect(true).toBe(true)` placeholder는 실증 없음 — 교체는 additive |

---

## 5. Milestones (priority-based, 시간 추정 없음)

| Milestone | Priority | 완료 조건 |
|-----------|----------|----------|
| M0: baseline 측정 | High | `pnpm vitest run --coverage`로 lib/app/components % 측정 + 전환 전 `pnpm test` pass count 측정. threshold 값 확정 (AC-03/04 전제) |
| M1: 전환 4건 | High | R1~R4 완료 — 각 `pnpm env:test` PASS + full `pnpm test` 회귀 0 |
| M2: CI suite 통합 | High | R5 — migrations-real-db.yml 9 suite green (7+2 신규; R3·R4는 이미 등록) |
| M3: Coverage 게이트 | High | C1~C3 — `ci:coverage` exit 0 + AC-05 negative test |
| M4: 전체 회귀 | High | AC-01~06 모두 PASS |

---

## 6. 검증 체크리스트 (Run 단계)

- [ ] cer-persist 패턴(`tests/integration/cer-persist-roundtrip.test.ts`) 직독 — 각 전환의 참조 모델
- [ ] 각 전환 파일의 `db.insert`/`db.select` 경로 grep → truncate 세트 + seedCoreActors 의존 확정
- [ ] `pnpm env:test vitest run <file>` per-file PASS (DATABASE_URL=regula_test)
- [ ] `pnpm test` full 회귀 0 (전환 전후 0 failed)
- [ ] coverage baseline 측정 → threshold 설정 → `pnpm ci:coverage` PASS
- [ ] AC-05 negative test (고의 커버리지 하락 → red)
- [ ] CI real-db job 12 suite green 확인
