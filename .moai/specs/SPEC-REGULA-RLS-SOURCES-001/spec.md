---
id: SPEC-REGULA-RLS-SOURCES-001
title: "sources/source_sections RLS 활성화 — org-isolation defense-in-depth (M-2)"
version: 1.1.0-draft
status: draft
created: 2026-07-09
updated: 2026-07-09
author: manager-spec
priority: medium
issue_number: 317
parent_spec: SPEC-REGULA-RLS-ENFORCE-001
labels: [type/bug, component/backend, priority/medium, security, rls, defense-in-depth]
phase: plan
---

## HISTORY

- 2026-07-09 v1.0.0-draft: 최초 작성. Issue #317 plan phase. 직검 기반 Fact 1-7 반영 (research.md §1). Option A (subquery 정책) 권장 (research.md §2). 0084 누락 원인: scope gap (AC4). 런타임 영향 nil 정정 (Fact 3 / L-013).
- 2026-07-09 v1.1.0: NULL policy strict org-match 확정 (M0 real-DB 직검: NULL 0 rows + knowledge_sources.organization_id NOT NULL ⇒ fail-closed). REQ-RLS-SRC-002/003 정책 표현식에서 `IS NULL OR` disjunction 제거.

---

## 1. 배경 및 목적

Issue #317은 parent #239 (project-wide RLS, CLOSED)가 누락한 sources 및 source_sections 테이블에 RLS(Row Level Security)를 활성화하여 org-isolation defense-in-depth 계층을 완성하는 작업이다.

**현재 상태 (직검):** sources/source_sections는 0000_init에서 RLS policy 없이 생성되었으며, 현재까지 ENABLE ROW LEVEL SECURITY조차 부여되지 않았다. app-level `withTenantScope` GUC (`app.current_org_id`)가 이미 org-isolation을 시행 중이므로, 본 SPEC은 현재 취약점이 아닌 **백업 계층(backstop layer)**을 추가한다.

**규제 근거:** 21 CFR Part 11 §11.10(c) 감사 추적성 + ISO 13485 tenant isolation. 의료기기 RA 도구에서 org 간 데이터 누출은 규제 위반이며, RLS는 superuser 버그나 privilege escalation 시에도 org-scope를 유지하는 최후의 방어선이다.

---

## 2. 범위 (Scope)

### In Scope

- migration: sources 테이블 `ENABLE ROW LEVEL SECURITY` + `FORCE ROW LEVEL SECURITY` + org-isolation policy (USING + WITH CHECK)
- migration: source_sections 테이블 `ENABLE ROW LEVEL SECURITY` + `FORCE ROW LEVEL SECURITY` + org-isolation policy (subquery/JOIN 방식, research.md §2 Option A)
- real-DB 통합 테스트: 카나리 role (`regula_app` NOBYPASSRLS) 기반 GUC set/unset 시나리오 (AC3)
- 문서화: migration 0084가 sources/source_sections를 누락한 진실 원인 (AC4)

### Exclusions (What NOT to Build)

- **DO NOT**: 다른 테이블의 RLS 정책을 수정하거나 WITH CHECK를 추가하지 않는다 (non-goal 명시)
- **DO NOT**: RAG pipeline (retrieval/ingestion)을 재구조화하지 않는다
- **DO NOT**: `regula_app` role 생성을 반복하지 않는다 (migration 0085가 이미 생성)
- **DO NOT**: `DATABASE_URL`을 `regula_app`으로 전환하는 ops 작업을 수행하지 않는다 (본 SPEC scope 외부)
- **DO NOT**: source_sections에 denormalized `organization_id` 컬럼을 추가하지 않는다 (Option B, research.md §2에서 기각)
- **DO NOT**: app-level `withTenantScope` 호출 경로를 변경하지 않는다 (RLS는 백업 계층, app 로직은 동일)

---

## 3. 가정 (Assumptions)

1. `regula_app` role (migration 0085 생성, NOSUPERUSER NOBYPASSRLS)이 DB에 존재한다 (직검: 0085_app_role.sql)
2. 현재 `DATABASE_URL`은 `postgres` superuser (직검: .env.local:6) — RLS는 런타임에 inert 상태
3. `sources.organization_id`는 nullable이나, 코퍼스는 현재 100% org-scoped이며 글로벌 문서도 per-org로 ingestion된다 (research.md Fact 7 — real-DB 직검: NULL 0 rows; Fact 8 — `knowledge_sources.organization_id` NOT NULL). NULL org_id row는 의도된 상태가 아니며, strict org-match 정책이 fail-closed로 차단한다 (defense-in-depth)
4. 모든 ingestion/retrieval 쿼리 경로는 이미 `withTenantScope`로 GUC를 설정한다 (직검: research.md Fact 5)
5. `sources.id`는 PK이며 `source_sections.source_id`는 FK (CASCADE)로 조인 구조가 보장된다 (직검: 0000_init.sql:89,126)

