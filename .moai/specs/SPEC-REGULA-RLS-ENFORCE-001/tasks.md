# SPEC-REGULA-RLS-ENFORCE-001 — RLS WITH CHECK + app.current_org_id GUC Wiring

**Issue**: [#239 — RLS WITH CHECK clauses + app.current_org_id GUC wiring (M1, project-wide)](https://github.com/holee9/ra-med-bot/issues/239)
**Scope**: project-wide (RLS inert → enforced defense-in-depth)
**Baseline**: main `ffc4dbe` — 4262 passed | 8 skipped (runtime 직검 기준)
**Constraint**: 단일 세션 완료 불가. 3-Phase 분할 PR.

---

## §1 베이스라인 직검 (runtime evidence, not self-report)

### §1.1 현재 RLS 상태 (migrations/*.sql grep)

- 총 마이그레이션: **83개** (0000~0082)
- `CREATE POLICY`: 41개 / `ENABLE ROW LEVEL SECURITY`: 41개 / `FORCE ROW LEVEL SECURITY`: **0개**
- `WITH CHECK` 포함 정책: 26개 → **WITH CHECK 누락 17개** (7개 마이그레이션)

| Migration | Policies | WITH CHECK | Missing | Tables |
|-----------|----------|------------|---------|--------|
| `0015_docingest_rls.sql` | 4 | 0 | **4** | document_chunks, documents 등 docingest 계열 |
| `0066_knowledge_gap.sql` | 1 | 0 | **1** | unanswered_queue |
| `0067_classify.sql` | 1 | 0 | **1** | (classify 관련) |
| `0068_traceability.sql` | 3 | 0 | **3** | traceability 계열 |
| `0077_model_governance.sql` | 4 | 0 | **4** | change_request 등 model-governance |
| `0078_cyberdevice.sql` | 4 | 1 | **3** | sbom, threat_model 등 cyberdevice |
| `0080_corpus_license.sql` | 2 | 1 | **1** | corpus_license |
| **합계** | **19** | **2** | **17** | |

> 참고: 오케스트레이터 프롬프트는 "15개"로 추정했으나 runtime 직검(grep) 결과 **17개**. L-007(카운트 직검) 준수.

### §1.2 현재 DB 클라이언트 아키텍처

- **`lib/db/client.ts:16-22`**: 단일 `postgres(DATABASE_URL)` 연결, `drizzle()` 래핑. 역할 전환 없음.
- **`lib/db/client.ts:33-42`** `withTenantScope(orgId, fn)`:
  - `db.transaction(async (tx) => { tx.execute(sql.raw('SET LOCAL app.current_org_id = ...')); return fn(tx); })`
  - 구현 자체는 **정확** (SET LOCAL 은 트랜잭션 스코프에서만 유효 → db.transaction 내부 실행 보장).
  - **프로덕션 호출부 단 1개**: `lib/ai/retrievers/internal-docs.ts:58` (document 검색 경로).
  - **app/api 라우트에서 호출부 0개**. 모든 라우트는 `eq(orgId, ...)` 앱 필터에만 의존.

### §1.3 영향받는 쿼리 경로 맵핑 (grep 기반 구체적 증거)

**Route-level org-scoped 쿼리 (app/api/)**:

- 총 route.ts: **171개**
- `db.select|insert|update|delete` in app/api: **33개 파일** (grep 카운트)
- `session.user.organizationId` 사용 라우트: rlhf/feedback, traceability, pms, cyberdevice, model-governance, knowledge-gap, change-control 등 다수
- 패턴: `eq(<table>.orgId, session.user.organizationId)` 또는 `eq(...orgId, organizationId)` — 모두 앱 필터. RLS 미작동 시 이 필터가 **유일한 격리 계층**.

**orgId 추출 경로**:
- `lib/auth.ts:91-111` session callback → `s.organizationId = membership?.orgId ?? null` (line 110)
- session.user.organizationId 가 null 인 경우(미가입 사용자) → 빈 문자열 fallback (`app/api/rlhf/feedback/aggregate/route.ts:25`: `?? ''`)

**비-라우트 DB 클라이언트 사용 (GUC 없이 실행되는 경로)**:

| 분류 | 파일 | 비고 |
|------|------|------|
| lib 헬퍼 (40개) | lib/audit.ts, lib/auth.ts, lib/rlhf/*.ts, lib/model-governance/*.ts, lib/knowledge-gap/*.ts, lib/source-governance/*.ts, lib/cyberdevice/*.ts, lib/traceability/hooks.ts, lib/ai/consult.ts, lib/ai/persistence.ts 등 | 대부분 `import { db }` 직접 사용. withTenantScope 미사용. |
| 스크립트 (seed/migration 허용 경로) | scripts/seed-corpus.ts, seed-fda-corpus.ts, seed-radar-fixtures.ts, seed-test-db.ts, seed-local-docs.ts, seed-templates.ts, ingest-gitea-wiki.ts, create-admin.ts, dev-bootstrap.ts, e2e-env.ts | **크로스-org 쓰기 정상 경로**. service-role bypass 유지 필요. |
| Inngest 백그라운드 | lib/inngest/docingest/upload-processed.ts:161 (주석만, 미구현) | 향후 배치 인서트 시 withTenantScope 사용 예정 |

**테스트 DB 클라이언트 역할**:
- `tests/unit/db/client.test.ts`: withTenantScope 자체를 **mock** 으로 검증 (실DB 미접속). `vi.mock('../../../lib/db/client')` 패턴.
- `tests/unit/enterprise-migrations.test.ts`: 20개 `expect(fileExists(...))` — **파일 존재/내용 텍스트 검증**. SQL 실행 안 함. 신규 migration 0083 추가 시 **자동 break 없음** (per-file describe 블록 구조). 단, 새 정책에 대한 케이스 추가 권장.
- 통합/e2e 테스트: 별도 setup 필요 (현재는 unit 만).

### §1.4 이슈 #239 핵심 진단 (오케스트레이터 검증)

`migrations/0082_rlhf.sql:62-68` @MX:TODO 인용:
> "RLS is INERT project-wide (service-role db client bypasses row security; no per-request SET LOCAL role). The query-layer org guard ... is the ACTUAL tenant boundary."

→ **RLS 가 inert 한 근본 원인 2가지**:
1. **연결 역할 문제**: `DATABASE_URL` 이 table owner 또는 BYPASSRLS 속성을 가진 역할 → RLS 정책이 있어도 우회.
2. **GUC 미설정**: `app.current_org_id` 가 세팅되지 않으면 정책의 `current_setting('app.current_org_id')` 가 NULL/빈값 → 모든 행 필터링(또는 에러).

---

## §2 Phase 분해 (3-PR 전략, 단일 세션 불가)

### Phase 1 — WITH CHECK 17개 + 카운터 마이그레이션 (PR #1, 회귀 낮음)

**목표**: INSERT/UPDATE 미게이트 정책 17개에 WITH CHECK 추가. **RLS 는 여전히 inert** (연결 역할 문제 미해결). 정책 형상(Shape)만 완성.

**산출**:
- 신규 migration `migrations/0083_rls_with_check_clauses.sql`: 7개 마이그레이션의 17개 정책에 대해 `ALTER POLICY ... WITH CHECK (...)` 추가 (USING 과 동일 조건).
- WITH CHECK 조건은 기존 USING 조건과 동일하게 유지 (회귀 최소화).
- `tests/unit/enterprise-migrations.test.ts` 에 0083 describe 블록 추가 (정책 수, WITH CHECK 포함 검증).
- `.moai/project/db/rls-policies.md` (_TBD stub) → 실제 정책 매트릭스로 채우기 (단일 진실원 부재 해소).

**게이트 (직검, L-007)**:
- `pnpm test` full 통과 (4262 baseline 유지).
- migration 0083 파일 존재 + 17개 WITH CHECK 포함 (grep 직검).
- `tests/unit/enterprise-migrations.test.ts` 통과.
- 기존 41개 ENABLE ROW LEVEL SECURITY 유지 (FORCE 미추가 — Phase 3 에서 결정).

**의존성**: 없음. 독립 PR.

**회귀 프로파일**: 낮음. RLS 가 이미 inert 이므로 WITH CHECK 추가해도 런타임 동작 변화 없음 (정책이 평가되지 않음).

### Phase 2 — 라우트별 withTenantScope 점진적 wiring (PR #2~#N, 회귀 중간)

**목표**: 모든 org-scoped 라우트 DB 작업을 `withTenantScope(orgId, fn)` 트랜잭션으로 래핑. **아직 RLS 는 inert** (연결 역할 미변경). wiring 계약만 확립.

**산출**:
- app/api 내 33개 DB 접근 라우트를 도메인별 그룹으로 분할 (rlhf, pms, cyberdevice, model-governance, knowledge-gap, traceability, change-control 등).
- 각 그룹별 PR: 라우트 핸들러의 DB 블록을 `await withTenantScope(organizationId, async (db) => { ... })` 로 래핑.
- `lib/` 헬퍼 중 라우트 경로에서 호출되는 것들 (audit, auth 제외 — 크로스-org 정상) 도 wiring.
- 신규 테스트: `tests/unit/db/with-tenant-scope-coverage.test.ts` — app/api 모든 route.ts 를 정적 스캔하여 `db.select|insert|update|delete` 가 withTenantScope 블록 밖에 있으면 실패 (회귀 방어용 정적 게이트).

**게이트 (직검)**:
- `pnpm test` full 통과 (이전 baseline 유지).
- 정적 커버리지 테스트: withTenantScope 밖 org-scoped DB 호출 0건.
- `pnpm lint` (lint:hex 포함) 통과 (L-008).
- 도메인별 e2e 스모크 (최소 1개 도메인) — RLS inert 상태이므로 동작 동일 확인.

**의존성**: Phase 1 완료 후 착수 (정책 형상 완성 전제). Phase 2 끝나야 Phase 3 가능.

**회귀 프로파일**: 중간. 트랜잭션 래핑으로 인한 부작용 (자동커밋 전환, 중첩 트랜잭션, 에러 전파) 가능. 도메인별 분할로 폭발 반경 제한.

**예외 허용 목록 (wiring 제외, 명시적 문서화)**:
- 스크립트/시드: scripts/* (크로스-org 정상 쓰기).
- lib/auth.ts session callback: 인증 컨텍스트 생성 자체이므로 orgId 미확정 상태.
- lib/audit.ts: 크로스-org 감사 기록 (시스템 관점).
- 마이그레이션/배치 작업.

### Phase 3 — enforce 전환 + 연결 역할 검증 (PR #최종, 회귀 높음)

**목표**: RLS 를 실제 enforce. 핵심은 **연결 역할 속성 검증 후 결정**.

**Critical Verification Gate (Phase 3 시작 전 직검)**:

`DATABASE_URL` 의 DB 역할 속성 확인 (PSQL 직저 실행):
```sql
SELECT rolname, rolbypassrls, rolsuper
FROM pg_roles WHERE rolname = current_user;
```

**분기 결정**:

| 검증 결과 | 조치 | 근거 |
|-----------|------|------|
| `rolbypassrls = true` | Option B (비 service-role 클라이언트 전환) 강제 | BYPASSRLS 속성은 FORCE ROW LEVEL SECURITY 도 무시. RLS enforce 불가능. |
| `rolbypassrls = false, table owner` | Option A (FORCE ROW LEVEL SECURITY) 가능 | 소유자는 기본 RLS 우회하지만 FORCE 로 적용 가능. |
| `rolsuper = true` | 슈퍼유저는 항상 우회 → 전용 app 역할 생성 필요 | 운영 권장사항 위반. |

**Option A — FORCE ROW LEVEL SECURITY (권장, 조건부)**:

- 산출: migration `migrations/0084_force_rls.sql` — 모든 RLS 활성 테이블에 `FORCE ROW LEVEL SECURITY`.
- 전제: app 연결 역할이 BYPASSRLS=false 이고 table owner.
- 장점: 클라이언트 구조 변경 없음. withTenantScope GUC 만으로 enforce.
- 단점: 소유자 권한 쿼리(마이그레이션/시드)도 RLS 적용 받음 → escape hatch 필요 (별도 service-role 클라이언트 for scripts).

**Option B — 비 service-role 클라이언트 전환 (대안, 회귀 큼)**:

- 산출: `lib/db/client.ts` 에 `dbAuthenticated` (RLS 적용 역할) + `dbService` (BYPASSRLS, scripts/migrations 전용) 이중 클라이언트.
- 라우트는 `dbAuthenticated` 사용, withTenantScope 로 GUC 세팅.
- 장점: Supabase 표준 패턴, 명확한 역할 분리.
- 단점: 연결 풀 2배, 모든 `import { db }` 호출부 검증 필요, 회귀 폭발.

**권장안**: **Option A (FORCE ROW LEVEL SECURITY)** — 단, Phase 3 게이트 검증(`rolbypassrls=false`) 충족 시. 미충족 시 Option B 로 회피.

**게이트 (직검)**:
- 역할 속성 SQL 직검 결과 기록.
- 카나리: 단일 도메인(예: rlhf) enforce 후 e2e 스모크. 빈 결과/에러 발생 시 즉시 롤백.
- `pnpm test` full 통과.
- 전체 라우트 스모크 (주요 도메인 5개 이상).
- GUC 미설정 탐지: `SET LOCAL app.current_org_id` 없이 쿼리 시 빈 결과 반환하는지 확인하는 명시적 테스트 추가.

---

## §3 Migration Plan

| N | 파일 | Phase | 내용 |
|---|------|-------|------|
| 0083 | `migrations/0083_rls_with_check_clauses.sql` | 1 | 17개 정책 WITH CHECK 추가 (ALTER POLICY) |
| 0084 | `migrations/0084_force_rls.sql` | 3 (Option A 시) | FORCE ROW LEVEL SECURITY on all RLS tables |
| - | `lib/db/client.ts` 수정 | 3 (Option B 시) | 이중 클라이언트 (dbAuthenticated + dbService) |

**마이그레이션 번호 규칙**: `migrations/NNNN_slug.sql` (다음 = 0083, 0084).
**enterprise-migrations.test.ts 영향**: 0083/0084 는 Phase 5 Enterprise 범위 밖(0004~0008, 0072~0081). 자동 break 없음. 단, 정책 수 검증 케이스 추가 권장.

---

## §4 영향도 요약 (파일:라인)

**Phase 1 영향 (마이그레이션만)**:
- `migrations/0083_rls_with_check_clauses.sql` (신규)
- 7개 기존 마이그레이션은 수정 없음 (새 ALTER POLICY 는 0083 에서 실행)
- `tests/unit/enterprise-migrations.test.ts` (+1 describe 블록)
- `.moai/project/db/rls-policies.md` (매트릭스 채우기)

**Phase 2 영향 (라우트 wiring)**:
- `app/api/**/*.ts` — 171개 라우트 중 33개 DB 접근 라우트 (도메인별 분할)
- `lib/*.ts` — 라우트 경로 헬퍼 (audit/auth 제외)
- `tests/unit/db/with-tenant-scope-coverage.test.ts` (신규 정적 게이트)

**Phase 3 영향 (enforce 전환)**:
- `migrations/0084_force_rls.sql` (Option A) 또는 `lib/db/client.ts` (Option B)
- 전체 라우트 스모크 회귀

---

## §5 회귀 완화 전략

### §5.1 GUC 미설정 탐지

- **정적 게이트**: `tests/unit/db/with-tenant-scope-coverage.test.ts` — AST/grep 기반으로 `db.select|insert|update|delete` 가 withTenantScope 블록 밖에 있으면 실패. Phase 2 에서 추가, Phase 3 게이트로 사용.
- **동적 카나리**: Phase 3 에서 단일 도메인(rlhf) 부터 enforce 전환. e2e 스모크로 빈 결과/500 에러 탐지. 실패 시 즉시 롤백 (migration down).
- **명시적 GUC 미설정 테스트**: `SET LOCAL app.current_org_id` 없이 SELECT 시 0행 반환 단언 (RLS 가 실제 enforce 됨을 증명).

### §5.2 롤백 계획

- Phase 1: 0083 마이그레이션 down (WITH CHECK 제거). 무위험.
- Phase 3: 0084 마이그레이션 down (FORCE 제거). RLS 가 다시 inert 로 복귀. 앱 필터가 여전히 동작하므로 기능 영향 없음.
- Option B 경우: `lib/db/client.ts` git revert. 라우트 wiring 은 유지 (withTenantScope 는 비-enforce 상태에서도 트랜잭션 래퍼로 동작).

### §5.3 카나리 시나리오

1. Phase 3 전환 전, 스테이징에서 단일 도메인(rlhf) 라우트만 enforce.
2. `app.current_org_id` 가 세팅된 요청: 정상 데이터 반환.
3. GUC 누락 요청 (의도적): 0행 또는 WITH CHECK 위반 에러.
4. 두 시나리오 모두 단언 통과 시 전체 enforce 승인.

---

## §6 Completion Criteria (runtime 직검)

- [ ] §1.1 의 17개 WITH CHECK 누락 정책이 모두 WITH CHECK 보유 (grep 직검: WITH CHECK 수 ≥ CREATE POLICY 수).
- [ ] `withTenantScope` 호출부가 app/api 의 모든 org-scoped DB 라우트를 커버 (정적 게이트 통과).
- [ ] GUC 미설정 시 SELECT 가 0행 반환함을 증명하는 테스트 통과 (RLS 실제 enforce 증거).
- [ ] 회귀 baseline 4262 passed 유지 (pnpm test full, L-009).
- [ ] 스크립트/시드 경로는 service-role bypass 유지 (크로스-org 쓰기 정상).
- [ ] 이슈 #239 @MX:TODO (`migrations/0082_rlhf.sql:64`) 제거 또는 "resolved by SPEC-REGULA-RLS-ENFORCE-001" 로 교체.

---

## §7 아키텍처 결정 요약

| 항목 | 결정 | 근거 |
|------|------|------|
| WITH CHECK 추가 | Phase 1, 17개 정책 | INSERT/UPDATE 미게이트 폐쇄 |
| GUC wiring 패턴 | `withTenantScope` 트랜잭션 래퍼 (기존 재사용) | SET LOCAL 은 트랜잭션 스코프 필수. 미들웨어(edge) 불가 |
| enforce 방식 | **Option A (FORCE ROW LEVEL SECURITY)** 권장 — 단, `rolbypassrls=false` 검증 후 | 클라이언트 구조 변경 최소, 회귀 프로파일 낮음 |
| Escape hatch | scripts/migrations 는 service-role 유지 | 크로스-org 정상 쓰기 경로 |
| 단일 세션 | 불가 | 3-Phase 분할, Phase 2 는 도메인별 다중 PR |

---

**산출 경로**: `/home/abyz-lab/work/workspace-github/holee9/ra-med-bot/.moai/specs/SPEC-REGULA-RLS-ENFORCE-001/tasks.md`
