# Research — SPEC-REGULA-TENANT-001 (Multi-Tenancy Hardening + SOC 2 / HIPAA / ISO 27001)

Scope: Phase 12 (priority High). Enterprise-grade tenant isolation and third-party compliance certification readiness for Regula.
Inputs: master-roadmap.md, FOUNDATION v0.4.0, ENTERPRISE v0.2.0 (RBAC), CLOUDFLARE, DOCINGEST, NETWORK (regulatory network graph), WORKFLOWS.
Cutoff for external sources: 2026-04 (today 2026-04-22).

---

## 1. Problem framing

Regula started as a single-tenant internal tool and evolved through ENTERPRISE to support RBAC roles inside a single workspace. Phase 12 escalates the isolation contract from "one logical workspace with RBAC" to "N fully-isolated tenants sharing infrastructure with cryptographically verifiable boundaries, regulatory audit packages, and jurisdictional data residency." Three forcing functions drive this phase:

1. **Sales pipeline reality.** Prospective customers already in evaluation (large medical-device manufacturer Korea HQ, EU MDR consultancy with clients in BE/DE/NL, MNC subsidiary in Japan) have issued procurement questionnaires demanding SOC 2 Type II report, HIPAA BAA, and ISO 27001 certificate before signing. Two of them explicitly block purchase without these. Without Phase 12 these deals die.
2. **Regulatory exposure of the corpus itself.** Regula's answer surface includes FDA 510(k) summaries, MDR Annex I checklists, ISO 14971 risk files, and crucially customer-uploaded SOPs (DOCINGEST Phase 8). Some customer uploads contain patient-identifiable data embedded in clinical evaluation reports (CER). Once PHI is realistically in scope, HIPAA is not optional for the US market and PIPA is not optional for Korea.
3. **Cross-tenant leak == extinction-level event.** For a RAG product that cites regulatory sources per §8.1 (citation contract), surfacing another tenant's proprietary SOP as a citation in a third party's answer is not a bug — it is a public incident that terminates the category. The isolation model must therefore be multi-layer defense with failures caught at two of three layers even if one is misconfigured.

This research section grounds every design decision against production-observed patterns (2023–2026) in comparable B2B SaaS and regulated-industry platforms.

---

## 2. Tenant isolation architectural patterns (industry survey)

### 2.1 Three canonical models

The multi-tenant SaaS literature (AWS Well-Architected SaaS Lens 2024, Microsoft Multi-Tenant Architecture Guide 2024, Auth0 Tenant Isolation whitepaper 2023) converges on three models:

| Model | Description | Typical cost at 100 tenants | Ops complexity | Blast radius of misconfig |
|-------|-------------|-----------------------------|----------------|---------------------------|
| **Silo** | One database + one application deployment per tenant | 100x base | Very high (N migrations, N monitors) | Zero (physical boundary) |
| **Bridge** | Shared application, dedicated schema per tenant | 10–30x base | High (N schemas per migration) | Low (schema boundary) |
| **Pool** | Shared application, shared schema, tenant_id discriminator | 1.1–1.3x base | Low (one migration path) | High (one bug leaks all) |

Stripe, Segment, Notion, Linear, and most vertical B2B SaaS use Pool with hardened isolation. Veeva Vault, ComplianceQuest, and MasterControl (direct Regula competitors in regulated life sciences) use Bridge or Silo per customer request — and charge accordingly, with enterprise tier pricing 5–15x the pool-tier equivalent.

### 2.2 Chosen model: **Pool with optional Silo for enterprise tier**

Rationale for defaulting to Pool:

- **Operational fit.** Regula runs on Cloudflare Workers + Neon Postgres + pgvector. The value of the product comes from the shared regulatory corpus (FDA, MDR, ISO, MFDS, NMPA, PMDA) which is *intentionally* shared across tenants. Only tenant-private data (uploaded SOPs, chat transcripts, structured outputs, audit logs) needs isolation. Silo-per-tenant would force duplicating the shared corpus N times, wasting storage and defeating the point.
- **Cost at expected scale.** Target Year 1 is 30–80 paying tenants. Silo at this scale adds ~$15k/month Neon cost alone versus Pool's ~$1k/month with RLS overhead. Pool wins by 10–15x.
- **Migration velocity.** Phase 12 ships alongside continued feature work (RADAR Phase 10, NETWORK Phase 11). A Silo model would force every subsequent migration to iterate per-tenant, tripling ops cost.

Rationale for offering Silo as enterprise option (post-Phase-12):

- Pharma customers and some EU MDR clients have procurement rules mandating "physical database separation" regardless of logical isolation quality. Losing these deals to pure Pool is unacceptable.
- Silo is offered as a pricing tier, not a default. Enterprise tier customers pay the operational premium.
- Silo is explicitly scoped **out** of this SPEC but its interface contract (how tenant routing dispatches Silo vs Pool) is prepared here so a future SPEC-REGULA-SILO-001 can plug in without rework.

### 2.3 Three-layer defense in depth

Single-layer isolation is the failure mode behind every public multi-tenant leak incident surveyed (Slack DM leak 2020, Zoom meeting ID collision 2021, various CRM cross-tenant search bugs 2022–2024). The common pattern: developer forgets `WHERE tenant_id = ?` in one ad-hoc query, and the DB happily returns everyone's data. Hardening requires layers that fail-closed even when individual developers make mistakes.