---

## 4. 요구사항 (EARS Format)

### REQ-RLS-SRC-001 — sources 테이블 RLS 활성화 (AC1)

**Ubiquitous + State-Driven**: The database **shall** have `ENABLE ROW LEVEL SECURITY` and `FORCE ROW LEVEL SECURITY` on the `sources` table, such that all rows are subject to the org-isolation policy regardless of the connecting role's table-owner status.

**검증**: `SELECT relrowsecurity, relforcerowsecurity FROM pg_class WHERE relname = 'sources'` → both `true`.

---

### REQ-RLS-SRC-002 — sources org-isolation 정책 (AC2)

**Event-Driven**: **When** a query reads or writes the `sources` table under a `regula_app` role (NOBYPASSRLS) with `app.current_org_id` GUC set, the database **shall** restrict rows to those where `organization_id = current_setting('app.current_org_id', true)::uuid` (USING — strict org-match, no `IS NULL OR` disjunction) and **shall** reject any INSERT/UPDATE where the new `organization_id` is NULL or does not equal the GUC value (WITH CHECK — fail-closed). A NULL `organization_id` row is blocked from both read (invisible) and write (rejected), which is the intended defense-in-depth behavior since ingestion is architecturally always org-scoped (Fact 8).

**검증**: 카나리 role 기반 Given/When/Then (acceptance.md AC2 시나리오).

---

### REQ-RLS-SRC-003 — source_sections 테이블 RLS 활성화 + 정책 (AC1, AC2)

**Ubiquitous + State-Driven**: The database **shall** have `ENABLE ROW LEVEL SECURITY` and `FORCE ROW LEVEL SECURITY` on the `source_sections` table, with a policy that **shall** use a subquery to the parent `sources` table to determine org ownership (since `source_sections` has no `organization_id` column — Fact 2).

**Event-Driven**: **When** a query reads `source_sections` under a NOBYPASSRLS role with GUC set, the database **shall** allow access only to sections whose parent source satisfies `s.organization_id = current_setting('app.current_org_id', true)::uuid` (strict org-match via EXISTS subquery — no `IS NULL OR` disjunction). **When** a query inserts/updates `source_sections`, the database **shall** reject the write unless the parent source's `organization_id` equals the GUC value (no NULL-org insert allowed — ingestion is always org-scoped).

**설계 근거**: research.md §2 Option A (subquery). `sources.id` PK 인덱스上进行, planner 비용 미미. Option B (denormalized column)는 동기화 불변성 위험으로 기각.

**검증**: 카나리 role 기반 source_sections GUC 시나리오 (acceptance.md AC2 시나리오).

---

### REQ-RLS-SRC-004 — 카나리 테스트 role 및 GUC 시나리오 (AC3)

**State-Driven**: **While** the application DB role remains `postgres` (superuser, RLS bypass), the database **shall not** enforce RLS on sources/source_sections at runtime (Fact 3). The test suite **shall** verify RLS behavior using the `regula_app` role (NOBYPASSRLS, migration 0085) via `SET ROLE regula_app` within real-DB integration tests.

**Event-Driven**: **When** the canary runs with GUC set to org A, the test **shall** observe only org-A rows. **When** the canary runs with GUC unset or set to org B, the test **shall** observe zero org-A rows (fail-closed). Any NULL-org row (if introduced by a bug) **shall** be invisible under the strict org-match policy — this verifies fail-closed defense-in-depth.

**검증**: `tests/integration/rls-sources-real-db.test.ts` (신규), acceptance.md AC3 시나리오.

---

### REQ-RLS-SRC-005 — migration 0084 누락 진실 원인 문서화 (AC4)

**Ubiquitous**: The SPEC research document **shall** document the verified root cause of why migration 0084 (FORCE ROW LEVEL SECURITY) omitted sources/source_sections: they were created in 0000_init without any RLS policy, and 0083/0084 were migrations that attached WITH CHECK/FORCE to tables that already had ENABLE+policy from migrations 0066-0082. sources/source_sections had no policy to attach to — a scope gap, not a list omission (the list is 19 tables, not 20; ingest_jobs was dropped in 0017).

