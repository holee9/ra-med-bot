---
id: SPEC-REGULA-TENANT-001
version: 2.0.0
status: completed
phase: 12
priority: Medium
created: 2026-04-22
updated: 2026-05-04
author: manager-spec (Regula harness)
issue_number: 14
depends_on:
  - SPEC-REGULA-ENTERPRISE-001
lifecycle_level: spec-anchored
---

# SPEC-REGULA-TENANT-001 — Tenant-Lite (부서 Attribute RBAC)

## HISTORY

| Date | Version | Change | Author |
|------|---------|--------|--------|
| 2026-04-22 | 0.1.0 | Initial draft — Phase 12 multi-tenancy hardening + SOC 2 Type II + HIPAA BAA + ISO 27001 ISMS (70 REQ) | manager-spec |
| 2026-05-04 | 2.0.0 | SCOPE REDUCTION: 70 REQ → 5 REQ. v2.0 redefines Phase 10 as "TENANT-Lite". Original enterprise multi-tenancy, 3-layer RLS isolation, SOC 2/HIPAA BAA chain, ISO 27001, multi-region — all DROPPED. Single-tenant internal tool assumption confirmed. Only department attribute RBAC remains (absorbed into Phase 5 ENTERPRISE). See master-roadmap-v2.md Section 3.10. | manager-spec |
| 2026-05-04 | 2.0.0 | STATUS: completed — Issue #14 implementation, PR review, sync all complete. | manager-spec |

---

## 1. Purpose and Context (v2.0)

### 1.1 v2.0 스코프 축소 결정

본 SPEC은 v0.1.0에서 70개의 REQ로 enterprise multi-tenant 플랫폼을 정의했으나, 2026-05-04 master-roadmap-v2 검토 결과 **5개 REQ로 축소**되었다. v2.0은 Phase 12를 "TENANT-Lite"로 재정의하며, 부서(department) attribute 기반 RBAC만 유지한다.

핵심 결정 근거 (master-roadmap-v2.md §3.10):

- **Regula는 사내 전용 RA 운영 시스템이다.** 사용자는 6~8명(RA 1~2 + Dev 2 + Exec 1 + External 2~3)이며, enterprise SaaS가 아니다.
- **Single-tenant 가정이 확인되었다.** 외부 고객사에게 multi-tenant SaaS로 판매할 계획이 없으므로 RLS 기반 3-layer isolation이 불필요하다.
- **외부 인증(SOC 2 / HIPAA BAA / ISO 27001)은 채택하지 않는다.** 대신 사내 정책 체크리스트와 21 CFR Part 11 self-compliance 절차로 대체된다.
- **Multi-region 데이터 거주성도 불필요하다.** 단일 region에 모든 데이터가 위치한다.

### 1.2 v2.0 구현 완료 (Issue #14)

Issue #14 "[Phase 12] Tenant-Lite — 부서 Attribute RBAC 5 REQ"가 구현 완료되었다. 구현 내용:

- Group A: RA / Dev / Exec / External 부서 attribute 스키마 (`users.department`)
- Group B: 부서별 기능 ACL 매트릭스 적용

### 1.3 v0.1.0과의 관계

v0.1.0의 70개 REQ는 §10에 ARCHIVED 항목으로 보존된다. 향후 외부 고객사 SaaS 판매 결정이 내려지면 별도의 SPEC(예: SPEC-REGULA-MULTITENANT-001)으로 부활시킨다.

---

## 2. Goals and Non-Goals

### 2.1 Goals (v2.0 스코프)

다음 5개 REQ만이 v2.0의 정식 스코프이다:

- **G1.** `users` 테이블에 `department` 컬럼 추가 (REQ-TEN-001).
- **G2.** Drizzle ORM 비파괴적 마이그레이션 적용 (REQ-TEN-002).
- **G3.** RA / Dev / Exec / External 부서별 ACL 매트릭스 적용 (REQ-TEN-003).
- **G4.** `audit_logs.metadata`에 `department` 필드 포함 (REQ-TEN-004).
- **G5.** Admin Users UI에서 department 편집 + 변경 감사 로깅 (REQ-TEN-005).

### 2.2 Non-Goals (명시적 제외)

다음 항목은 v2.0에서 절대 구현하지 않는다:

- Postgres Row-Level Security (RLS)
- Drizzle ORM tenant_id middleware (3-layer isolation)
- Cloudflare Worker tenant JWT validation (edge layer isolation)
- SOC 2 Type II 외부 감사
- HIPAA BAA chain
- ISO/IEC 27001:2022 ISMS 인증
- Multi-region 데이터 거주성
- Compliance tier model (`standard` / `hipaa` / `pharma`)
- Blue-Green migration for tenant_id retroactive addition
- `tenants`, `tenant_members`, `tenant_audit_policies` 테이블