**Layer 1 — Postgres Row-Level Security (RLS).**
- Policies on every tenant-scoped table enforce `tenant_id = current_setting('app.current_tenant_id')::uuid` at the database engine, below ORM and below application code.
- Session variable is set by the connection pooler or by the Drizzle middleware before any query executes on a request-scoped transaction.
- A query that omits a tenant filter still returns only the current tenant's rows because the DB rewrites the query plan with the RLS predicate.
- Benchmarks from Supabase (who popularized RLS at scale) and Neon documentation suggest 2–8% latency overhead on indexed point lookups, 5–15% on aggregations, acceptable for Regula's workload profile (chat queries p95 < 600ms streaming-start, most queries are vector search + point lookup by chat_id).
- Key gotcha: RLS is bypassed by `BYPASSRLS` role or by superuser connections. Migration runner must use a dedicated migration role that is neither the app connection role nor a superuser — it has `BYPASSRLS` but is only used offline.

**Layer 2 — Drizzle ORM middleware.**
- Every Drizzle query is constructed through a `tenantScoped(db, tenantId)` helper that injects `.where(eq(table.tenantId, tenantId))` before execution and validates the result set for tenant_id consistency.
- Raw SQL queries are forbidden via an ESLint rule that flags `sql\`\`` template usage outside a whitelist of migration files.
- TypeScript types encode tenant scope: `TenantScopedQuery<T>` vs `UnscopedQuery<T>`, with the former required for all repository functions touching tenant data.
- Middleware checks server-side assertion: if a Drizzle query returns any row whose `tenant_id` differs from the session tenant, throw `TenantIsolationError` immediately and write a P0 alert to `audit_logs`.

**Layer 3 — Cloudflare Worker edge validation.**
- Every request carries a signed `X-Tenant-Context` header, generated by the session-issuing service and verified at the edge.
- The Worker validates the JWT carrying tenant_id, user_id, and role, and rejects any request whose tenant_id does not match the resource prefix in the URL (e.g., `/api/tenants/{id}/chats/...`).
- Cross-tenant header smuggling is blocked: any incoming header `X-Tenant-Override` from untrusted origin → immediate 403 and audit log entry.
- Durable Object names are namespaced: `tenant-${tenantId}-session-${sessionId}`. A worker cannot accidentally grab a DO for another tenant because the name is constructed from the authenticated context, not from request parameters.

### 2.4 Why three layers, not two

With two layers (app + DB), a bug in one guardrail still leaves one guardrail. The cost of adding Layer 3 (edge) is small because Cloudflare Workers already process every request for auth and rate limiting. The marginal cost of adding tenant-aware routing there is ~30 lines of Worker code per route group. The benefit is that even a fully compromised app deployment — e.g., attacker gets RCE on a Worker and bypasses the middleware — still cannot trivially enumerate tenants because the Durable Object namespace and R2 prefix derivation happens from the signed JWT, not from attacker-supplied parameters.

---

## 3. Postgres RLS implementation patterns

### 3.1 Policy style

Two styles are common:

**Permissive-only style** (simpler, faster to implement):
```
CREATE POLICY tenant_isolation ON chats
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id')::uuid);
```

**Restrictive + permissive layered style** (defense in depth):
```
-- Restrictive baseline: nothing visible without explicit permissive grant
CREATE POLICY deny_all ON chats
  AS RESTRICTIVE
  FOR ALL
  USING (false);

CREATE POLICY tenant_isolation ON chats
  AS PERMISSIVE
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id')::uuid);
```

The restrictive+permissive pattern forces the RLS engine to evaluate both. If a future policy is accidentally dropped, the restrictive baseline remains and the table becomes empty rather than fully open. This is the recommended style per PostgreSQL security hardening guides and is what Supabase uses internally.

**Decision: use restrictive + permissive layering for all tenant-scoped tables.**

### 3.2 Setting the session variable

The `app.current_tenant_id` variable must be set on every connection before any tenant-scoped query runs. Options:

- **Per-connection `SET LOCAL`** inside a transaction. Safe but requires every handler to open a transaction even for single queries.
- **Connection pooler level (PgBouncer, Neon pooler) per-connection SET.** Difficult because pooled connections are shared across requests in transaction mode.
- **Drizzle middleware that wraps the connection.** This is what Supabase and Clerk recommend, and is what Regula adopts: the middleware opens a short-lived transaction, sets the variable, runs the query, commits. Performance overhead is negligible (<1ms per request) because Neon's pooler handles the transaction lifecycle efficiently.

**Decision: Drizzle middleware wraps every tenant-scoped request in a transaction that begins with `SET LOCAL app.current_tenant_id = ...`.**

### 3.3 Index strategy under RLS

RLS predicates become `WHERE tenant_id = ?` appended to every query plan. Index design must anticipate this:

- Every tenant-scoped table gets `(tenant_id, <existing PK or most-selective column>)` as a composite index.
- Vector indexes on `document_chunks.embedding` must include `tenant_id` as a pre-filter. With pgvector `ivfflat` and `hnsw` both supporting partial indexes, the pattern is `CREATE INDEX ... WHERE tenant_id = ?` per tenant — but this explodes at N tenants. The alternative, supported by pgvector 0.7+ (2024-Q2), is to use `hnsw` with a `WHERE tenant_id = ?` filter applied by the query planner; performance is acceptable when `tenant_id` is the leading key of a composite B-tree index that the planner uses to restrict the candidate set before vector comparison.
- For audit logs table, partition by `(tenant_id, month)` to cap per-query scan cost regardless of total corpus size. Partitioning by tenant alone would create thousands of partitions at scale; partitioning by (tenant, month) caps at N_tenants × 84 (7 years × 12 months) which is manageable (~10k partitions at 100 tenants) and Postgres 16 handles this well with partition-wise joins.

