# Research — SPEC-REGULA-REALDB-001

> Issue #395 (follow-up #364). #364(PR #394)가 real-db foundation + 패턴 입증을 완료했고, 본 SPEC은 잔여 (B)클래스 전환 + coverage 게이트를 다룬다.

---

## 1. 현상 (Empirically Verified)

### 1.1 real-db foundation (PR #394, 재사용 가능)
`tests/fixtures/database.ts`:
- `getDb()` — lazy `import('@/lib/db/client')` (DATABASE_URL 미설정 시 모듈 로드 회피)
- `truncateTables(names, {cascade?})` — `TRUNCATE ... RESTART IDENTITY` (+ domain-scoped CASCADE). audit_logs 제외 (REQ-FND-044 immutability trigger).
- `seedCoreActors({userId,userEmail,userName,orgId,orgName,projectId,projectName})` — org→user→project INSERT, `onConflictDoNothing` (재실행 안전).
- `HAS_DATABASE_URL = Boolean(process.env.DATABASE_URL)` — skipIf 가드.

**입증된 패턴** (`cer-persist-roundtrip.test.ts`, PR #394): `beforeAll` seedCoreActors → `beforeEach` truncateTables([domain], {cascade:true}) → lazy route import → `it.skipIf(!HAS_DATABASE_URL)`. H2 원자성은 실 `db.transaction` rollback으로 증명 (audit mock 실패 주입). route-level mock(audit/with-permission/project-ownership/pubmed)은 유지.

### 1.2 잔여 (B)클래스 5개 — mock 기반 직검 (2026-07-09)
| File | vi.mock(@/lib/db) | real-db markers | 상태 |
|------|-------------------|-----------------|------|
| `tests/integration/rlhf-reranking-flow.test.ts` | 1 | 0 | mock → 전환 |
| `tests/integration/docingest-e2e.test.ts` | 1 | 0 | mock → 전환 |
| `tests/integration/knowledge-gap-replay-real.test.ts` | 1 | 0 | 부분 real-db → 확장 (이름에 -real 이나 mock 혼재) |
| `tests/integration/rlhf-calibration.test.ts` | 1 | 0 | mock → 전환 |
| `tests/integration/model-governance.test.ts` | 1 | 5 | 부분 real-db → 확장 |

직검: 5개 전부 `vi.mock('@/lib/db/client')` 사용. knowledge-gap-replay-real/model-governance는 real-db marker 일부 보유(확장 대상). 순수 mock 3개(rlhf-reranking/docingest-e2e/rlhf-calibration)는 전환 대상.

### 1.3 coverage 도구 현황
`vitest.config.ts`:
- `coverage.provider: 'v8'`, `reporter: ['text','html','lcov']`, `include: ['lib/**','app/**','components/**']`.
- **`thresholds` 미설정** — coverage가 떨어져도 CI가 green (L-013 맹점: 테스트 통과 ≠ 커버리지 유지).
- `@vitest/coverage-v8@^1.6.1` 설치됨.
- `package.json`에 `test:coverage`/`ci:coverage` 스크립트 **없음** — 신규 추가 필요.

### 1.4 real-db CI job — 이미 완료 (SPEC-REGULA-MIGRATION-001)
`.github/workflows/migrations-real-db.yml` (main `d89b23a`)가 fresh pgvector + from-scratch apply + real-db 7 suite 실행. **#395의 "3. real-db CI 별도 job"은 본 SPEC이 이미 흡수**. 전환된 테스트는 이 job의 suite 목록에 추가되어 자동 실행.

---

## 2. 아키텍처 통찰

**real-db 전환과 coverage 게이트는 상호보완적 L-013 안전망.**
- real-db 전환: mock이 숨기던 FK type mismatch / schema drift / RLS 동작을 실DB INSERT/SELECT로 포착 (SPEC-REGULA-MIGRATION-001이 구조적 drift를 잡았다면, 본 SPEC은 **도메인 로직의 real-db 회귀**를 잡는다).
- coverage 게이트: 테스트가 "통과"해도 커버리지가 떨어지면 CI red → 회귀 테스트 추가 없는 코드 축소 차단.

---

## 3. 의존성 매트릭스

| 전환 파일 | 도메인 truncate 세트 (예상) | seedCoreActors | route-level mock 유지 |
|-----------|----------------------------|----------------|----------------------|
| rlhf-reranking-flow | answer_feedback(+messages/conversations cascade) | O | audit/with-permission |
| docingest-e2e | organization_documents/document_chunks/ingest 연관 | O | inngest/audit |
| knowledge-gap-replay-real | unanswered_queue/knowledge_gaps(+cascade) | O | llm/audit |
| rlhf-calibration | calibration_candidates(+cascade) | O | audit |
| model-governance | prompt_registry/model_pin/change_request/approved_combination | O | audit |

정확한 truncate 세트는 Run phase에서 각 파일의 INSERT 경로 직독으로 확정 (cascade 옵션으로 child FK 회피).

---

## 4. coverage baseline (Run phase M0 측정 필요)

현 시점 lib/app/components coverage % 미측정. Run M0에서 `pnpm vitest run --coverage`로 baseline 측정 후:
- baseline ≥ 85% → threshold 85% 즉시 적용.
- baseline < 85% → threshold를 baseline로 설정(ratchet) + 85% 도달 follow-up 이슈.

---

## 5. 참조
- Issue #395 (본 SPEC 권위 소스), #364 (closed, foundation)
- PR #394 (foundation + cer-persist 패턴), PR #397 (SPEC-REGULA-MIGRATION-001, real-db CI job)
- `tests/fixtures/database.ts` (foundation)
- L-013 (정적테스트 + CI mock + self-report 3중 맹점)