---

## 3. Exclusions (What NOT to Build)

[HARD] v2.0의 명시적 제외 항목:

- **E1.** Multi-tenant 모델 어떤 것도 도입하지 않는다. Single-tenant 가정으로 진행한다.
- **E2.** Postgres RLS policy 도입 금지. `users.department`는 일반 컬럼으로 처리하며, ACL은 application layer에서만 평가한다.
- **E3.** `tenants`, `tenant_members`, `tenant_audit_policies` 테이블 생성 금지.
- **E4.** Cloudflare Worker JWT tenant context 검증 미구현.
- **E5.** SOC 2 / HIPAA / ISO 27001 관련 control mapping 미수행.
- **E6.** Multi-region 라우팅 미구현.
- **E7.** Admin tenant 관리 페이지(`/admin/tenant/*`) 신설 금지. 기존 `/admin/users`에 department 컬럼만 추가한다.
- **E8.** External user를 위한 separate tenant 격리 미구현. External은 기존 single-tenant 안에서 ACL로 분리한다.

---

## 4. Functional Requirements (EARS, v2.0 — 5 REQ)

### 4.1 Group A — Department Attribute Schema

#### REQ-TEN-001 — `users.department` 컬럼 정의

**EARS:** The system **shall** maintain a `department` column on the `users` table with type `text not null` and check constraint `check (department in ('ra', 'dev', 'exec', 'external'))`. Default value during initial migration **shall** be `'ra'`.

**근거:** Regula는 사내 RA 시스템으로 부서가 6~8명의 사용자를 명확하게 구분하는 1차 attribute다. `not null`로 강제해 ACL 평가 시 `null` 분기를 제거하고, check constraint로 enum 무결성을 DB 레이어에서 보장한다.

**검증 방법:**
- Unit test: `lib/db/schema.ts`에서 `department` 컬럼이 `text().notNull()` + check constraint로 선언되었는지 확인.
- DB 통합 test: `INSERT INTO users (..., department) VALUES (..., 'invalid')` 가 check constraint 위반으로 실패함을 확인.
- DB 통합 test: `INSERT INTO users (..., department) VALUES (..., 'ra')` / `'dev'` / `'exec'` / `'external'` 가 모두 성공함을 확인.

#### REQ-TEN-002 — Drizzle 비파괴적 마이그레이션

**EARS:** **When** the Drizzle migration adds the `department` column to the existing `users` table, the system **shall** apply a non-destructive migration that backfills existing rows with `department = 'ra'` and **shall not** invalidate any existing Auth.js session record or break currently-authenticated user logins.

**근거:** Regula는 운영 중인 사내 시스템이며 사용자 세션이 활성 상태에서 마이그레이션이 적용된다. `ADD COLUMN ... DEFAULT 'ra' NOT NULL` 패턴으로 단일 트랜잭션에서 안전하게 처리 가능하며, Auth.js의 `users` 테이블 사용 방식과 호환된다.

**검증 방법:**
- Migration test: 마이그레이션 적용 전 `users` 테이블에 N개 row가 있는 fixture를 만든 뒤 마이그레이션 실행, 모든 row가 `department = 'ra'`로 채워졌고 카운트가 변경되지 않음을 확인.
- Session 호환성 test: 마이그레이션 전 발급된 Auth.js 세션 쿠키가 마이그레이션 후에도 유효하게 동작함을 확인.
- Down migration test: 마이그레이션 롤백 시 `department` 컬럼이 안전하게 제거됨을 확인.

### 4.2 Group B — Department-Based ACL

#### REQ-TEN-003 — 부서별 ACL 매트릭스

**EARS:** **When** an authenticated user issues a request to a protected route or workflow, the system **shall** evaluate the user's `department` attribute and grant or deny access according to the following matrix:

| Department | RA workflows (RAG, drafter, audit-response, indication-impact) | Expert review queue | Admin panel (`/admin/*`) | Radar admin / corpus ingestion | Read-only dashboards & reports | Updates feed (shared) |
|------------|----------------------------------------------------------------|---------------------|--------------------------|--------------------------------|--------------------------------|------------------------|
| `ra`       | Full read/write/submit                                         | Full                | Denied                   | Denied                         | Full                           | Full                   |
| `dev`      | Read-only                                                      | Denied              | Full read/write          | Full                           | Full                           | Full                   |
| `exec`     | Read-only                                                      | Read-only           | Denied                   | Denied                         | Full read-only                 | Full                   |
| `external` | Denied (except explicitly shared workflows)                    | Denied              | Denied                   | Denied                         | Denied                         | Full (read)            |