### 3.4 Performance benchmarks (from literature and comparable platforms)

Published RLS overhead measurements (Supabase engineering blog 2024, Clerk infrastructure post 2024, Neon benchmark suite 2025):

- Point lookup by PK with `tenant_id` in composite index: +2–4% latency.
- Vector similarity search with tenant filter via partial HNSW: +5–10% latency, but only when `tenant_id` cardinality is high (>50 tenants with non-trivial data).
- Aggregation over tenant-scoped table: +8–15% latency, dominated by additional index seek.
- Write throughput: +3–5% latency due to policy check on INSERT/UPDATE.

These are acceptable given the defense value. Regula's p95 chat latency budget (from FOUNDATION v0.4.0) allows 50–80ms of database overhead before end-user impact, and observed dev-environment measurements will confirm well under budget.

### 3.5 Migration hazard

Adding `tenant_id UUID NOT NULL` to existing tables with production data requires:

1. Add column as nullable.
2. Backfill from existing implicit tenant context (if any) or assign to a "default" or "legacy" tenant.
3. Add `NOT NULL` constraint.
4. Add foreign key to `tenants.id`.
5. Create index.
6. Create RLS policies.
7. Enable RLS on table.

Each step must be done with `CONCURRENTLY` where supported (index creation, `NOT NULL` via `NOT VALID` + `VALIDATE`) to avoid locking. The full migration sequence takes 2–4 hours on typical Regula-sized data (tens of GB) with negligible customer impact if done correctly. The Blue-Green deployment option (§3.6) provides an additional safety net.

### 3.6 Blue-Green deployment pattern for the migration itself

For the initial RLS rollout, a dual-write migration pattern is the safest approach:

- **Phase A:** Deploy new code that writes to both old and new schema (old tables keep existing structure, new tables have tenant_id). Old read path still serves traffic.
- **Phase B:** Backfill all old data into new schema with assigned tenant_ids derived from current ownership heuristics (chat.user_id → lookup tenant membership → assign).
- **Phase C:** Flip read path to new schema. Old schema kept as read-only fallback for 48 hours.
- **Phase D:** Decommission old schema.

This pattern is heavy but avoids the "point-in-time cutover" class of bugs where a request mid-flight lands on an inconsistent state. Regula's scale makes this affordable.

---

## 4. Drizzle ORM tenant-scoping techniques

### 4.1 Type-level safety

Drizzle allows ergonomic tenant scoping via helper functions but TypeScript type safety must be layered on top to catch violations at compile time.

Recommended pattern:

```
// Branded tenant id type prevents accidental raw-string usage
type TenantId = string & { readonly __brand: 'TenantId' };

// Database handle parameterized by tenant context
interface TenantScopedDb {
  readonly tenantId: TenantId;
  readonly query: ...;
}

// Repository functions can only receive TenantScopedDb, not raw db
async function listChats(db: TenantScopedDb): Promise<Chat[]> { ... }
```

This ensures that forgetting tenant scope is a type error at compile time, not a runtime leak.

### 4.2 Middleware integration with Next.js App Router

Regula uses Next.js 15 App Router. The pattern:

1. `middleware.ts` at the project root extracts JWT, validates tenant context, attaches to request headers.
2. Server-side `getTenantContext()` helper reads the validated context from the request.
3. Every `layout.tsx` and `page.tsx` under `/app/(app)/` calls `getTenantContext()` and passes it to data-fetching hooks.
4. Drizzle client is constructed with `withTenantContext(db, context)` before any query runs.

The middleware approach ensures that server components default to the authenticated tenant and cannot query another tenant without explicitly bypassing the helper (which requires an audit-logged `asAdmin()` escape hatch reserved for internal tooling).

### 4.3 TanStack Query server state

TanStack Query caches server state. Cache keys must include `tenantId` as the first key segment to prevent cache poisoning between tenants if a user somehow lands in a different tenant's session:

```
['tenant', tenantId, 'chats', chatId]
```

This is enforced by a lint rule on all TanStack query key factories.

---

## 5. Cloudflare edge isolation patterns

### 5.1 Durable Object naming

Durable Objects in Cloudflare Workers are globally addressed by name. Accidental cross-tenant access is trivially possible if names are constructed from user input. Regula's pattern:

- DO name = HMAC(tenantId + resourceType + resourceId, secret) → deterministic, authenticated, tenant-scoped.
- Workers cannot construct a DO name without knowing the secret, which is only accessible to the server that already holds a validated tenant JWT.

### 5.2 R2 bucket prefixes

All uploaded documents go to a single R2 bucket with path prefix `tenants/{tenantId}/documents/{docId}`. Worker-level access control checks the prefix on every GET/PUT and rejects requests that don't match the authenticated tenant. R2 itself does not have native multi-tenancy beyond bucket level; prefix isolation is the standard pattern.

### 5.3 KV namespacing

All KV keys use prefix `tenant:{tenantId}:`. Worker helper functions enforce prefix construction.

### 5.4 Logs and metrics tagging

Cloudflare Workers Analytics Engine and Logpush destinations (Sentry, PostHog) must receive tenant_id as a tag on every log entry and every metric data point. This is both for cross-tenant troubleshooting and for per-tenant billing attribution.

