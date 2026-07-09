# Acceptance — SPEC-REGULA-RLS-SOURCES-001

> Issue #317 AC1-AC4 매핑 + 카나리 시나리오 + NFR 게이트
> 모든 시나리오는 Given/When/Then 형식. 검증 명령은 real-DB (regula-test-db) 기준.

---

## 1. AC1 — sources/source_sections RLS 활성화 + FORCE

### AC1-G1 — sources ENABLE + FORCE

**Given** migration 0114가 regula-test-db에 적용되었다
**When** 다음 쿼리를 실행하면:
```sql
SELECT relrowsecurity, relforcerowsecurity
FROM pg_class WHERE relname = 'sources';
```
**Then** 결과가 `(true, true)`이어야 한다 (둘 다 true).

### AC1-G2 — source_sections ENABLE + FORCE

**Given** migration 0114가 regula-test-db에 적용되었다
**When** 동일한 catalog 쿼리를 `source_sections`에 대해 실행하면
**Then** 결과가 `(true, true)`이어야 한다.

**검증 명령** (psql 또는 drizzle execute):
```sql
SELECT relname, relrowsecurity, relforcerowsecurity
FROM pg_class
WHERE relname IN ('sources', 'source_sections');
```

---

## 2. AC2 — org_id policy USING + WITH CHECK

### AC2-G1 — sources 정책 존재

**Given** migration 0114가 적용되었다
**When** `SELECT * FROM pg_policy WHERE polname = 'sources_org_isolated'` 실행
**Then** 정책이 존재하며, `polcmd = '*'` (FOR ALL), `polroles`에 `regula_app`의 OID가 포함되어야 한다.

### AC2-G2 — source_sections 정책 존재 (subquery)

**Given** migration 0114가 적용되었다
**When** `SELECT * FROM pg_policy WHERE polname = 'source_sections_org_isolated'` 실행
**Then** 정책이 존재하며, `polqual` (USING)과 `polwithcheck` 모두 `EXISTS (SELECT 1 FROM sources s WHERE s.id = source_sections.source_id AND ...)` 형태를 포함해야 한다.

### AC2-G3 — 카나리: GUC set → 자기 org rows 가시

**Given** 두 org (org-A, org-B)가 각각 sources row를 가지고 있고, `regula_app` role로 세션을 열었다
**When** 다음을 실행하면:
```sql
SET ROLE regula_app;
SET app.current_org_id = '<org-A-uuid>';
SELECT count(*) FROM sources WHERE organization_id = '<org-A-uuid>';
```
**Then** org-A의 source row count가 반환되어야 한다 (예: 기존 데이터 기준 N행).

### AC2-G4 — 카나리: GUC unset → fail-closed (0행)

**Given** `regula_app` role 세션
**When** GUC를 설정하지 않고 (또는 org-B로 설정하고) org-A source를 조회하면:
```sql
SET ROLE regula_app;
-- GUC 미설정 상태
SELECT count(*) FROM sources WHERE organization_id = '<org-A-uuid>';
```
**Then** 결과가 `0`이어야 한다 (fail-closed). org-A row는 보이지 않는다.

### AC2-G5 — 카나리: cross-org INSERT WITH CHECK 차단

**Given** `regula_app` role, GUC = org-A
**When** org-B의 organization_id로 sources에 INSERT를 시도하면:
```sql
SET ROLE regula_app;
SET app.current_org_id = '<org-A-uuid>';
INSERT INTO sources (id, organization_id, org_label, title, type)
VALUES (gen_random_uuid(), '<org-B-uuid>', 'B', 'cross-org attempt', 'regulatory');
```
**Then** `ERROR: new row violates row-level security policy` 오류로 차단되어야 한다.

### AC2-G6 — 카나리: source_sections GUC set → 자기 org sections 가시

**Given** org-A의 source에 매달린 source_sections row가 존재한다
**When** `regula_app` role + GUC = org-A로 해당 sections을 조회하면
**Then** org-A의 sections이 가시적이어야 한다.

### AC2-G7 — 카나리: source_sections cross-org INSERT 차단

**Given** `regula_app` role, GUC = org-A, org-B의 source row가 존재한다
**When** org-B의 source_id로 source_sections에 INSERT를 시도하면
**Then** WITH CHECK가 부모 source의 org_id ≠ GUC를 감지하여 차단해야 한다 (`ERROR: new row violates row-level security policy`).

### AC2-G8 — 카나리: NULL-org source 차단 (strict fail-closed 검증)

