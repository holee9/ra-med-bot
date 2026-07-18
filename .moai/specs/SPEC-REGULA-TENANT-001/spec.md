---
id: SPEC-REGULA-TENANT-001
version: 1.0.0
status: completed
phase: 12
priority: High
created: 2026-04-22
updated: 2026-05-04
author: manager-spec (Regula harness)
issue_number: 14
depends_on:
  - SPEC-REGULA-FOUNDATION-001
  - SPEC-REGULA-CHAT-001
  - SPEC-REGULA-STRUCTURED-001
  - SPEC-REGULA-BREADTH-001
  - SPEC-REGULA-ENTERPRISE-001
  - SPEC-REGULA-LAUNCH-001
  - SPEC-REGULA-CLOUDFLARE-001
  - SPEC-REGULA-DOCINGEST-001
  - SPEC-REGULA-WORKFLOWS-001
  - SPEC-REGULA-RADAR-001
  - SPEC-REGULA-NETWORK-001
lifecycle_level: spec-anchored
---

# SPEC-REGULA-TENANT-001 — 부서 Attribute RBAC (Tenant-Lite)

> **제목 정정 (2026-07-18, #520)**: 원제 "Multi-Tenancy Hardening + Security Certifications"는
> 실제 구현(부서 RBAC 5 REQ, RA/Dev/Exec/External)과 불일치하여 오해를 유발했다(목적 정합성 감사
> AMBIGUOUS 판정). 원래 범위(70 REQ, 3-layer tenant isolation, SOC 2/HIPAA BAA, multi-region)는
> 아래 HISTORY대로 v2.0에서 폐기됨. 구현된 부서 RBAC는 내부 팀 역할 분리(범위 내)이며 지양-5
> (멀티조직/SaaS 외판)와 무관. 제목을 실제 범위로 정정 — **범위 이탈 아님**.

## HISTORY

| Date | Version | Change | Author |
|------|---------|--------|--------|
| 2026-04-22 | 0.1.0 | Initial draft — Phase 12 multi-tenancy hardening + SOC 2 Type II + HIPAA BAA + ISO 27001 ISMS | manager-spec |
| 2026-05-04 | 1.0.0 | v2.0 재정의: 70 REQ → Tenant-Lite 5 REQ. Phase 5 흡수. 부서 Attribute RBAC 구현 완료 (PR #21, Issue #14) | sync |

## Implementation Notes (v2.0 재정의 — Tenant-Lite)

> **주의**: 이 SPEC의 원래 범위(70 REQ, 3-layer tenant isolation, SOC 2/HIPAA BAA, multi-region)는
> v2.0에서 폐기되었습니다. 아래 5 REQ만 구현되었습니다.

### 실제 구현된 5 REQ (Phase 5 흡수)

| REQ | 파일 | 내용 |
|-----|------|------|
| REQ-1 | `migrations/0018_user_department_enum.sql` | `user_department` pgEnum + `users.department` nullable 컬럼 |
| REQ-2 | `lib/auth/department.ts` | `Department` 타입 정의 (RA/Dev/Exec/External) |
| REQ-3 | `lib/auth/department.ts` | `DEPARTMENT_ACL` 매트릭스 + `hasDepartmentAccess()` 함수 |
| REQ-4 | `lib/db/schema.ts` | Drizzle `userDepartmentEnum` + `department` 컬럼 선언 |
| REQ-5 | `app/api/ra/profile/route.ts` | `PATCH /api/ra/profile` department 필드 허용 |

### 부서별 ACL 매트릭스

| 부서 | dashboard.team | sources.ingest | templates.edit |
|------|:-:|:-:|:-:|
| RA | ✅ | ✅ | ✅ |
| Dev | ❌ | ✅ | ✅ |
| Exec | ✅ | ❌ | ❌ |
| External | ❌ | ❌ | ❌ |

### 폐기된 범위 (v2.0 기준)

- ❌ 3-layer tenant isolation (RLS / ORM middleware / edge)
- ❌ `tenants`, `tenant_members`, `tenant_audit_policies` 스키마
- ❌ SOC 2 Type II / HIPAA BAA / ISO 27001 인증 준비
- ❌ multi-region 데이터 레지던시
- ❌ Blue-Green 전체 tenant migration

---

---

## 1. Purpose and Context

Phase 12 of Regula establishes enterprise-grade tenant isolation and completes third-party security certification readiness. The phase converts Regula from a "single logical workspace with RBAC" model (delivered in SPEC-REGULA-ENTERPRISE-001) into a true multi-tenant platform with defense in depth at three layers (database, application, edge), region-pinned data residency, and auditable regulatory compliance against three frameworks: SOC 2 Type II (Trust Services Criteria 2017), HIPAA Security Rule + Privacy Rule (with signed Business Associate Agreements across the vendor chain), and ISO/IEC 27001:2022 (with a full Information Security Management System).

The phase is driven by three non-negotiable market forces documented in `research.md` §1:

1. **Procurement gating.** At least three named enterprise prospects (large medical-device manufacturer, EU MDR consultancy, MNC subsidiary) require SOC 2 Type II reports, executed HIPAA BAAs, and ISO 27001 certificates before contract signing.
2. **Regulatory scope creep.** DOCINGEST (Phase 8) uploads already include clinical evaluation reports, post-market surveillance narratives, and other documents that realistically contain Protected Health Information (PHI). HIPAA cannot be treated as optional.
3. **Extinction-level blast radius.** A single cross-tenant data leak in a RAG product that cites regulatory sources publicly (per §8.1 of the handoff, Phase 2 citation contract) ends the product. The isolation architecture must survive individual developer errors and individual layer misconfigurations without producing a cross-tenant disclosure.

Phase 12 does not introduce new user-facing features. It hardens existing behavior so that every prior phase operates safely when N tenants share infrastructure. The phase is a prerequisite for all enterprise sales motion following Phase 11.

### 1.1 Alignment with prior phases

- **FOUNDATION v0.4.0** established audit log schema, signing, and 7-year retention per 21 CFR Part 11. Phase 12 extends this schema with mandatory `tenant_id` on every row and region-scoped storage.
- **ENTERPRISE v0.2.0** introduced RBAC roles inside a single workspace. Phase 12 promotes RBAC into a tenant-aware model: roles are scoped to `tenant_members`, and permission checks are evaluated within tenant context.
- **CLOUDFLARE** established the Worker-based edge architecture. Phase 12 adds tenant context propagation at the edge layer and region-aware routing.
- **DOCINGEST** introduced customer-supplied document ingestion. Phase 12 enforces tenant isolation on all ingested artifacts and classifies tenant-level compliance tiers that affect PHI handling.
- **NETWORK** (Phase 11) produced the regulatory network graph. Phase 12 ensures that per-tenant customizations and annotations of the graph remain isolated while the underlying public regulatory corpus stays shared.

### 1.2 Alignment with handoff constitution

Non-obvious constraints from `CLAUDE.md` that Phase 12 must preserve or extend:

- **Constraint #4 (Audit logging is regulatory):** every LLM call, source access, expert flag event continues to be logged to `audit_logs`. Phase 12 adds `tenant_id NOT NULL` on every entry and enforces region-scoped log routing for residency.
- **Constraint #7 (Noindex everywhere):** new admin UIs under `/admin/tenant/*` must be behind Auth.js session AND Cloudflare Access (double gate) with `<meta name="robots" content="noindex">`.
- **Citation contract:** unchanged. Phase 12 adds a verification that citations in tenant A's answers can only reference documents visible to tenant A (shared public regulatory corpus + tenant-A's own uploads).
- **Expert-review gating:** unchanged. Phase 12 adds tenant-scoped expert review queues.

---

## 2. Goals and Non-Goals

### 2.1 Goals (in scope)

The phase ships the following capabilities:

- **G1.** True multi-tenant isolation at three layers: Postgres Row-Level Security (RLS), Drizzle ORM middleware, Cloudflare Worker edge validation.
- **G2.** Canonical `tenants`, `tenant_members`, `tenant_audit_policies` schema.
- **G3.** `tenant_id NOT NULL` retroactively added to every tenant-scoped table, with Blue-Green migration guaranteeing continuity.
- **G4.** Region-pinned data residency across US, EU, APAC with tenant-level routing.
- **G5.** Compliance-tier model (`standard`, `hipaa`, `pharma`) applied to tenants, affecting PHI handling, audit retention, and signing requirements.
- **G6.** Admin tenant management UI: tenant info, member management, audit export, compliance dashboard.
- **G7.** SOC 2 Type II readiness: control mapping, evidence collection automation, observation-window start.
- **G8.** HIPAA BAA chain completed with Cloudflare Enterprise, Anthropic Enterprise, Neon Enterprise, Sentry Business, PostHog Cloud Enterprise, Vercel Enterprise, plus customer-facing BAA template.
- **G9.** ISO 27001 ISMS documentation: scope, policy, risk assessment, risk treatment plan, Statement of Applicability, mandatory records.
- **G10.** 100-test cross-tenant red-team suite, automated in Playwright, required to pass in CI before each release.
- **G11.** Annual external penetration test program kick-off.
- **G12.** Incident response plan, disaster recovery plan, vendor management workflow aligned with all three frameworks.

### 2.2 Non-goals (out of scope)

The following are explicitly deferred and will not be delivered in this phase:

- **On-premises / fully self-hosted deployment.** Significant architectural divergence; deferred to a future SPEC when a signed enterprise deal funds the effort.
- **FedRAMP.** Requires US government customer demand and materially different control set (NIST 800-53 baselines). Deferred until a government procurement process starts.
- **HITRUST CSF.** An additional healthcare certification built on top of HIPAA + ISO 27001. Only pursued when a specific customer contractually demands it.
- **SOC 2 Type I.** Skipped in favor of going directly to Type II, which is what enterprise customers actually require.
- **China-domestic deployment (NMPA local hosting).** Requires separate Cloudflare China partner, domestic database, and legal entity. Deferred to a dedicated SPEC-REGULA-CHINA-001 when Chinese customer demand warrants it.
- **Silo-per-tenant database model.** Offered as a future enterprise pricing option but not built in this phase; the interface contract is prepared so a future SPEC-REGULA-SILO-001 can plug in without refactoring Pool code paths.
- **Primary migration from another SaaS.** Import of customer data from competitors is a separate feature.
- **GDPR right-to-erasure automation.** Data subject request handling is scoped to a dedicated privacy SPEC because it overlaps materially with PIPA/APPI privacy rights and deserves focused treatment.
- **Bug bounty program.** Deferred to post-launch after internal triage capacity matures.
- **SSO identity provider federation beyond Auth.js defaults.** Customer-specific SAML/OIDC IdPs are handled case-by-case in enterprise sales; a productized federation is a separate feature.

---

## 3. Exclusions (What NOT to Build)

Per Regula harness rules and MoAI SPEC scope boundaries, the following are **explicitly excluded** from Phase 12 implementation:

- **E1.** No migration to a Silo (per-tenant database) model, even behind a feature flag. Only Pool (shared DB + RLS) ships in this phase.
- **E2.** No FedRAMP control implementation, no NIST 800-53 control mapping, no StateRAMP equivalent.
- **E3.** No China-region architecture (separate CDN partner, domestic Postgres, Chinese cloud vendor). APAC region serves Japan and Korea only.
- **E4.** No automated data subject request handler (GDPR Art 15–22, PIPA equivalents). Manual workflow documented in runbook; automation deferred.
- **E5.** No HITRUST CSF control mapping.
- **E6.** No SOC 2 Type I audit (going directly to Type II).
- **E7.** No bug bounty program launch.
- **E8.** No customer-specific SAML/OIDC IdP federation productization.
- **E9.** No in-product compliance report download by customers (e.g., "download our SOC 2 report" button). Reports are shared via sales channel with NDA.
- **E10.** No deprecation of existing single-tenant-compatible code paths until the migration is verified; legacy read paths remain for 30 days as rollback safety net.
- **E11.** No changes to the public regulatory corpus schema or ingestion pipeline — the corpus remains shared across tenants. Only tenant-private overlays, annotations, and uploads become tenant-scoped.
- **E12.** No change to the citation contract format (the `<sup class="cite">N</sup>` and structured JSON) — Phase 12 adds enforcement that citations respect tenant scope but does not change wire format.

---

## 4. Functional Requirements (EARS)

Requirements use EARS syntax. All requirements are identified `REQ-T-NNN`.

### 4.1 Group A — Tenant schema and migration (REQ-T-001 through REQ-T-015)

- **REQ-T-001** — The system **shall** maintain a `tenants` table with columns `id uuid primary key`, `name text not null`, `type text not null check (type in ('free','pro','enterprise'))`, `region text not null check (region in ('us','eu','apac'))`, `compliance_tier text not null check (compliance_tier in ('standard','hipaa','pharma'))`, `created_at timestamptz not null default now()`, `updated_at timestamptz not null default now()`, `deleted_at timestamptz null`.
- **REQ-T-002** — The system **shall** maintain a `tenant_members` table with columns `tenant_id uuid not null references tenants(id)`, `user_id uuid not null references users(id)`, `role text not null` (aligned with RBAC roles from ENTERPRISE), `invited_at timestamptz`, `joined_at timestamptz`, `removed_at timestamptz null`, primary key `(tenant_id, user_id)`.
- **REQ-T-003** — The system **shall** maintain a `tenant_audit_policies` table with columns `tenant_id uuid primary key references tenants(id)`, `retention_years int not null default 7 check (retention_years >= 7)`, `signing_required bool not null default true`, `export_formats text[] not null default array['json','csv','pdf_signed']`, `region_restricted bool not null default false`.
- **REQ-T-004** — **When** a new tenant is created, the system **shall** populate `tenant_audit_policies` with values derived from the tenant's `compliance_tier`: `standard` defaults to 7-year retention, signed, JSON+CSV; `hipaa` defaults to 7-year retention, signed, JSON+CSV+PDF_signed, region_restricted; `pharma` defaults to 10-year retention, signed, all formats, region_restricted.
- **REQ-T-005** — The system **shall** add a `tenant_id uuid not null references tenants(id)` column to every tenant-scoped table (enumerated in §4.6).
- **REQ-T-006** — The system **shall** create composite indexes `(tenant_id, <existing primary-key or leading selective column>)` on every tenant-scoped table.
- **REQ-T-007** — The system **shall** execute the schema migration via a Blue-Green dual-write pattern: Phase A dual-writes to old and new schema; Phase B backfills `tenant_id` on historical rows assigned to a `default` tenant; Phase C adds `NOT NULL` and foreign key constraints; Phase D flips the read path; Phase E decommissions old paths after 30 days.
- **REQ-T-008** — **While** the migration is in Phase A or B, the system **shall** allow rollback to pre-migration code by redeploying the previous application version without data loss.
- **REQ-T-009** — The system **shall** perform all `ALTER TABLE` operations using `ADD COLUMN` with a nullable default, `CREATE INDEX CONCURRENTLY`, and `ALTER TABLE ... ADD CONSTRAINT ... NOT VALID` followed by `VALIDATE CONSTRAINT` to avoid long locks on large tables.
- **REQ-T-010** — **If** a migration step fails, **then** the system **shall** emit a P0 alert, halt subsequent steps, and require manual intervention before resuming.
- **REQ-T-011** — The system **shall** seed a `default` tenant during migration to receive pre-migration data; the `default` tenant is renamed to the production customer's tenant name once the migration completes.
- **REQ-T-012** — The system **shall** expose a `POST /api/admin/tenants` endpoint gated behind super-admin RBAC role, accepting `name`, `type`, `region`, `compliance_tier` and returning the new `tenant_id`.
- **REQ-T-013** — The system **shall** expose a `PATCH /api/admin/tenants/{id}` endpoint gated behind super-admin RBAC role; `region` is immutable after creation and attempts to change it return 409 Conflict with a documented migration-required error code.
- **REQ-T-014** — The system **shall** expose a `DELETE /api/admin/tenants/{id}` endpoint that performs a soft delete (sets `deleted_at`) and prevents logins for tenant members; hard deletion is a separate offline operation with a 30-day grace window.
- **REQ-T-015** — **When** a tenant is soft-deleted, the system **shall** log a P1 audit event, notify all tenant members via email, and suspend all running background jobs owned by the tenant.

### 4.2 Group B — Three-layer isolation (REQ-T-016 through REQ-T-030)

- **REQ-T-016** — The system **shall** enable Row-Level Security on every tenant-scoped table with a restrictive baseline policy `AS RESTRICTIVE FOR ALL USING (false)` plus a permissive policy `AS PERMISSIVE FOR ALL USING (tenant_id = current_setting('app.current_tenant_id')::uuid) WITH CHECK (tenant_id = current_setting('app.current_tenant_id')::uuid)`.
- **REQ-T-017** — The system **shall** route all application database connections through a non-superuser role that does not possess `BYPASSRLS`.
- **REQ-T-018** — The system **shall** route all migration database connections through a dedicated migration role that possesses `BYPASSRLS` and is used only during deploys, never at runtime request handling.
- **REQ-T-019** — The Drizzle ORM middleware **shall** wrap every request-scoped tenant-aware query in a transaction that begins with `SET LOCAL app.current_tenant_id = $1` where `$1` is the authenticated tenant id derived from the validated session JWT.
- **REQ-T-020** — **When** a Drizzle query returns any row whose `tenant_id` does not equal the session tenant id, the system **shall** abort the response with HTTP 500, emit a P0 `TenantIsolationError` to Sentry, and write a critical entry to `audit_logs`.
- **REQ-T-021** — The system **shall** forbid raw `sql\`\`` template usage outside an explicit allowlist of migration files, enforced by an ESLint rule that runs in CI.
- **REQ-T-022** — The system **shall** expose a branded TypeScript type `TenantId = string & { readonly __brand: 'TenantId' }` and require all repository functions touching tenant data to accept a parameter typed as `TenantScopedDb`, not a raw database handle.
- **REQ-T-023** — The Cloudflare Worker edge layer **shall** validate a signed `X-Tenant-Context` JWT on every request; requests with missing, invalid-signature, or expired JWT are rejected with HTTP 401.
- **REQ-T-024** — **If** a request URL contains a tenant id path segment that does not match the JWT-validated tenant id, **then** the Worker **shall** reject the request with HTTP 403 and log a security event.
- **REQ-T-025** — The Worker **shall** reject any incoming request carrying a `X-Tenant-Override` header with HTTP 403 and log a security event.
- **REQ-T-026** — The system **shall** construct every Durable Object name as `HMAC_SHA256(secret, tenantId || resourceType || resourceId)` so that Durable Object names cannot be guessed or forged without possession of the server secret.
- **REQ-T-027** — The system **shall** prefix every R2 object path with `tenants/{tenantId}/`; Worker helpers that interact with R2 **shall** reject any path not matching the authenticated tenant prefix.
- **REQ-T-028** — The system **shall** prefix every Cloudflare KV key with `tenant:{tenantId}:`; KV helper functions **shall** enforce this prefix at call time.
- **REQ-T-029** — **When** a TanStack Query cache key is constructed client-side, the first segment of the key array **shall** be the tenant id, ensuring cache isolation across tenants.
- **REQ-T-030** — The system **shall** tag every log line emitted to Sentry and every metric emitted to Cloudflare Analytics / PostHog with the `tenant_id` dimension so that logs and metrics can be filtered per tenant and routed to tenant-appropriate region.

### 4.3 Group C — SOC 2 Type II controls (REQ-T-031 through REQ-T-045)

Each requirement references a Common Criteria control identifier per AICPA TSC 2017.

- **REQ-T-031** (CC1.1–CC1.5 Control Environment) — The system **shall** maintain a documented information security policy signed by leadership, a documented code of conduct, and a documented employee security responsibility matrix, stored under `.moai/docs/compliance/`.
- **REQ-T-032** (CC2.1–CC2.3 Communication) — The system **shall** expose a public trust center page listing sub-processors, certifications, and security contact channels; internal communication channels for security incidents are documented in the incident response runbook.
- **REQ-T-033** (CC3.1–CC3.4 Risk Assessment) — The system **shall** maintain a living risk register aggregating the risk sections of every Regula SPEC, reviewed at least annually and on every major release.
- **REQ-T-034** (CC4.1–CC4.2 Monitoring) — The system **shall** run continuous monitoring via Sentry, Cloudflare Analytics, Grafana, and audit log anomaly detection; monitoring coverage **shall** be verified quarterly.
- **REQ-T-035** (CC5.1–CC5.3 Control Activities) — The system **shall** enforce segregation of duties via GitHub CODEOWNERS requiring review from a non-author for all merges to `main`.
- **REQ-T-036** (CC6.1 Logical Access) — The system **shall** require Auth.js authentication for all application access and enforce MFA for all users on tenants with `compliance_tier in ('hipaa','pharma')`.
- **REQ-T-037** (CC6.2 Access Authorization) — **When** a user is added to a tenant via `tenant_members`, the system **shall** apply RBAC role enforcement immediately on the next request and log the grant to `audit_logs`.
- **REQ-T-038** (CC6.3 Access Removal) — **When** a user is removed from a tenant, the system **shall** revoke all active sessions within 5 minutes, block new authentication attempts, and log the revocation.
- **REQ-T-039** (CC6.6 Encryption in Transit) — The system **shall** serve all traffic via TLS 1.3 with HSTS enabled, certificate pinning where clients allow it, and a cipher allowlist excluding deprecated suites.
- **REQ-T-040** (CC6.7 Encryption at Rest) — The system **shall** encrypt Neon Postgres at rest, R2 objects at rest, Cloudflare KV at rest, and Durable Object storage at rest using provider-managed keys; customer-managed keys are a future feature not required in Phase 12.
- **REQ-T-041** (CC7.1–CC7.5 System Operations) — The system **shall** maintain deployment runbooks, on-call rotation, Sentry error-rate alerting with SLO targets from FOUNDATION, and a tested incident response plan.
- **REQ-T-042** (CC8.1 Change Management) — The system **shall** require PR review + CI gate (Biome, Vitest, Playwright, Snyk) passing before merge to `main`, and **shall** deploy via canary rollout with automatic rollback on error-rate regression.
- **REQ-T-043** (CC9.1 Risk Mitigation) — The system **shall** maintain active contracts with Cloudflare (DDoS and WAF), cyber liability insurance, and vendor risk assessments updated annually.
- **REQ-T-044** (A1.1–A1.3 Availability) — The system **shall** meet a 99.9% uptime SLO measured monthly, publish a status page, and conduct disaster recovery tests semi-annually.
- **REQ-T-045** (C1.1–C1.2 Confidentiality) — The system **shall** classify customer-uploaded documents as confidential by default, enforce access controls per RBAC, and document confidentiality obligations in the standard customer terms.

### 4.4 Group D — HIPAA compliance (REQ-T-046 through REQ-T-055)

- **REQ-T-046** — The system **shall** treat any tenant with `compliance_tier in ('hipaa','pharma')` as a HIPAA-covered tenant; all associated data is treated as potentially containing PHI.
- **REQ-T-047** — The system **shall** hold executed Business Associate Agreements with Cloudflare Enterprise, Anthropic Enterprise, Neon Enterprise, Sentry Business, PostHog Cloud Enterprise, and Vercel Enterprise before the first HIPAA tenant is onboarded; the BAA inventory **shall** be reviewed quarterly.
- **REQ-T-048** — The system **shall** provide a customer-facing BAA template covering the Security Rule, Privacy Rule breach notification obligations, and sub-processor disclosures; customer signature is a precondition to provisioning a HIPAA tenant.
- **REQ-T-049** — The system **shall** log every access to PHI-containing records in `audit_logs` with `tenant_id`, `user_id`, `action`, `resource_id`, `timestamp`, and `ip_address`; logs **shall** be retained for a minimum of 7 years.
- **REQ-T-050** — The system **shall** enforce the minimum necessary standard: retrieval of customer documents during answer composition **shall** exclude documents outside the requesting user's role scope even within the same tenant.
- **REQ-T-051** — **When** an admin UI displays a field flagged as potential PHI, the system **shall** redact the field by default and require an explicit "show" user action; the show action **shall** be logged as a PHI access event.
- **REQ-T-052** — The system **shall** operate a HIPAA-compliant breach notification workflow that notifies the affected customer within 24 hours of breach discovery, including the information required under 45 CFR §164.410.
- **REQ-T-053** — The system **shall** complete annual HIPAA awareness training for all workforce members with access to PHI-containing systems; completion records are retained for SOC 2 evidence as well.
- **REQ-T-054** — The system **shall** scrub PHI fields from analytics pipelines (PostHog event payloads, Sentry error reports) before ingestion; a deny-list of known PHI field names is applied at the client boundary.
- **REQ-T-055** — **If** Anthropic completion caching is enabled, the system **shall** include `tenant_id` in the cache key to prevent cross-tenant cache hits; on HIPAA tenants, prompt caching **shall** be explicitly disabled unless a dedicated risk assessment is documented.

### 4.5 Group E — ISO 27001 ISMS (REQ-T-056 through REQ-T-063)

- **REQ-T-056** — The system **shall** maintain an ISMS scope statement defining boundaries (Regula product, supporting infrastructure, employees with system access) and excluded items (customer-operated endpoints), stored under `.moai/docs/compliance/isms/scope.md`.
- **REQ-T-057** — The system **shall** maintain an information security policy approved by leadership, reviewed annually, stored under `.moai/docs/compliance/isms/policy.md`.
- **REQ-T-058** — The system **shall** maintain a risk assessment methodology document and a current risk assessment report under `.moai/docs/compliance/isms/`; the report **shall** be updated on every major release and annually at minimum.
- **REQ-T-059** — The system **shall** maintain a risk treatment plan describing which risks are accepted, mitigated, transferred, or avoided, with owner and target completion date.
- **REQ-T-060** — The system **shall** maintain a Statement of Applicability (SoA) covering all 93 ISO/IEC 27001:2022 Annex A controls, with justification for each inclusion or exclusion.
- **REQ-T-061** — The system **shall** conduct an internal audit of the ISMS at least annually, with documented findings and corrective actions.
- **REQ-T-062** — The system **shall** hold a management review of the ISMS at least annually, covering performance metrics, incident history, audit results, and improvement opportunities.
- **REQ-T-063** — The system **shall** preserve mandatory records (training, internal audits, management reviews, corrective actions, incidents) for a minimum of three years to support ISO 27001 surveillance audits.

### 4.6 Group F — Admin UI (REQ-T-064 through REQ-T-070)

- **REQ-T-064** — The system **shall** provide an admin UI at `/admin/tenant/` (server-rendered Next.js App Router, under the `(app)` route group) displaying tenant id, name, type, region, compliance tier, member count, created date, and status.
- **REQ-T-065** — The system **shall** provide an admin UI at `/admin/tenant/members/` supporting member invite, role change, and removal, gated behind super-admin and tenant-admin RBAC roles as appropriate.
- **REQ-T-066** — The system **shall** provide an admin UI at `/admin/tenant/audit/` that allows export of tenant-scoped audit logs in JSON, CSV, and signed PDF formats, with a date range selector and cryptographic signature verification metadata.
- **REQ-T-067** — The system **shall** provide an admin UI at `/admin/tenant/compliance/` displaying the tenant's compliance tier, SOC 2 Type II status, HIPAA BAA status, ISO 27001 certificate status, BAA counter-signature status, and last audit log export timestamp.
- **REQ-T-068** — All `/admin/tenant/*` pages **shall** emit `<meta name="robots" content="noindex">`, be gated behind Cloudflare Access (second factor on top of Auth.js), and log every page view to `audit_logs`.
- **REQ-T-069** — The admin UI **shall** render page titles, labels, and structured data in English and Korean with the user's preferred language honored; regulatory-term translations follow the i18n skill rules from the harness.
- **REQ-T-070** — **When** the admin compliance dashboard detects a missing BAA, an expired certificate, or a failed scheduled audit export, the system **shall** display a P1 banner at the top of every admin page and fire a PagerDuty alert to the security officer.

### 4.7 Tenant-scoped table inventory

The following tables require `tenant_id` under §4.1 REQ-T-005, RLS under §4.2 REQ-T-016, and composite index under REQ-T-006:

- `chats`, `chat_messages`, `chat_trace_steps`
- `structured_outputs` (checklist / comparison / timeline / sources / related / expert_review_required)
- `documents` (customer uploads from DOCINGEST)
- `document_chunks` (vector-indexed chunks)
- `document_annotations` (tenant-private annotations on shared corpus)
- `expert_review_requests`, `expert_review_responses`
- `audit_logs`
- `user_sessions` (tenant-scoped session rows, distinct from Auth.js session cookies)
- `api_keys` (per-tenant issued API keys)
- `tenant_integrations` (tenant-specific Workflow/RADAR/NETWORK customizations)
- `workflow_definitions`, `workflow_runs` (from WORKFLOWS)
- `radar_subscriptions`, `radar_alerts` (from RADAR)
- `network_overlays` (tenant annotations on regulatory network graph)

The shared public corpus tables (`regulatory_documents`, `regulatory_chunks`, `network_nodes`, `network_edges`) intentionally remain **non-tenant-scoped** and are served identically to all tenants.

---

## 5. Non-Functional Constraints

### 5.1 Performance budget under RLS

- **NFR-P-1.** Chat streaming time-to-first-token **shall** remain under the FOUNDATION budget (p95 ≤ 700ms at Phase 12 go-live) despite RLS enablement. Validated via load test matching 50 concurrent tenants.
- **NFR-P-2.** Vector similarity search p95 **shall** remain under 150ms within a single tenant's document corpus at up to 100k chunks per tenant, validated via synthetic dataset.
- **NFR-P-3.** Audit log insert throughput **shall** remain above 500 inserts/sec on the tenant-partitioned table.
- **NFR-P-4.** Admin tenant dashboard **shall** load in under 2 seconds at p95 with 200 tenants.

### 5.2 Availability

- **NFR-A-1.** Tenant isolation layers **shall** fail closed: if the RLS policy cannot be evaluated, the query fails rather than returning unfiltered rows.
- **NFR-A-2.** The Blue-Green migration **shall** achieve cutover downtime under 5 minutes.
- **NFR-A-3.** Edge layer (Worker) **shall** degrade gracefully: if tenant JWT verification temporarily fails due to key rotation, the Worker **shall** fail closed (reject) rather than open.

### 5.3 Security

- **NFR-S-1.** No known-critical vulnerabilities in application dependencies at release; enforced by Snyk/Dependabot CI gate.
- **NFR-S-2.** Secrets (HMAC keys, JWT signing keys, database passwords, API keys) **shall** be stored in Cloudflare Secrets or the equivalent per environment; never in source control.
- **NFR-S-3.** All admin endpoints **shall** require Auth.js session + Cloudflare Access + RBAC role check (triple gate).

### 5.4 Data residency

- **NFR-R-1.** EU tenant data **shall not** leave the EU region except for audit log shipping to US-based audit firm, which is explicitly covered under SCC + TIA.
- **NFR-R-2.** APAC tenant data **shall** reside in the APAC region for Neon reads, R2 objects, Durable Objects, and KV values.
- **NFR-R-3.** Region field on `tenants` **shall not** be changeable after tenant creation; region migration is a separate operational procedure.

### 5.5 Auditability

- **NFR-AU-1.** Every admin action on `/admin/tenant/*` **shall** produce an audit log entry tagged with the acting user, target tenant, action, timestamp, and source IP.
- **NFR-AU-2.** Audit logs **shall** be append-only at the database level; the `audit_logs` role used by the application **shall not** have DELETE or UPDATE privileges.
- **NFR-AU-3.** Audit logs **shall** be exportable in JSON, CSV, and signed-PDF formats within 30 seconds for ranges up to 1 million rows.

### 5.6 Accessibility and internationalization

- **NFR-I-1.** Admin UI **shall** meet WCAG 2.1 AA, consistent with the handoff brand requirements.
- **NFR-I-2.** Regulatory terminology in the UI **shall** follow the `regula-i18n` skill's glossary for ko and en; mixed-language compliance-term rendering uses the serif/sans typographic contrast rule per handoff §6.

---

## 6. Technical Decisions

| # | Decision | Selected | Rejected alternatives | Rationale |
|---|----------|----------|-----------------------|-----------|
| 1 | Tenant isolation model | **Pool** (shared DB + RLS) | Silo (DB per tenant), Bridge (schema per tenant) | Operating cost, shared regulatory corpus fits Pool naturally, migration velocity preserved. Enterprise Silo option deferred. |
| 2 | Enterprise-tier Silo option | **Deferred** as future SPEC-REGULA-SILO-001 | Build now | Scope control; Pool with hardened isolation is sufficient for Year 1 sales; Silo added when a signed deal funds it. |
| 3 | Region strategy | **US / EU / APAC** (three regions) | US-only, or full per-country | Matches procurement demand of target customers; avoids over-building for markets not yet in pipeline. |
| 4 | Compliance tier model | **standard / hipaa / pharma** (three tiers) | Single universal tier | Customer demands differ materially; pharma tier supports extra retention and signing for 21 CFR Part 11 super-strict environments. |
| 5 | Audit export formats | **JSON + CSV + signed PDF** | JSON only | Auditors and compliance officers request signed PDFs for regulatory records; signing leverages FOUNDATION audit signing. |
| 6 | Migration pattern | **Blue-Green dual-write** | Big-bang cutover, expand-and-contract over weeks | Availability requirement; 5-minute downtime budget achievable only with dual-write. |
| 7 | RLS policy style | **Restrictive baseline + permissive tenant policy** | Permissive only | Defense in depth: accidental policy drop leaves table empty, not open. |
| 8 | Edge validation authority | **Signed JWT validated in Cloudflare Worker** | Session-cookie only, no edge validation | Depth; edge rejects bad requests before they ever reach app/db layers. |
| 9 | Durable Object naming | **HMAC(secret, tenant+resource)** | Concatenated plaintext | Prevents name enumeration and forgery. |
| 10 | Audit log partitioning | **Partition by (tenant_id, month)** | Partition by tenant only, or by month only | Controls scan cost at both axes; 10k partitions at 100 tenants × 84 months is within Postgres 16 planner comfort zone. |
| 11 | Compliance automation platform | **Drata (or Vanta)** adopted early | Manual evidence collection | 60–80% reduction in manual burden per industry case studies; cost justified by audit-prep time saved. |
| 12 | Auditor selection | **Schellman or A-LIGN** for bundled SOC 2 + ISO 27001 | Big 4 (Deloitte, KPMG, PwC, EY) | Cost and speed; enterprise procurement accepts specialized firms. Big 4 revisited in Year 2 if needed. |
| 13 | SOC 2 scope | **Security + Availability + Confidentiality** | Security only; or Security + Privacy | Three categories align with actual customer procurement checklists; Privacy deferred to dedicated privacy SPEC overlapping GDPR/PIPA work. |
| 14 | HIPAA de-identification | **None in inference path** | Safe Harbor de-id of retrieved chunks | Would defeat citation contract; compliance achieved via BAA + Security Rule safeguards instead. |
| 15 | External pen test cadence | **Annual external + continuous internal scans** | Biennial external | Matches competitor baselines and customer expectations. |
| 16 | Bug bounty timing | **Post-launch** | At Phase 12 launch | Insufficient triage capacity pre-launch; internal red team and external annual pen test provide coverage. |

---

## 7. Data Model Additions

### 7.1 New tables (DDL summary)

**`tenants`**
- `id uuid PK DEFAULT gen_random_uuid()`
- `name text NOT NULL`
- `type text NOT NULL CHECK (type IN ('free','pro','enterprise'))`
- `region text NOT NULL CHECK (region IN ('us','eu','apac'))`
- `compliance_tier text NOT NULL CHECK (compliance_tier IN ('standard','hipaa','pharma'))`
- `created_at timestamptz NOT NULL DEFAULT now()`
- `updated_at timestamptz NOT NULL DEFAULT now()`
- `deleted_at timestamptz NULL`
- Index: `(region)`, `(compliance_tier)`, `(deleted_at) WHERE deleted_at IS NULL`

**`tenant_members`**
- `tenant_id uuid NOT NULL REFERENCES tenants(id)`
- `user_id uuid NOT NULL REFERENCES users(id)`
- `role text NOT NULL` (values aligned with ENTERPRISE RBAC roles)
- `invited_at timestamptz`
- `joined_at timestamptz`
- `removed_at timestamptz NULL`
- PK: `(tenant_id, user_id)`
- Index: `(user_id)` for reverse lookup

**`tenant_audit_policies`**
- `tenant_id uuid PK REFERENCES tenants(id)`
- `retention_years int NOT NULL DEFAULT 7 CHECK (retention_years >= 7)`
- `signing_required bool NOT NULL DEFAULT true`
- `export_formats text[] NOT NULL DEFAULT ARRAY['json','csv','pdf_signed']`
- `region_restricted bool NOT NULL DEFAULT false`
- `updated_at timestamptz NOT NULL DEFAULT now()`

### 7.2 Modified tables

Every table in the §4.7 inventory receives:

- `tenant_id uuid NOT NULL REFERENCES tenants(id)` added column.
- Composite index `(tenant_id, <existing selective column>)`.
- RLS enabled with the restrictive+permissive policy pair from REQ-T-016.
- For `audit_logs` specifically: partition by `(tenant_id, month)` using Postgres 16 declarative partitioning; append-only at DB role level.

### 7.3 Shared corpus tables (explicitly non-tenant-scoped)

These tables **do not** receive `tenant_id` and **do not** get RLS enabled:

- `regulatory_documents` (FDA, MDR, ISO, MFDS, NMPA, PMDA corpus)
- `regulatory_chunks` (vector index over shared corpus)
- `network_nodes`, `network_edges` (regulatory network graph)

Reads from these tables are allowed from any tenant context. Writes to these tables are restricted to the ingestion pipeline service account; normal application code has no write privilege.

---

## 8. API Additions

Summary of new / modified endpoints. Full OpenAPI schemas are produced during Run phase.

- `POST /api/admin/tenants` — create tenant (super-admin).
- `GET /api/admin/tenants` — list tenants (super-admin).
- `GET /api/admin/tenants/{id}` — fetch tenant details (super-admin or tenant-admin of that tenant).
- `PATCH /api/admin/tenants/{id}` — update mutable fields (super-admin or tenant-admin). Region is immutable.
- `DELETE /api/admin/tenants/{id}` — soft delete (super-admin).
- `POST /api/admin/tenants/{id}/members` — invite member.
- `PATCH /api/admin/tenants/{id}/members/{userId}` — change role.
- `DELETE /api/admin/tenants/{id}/members/{userId}` — remove member.
- `GET /api/admin/tenants/{id}/audit?format=json|csv|pdf&from=...&to=...` — export audit log.
- `GET /api/admin/tenants/{id}/compliance` — compliance status summary for UI.

All endpoints enforce:
- Auth.js authentication with valid session cookie.
- Cloudflare Access second-factor for super-admin paths.
- RBAC role check (super-admin or tenant-admin as appropriate).
- JWT-tenant-context alignment with URL tenant path parameter.
- Audit log entry on every write.

---

## 9. Operational Runbooks (produced during Run phase)

The phase produces the following runbooks. They are referenced here so that Run-phase implementers know the scope.

- **RB-1.** Tenant creation and provisioning (including R2 bucket in matching region, KV namespace prefix setup).
- **RB-2.** Tenant soft-delete and hard-delete procedure (with 30-day grace).
- **RB-3.** Region migration procedure (manual, high-touch).
- **RB-4.** Member onboarding / offboarding with role assignment.
- **RB-5.** Audit log export procedure and signature verification steps for auditors.
- **RB-6.** Incident response runbook (P0/P1/P2/P3 severity definitions, containment steps, customer notification templates).
- **RB-7.** Breach notification runbook for HIPAA (24-hour customer notice, HHS reporting thresholds).
- **RB-8.** Disaster recovery runbook (RTO 4h, RPO 1h) with semi-annual drill checklist.
- **RB-9.** Vendor onboarding runbook (BAA negotiation, security questionnaire, sub-processor disclosure).
- **RB-10.** Annual penetration test coordination runbook.
- **RB-11.** Drata/Vanta evidence collection maintenance runbook.
- **RB-12.** Migration rollback runbook for Blue-Green schema changes.

---

## 10. Acceptance Criteria (summary)

Full Given-When-Then scenarios live in `acceptance.md`. Headline criteria:

- **A-1.** Cross-tenant data leaks: **0** across the 100-test red-team matrix, validated both in CI (automated Playwright suite) and manual quarterly review.
- **A-2.** RLS policy applied on 100% of tenant-scoped tables; automated test scans `pg_tables` + `pg_policies` to confirm.
- **A-3.** SOC 2 Type II audit report issued covering minimum 6-month observation window, with no qualifications on Security/Availability/Confidentiality categories.
- **A-4.** ISO 27001:2022 certificate issued, covering in-scope systems and regions.
- **A-5.** HIPAA BAAs executed with all six required sub-processors and customer-facing BAA template signed off by legal.
- **A-6.** Signed audit log export succeeds quarterly for every tenant, verified by a signature-check job.
- **A-7.** Incident response drill executed at least once per half-year with written post-mortem.
- **A-8.** DR failover test completed successfully at least once per year, restoring within RTO 4h.
- **A-9.** Blue-Green migration cutover completed with under 5 minutes of end-user downtime, measured by uptime monitor.
- **A-10.** Chat streaming p95 TTFT within budget on production post-RLS enablement.
- **A-11.** No BAA gap reported on admin compliance dashboard for longer than 24 hours.
- **A-12.** Performance benchmarks documented: vector query p95, audit insert throughput, admin dashboard load p95, all within NFR targets.

---

## 11. Risks and Mitigations (spec-level)

| # | Risk | Likelihood | Impact | Mitigation |
|---|------|-----------|--------|------------|
| R1 | Schema migration error causes production data integrity issue | Medium | High | Blue-Green dual-write, canary per-table verification, pre-prod synthetic load, documented rollback playbook per RB-12. |
| R2 | RLS enablement degrades p95 latency beyond NFR-P-1 | Medium | Medium | Index pre-flighting, partial HNSW validation, shadow traffic tests before cutover, fallback to per-tenant partial index. |
| R3 | Cross-tenant leak discovered post-launch | Low-Medium | Extinction | Three-layer defense, 100-test red-team, quarterly external pen tests, code review enforced on tenant-touching paths. |
| R4 | SOC 2 observation window delays enterprise deal close | High | Medium | Pre-Type-II readiness assessment with auditor, start observation window the day Phase 12 controls ship, share interim letter with prospects. |
| R5 | Customer BAA negotiation blocks onboarding | Medium | Medium | Provide pre-reviewed BAA template; carve out customer-specific negotiations only when legal complexity warrants. |
| R6 | HIPAA breach during audit window invalidates Type II | Low | High | Aggressive monitoring, MFA mandatory on HIPAA tenants, audit-log anomaly detection, tested IR runbook (RB-6, RB-7). |
| R7 | Large enterprise prospect demands Silo model mid-sales cycle | Medium | Medium | Pool interface contract designed so SPEC-REGULA-SILO-001 can plug in later; sales empowered to quote Silo premium pricing. |
| R8 | Region not available for EU prospect in time | Medium | High | EU region prioritized at top of Phase 12 rollout before any EU enterprise outreach scales. |
| R9 | Vendor fails to sign BAA on time | Medium | High | Parallel BAA negotiations with all six vendors started early; fallback vendor identification documented for each category. |
| R10 | Drata/Vanta dependency lock-in | Low | Low | Evidence stored in standardized formats; platform is acceleration, not the source of truth. |
| R11 | Auditor finds a gap late in observation window | Medium | High | Quarterly internal pre-audit, Drata continuous evidence check. |
| R12 | Duplicate admin UI paths conflict with existing `/admin` routes from ENTERPRISE | Low | Low | Namespace under `/admin/tenant/*` distinct from ENTERPRISE RBAC-only admin paths; route map documented. |
| R13 | pgvector + RLS + high concurrency reveals previously-unseen planner bug | Medium | Medium | Benchmark sprint during Run phase, partial HNSW fallback prepared, pgvector upstream monitored. |
| R14 | Noindex + Cloudflare Access on admin breaks internal usability | Low | Low | Internal user IdP integrated with Cloudflare Access; bookmarks documented for operations team. |

---

## 12. Non-Obvious Constraints Matrix

Mapping from Regula handoff non-obvious constraints to Phase 12 requirements:

| Constraint (from CLAUDE.md) | Affected REQs | Notes |
|-----------------------------|---------------|-------|
| #1 Citations must be inline per claim | — | Unchanged; Phase 12 preserves citation contract and adds tenant-scope filtering of retrievable documents. |
| #2 Multi-phase streaming (trace → prose → structured JSON) | — | Unchanged; audit logs now tag tenant_id on trace steps. |
| #3 Expert-review auto-flagging | REQ-T-037 | Expert review queues become tenant-scoped; super-admin cross-tenant view requires explicit audit log entry. |
| #4 Audit logging is regulatory, not observability | REQ-T-049, NFR-AU-1/2/3, Group C/D/E controls | `tenant_id NOT NULL` on all rows; partition by (tenant, month); 7-year retention baseline; append-only role. |
| #5 Serif/sans typographic contrast is a brand requirement | REQ-T-069 | Admin UI obeys existing typographic rules; compliance-term strings use serif where the handoff specifies. |
| #6 Korean + English first-class | REQ-T-069, NFR-I-2 | Admin UI and compliance labels localized via regula-i18n. |
| #7 App is noindex everywhere (except /login) | REQ-T-068 | `/admin/tenant/*` is doubly gated (Auth.js session + Cloudflare Access) and emits `<meta name="robots" content="noindex">`. |

---

## 13. Implementation Phasing Reference

Full milestone breakdown lives in `plan.md` (to be authored in a follow-up pass). Phase-12 top-level ordering (priority-based, no time estimates):

1. **Priority High — Schema & Migration Foundation.** `tenants`, `tenant_members`, `tenant_audit_policies` tables; default tenant seeded; tenant_id added to inventory tables (nullable phase).
2. **Priority High — Blue-Green dual-write rollout.** App writes to both old and new schema; backfill runs.
3. **Priority High — RLS enablement.** Policies applied; connection roles split; synthetic cross-tenant canary verifies isolation.
4. **Priority High — Edge layer.** Cloudflare Worker tenant JWT validation, URL path check, DO name HMAC, R2 prefix enforcement, KV prefix enforcement.
5. **Priority High — Drizzle middleware + TS branded types.** Type migration across codebase, ESLint rule for raw SQL allowlist.
6. **Priority High — Admin UI.** Tenant info, members, audit export, compliance dashboard, all behind double gate.
7. **Priority High — BAA chain.** Contracts with Cloudflare, Anthropic, Neon, Sentry, PostHog, Vercel; customer BAA template finalized.
8. **Priority High — HIPAA controls implementation.** Minimum-necessary retrieval, PHI redaction in admin UI, analytics scrub, breach notification runbook.
9. **Priority Medium — SOC 2 evidence + Drata/Vanta integration.** Continuous evidence collection wired; gap assessment completed.
10. **Priority Medium — ISO 27001 ISMS documentation.** Scope, policy, risk assessment, SoA, mandatory records system.
11. **Priority Medium — 100-test red team + Playwright automation.**
12. **Priority Medium — DR drill, IR drill, vendor review cycle.**
13. **Priority Medium — Observation window start.** Type II clock starts after all controls operational.
14. **Priority Low — Auditor engagement.** Schellman/A-LIGN kick-off, readiness assessment, Stage 1 audit for ISO 27001.
15. **Priority Low — Certificate issuance + trust center publication.** Reports posted to trust center, sales enablement briefed.

---

## 14. Dependencies on Prior Phases

- **FOUNDATION v0.4.0:** audit log table and signing are extended with `tenant_id` and region-scoped storage; preconditions for REQ-T-049 and NFR-AU-2.
- **CHAT v0.x (SPEC-REGULA-CHAT-001):** chat, chat_messages, chat_trace_steps receive `tenant_id`; streaming trace event payloads gain tenant tagging.
- **STRUCTURED:** structured_outputs tables receive tenant_id; checklist/comparison/timeline/sources/related/expert_review blocks remain schema-identical aside from tenant tagging.
- **BREADTH:** breadth ranking / suggestion features respect tenant-scoped document visibility.
- **ENTERPRISE v0.2.0 (RBAC):** roles table ties into `tenant_members.role`; role check middleware becomes tenant-aware.
- **LAUNCH:** onboarding flow updated to provision a tenant per new signup; invite flow goes through `tenant_members`.
- **CLOUDFLARE:** existing Worker architecture gets new middleware layer; region routing rules added.
- **DOCINGEST:** uploads write to tenant-prefixed R2 paths; chunk ingestion preserves tenant_id.
- **WORKFLOWS:** workflow_definitions/runs receive tenant_id; tenant admins cannot read other tenants' workflows.
- **RADAR:** subscriptions/alerts are tenant-scoped; shared regulatory feeds remain shared.
- **NETWORK:** overlays/annotations on regulatory network graph are tenant-scoped; graph itself is shared.

No prior-phase SPEC is modified by this document per harness rule (golden rule: do not edit prior specs). The dependencies listed here are informational.

---

## 15. Glossary

- **BAA** — Business Associate Agreement, contract required under HIPAA between Covered Entity (or Business Associate) and a sub-contractor handling PHI on its behalf.
- **BYPASSRLS** — Postgres role attribute that causes RLS policies to be ignored. Reserved for migration role only.
- **Covered Entity** — HIPAA-regulated organization (health plan, health care clearinghouse, or health care provider).
- **Durable Object (DO)** — Cloudflare Workers runtime primitive for coordinated stateful storage.
- **EARS** — Easy Approach to Requirements Syntax (ubiquitous / event-driven / state-driven / unwanted / complex).
- **ISMS** — Information Security Management System (ISO 27001 mandated framework).
- **PHI** — Protected Health Information (HIPAA-defined identifiable health information).
- **Pool model** — Multi-tenant architecture where all tenants share application and database with logical isolation.
- **RLS** — Row-Level Security, Postgres policy-based access control evaluated per query.
- **RTO / RPO** — Recovery Time Objective / Recovery Point Objective, disaster recovery metrics.
- **SCC** — Standard Contractual Clauses (EU cross-border data transfer mechanism).
- **Silo model** — Multi-tenant architecture where each tenant has a fully separate database (and often a separate deployment).
- **SoA** — Statement of Applicability (ISO 27001 mandatory document mapping Annex A controls).
- **SOC 2** — AICPA service organization control framework; Type II is a period-of-time attestation.
- **Sub-processor** — Third party engaged by Regula that processes customer data on Regula's behalf.
- **TIA** — Transfer Impact Assessment, GDPR-required analysis for cross-border data transfers.
- **Trust Services Criteria** — AICPA-defined criteria underpinning SOC 2 reports.

---

## 16. Pending Items

- **P1.** On-premises / self-hosted deployment: deferred to post-launch SPEC; depends on signed enterprise demand.
- **P2.** FedRAMP: deferred to government-customer SPEC.
- **P3.** HITRUST CSF: deferred until customer-contractual demand materializes.
- **P4.** Silo enterprise option: interface contract prepared in Phase 12; implementation in future SPEC-REGULA-SILO-001.
- **P5.** China-region deployment: deferred to dedicated SPEC.
- **P6.** Bug bounty program: launch decision revisited 6 months post-Phase-12 go-live.
- **P7.** GDPR data subject request automation: consolidated into a dedicated privacy SPEC alongside PIPA/APPI handling.
- **P8.** Customer-managed encryption keys (CMEK): out of scope; tracked as a future enterprise feature ask.

---

## 17. Out-of-Band Decisions Required

During Run phase, the following decisions require out-of-band confirmation before implementation proceeds:

- **OOB-1.** Final selection of auditor firm (Schellman vs A-LIGN vs alternative) pending two quotes and references.
- **OOB-2.** Final selection of compliance automation platform (Drata vs Vanta vs Secureframe vs Sprinto) pending vendor demo.
- **OOB-3.** Customer-facing BAA template legal review and executive sign-off.
- **OOB-4.** Confirmation of chosen external pen test vendor (HackerOne / Cobalt / Bishop Fox / NCC Group).
- **OOB-5.** Confirmation of region residency commitments at the customer contract template level.
- **OOB-6.** Headcount decision on dedicated Security Officer vs designated engineering lead.

---

## 18. Detailed RLS Policy Specifications (illustrative)

The following illustrative policy specifications describe the exact wire form each tenant-scoped table must adopt. Concrete SQL generation is a Run-phase activity; the wording here captures the semantic contract. For each table in §4.7 the policy set follows this template:

**Template (per tenant-scoped table)**

- Enable RLS on the table (force).
- Attach a restrictive baseline policy `deny_all` that evaluates to `false` for every session regardless of role.
- Attach a permissive policy `tenant_isolation` whose `USING` and `WITH CHECK` predicates both test `tenant_id = current_setting('app.current_tenant_id')::uuid`.
- For the `audit_logs` table, additionally attach a permissive policy `service_append_only` that allows INSERT only from the dedicated `audit_writer` role and denies UPDATE/DELETE to every non-migration role.
- For read replicas serving regional traffic, the session variable `app.current_tenant_id` is set by the read-replica-aware Drizzle middleware; the baseline policy still applies.

**Policy lifecycle expectations**

- Every new tenant-scoped table added in subsequent SPECs inherits the template automatically via a `CREATE TABLE ... LIKE` helper or via a migration lint rule that flags missing RLS.
- Dropping any policy triggers a P0 alert; the migration role is permitted to drop policies but only as part of a documented migration job.
- The baseline `deny_all` restrictive policy **must** remain after every schema change; CI verifies this by reading `pg_policies` and asserting both policies exist for each table.

**Session variable provenance and tamper-resistance**

- `app.current_tenant_id` is set by `SET LOCAL` inside a transaction opened by the Drizzle middleware.
- The value is derived exclusively from the validated session JWT; no application code path sets it from a request header, query string, or cookie directly.
- The transaction is committed or rolled back on request end; `SET LOCAL` ensures the value does not leak to subsequent connections from the pooler.

**Interaction with connection pooling**

- Neon's connection pooler operates in transaction mode, which is compatible with `SET LOCAL`.
- PgBouncer in session mode (if used for maintenance) is avoided for runtime traffic because it would leak session variables across requests.
- The Drizzle middleware includes a runtime assertion after `SET LOCAL` that re-reads `current_setting('app.current_tenant_id')` and confirms it equals the session JWT tenant id before any query runs.

---

## 19. Detailed API Contracts

API surface notation: `method path` — purpose, auth requirement, request body fields, success response shape, error codes. Full OpenAPI schemas are produced during Run phase per REQ-T-012 through REQ-T-014.

### 19.1 `POST /api/admin/tenants`

- **Auth:** Auth.js session + Cloudflare Access + super-admin RBAC role.
- **Request body fields:** `name` (string, required), `type` (enum free|pro|enterprise, required), `region` (enum us|eu|apac, required), `compliance_tier` (enum standard|hipaa|pharma, required), `initial_admin_user_id` (uuid, optional — if provided, user is added to `tenant_members` as admin).
- **Success response (201):** full `tenant` row including the generated `id`.
- **Error codes:** 400 invalid field value; 403 insufficient RBAC; 409 duplicate tenant name at org level; 422 compliance_tier requires BAA precondition not met.
- **Audit event:** `tenant.created` with full body captured (sensitive fields redacted).

### 19.2 `GET /api/admin/tenants`

- **Auth:** super-admin only.
- **Query parameters:** `region`, `compliance_tier`, `type`, `include_deleted` (boolean, default false), `cursor` (opaque pagination), `limit` (default 50, max 200).
- **Success response (200):** paginated list; each entry includes tenant row plus `member_count` and `last_audit_export_at`.
- **Audit event:** `tenant.listed` with filter parameters captured.

### 19.3 `GET /api/admin/tenants/{id}`

- **Auth:** super-admin OR tenant-admin of the target tenant.
- **Success response (200):** tenant row + audit policy + member summary + compliance status.
- **Error codes:** 403 not a member of the tenant; 404 tenant soft-deleted and caller is not super-admin.

### 19.4 `PATCH /api/admin/tenants/{id}`

- **Auth:** super-admin for `type`, `compliance_tier`; tenant-admin for `name` only.
- **Mutable fields:** `name`, `type`, `compliance_tier`.
- **Immutable fields:** `region`, `id`, `created_at` (409 Conflict on attempt to change).
- **Side effects:** changing `compliance_tier` from `standard` to `hipaa`/`pharma` enforces BAA precondition check; failing check returns 422 with the missing BAA listed.
- **Audit event:** `tenant.updated` with before/after diff captured.

### 19.5 `DELETE /api/admin/tenants/{id}`

- **Auth:** super-admin only.
- **Behavior:** soft delete by setting `deleted_at`. No rows in tenant-scoped tables are physically removed. All active sessions for tenant members are revoked within 5 minutes per REQ-T-038. Background jobs are suspended per REQ-T-015.
- **Response (204):** no body.
- **Audit event:** `tenant.soft_deleted` with actor, reason (optional request field).

### 19.6 `POST /api/admin/tenants/{id}/members`

- **Auth:** super-admin OR tenant-admin of the target tenant.
- **Request body fields:** `email` (string, required), `role` (enum from ENTERPRISE RBAC, required).
- **Behavior:** creates or looks up `users` row; writes `tenant_members` row with `invited_at = now()`; sends invite email.
- **Error codes:** 409 already member; 422 invalid role for compliance tier (e.g., non-admin cannot be granted PHI access on HIPAA tenant without required training completion).
- **Audit event:** `tenant.member.invited`.

### 19.7 `PATCH /api/admin/tenants/{id}/members/{userId}`

- **Auth:** super-admin OR tenant-admin of the target tenant.
- **Request body fields:** `role` (required).
- **Audit event:** `tenant.member.role_changed`.

### 19.8 `DELETE /api/admin/tenants/{id}/members/{userId}`

- **Auth:** super-admin OR tenant-admin; self-removal is permitted.
- **Behavior:** sets `removed_at = now()`; triggers session revocation within 5 minutes per REQ-T-038.
- **Audit event:** `tenant.member.removed`.

### 19.9 `GET /api/admin/tenants/{id}/audit`

- **Auth:** super-admin OR tenant-admin.
- **Query parameters:** `format` (enum json|csv|pdf, required), `from` (ISO8601, required), `to` (ISO8601, required), `action_filter` (array, optional), `user_filter` (uuid, optional).
- **Behavior:** streams export; for `pdf` includes cryptographic signature block with public key hash for verifier cross-check; rejects if `to - from > 365 days` in a single request (pagination required for multi-year exports).
- **Success response:** `application/json` / `text/csv` / `application/pdf` stream.
- **Audit event:** `tenant.audit.exported` with range and format captured.

### 19.10 `GET /api/admin/tenants/{id}/compliance`

- **Auth:** super-admin OR tenant-admin.
- **Success response (200):** JSON object with fields `compliance_tier`, `soc2_type2_status`, `soc2_report_url` (nullable, gated by NDA flow), `hipaa_baa_status`, `iso27001_cert_status`, `baa_counter_signatures` (array), `last_audit_export_at`, `next_audit_due_at`, `pen_test_last_run_at`, `pen_test_findings_open`, `outstanding_compliance_issues` (array).

---

## 20. Expanded SOC 2 Control Mapping (Common Criteria detail)

Each entry below maps a specific Common Criterion to the concrete Regula evidence source. The Run phase produces the corresponding evidence artifacts and wires continuous collection into Drata/Vanta.

| CC | Title | Regula evidence |
|----|-------|-----------------|
| CC1.1 | Integrity and ethical values | Code of conduct, acceptable use policy, leadership signature page |
| CC1.2 | Board oversight | Quarterly security review minutes, designated Security Officer appointment letter |
| CC1.3 | Organizational structure | Org chart under `.moai/docs/compliance/org-chart.md`, reporting lines documented |
| CC1.4 | Commitment to competence | Onboarding checklist including security-awareness training completion |
| CC1.5 | Accountability | RACI matrix for security responsibilities; annual individual objective review |
| CC2.1 | Information requirements | Data classification policy, inventory of systems handling PHI / confidential data |
| CC2.2 | Internal communication | Slack security channel, weekly security digest, incident runbook references |
| CC2.3 | External communication | Public trust center page, security contact inbox, breach notification procedures |
| CC3.1 | Objective specification | Information security objectives documented, reviewed annually |
| CC3.2 | Risk identification | Living risk register per REQ-T-033 |
| CC3.3 | Fraud risk | Fraud scenarios in risk register, monitoring for anomalous access |
| CC3.4 | Change assessment | Change impact assessment in PR template |
| CC4.1 | Monitoring procedures | Continuous monitoring stack (Sentry, Cloudflare Analytics, Grafana, audit-log anomaly detection) |
| CC4.2 | Monitoring evaluation | Quarterly review of monitor coverage, alert tuning, false positive rate |
| CC5.1 | Control selection | Annex A-like control catalog derived from ISO 27001 SoA |
| CC5.2 | Policy deployment | Policies stored in `.moai/docs/compliance/` under version control |
| CC5.3 | Control evaluation | Internal audit schedule with documented corrective actions |
| CC6.1 | Logical access | Auth.js, RBAC, MFA enforcement per REQ-T-036 |
| CC6.2 | Access authorization | Role request workflow with approval chain |
| CC6.3 | Access removal | Offboarding runbook, revocation within 5 minutes per REQ-T-038 |
| CC6.4 | Restricted access to assets | Physical security inherited from Cloudflare, Neon, Vercel; employee laptop policy |
| CC6.5 | Logical asset restrictions | Network segmentation, production vs staging separation |
| CC6.6 | Encryption in transit | TLS 1.3, HSTS, cipher allowlist per REQ-T-039 |
| CC6.7 | Encryption at rest | Provider-managed keys per REQ-T-040 |
| CC6.8 | Unauthorized / malicious software | Snyk SAST/SCA + Dependabot + DAST per REQ-T-042 |
| CC7.1 | System operations — infrastructure | Runbook library under `.moai/docs/runbooks/` |
| CC7.2 | System operations — change | PR review + CI gates per REQ-T-042 |
| CC7.3 | System operations — incident | Incident response runbook RB-6 |
| CC7.4 | System operations — recovery | Disaster recovery runbook RB-8; RTO 4h, RPO 1h per NFR |
| CC7.5 | System operations — continuous | Observability stack per REQ-T-034 |
| CC8.1 | Change management | PR + CODEOWNERS + CI + canary deploy per REQ-T-042 |
| CC9.1 | Risk mitigation — insurance / vendors | Cyber liability insurance, vendor risk assessment annually |
| CC9.2 | Risk mitigation — vendors | Sub-processor list, BAAs, security questionnaire templates |
| A1.1 | Availability objectives | 99.9% uptime SLO per NFR-A-1 |
| A1.2 | Availability monitoring | Status page, Grafana alerting |
| A1.3 | Availability recovery | DR runbook RB-8, semi-annual drill |
| C1.1 | Confidentiality identification | Data classification policy, customer document classification default |
| C1.2 | Confidentiality controls | RBAC, tenant isolation, PHI redaction |

---

## 21. Expanded ISO 27001:2022 Annex A Coverage (selected controls)

The full Statement of Applicability lives under `.moai/docs/compliance/isms/soa.md`. A representative subset:

| Control | Theme | Regula application |
|---------|-------|--------------------|
| A.5.1 | Policies for information security | Information security policy approved annually |
| A.5.7 | Threat intelligence | Feed monitoring (CISA, CVE, vendor advisories) integrated into triage |
| A.5.23 | Information security for cloud services | BAAs, vendor questionnaires, Cloudflare/Anthropic/Neon contractual controls |
| A.5.30 | ICT readiness for business continuity | DR runbook RB-8 |
| A.6.1 | Screening | Background checks per employment policy |
| A.6.3 | Information security awareness, education, training | Annual training per REQ-T-053 |
| A.6.8 | Reporting of information security events | Incident reporting channel in onboarding training |
| A.7.x | Physical controls | Inherited from sub-processors plus laptop security policy |
| A.8.1 | User endpoint devices | Laptop full-disk encryption, auto-lock, MDM (if adopted) |
| A.8.2 | Privileged access rights | RBAC roles, super-admin audit log per REQ-T-049 |
| A.8.3 | Information access restriction | Minimum necessary per REQ-T-050 |
| A.8.5 | Secure authentication | Auth.js, MFA mandatory for HIPAA tenants |
| A.8.8 | Management of technical vulnerabilities | Snyk + Dependabot weekly |
| A.8.10 | Information deletion | Soft delete with 30-day hard delete window |
| A.8.11 | Data masking | PHI redaction in admin UI per REQ-T-051 |
| A.8.12 | Data leakage prevention | Three-layer isolation per REQ-T-016 through REQ-T-030 |
| A.8.16 | Monitoring activities | Observability stack per REQ-T-034 |
| A.8.23 | Web filtering | Corporate IdP-based filtering for employee endpoints (if adopted) |
| A.8.24 | Use of cryptography | TLS 1.3 + HMAC key rotation + signed audit logs |
| A.8.28 | Secure coding | Coding standards, SAST in CI |
| A.8.32 | Change management | PR review + CI gate per REQ-T-042 |
| A.8.34 | Protection of information systems during audit | Read-only audit access role |

Any controls marked non-applicable (e.g., the subset of physical controls beyond what Regula inherits from sub-processors) carry an inclusion-or-exclusion justification paragraph in the SoA.

---

## 22. Vendor BAA / Tier Matrix (reference)

Phase 12 acceptance requires signed BAAs with the following sub-processors. The current target state is captured here; actual execution is tracked in `.moai/docs/compliance/vendor-baa-register.md` during Run phase.

| Sub-processor | Role in stack | Required tier for BAA | PHI exposure | Status at Phase 12 ship |
|---------------|---------------|-----------------------|--------------|-------------------------|
| Cloudflare Enterprise | Edge, Workers, R2, KV, DO, DNS, WAF, Access | Enterprise | Yes (transit + storage) | BAA executed |
| Anthropic Enterprise | Claude Sonnet / Haiku inference | Enterprise | Yes (transit, no storage) | BAA executed |
| Neon Enterprise | Postgres (primary + read replicas) | Enterprise | Yes (storage) | BAA executed |
| Vercel Enterprise | Next.js hosting (server runtime) | Enterprise | Yes (transit) | BAA executed |
| Sentry Business | Error tracking | Business (BAA tier) | Incidental (PHI scrubbed before ingest per REQ-T-054) | BAA executed |
| PostHog Cloud Enterprise | Product analytics | Cloud Enterprise (BAA tier) | Incidental (PHI scrubbed per REQ-T-054) | BAA executed |

Additional vendor review items:
- Compliance automation platform (Drata / Vanta) does not process PHI directly but processes evidence including employee data; DPA in place.
- Auditor firm (Schellman / A-LIGN) receives aggregated evidence; confidentiality agreement in place.
- Penetration test vendor: scoped environment access limited to staging + isolated PHI-free production tenants, plus scoped red-team accounts.

---

## 23. Performance Benchmark Plan (for NFR validation)

The Run phase executes the following benchmark protocol before RLS enablement goes live:

- **BM-1.** Chat streaming TTFT measured under simulated 50 concurrent tenants, 20 concurrent sessions each, synthetic 10k-chunk corpus per tenant. Target: p95 ≤ 700ms per NFR-P-1.
- **BM-2.** Vector similarity search measured at 100k chunks per tenant, partial HNSW index. Target: p95 ≤ 150ms per NFR-P-2.
- **BM-3.** Audit log insert throughput measured on partitioned `(tenant_id, month)` table, 10 writers × 100 req/sec each. Target: ≥ 500 inserts/sec per NFR-P-3.
- **BM-4.** Admin tenant dashboard load measured at 200 tenants + 50 members per tenant. Target: p95 ≤ 2s per NFR-P-4.
- **BM-5.** RLS overhead comparison: run BM-1 through BM-4 with RLS disabled, capture baseline; enable RLS, re-run; overhead must not exceed research.md §3.4 bounds (chat +2–4% point lookup, +5–10% vector, +8–15% aggregation).
- **BM-6.** Migration load simulation: apply schema migration to a restored production snapshot; measure end-to-end time and peak lock duration.
- **BM-7.** Region-routing regression: for each of (us, eu, apac), send representative traffic from a test client in the region; measure that routing places requests on the correct Durable Object, R2 bucket, Neon replica.

Benchmark results are attached to the Phase 12 release notes and kept in `.moai/reports/perf-tenant-{date}/` for audit.

---

## 24. Migration Phase Detail

Per REQ-T-007 the migration runs in five ordered phases. Each phase has an explicit rollback checkpoint.

### 24.1 Phase A — Dual-write enablement

- Deploy application version that writes to both pre-migration tables and post-migration tables.
- Post-migration tables have `tenant_id` column (nullable in this phase).
- Reads continue from pre-migration tables.
- Rollback: redeploy previous version; no data loss because pre-migration tables remain authoritative.

### 24.2 Phase B — Backfill

- Offline backfill job populates `tenant_id` on all historical rows using ownership heuristics derived from `chats.user_id → tenant_members.tenant_id` lookup.
- Job runs in batches of 10k rows with progress logged to `.moai/reports/migration-phase-b-{date}.md`.
- Verification: after each table is backfilled, a count-match check confirms no NULL `tenant_id` remains and counts match pre-migration totals.
- Rollback: backfill rows are identifiable by a backfill marker column; can be reset to NULL by a documented SQL job.

### 24.3 Phase C — Constraint application

- Apply `NOT NULL` via `ADD CONSTRAINT ... NOT VALID` + `VALIDATE CONSTRAINT` pattern to avoid long locks.
- Add foreign key `tenant_id → tenants(id)` via the same pattern.
- Create composite indexes `CONCURRENTLY`.
- Rollback: `ALTER TABLE ... DROP CONSTRAINT` on the new constraints.

### 24.4 Phase D — Read path cutover

- Deploy application version that reads from post-migration tables and enables RLS policies.
- Connection role for runtime switched to the non-`BYPASSRLS` role.
- Edge layer (Worker) JWT validation enabled for tenant context.
- Rollback: redeploy previous version; disable RLS policies on affected tables; switch connection role back.

### 24.5 Phase E — Pre-migration path decommission

- After 30 days with zero rollback incidents and passing weekly audits, pre-migration tables are renamed with `_legacy_` prefix and access revoked from app roles.
- After an additional 60 days, pre-migration tables are dropped.
- Rollback window closes at start of Phase E decommission; after this point, rollback requires backup restore.

---

## 25. Cross-Tenant Red-Team Matrix (reference)

Per REQ-T-010 acceptance criterion A-1, the Phase 12 release gate includes a 100-test red-team matrix. Categories and per-category counts, with representative tests named:

| # | Category | Tests | Representative test |
|---|----------|-------|---------------------|
| 1 | Direct tenant_id manipulation in URLs | 15 | `GET /api/tenants/{other_id}/chats` with valid session for a different tenant returns 403 |
| 2 | JWT claim tampering | 10 | Modified tenant id in JWT payload rejected by signature check at Worker |
| 3 | Header injection | 10 | `X-Tenant-Override` header ignored and logged as security event |
| 4 | SQL injection targeting tenant isolation | 15 | `' OR tenant_id != ''` injected into search parameter — RLS still returns only caller tenant rows |
| 5 | Durable Object name enumeration | 10 | Guessed DO names rejected; HMAC prevents forgery |
| 6 | R2 path traversal | 10 | `../other-tenant/…` rejected by prefix check |
| 7 | KV key prefix bypass | 10 | Key without `tenant:{id}:` prefix rejected |
| 8 | Cache poisoning | 10 | TanStack Query cache key verified to include tenant id as first segment |
| 9 | Session fixation | 5 | Session cookie from tenant A used after switching to tenant B context rejected |
| 10 | Citation leak (Regula-specific) | 5 | Answer for tenant A never contains citation pointing to tenant B's uploaded document |
| **Total** | | **100** | |

Each test has automated reproduction in Playwright, signed off by a designated red-team engineer (separate from the feature implementer to ensure adversarial independence), and re-run on every release cut. Test failures block merge and release.

---

## 26. SPEC-Level Acceptance Scenarios (Given-When-Then, summary)

Detailed scenarios live in `acceptance.md` (Run-phase artifact). The top SPEC-level scenarios are:

- **GWT-1.** Given a user authenticated into tenant A, When the user issues a URL path `/api/tenants/{B}/chats`, Then the system returns HTTP 403 and logs a P1 security event.
- **GWT-2.** Given a HIPAA tenant with an admin user, When the admin exports audit logs with `format=pdf`, Then the response contains a signed PDF whose signature verifies against the tenant's publicly listed public key hash.
- **GWT-3.** Given the migration is in Phase D (read path cutover), When a synthetic cross-tenant probe query is issued, Then the RLS policy returns zero rows and the probe writes a success entry to the migration verification log.
- **GWT-4.** Given a soft-deleted tenant, When any member of that tenant attempts to log in, Then authentication succeeds at the identity provider but authorization fails at the tenant membership check and the user is shown a contact-support page.
- **GWT-5.** Given an EU tenant, When an admin views the compliance dashboard, Then the dashboard displays `region = eu` and no non-EU sub-processor appears in the active data path breakdown.
- **GWT-6.** Given a customer-supplied document ingested under tenant C, When a user in tenant D issues a chat query whose citation would reference that document, Then the citation cannot be produced and the RAG pipeline retrieves only shared public regulatory corpus + tenant D's own documents.
- **GWT-7.** Given the SOC 2 Type II observation window is active, When a scheduled evidence-collection job runs, Then Drata/Vanta receives a fresh snapshot of access, change, monitoring, and vulnerability evidence with zero gaps.
- **GWT-8.** Given a BAA with a sub-processor lapses, When the admin compliance dashboard renders, Then a P1 banner appears within 24 hours and a PagerDuty alert fires to the Security Officer.
- **GWT-9.** Given a penetration test is completed, When the report identifies any finding rated High or Critical, Then the finding is tracked to resolution with root-cause analysis attached to the audit log.
- **GWT-10.** Given the incident response runbook is invoked, When a P0 incident is declared, Then customer notification for any affected HIPAA tenant occurs within 24 hours and regulatory notification occurs within statutory timelines.

---

## 27. Traceability

Every requirement in this SPEC maps to at least one:
- Prior-phase SPEC it depends on (documented in §14),
- Non-obvious constraint (documented in §12),
- Acceptance scenario (documented in §26 and expanded in `acceptance.md`),
- Risk with mitigation (documented in §11).

The Run phase produces a traceability matrix artifact under `.moai/reports/traceability-tenant-001.md` tying each REQ-T to implementing file(s), tests, and acceptance evidence.

---

End spec.md