### 5.5 Regional routing (data residency)

Cloudflare Workers offer Geo-steering via Workers Regional deployment (GA 2024). For EU tenants, Durable Objects can be pinned to `eu` region; for US tenants, `enam`; for APAC, `apac`. Critically, R2 offers EU jurisdiction buckets that guarantee data residency in Germany / Netherlands. Neon offers EU (Frankfurt) and US (Oregon, Virginia) regions.

Pinning strategy:
- `tenants.region` field (us/eu/apac) drives routing at the edge.
- At tenant creation, R2 bucket is provisioned in the matching jurisdiction.
- Neon database replica in the matching region is provisioned via Neon branch API; primary stays in main region for operational simplicity but read replicas serve regional traffic.
- Cross-region writes are rare (most writes are per-tenant); they go to primary and replicate to the tenant's region for reads.

---

## 6. SOC 2 Type II — Trust Services Criteria mapping

### 6.1 SOC 2 Type II vs Type I

Type I is a point-in-time attestation that controls are designed appropriately. Type II is a period-of-time attestation (typically 6 months minimum, often 12 months) that controls operated effectively over the observation window. Enterprise customers universally require Type II; Type I is considered a stepping stone only.

**Decision: skip Type I, pursue Type II directly.** The additional cost is modest (one more audit firm visit) and Type II is what customers actually ask for.

### 6.2 Trust Services Criteria 2017 (applicable set)

SOC 2 is based on five Trust Service Categories; four are optional and only Security is required. Regula scope:

- **Security** (required): Common Criteria CC1.x through CC9.x — logical and physical access, system operations, change management, risk mitigation.
- **Availability** (optional, recommended): A1.x — performance monitoring, disaster recovery, capacity planning. Enterprise customers increasingly expect this.
- **Confidentiality** (optional, recommended): C1.x — identification and handling of confidential information. Relevant for customer SOPs.
- **Processing Integrity** (optional, deferred): PI1.x — only relevant when Regula is a transaction processor. Not applicable in Phase 12.
- **Privacy** (optional, deferred to Phase 13 or dedicated GDPR SPEC): P1.x through P8.x — covered partially by HIPAA/GDPR work.

**Decision: pursue Security + Availability + Confidentiality. Defer Privacy to a dedicated future SPEC because Privacy overlaps heavily with GDPR and PIPA work that benefits from focused treatment.**

### 6.3 Control mapping matrix (summary)

Full mapping is included in spec.md. Key Common Criteria controls and Regula implementation evidence:

| Control | Name | Regula evidence source |
|---------|------|------------------------|
| CC1.1–CC1.5 | Control Environment | Agency constitution, Regula coding standards, employee onboarding checklist |
| CC2.1–CC2.3 | Communication & Information | `.moai/docs/`, security incident runbook, customer-facing status page |
| CC3.1–CC3.4 | Risk Assessment | Phase-by-phase risk registers (FOUNDATION §15, ENTERPRISE §15, etc.), annual risk review |
| CC4.1–CC4.2 | Monitoring Activities | regula-observability Phase 8 continuous monitoring, quarterly internal control tests |
| CC5.1–CC5.3 | Control Activities | Change management via PR + CODEOWNERS, segregation of duties, automated testing |
| CC6.1–CC6.8 | Logical & Physical Access | Auth.js + RBAC from ENTERPRISE, Cloudflare Access for admin UIs, SSO enforcement, MFA mandatory for enterprise tier |
| CC7.1–CC7.5 | System Operations | Deployment pipeline, Sentry error tracking, Grafana alerting, incident response plan |
| CC8.1 | Change Management | Git + PR review, Biome/Vitest/Playwright CI gates, canary deploys |
| CC9.1–CC9.2 | Risk Mitigation | Cloudflare DDoS, Anthropic Enterprise contract, vendor assessments, cyber insurance |

### 6.4 Observation window and auditor selection

- **Observation window:** minimum 6 months of operational evidence. Recommended 12 months for the first Type II to build a stronger report. Regula target: start observation window 30 days after Phase 12 spec.md controls are implemented and RLS is enabled in production.
- **Auditor selection:** industry practice splits between Big 4 (Deloitte, KPMG, PwC, EY) and specialized SOC firms (A-LIGN, Schellman, Prescient Assurance, Drata-partnered auditors).
  - Big 4: high cost (~$80–150k for initial Type II), strong brand signal for enterprise procurement, slower turnaround.
  - Specialized: moderate cost (~$25–50k), faster, equally valid report; less brand recognition but enterprise procurement departments accept them.
  - **Recommendation: start with Schellman or A-LIGN for cost and speed. Revisit Big 4 after Year 2 if customer feedback warrants it.**
- **Compliance automation platform:** Drata, Vanta, Secureframe, Sprinto. These platforms auto-collect evidence from AWS/Cloudflare/GitHub and reduce the manual burden of control monitoring by 60–80% per public customer case studies. **Recommendation: adopt Drata or Vanta from the start of Phase 12. Cost ~$10–30k/year depending on headcount.**

### 6.5 Evidence collection strategy

Automated:
- Access reviews exported monthly from Auth.js + RBAC tables.
- Change logs exported from GitHub (PR merged, reviewer, commit hash).
- Monitoring alerts exported from Sentry + Cloudflare Analytics + Grafana.
- Vulnerability scans: weekly from Snyk or Dependabot.
- Penetration test results: annual (§6.6).