**Given** synthetic하게 `organization_id IS NULL`인 source row를 삽입한다 (bug 시뮬레이션 — 정책 결정: strict org-match, Fact 7/8/9 기반)
**When** `regula_app` role + GUC = org-A(어떤 org)로 해당 NULL-org source를 조회하면
**Then** NULL-org source는 **보이지 않아야 한다** (0행 반환 — strict org-match 정책이 USING에서 차단). 이는 fail-closed defense-in-depth 동작을 검증한다: NULL org_id row는 bug이며, 어떤 org 세션에서도 invisible이어야 한다.

---

## 3. AC3 — retriever/ingestion 경로 카나리

### AC3-G1 — superuser는 RLS unaffected (Fact 3 검증)

**Given** 현재 `DATABASE_URL` = postgres superuser
**When** GUC 설정 없이 sources/source_sections를 조회하면
**Then** 모든 row가 가시적이어야 한다 (superuser는 RLS bypass). 이는 런타임 회귀가 0임을 입증 (REQ-RLS-SRC-006).

### AC3-G2 — regula_app 전환 시나리오 시뮬레이션

**Given** `regula_app` role (NOBYPASSRLS)로 세션을 열었다
**When** 다음 3가지 GUC 상태를 순차적으로 실행하면:
```sql
SET ROLE regula_app;
-- (1) GUC = org-A
SET app.current_org_id = '<org-A-uuid>'; SELECT count(*) FROM sources;
-- (2) GUC unset
RESET app.current_org_id; SELECT count(*) FROM sources;
-- (3) GUC = org-B (타 org)
SET app.current_org_id = '<org-B-uuid>'; SELECT count(*) FROM sources;
```
**Then**:
- (1) org-A rows 반환 (strict org-match)
- (2) `0` (fail-closed — GUC 미설정 시 어떤 row도 보이지 않음)
- (3) `0` (org-A 관점에서 타 org는 보이지 않음)

### AC3-G3 — ingestion 경로 (withTenantScope 호환)

**Given** `lib/ingest/source-sections-upsert.ts`가 `withTenantScope(orgId)` 내에서 INSERT를 수행한다
**When** regula_app role 하에서 해당 함수를 호출하면 (또는 동등한 GUC 설정 환경)
**Then** INSERT가 정상 수행되어야 한다 (GUC = orgId가 부모 source의 org와 일치하므로 WITH CHECK 통과).

### AC3-G4 — retrieval 경로 (withTenantScope 호환)

**Given** `lib/rlhf/retrieval-hook.ts`가 `withTenantScope` 내에서 source_sections SELECT를 수행한다
**When** regula_app role 하에서 호출하면
**Then** 자기 org의 sections만 반환되어야 한다 (RLS가 app-level WHERE와 일관되게 동작).

---

## 4. AC4 — migration 0084 누락 진실 원인 문서화

### AC4-G1 — research.md에 진실 원인 기록

**Given** research.md가 존재한다
**When** research.md §1 Fact 4를 읽으면
**Then** 다음 진실이 명시되어야 한다:
1. 0083/0084는 19개 테이블을 대상으로 함 (20개 아님; ingest_jobs는 0017에서 DROP)
2. sources/source_sections는 0000_init에서 RLS policy 없이 생성됨
3. 0083/0084는 "기존에 ENABLE+policy가 있는 테이블에 WITH CHECK/FORCE를 붙이는" migration이었으므로, sources/source_sections는 대상 주소록에 없었음 (scope gap, not list omission)

### AC4-G2 — migration 0114 헤더에 AC4 설명

**Given** migrations/0114_*.sql이 존재한다
**When** 파일 헤더 주석을 읽으면
**Then** 0084 누락 원인에 대한 1문단 요약이 `@MX:NOTE`와 함께 포함되어야 한다 (AC4 교차 검증 소스).

---

## 5. NFR 시나리오

### NFR-1 — superuser 하에서 기존 테스트 100% 통과

**Given** main branch의 기존 테스트 스위트
**When** migration 0114 적용 후 `pnpm test`를 실행하면 (superuser 연결)
**Then** 기존 통과했던 모든 테스트가 동일하게 통과해야 한다 (회귀 0건).

**검증**: `pnpm ci:test` (L-009: full test, 타깃만 아님).

### NFR-2 — real-DB migration 적용 + catalog 직검

**Given** regula-test-db에 migration 0114가 적용되었다
**When** 다음 catalog 쿼리를 실행하면:
```sql
SELECT c.relname, c.relrowsecurity, c.relforcerowsecurity,
       array_agg(p.polname) AS policies
FROM pg_class c
LEFT JOIN pg_policy p ON p.polrelid = c.oid
WHERE c.relname IN ('sources', 'source_sections')
GROUP BY c.relname, c.relrowsecurity, c.relforcerowsecurity;
```
**Then**:
- 두 테이블 모두 `relrowsecurity = true`, `relforcerowsecurity = true`
- `sources`에 `sources_org_isolated` 정책 존재
- `source_sections`에 `source_sections_org_isolated` 정책 존재