**근거:** 부서별 책임 분리는 사내 운영 거버넌스의 핵심이다. `ra`는 Regulatory Affairs 핵심 워크플로우 전체를 소유하고, `dev`는 admin/시스템 관리에 집중하지만 RA 워크플로우의 read 권한을 가진다. `exec`는 의사결정용 read-only 액세스만 가진다. `external` 컨설턴트는 explicitly shared 페이지에만 접근 가능하다.

**검증 방법:**
- Unit test (`lib/auth/department-acl.ts`): 각 부서별로 모든 보호된 route에 대해 expected permission이 정확히 반환됨을 확인.
- E2E test: `dev` 사용자로 로그인 후 `/admin/users` 접근 가능, `ra` 사용자로 접근 차단 확인.
- E2E test: `external` 사용자로 로그인 후 RA 워크플로우 차단, `/updates` 접근 가능 확인.

#### REQ-TEN-004 — `audit_logs.metadata.department` 기록

**EARS:** **When** any auditable action is recorded into `audit_logs`, the system **shall** include the acting user's current `department` value inside the `metadata` JSON field as `{ "department": "<value>" }`.

**근거:** 감사 로그는 21 CFR Part 11 자체 준수의 핵심 산출물이다. `metadata`에 부서 값을 직접 임베드하면 작업 시점의 부서 값을 고정 저장하므로 사용자가 나중에 다른 부서로 이동해도 과거 감사 기록이 정확하게 보존된다.

**검증 방법:**
- Unit test (`lib/audit.ts`): `recordAudit({ ... })` 호출 시 `metadata.department`가 호출자의 세션 부서 값과 일치함을 확인.
- DB 통합 test: 대표적 액션 각각에 대해 `audit_logs` row의 `metadata`에 `department` 필드가 포함됨을 확인.

#### REQ-TEN-005 — Admin Users UI department 편집 + 감사 로깅

**EARS:** The admin user management UI at `/admin/users` **shall** display the `department` attribute for each user and **shall** allow administrators to edit it. **When** an administrator changes a user's `department` value, the system **shall** record an audit log entry with `audit_action = 'user_department_changed'` containing both the old and new department values in `metadata`.

**근거:** 부서 변경은 즉시 사용자의 권한 범위(REQ-TEN-003 매트릭스)를 변경하므로, 누가 언제 어떤 부서로 변경했는지 추적이 의무적이다.

**검증 방법:**
- E2E test: `dev` 사용자로 `/admin/users` 접근, 다른 사용자의 부서를 `ra` → `exec`로 변경, audit_logs에 `user_department_changed` 행이 old=`'ra'`, new=`'exec'`로 기록됨을 확인.
- Unit test: 부서 변경 API endpoint가 (1) `dev` 부서가 아니면 403, (2) 변경 후 `audit_logs.insert` 호출 여부, (3) old/new 값이 정확한지 검증.

---

## 5. Acceptance Criteria (Issue #14 검증 체크리스트)

- [x] **AC-1.** `users` 테이블 schema에 `department text not null` + check constraint 적용됨 (REQ-TEN-001).
- [x] **AC-2.** Drizzle 마이그레이션을 staging DB에 적용했을 때 모든 기존 row가 `department = 'ra'`로 backfill되며 row count가 변하지 않음 (REQ-TEN-002).
- [x] **AC-3.** 마이그레이션 적용 후 기존 Auth.js 세션 쿠키로 로그인 상태가 유지됨 (REQ-TEN-002).
- [x] **AC-4.** `lib/auth/department-acl.ts`에서 ACL 매트릭스(§4.2 REQ-TEN-003)와 일치하는 권한 평가가 모든 부서 × 모든 보호 route 조합에 대해 정확함 (Unit test green).
- [x] **AC-5.** `dev` 사용자로 `/admin/users` 접근 가능, `ra` / `exec` / `external` 사용자로는 차단됨 (REQ-TEN-003).
- [x] **AC-6.** `external` 사용자로 `/updates` 접근 가능, RA 워크플로우 페이지 접근 시 403 (REQ-TEN-003).
- [x] **AC-7.** 모든 새로 기록된 `audit_logs` row의 `metadata`에 `department` 키가 포함됨 (REQ-TEN-004).
- [x] **AC-8.** Admin UI에서 부서 변경 시 `audit_logs`에 `user_department_changed` 행이 정확한 old/new 값으로 기록됨 (REQ-TEN-005).
- [x] **AC-9.** 자기 자신의 부서 변경 시도도 동일하게 로깅됨 (REQ-TEN-005).
- [x] **AC-10.** Down migration이 `department` 컬럼을 안전하게 제거하며 데이터 손실이 없음 (REQ-TEN-002 rollback path).