Manual:
- Board/leadership security review minutes (quarterly).
- Employee security training completion certificates.
- Vendor due-diligence reports for sub-processors.
- Business continuity tabletop exercise results (semi-annually).

### 6.6 Penetration testing

SOC 2 does not formally require pen testing but enterprise customers typically ask for results. ISO 27001 Annex A.12.6 does require vulnerability management. The pragmatic approach:

- Annual external pen test by a reputable firm (HackerOne, Cobalt, Bishop Fox, NCC Group). Cost ~$20–40k.
- Continuous internal scanning via Snyk (SAST + SCA) and weekly DAST against staging.
- Bug bounty program via HackerOne or Bugcrowd deferred to post-launch (requires mature triage capacity).

### 6.7 Competitor certification status (2026-04 survey)

| Competitor | SOC 2 Type II | HIPAA BAA | ISO 27001 | Notes |
|------------|---------------|-----------|-----------|-------|
| Veeva Vault | Yes | Yes | Yes | Enterprise gold standard; heavy procurement burden per customer |
| ComplianceQuest | Yes | Unclear | Yes | Salesforce-based, inherits some Salesforce certs |
| MasterControl | Yes | Yes | Yes | Medical device focus, similar profile to target Regula customers |
| Greenlight Guru | Yes | Yes | Yes | Strong medical device UX, smaller footprint than Veeva |
| Notion AI | Yes | Yes (Enterprise tier only) | Yes | Horizontal comparable, shows BAA gating behind enterprise tier is accepted practice |

**Implication:** Regula cannot credibly sell into medical device enterprise without matching at minimum SOC 2 + HIPAA + ISO 27001. Phase 12 scope is validated by market standard.

---

## 7. HIPAA compliance — Security Rule + Privacy Rule

### 7.1 Scope determination

HIPAA applies when Regula handles Protected Health Information (PHI) on behalf of a Covered Entity (hospital, clinic, insurer, provider) or a Business Associate. The regulatory question is whether Regula is acting as a Business Associate.

**Determination:** YES for any customer in the US healthcare provider or device-manufacturer-with-clinical-data space. Customer SOPs and clinical evaluation reports uploaded via DOCINGEST routinely contain:
- Patient identifiers in clinical investigation reports.
- Subject data in post-market surveillance documents.
- Adverse event narratives with identifiable fields.

Even if the customer redacts before upload, Regula cannot rely on that in practice. The safer posture is: assume PHI is in scope, implement HIPAA-compliant safeguards by default.

### 7.2 Security Rule — Administrative / Physical / Technical Safeguards

**Administrative Safeguards (§164.308):**
- Security Management Process: risk assessment + sanction policy + information system activity review.
- Assigned Security Responsibility: named Security Officer (required role to fill before BAA signing).
- Workforce Security: onboarding/offboarding, access authorization.
- Information Access Management: role-based, minimum necessary.
- Security Awareness Training: HIPAA training for all staff with PHI access, annually.
- Security Incident Procedures: incident response plan with breach notification protocol.
- Contingency Plan: backup, disaster recovery, emergency mode operation.
- Evaluation: periodic evaluation (annual).

**Physical Safeguards (§164.310):**
- Facility Access Controls: Cloudflare/Neon/Anthropic provide physical security; Regula inherits.
- Workstation Use and Security: employee laptop security policy, full-disk encryption, auto-lock.
- Device and Media Controls: secure disposal, backup encryption.

**Technical Safeguards (§164.312):**
- Access Control: unique user identification (Auth.js user_id), automatic logoff, encryption/decryption of ePHI.
- Audit Controls: all access to PHI logged to `audit_logs` with 7-year retention (21 CFR Part 11 already requires this; HIPAA reinforces).
- Integrity: digital signatures on audit logs (Phase 8 FOUNDATION), checksum validation on document storage.
- Transmission Security: TLS 1.3 end-to-end, certificate pinning where possible.

### 7.3 Privacy Rule — minimum necessary

Privacy Rule §164.502(b) requires that uses and disclosures of PHI be limited to the minimum necessary. In Regula context this means:

- Answer prompt must not include raw PHI in the system prompt or context window if avoidable.
- Document chunks served to Claude Sonnet as RAG context may contain PHI; this is necessary for citation accuracy but must be logged.
- Admin UI screens must redact PHI fields by default, requiring explicit "show" action that is audit-logged.
- Analytics dashboards (PostHog) must scrub PHI fields before ingestion.

### 7.4 Business Associate Agreement (BAA) requirements

BAAs required with sub-processors that handle PHI:
- **Cloudflare Enterprise:** signs BAA as of 2024. Confirmed per Cloudflare public statements.
- **Anthropic Enterprise:** signs BAA for Claude API as of 2024. Confirmed per Anthropic Enterprise tier terms.
- **Neon Postgres:** Enterprise tier signs BAA as of 2024. Free/Pro tiers do not.
- **Sentry:** Business tier signs BAA as of 2023. Team tier does not.
- **PostHog:** Cloud Enterprise signs BAA as of 2024. Community tier does not.
- **Vercel:** Enterprise signs BAA. Hobby/Pro do not.

**Implication:** Regula's entire vendor stack must be upgraded to enterprise tiers before BAA chain is complete. Cost uplift ~$3–8k/month at current scale, passes through to customer pricing.

### 7.5 Breach notification