**검증**: research.md §1 Fact 4 + migration 파일 헤더 주석 (0114 migration에 AC4 설명 포함).

---

### REQ-RLS-SRC-006 — superuser 하에서 런타임 회귀 없음 (NFR)

**State-Driven**: **While** `DATABASE_URL` points to the `postgres` superuser, the application **shall** experience zero runtime behavior change from this SPEC's migrations (RLS is inert under superuser). No existing test, ingestion path, or retrieval path **shall** regress.

**검증**: 기존 `pnpm test` 전체 통과 + real-DB 기존 테스트 통과 (acceptance.md NFR 시나리오).

---

### REQ-RLS-SRC-007 — real-DB migration 적용 검증 (NFR, L-010/L-013)

**Event-Driven**: **When** the new migration (0114) is applied to regula-test-db, the database **shall** reflect `ENABLE + FORCE ROW LEVEL SECURITY` and the org-isolation policies on sources/source_sections, verifiable via `pg_class.relrowsecurity`, `pg_class.relforcerowsecurity`, and `pg_policy` catalog tables (not just textual SQL parsing).

**검증**: `tests/integration/migrations-real-db.test.ts` 또는 신규 real-DB 테스트에서 `\d`/catalog 쿼리로 직검 (acceptance.md NFR 시나리오).

---

## 5. 비기능 요구사항 (NFRs)

| ID | 항목 | 기준 |
|----|------|------|
| NFR-1 | 런타임 회귀 | superuser 하에서 기존 `pnpm test` 100% 통과 (REQ-RLS-SRC-006) |
| NFR-2 | real-DB 검증 | migration 적용 후 `pg_class`/`pg_policy` catalog 직검 (L-010/L-013, REQ-RLS-SRC-007) |
| NFR-3 | 카나리 독립성 | 카나리 테스트는 `regula_app` role로 수행, `postgres` superuser 의존 금지 (REQ-RLS-SRC-004) |
| NFR-4 | 보안 | 정책은 `FOR ALL TO regula_app` — superuser bypass는 의도적, regula_app 전환 후 enforce |
| NFR-5 | 성능 | Option A subquery 정책이 hot retrieval 경로에 성능 영향을 주지 않음을 `EXPLAIN ANALYZE`로 확인 (M3) |

---

## 6. 제약사항 (Constraints)

1. **migration 번호**: 0114 (0113이 최신, 직검)
2. **policy 이름 규칙**: `{table}_org_isolated` (0099 knowledge_sources 패턴 준수)
3. **GUC 이름**: `app.current_org_id` (project-wide 표준, 0015부터 사용)
4. **role**: `regula_app` (migration 0085, 재사용 — 신규 role 생성 금지)
5. **Charter 준수**: [지양-1]은 RAG corpus *content*(FDA/EU MDR/MFDS/NMPA/PMDA + 내부 SOP)를 규정하며, storage nullability가 아니다 — strict org-match 정책이 부합. 근거: (1) real-DB 코퍼스는 100% org-scoped (NULL 0 rows, Fact 7), (2) `knowledge_sources.organization_id`가 NOT NULL이므로 ingestion은 아키텍처적으로 항상 org-scoped (Fact 8), (3) fail-closed on NULL이 defense-in-depth 정답 — NULL org_id는 bug를 의미하며 차단되어야 한다

---

## 7. 추적성 (Traceability)

| REQ | Issue AC | 검증 방법 | File |
|-----|----------|-----------|------|
| REQ-RLS-SRC-001 | AC1 | pg_class catalog | migrations/0114_*.sql |
| REQ-RLS-SRC-002 | AC2 | 카나리 GUC 시나리오 | migrations/0114_*.sql + tests/integration/rls-sources-real-db.test.ts |
| REQ-RLS-SRC-003 | AC1, AC2 | 카나리 source_sections 시나리오 | migrations/0114_*.sql + tests/integration/rls-sources-real-db.test.ts |
| REQ-RLS-SRC-004 | AC3 | real-DB SET ROLE 테스트 | tests/integration/rls-sources-real-db.test.ts |
| REQ-RLS-SRC-005 | AC4 | research.md + migration 주석 | research.md §1 Fact 4, migrations/0114_*.sql 헤더 |
| REQ-RLS-SRC-006 | (NFR) | pnpm test 전체 통과 | CI |
| REQ-RLS-SRC-007 | (NFR) | pg_class/pg_policy 직검 | tests/integration/migrations-real-db.test.ts (확장) |