**검증**: `tests/integration/migrations-real-db.test.ts` 확장 또는 신규 real-DB 테스트 (L-010/L-013: textual SQL만으로는 부족, 실DB catalog 직검 필수).

### NFR-3 — 카나리 테스트 regula_app role 독립성

**Given** 카나리 테스트가 `SET ROLE regula_app`으로 수행된다
**When** 테스트 환경의 기본 role이 `postgres`여도
**Then** 카나리는 `SET ROLE regula_app` 후 NOBYPASSRLS 동작을 검증해야 한다 (superuser로 fallback하지 않음).

### NFR-5 — Option A subquery 성능 (M3)

**Given** source_sections에 상당한 데이터가 존재한다 (운영 규모 또는 시드 데이터)
**When** retrieval 쿼리(`WHERE id IN (...)`)에 대해 `EXPLAIN ANALYZE`를 실행하면
**Then** subquery 정책이 sequential scan을 유발하지 않고, PK/FK 인덱스를 사용해야 한다. P95 지연이 기준치(예: 기존 대비 +50ms 이내)를 초과하지 않아야 한다. — **초과 시 Option B fallback 검토** (research.md §2).

---

## 6. Definition of Done (DoD)

- [ ] migration 0114가 생성되었고, sources/source_sections에 ENABLE + FORCE + org-isolation policy를 포함한다
- [ ] migration 0114 헤더에 AC4 누락 원인 설명이 있다 (@MX:NOTE)
- [ ] real-DB (regula-test-db)에 migration이 정상 적용된다 (L-010)
- [ ] `pg_class`/`pg_policy` catalog 직검으로 ENABLE+FORCE+policy를 확인한다 (L-013, NFR-2)
- [ ] `tests/integration/rls-sources-real-db.test.ts` (또는 동등)가 AC2-G3~G8, AC3-G2~G4 시나리오를 포함한다
- [ ] 카나리 테스트는 `regula_app` role (NOBYPASSRLS)로 수행된다 (NFR-3)
- [ ] 기존 `pnpm test` 100% 통과 (NFR-1)
- [ ] L-015: `pnpm ci:migrations`, `ci:rbac`, `ci:audit`, `ci:test`, `ci:lint`, `ci:typecheck` 전 단계 로컬 통과
- [ ] Charter [지양-1~5] 위반 없음 (research.md §1 Fact 7, §2에서 검증)
- [ ] research.md에 직검 로그 (§5)가 모든 Fact의 file:line 출처를 포함한다

---

## 7. Edge Cases (경계 시나리오)

| 시나리오 | 예상 동작 | 근거 |
|----------|-----------|------|
| `organization_id IS NULL` source INSERT (regula_app, GUC set) | WITH CHECK 차단 (`organization_id = GUC` 불일치) | ingestion은 항상 org-scoped (Fact 8) |
| `organization_id IS NULL` source SELECT (regula_app, GUC set) | strict 정책: 항상 차단 (fail-closed), ingestion은 org-scoped 강제 | Fact 7/8/9 — NULL org_id는 bug |
| 고아 source_section (부모 source가 삭제 중인 경우) | FK CASCADE가 section을 먼저 삭제하므로 정책 평가 전에 제거 | 0000_init ON DELETE CASCADE |
| `superseded_by`가 설정된 section | RLS와 무관 (superseded는 비즈니스 로직) — 정책은 그대로 적용 | retrieval-hook.ts가 이미 WHERE로 필터 |
| system-actor query (orphan-cleanup.ts) | `db` singleton (service role)로 RLS bypass — 본 SPEC과 무관 | research.md Fact 5 |

---

## 8. 품질 게이트 (Quality Gates, L-015)

run phase 종료 전 다음을 로컬에서 직검 (CI green ≠ 전체 green):

```bash
pnpm ci:migrations      # migration sequence (0114 번호 정합)
pnpm ci:rbac            # RBAC route matrix (본 SPEC과 무관하나 회귀 확인)
pnpm ci:audit           # audit completeness
pnpm ci:lint            # biome lint (lint:hex full)
pnpm ci:typecheck       # tsc
pnpm ci:test            # vitest run (full, L-009)
pnpm ci:coverage        # coverage (85% ratchet, SPEC-REGULA-REALDB-001 게이트)
```

추가 (real-DB):
```bash
DATABASE_URL=postgresql://postgres:test@localhost:5432/regula_test pnpm vitest run tests/integration/rls-sources-real-db.test.ts
DATABASE_URL=... pnpm vitest run tests/integration/migrations-real-db.test.ts
```