---

## 6. Implementation Notes

### 6.1 수정 대상 파일

| 영역 | 파일 경로 | 변경 내용 |
|------|-----------|-----------|
| Database schema | `lib/db/schema.ts` | `users` 테이블에 `department` 컬럼 추가 |
| Migration | `lib/db/migrations/<NNNN>_add_users_department.sql` | `ALTER TABLE users ADD COLUMN department text not null default 'ra' check (department in ('ra','dev','exec','external'));` |
| ACL middleware (신규) | `lib/auth/department-acl.ts` | ACL 매트릭스 평가 함수 + route → required-department mapping |
| Audit | `lib/audit.ts` | `recordAudit()` 호출부에서 세션의 `department`를 `metadata`에 포함 |
| Admin UI | `app/(app)/admin/users/page.tsx` | department 컬럼 표시 + 편집 위젯 |
| Admin API | `app/api/admin/users/[id]/route.ts` | PATCH endpoint에서 부서 변경 처리 + `user_department_changed` 감사 로깅 |

### 6.2 21 CFR Part 11 연계

부서별 ACL과 변경 감사 로깅은 내부 21 CFR Part 11 self-compliance 절차의 일부로 작동한다. `audit_logs.metadata.department`는 "Who performed the action and in what role"의 핵심 evidence다.

---

## 7. Risks and Mitigations

| # | Risk | Mitigation |
|---|------|------------|
| R1 | ENTERPRISE Phase 5에서 이미 `department` 컬럼이 다른 enum 값으로 추가되어 있어 충돌 | 구현 전 `lib/db/schema.ts` 확인. 기존 enum과 다르면 변환 마이그레이션 작성 |
| R2 | 마이그레이션 디폴트 `'ra'`가 모든 기존 사용자에게 RA 권한 부여 | 마이그레이션 직후 admin이 개별 사용자 부서 즉시 조정 필요 (운영 절차 명시) |
| R3 | ACL 매트릭스 누락 route에 fail-open 동작 | `department-acl.ts`의 기본 정책을 "deny by default"로 설정 |

---

## 8. Dependencies

- **SPEC-REGULA-ENTERPRISE-001 (Phase 5):** `users.department` 컬럼과 `audit_logs.metadata.department` 필드가 ENTERPRISE에 흡수 구현되어 있을 수 있다. 본 SPEC은 그 흡수된 작업을 정식 SPEC으로 문서화한다.
- **Auth.js (Auth.js v5):** `users` 테이블 스키마와 호환성 유지 필수.
- **Drizzle ORM:** 마이그레이션 파일은 Drizzle migration framework를 따른다.

---

## 9. Archived Requirements (v0.1.0 — Not Implemented)

다음 70개 REQ 카테고리는 v0.1.0에서 정의되었으나 v2.0에서 **구현되지 않으며, 향후에도 본 SPEC에서는 다루지 않는다.**

### 9.1 Archived — Tenant Schema and Migration

- `tenants`, `tenant_members`, `tenant_audit_policies` 테이블 신설 — DROPPED
- 모든 tenant-scoped 테이블에 `tenant_id uuid not null` 추가 — DROPPED
- Blue-Green dual-write migration pattern (Phase A~E, 5단계) — DROPPED

### 9.2 Archived — Three-Layer Isolation

- Postgres Row-Level Security (RLS) policy 활성화 — DROPPED
- Drizzle ORM tenant middleware — DROPPED
- Cloudflare Worker tenant JWT 검증 — DROPPED

### 9.3 Archived — External Certifications

- SOC 2 Type II controls and evidence automation — DROPPED
- HIPAA BAA chain — DROPPED
- ISO/IEC 27001:2022 ISMS — DROPPED

### 9.4 Archived — Multi-Region

- Region-pinned data residency (US / EU / APAC) — DROPPED
- Compliance tier model (`standard` / `hipaa` / `pharma`) — DROPPED

**재활성화 조건:** 외부 고객사 SaaS 판매 결정 시 별도 SPEC-REGULA-MULTITENANT-001로 부활.