- Breach affecting fewer than 500 individuals: annual summary to HHS.
- Breach affecting 500+ individuals: notify HHS, affected individuals, and prominent media outlet within 60 days.
- State laws (California, New York, Massachusetts) add stricter timelines (as short as 30 days in some states).
- Customer BAA typically requires Regula to notify them within 24–72 hours of breach discovery so they can meet their own obligations.

Regula's breach notification protocol must support the 24-hour notification window, which requires on-call rotation and tested incident response.

### 7.6 De-identification option (§164.514)

HIPAA provides two paths for data to leave HIPAA scope:
- **Safe Harbor:** 18 identifiers removed.
- **Expert Determination:** statistician attests re-identification risk is very small.

For analytics and ML training purposes, Regula could operate on de-identified data outside BAA scope. However, for the chat inference path, de-identification would defeat the purpose (SOPs must retain their original content for citation). **Decision: no de-identification in inference path; de-identification only if/when Regula does analytics on aggregate customer usage.**

---

## 8. ISO/IEC 27001:2022 — ISMS and controls

### 8.1 2022 update vs 2013

ISO 27001 was revised in October 2022, reducing Annex A controls from 114 to 93, reorganized into four themes:
- **People (8 controls)**
- **Organizational (37 controls)**
- **Technological (34 controls)**
- **Physical (14 controls)**

Certified organizations had a 3-year transition window; anyone starting certification in 2026 starts directly on the 2022 version.

### 8.2 ISMS components

ISO 27001 requires an Information Security Management System with the following documents:

1. **ISMS Scope Statement:** what is in scope (Regula product + supporting infra + team).
2. **Information Security Policy:** high-level commitment signed by leadership.
3. **Risk Assessment Methodology:** defined approach (likelihood × impact matrix).
4. **Risk Assessment Report:** current risk register.
5. **Risk Treatment Plan:** how risks are addressed (accept, mitigate, transfer, avoid).
6. **Statement of Applicability (SoA):** which of the 93 Annex A controls are in scope with justification.
7. **Mandatory Records:** training, internal audit, management review, corrective actions, incident records.

### 8.3 Statement of Applicability estimate

Typical B2B SaaS SoA marks 85–93 of the 93 controls as applicable. Controls typically excluded are industry-specific (OT/SCADA, physical security beyond cloud provider inheritance). Regula SoA estimate: ~88–91 applicable controls.

### 8.4 Certification body selection

ISO 27001 certificates are issued by accredited certification bodies, not auditors directly. Common choices:
- **BSI** (British Standards Institution): premium brand, international recognition.
- **TÜV** (multiple German certification bodies): strong in EU.
- **DNV, Bureau Veritas:** global presence.
- **Schellman, A-LIGN:** often one-stop shops combining SOC 2 + ISO 27001, cost-effective.

**Recommendation: bundle ISO 27001 with SOC 2 at the same firm (Schellman or A-LIGN) for cost efficiency and consistent evidence collection.**

### 8.5 Certification timeline

- Stage 1 audit (documentation review): ~1 month after ISMS documentation complete.
- Stage 2 audit (operational): ~2–3 months after Stage 1.
- Certificate issuance: ~1 month after successful Stage 2.
- Annual surveillance audits: Year 1, Year 2.
- Recertification: Year 3.

Total elapsed time from ISMS start to certificate: typically 6–12 months.

### 8.6 Overlap with SOC 2

ISO 27001 Annex A controls overlap extensively with SOC 2 Common Criteria. Evidence collected for one can serve the other with ~80% reuse. This is why bundling auditors saves significant effort.

---

## 9. Data residency and jurisdictional conflicts

### 9.1 Why regional pinning matters

- **EU GDPR Art 44–49:** data transfer outside EEA requires adequacy decision or Standard Contractual Clauses (SCCs) + Transfer Impact Assessment. US adequacy via Data Privacy Framework (2023) is valid but uncertain (prior frameworks were struck down by CJEU; DPF is under legal challenge 2024–2026).
- **Korea PIPA:** cross-border transfer requires explicit consent or exception; enterprise customers often require Korea residency.
- **China DSL + PIPL:** data of Chinese citizens must be stored in China; for a global SaaS this typically means a separate China deployment or explicit scope-out.
- **Japan APPI:** less strict than GDPR but enterprise customers often demand Japan residency for sensitive data.

### 9.2 Regula regions

Phase 12 scope covers three regions:

- **US (enam):** default region. Neon US-East (Ohio/Virginia), Cloudflare enam, R2 WNAM/ENAM jurisdiction buckets.
- **EU:** Neon EU-Central (Frankfurt), Cloudflare eu, R2 EU jurisdiction bucket.
- **APAC:** Neon AP-Southeast (Singapore), Cloudflare apac, R2 APAC jurisdiction bucket. APAC covers Korea and Japan customers until separate regions are needed.

### 9.3 Scope-out for now

- **China:** requires China-specific deployment (separate Cloudflare partner in China, domestic database). Out of scope for Phase 12. Customers requiring China residency are either served from APAC with explicit legal sign-off, or deferred until a dedicated China SPEC.
- **Russia:** no operational presence. No compliance work.
- **Brazil LGPD:** covered by GDPR-like posture, no region yet.

### 9.4 Data residency enforcement mechanism

- `tenants.region` field (us/eu/apac) set at tenant creation.
- Cannot be changed after creation without a data migration procedure (future SPEC).
- Cloudflare Worker routing rules pin the tenant to the matching region for Durable Objects and R2 access.
- Neon read replicas serve tenant reads from the matching region; writes go to primary with async replication for cross-region reads.
- Logs and metrics tagged with region, routed to region-matched Sentry/PostHog projects (enterprise tier supports this).

---

## 10. Migration plan for existing data

### 10.1 Current state

Pre-Phase-12, Regula operates as a single logical tenant. Existing tables do not have `tenant_id`. Data volume at Phase 12 implementation time: assume modest (design-phase or small beta with a handful of customers).

### 10.2 Migration sequence

1. Create `tenants` table, seed with a `default` tenant row for existing data.
2. Create `tenant_members` table, backfill from existing `users` table assigning all users to `default`.
3. For each tenant-scoped existing table (chats, messages, documents, audit_logs, etc.):
   a. Add nullable `tenant_id`.
   b. Backfill with `default` tenant id.
   c. Add `NOT NULL` constraint.
   d. Add foreign key.
   e. Create composite index.
   f. Deploy app code that writes `tenant_id` on new rows.
4. Enable RLS on each table with policies defined.
5. Switch application connection role to a non-bypass role.
6. Validate with synthetic multi-tenant test: create two test tenants, verify cross-tenant query returns zero rows.
7. Rename `default` tenant to the actual production tenant name for existing customers.

### 10.3 Rollback plan

At each step, rollback is straightforward:
- Disable RLS on a table (`ALTER TABLE ... DISABLE ROW LEVEL SECURITY`) returns to pre-policy state.
- Revert app code deploys via standard Vercel / Cloudflare rollback.
- Drop `tenant_id` column only after 30-day backup retention confirms no rollback needed.

### 10.4 Downtime budget

With Blue-Green dual-write, downtime can be kept under 5 minutes (the cutover step). Most steps are online (`ADD COLUMN` with default, `CREATE INDEX CONCURRENTLY`, `VALIDATE CONSTRAINT`). The cutover is a deploy of new app version that switches the read path.

---

## 11. Security scanning and penetration testing

### 11.1 Automated scans

- **SAST (Static Application Security Testing):** Snyk Code or GitHub CodeQL on every PR. Fail PR on high/critical.
- **SCA (Software Composition Analysis):** Snyk Open Source or Dependabot. Weekly scan, auto-PR for patch updates.
- **Container/infra scanning:** Cloudflare Pages + Workers do not have traditional containers, but Terraform/IaC definitions (if adopted) scanned with Checkov.
- **DAST (Dynamic Application Security Testing):** OWASP ZAP automated run against staging weekly. Findings triaged by security officer.

### 11.2 Manual red team — 100 test case matrix

Phase 12 acceptance requires a 100-test-case cross-tenant isolation red team. Categories:

| Category | Test count | Example |
|----------|-----------|---------|
| Direct tenant_id manipulation in URLs | 15 | `/api/tenants/{other_id}/chats` → 403 |
| JWT claim tampering | 10 | Swap tenant_id in JWT, verify signature rejects |
| Header injection | 10 | `X-Tenant-Override: ...` → rejected |
| SQL injection attempts targeting tenant isolation | 15 | `' OR tenant_id != '...` → RLS still isolates |
| Durable Object name enumeration | 10 | Guess DO names → HMAC prevents |
| R2 path traversal | 10 | `../other-tenant/...` → rejected |
| KV key prefix bypass | 10 | Key without proper prefix → rejected |
| Cache poisoning | 10 | Tanstack Query cache carries cross-tenant → test verifies |
| Session fixation | 5 | Old session from different tenant → reject |
| Citation leak (Regula-specific) | 5 | Answer in tenant A contains document from tenant B → never |

Each test must have automated reproduction; manual tests captured in Playwright.

### 11.3 Annual external pen test scope

- Application-layer: authentication, authorization, tenant isolation.
- API: all REST/SSE endpoints.
- LLM-specific: prompt injection, jailbreak resistance, data exfiltration via model output.
- Network: edge security, rate limiting, DDoS posture.

### 11.4 LLM-specific security concerns

Phase 12 inherits LLM risks from earlier phases but must explicitly verify:
- Prompt injection cannot cross tenant boundary (tenant A's document cannot instruct Claude to leak tenant B data — mitigation: separate RAG contexts per tenant, verified).
- Model output scrubbing for PHI must work (verified against known test corpus).
- Completion caching (if used) must be tenant-scoped. Anthropic prompt caching feature from 2024 allows per-prefix cache — verify cache key includes tenant context.

---

## 12. Operational readiness

### 12.1 Incident response plan

Required by SOC 2, HIPAA, and ISO 27001. Regula plan components:

- **Detection:** Sentry alert rules, Cloudflare WAF events, audit log anomaly detection.
- **Classification:** P0/P1/P2/P3 severity matrix with response time targets.
- **Containment:** runbooks for common incidents (compromised credential, data leak suspicion, DDoS).
- **Eradication and recovery:** process for patching + post-mortem + customer communication.
- **Post-incident:** blameless PIR, regulatory breach notification if applicable (HIPAA 24–72h customer notice).

### 12.2 Disaster recovery and business continuity

- **RTO (Recovery Time Objective):** 4 hours for critical services (chat, auth).
- **RPO (Recovery Point Objective):** 1 hour for user data.
- **Backup strategy:** Neon point-in-time restore (7-day window built-in; 30-day for Enterprise). R2 versioning enabled. Audit logs append-only to cold storage with 7-year retention per 21 CFR Part 11.
- **DR drill:** semi-annually, tabletop plus one live failover test per year.

### 12.3 Vendor management

- Sub-processor list maintained in a public trust center page (standard practice).
- Annual vendor review: security posture, BAA status, SOC 2 / ISO 27001 evidence.
- Onboarding workflow for new vendors: security questionnaire, legal review, data flow documentation.

### 12.4 Employee training

- Initial security training at onboarding: HIPAA, SOC 2 awareness, social engineering, phishing.
- Annual refresher.
- Role-based: engineers additional training on secure coding, ops on incident response.
- Completion tracked via training platform (KnowBe4, Hoxhunt, etc.) or custom LMS.

### 12.5 Security Officer role

Required by HIPAA, recommended by SOC 2 and ISO 27001. At Regula's current team size, this is likely a designated engineering lead or CTO responsibility until headcount justifies a dedicated CISO.

---

## 13. Cost estimation

### 13.1 Annual cost of compliance

| Category | Estimate | Notes |
|----------|----------|-------|
| SOC 2 Type II audit | $30–50k | Schellman or A-LIGN; less for first year if combined with Type I stepping |
| ISO 27001 certification | $25–40k | Initial + first surveillance |
| HIPAA | ~$0 direct cost | BAA-only; audit rolled into SOC 2 + ISO scope |
| Compliance automation (Drata/Vanta) | $15–25k/year | Small team tier |
| Vendor upgrades (enterprise tiers for BAA) | $40–80k/year | Cloudflare, Anthropic, Neon, Sentry, PostHog |
| External pen test | $25–40k/year | Annual |
| Compliance tooling (SAST/SCA/DAST) | $10–15k/year | Snyk or equivalent |
| Security training platform | $5–10k/year | Per-seat |
| Security Officer time | 20–30% FTE | Ongoing |
| Legal (BAA negotiations, policy drafting) | $10–20k | First year high, drops after |
| **Total first year** | **~$160–280k** | Excluding internal time |
| **Total steady state (Year 2+)** | **~$130–230k/year** | |

### 13.2 Cost attribution

Compliance cost should be attributed to enterprise tier pricing. Typical SaaS pattern:
- Standard tier (no HIPAA BAA): smaller customers, lower ACV.
- Enterprise tier (full BAA, SOC 2 report, ISO 27001 cert): larger customers, ACV 3–5x higher.

At target Year 1 ARR ($2–5M per master-roadmap), compliance cost is 4–8% of revenue, aligned with industry norms for regulated B2B SaaS.

---

## 14. Risks and mitigations (research-level)

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Migration causes production incident | Medium | High | Blue-Green pattern, synthetic canary tests, rollback plan tested pre-deploy |
| RLS performance degrades chat p95 | Medium | Medium | Composite indexes, partial HNSW, benchmark before full rollout |
| Cross-tenant leak discovered post-launch | Low-medium | Extinction | Three-layer defense, 100-test red team, external pen test |
| SOC 2 audit observation window delays go-to-market | High | Medium | Start observation window early, communicate timeline to sales/customers |
| BAA negotiation with customers stalls | Medium | Medium | Pre-negotiate template BAA with legal; avoid one-off customer BAA rewrites where possible |
| Enterprise silo option demanded by large deal | Medium | Medium | Prepare interface contract in Phase 12; spin up SPEC-REGULA-SILO-001 when the deal closes |
| HIPAA breach during observation window invalidates Type II | Low | High | Incident response drills, aggressive monitoring, MFA mandatory, principle of least privilege |
| EU customer demands data residency Regula cannot yet deliver | High | High | Prioritize EU region in Phase 12 rollout before EU enterprise sales push |
| Auditor finds a control gap late in Type II window | Medium | High | Engage auditor early (pre-observation readiness assessment), use Drata/Vanta for continuous evidence |
| China customer opportunity requires separate architecture | Low | Medium | Defer to separate SPEC; scope out of Phase 12 |
| pgvector performance under RLS + high concurrency unknown | Medium | Medium | Dedicated benchmark sprint, fallback to per-tenant partial indexes if needed |

---

## 15. Open questions deferred to spec.md

- Exact list of tenant-scoped tables and their RLS policy wording → covered in spec.md §4.
- Admin UI wireframes → covered in spec.md §6.
- API contract for admin tenant management → covered in spec.md §5 and §7.
- Full 100-test red team scenarios → covered in spec.md acceptance section.
- Exact chat latency budget allocation under RLS → covered in spec.md non-functional constraints.

---

## 16. References (external)

- AWS Well-Architected SaaS Lens (2024 rev) — tenant isolation patterns.
- PostgreSQL official documentation on Row-Level Security, v16.
- pgvector release notes 0.5, 0.6, 0.7 (2023–2024) — partial HNSW behavior.
- Cloudflare Workers documentation — Durable Object naming, R2 jurisdiction, Regional deployment.
- Neon documentation — multi-region branches, HIPAA tier, enterprise pricing.
- AICPA Trust Services Criteria 2017 (with 2022 points of focus) — SOC 2 control wording.
- 45 CFR Part 160 and 164 (HIPAA Security and Privacy Rules).
- ISO/IEC 27001:2022 and ISO/IEC 27002:2022 — ISMS and controls.
- 21 CFR Part 11 — electronic records and signatures (carries over from FOUNDATION).
- Competitor public trust pages: Veeva (trust.veeva.com), MasterControl, ComplianceQuest, Greenlight Guru (current as of 2026-04).

---

End research.md
