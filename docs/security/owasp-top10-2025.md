# OWASP Top 10 2021 — Regula Security Mapping

**Document scope**: Maps OWASP Top 10 2021 categories to Regula's medical device RA chatbot implementation,
describing mitigations and current status for each risk category.

**Last reviewed**: 2026-05-03
**Reviewed by**: Security team
**SPEC**: SPEC-REGULA-LAUNCH-001 (REQ-LAUNCH-029)

---

## Mapping Table

| ID | Category | Description | Regula Mitigation | Status |
|----|----------|-------------|-------------------|--------|
| A01 | Broken Access Control | Failure to enforce restrictions on authenticated users, allowing them to act outside their intended permissions. | Auth.js v5 SSO (Microsoft Entra ID + Google OAuth); RBAC with `admin`, `reviewer`, `consultant` roles; `withPermission` middleware on every mutating API route; row-level security enforced at DB layer. | MITIGATED |
| A02 | Cryptographic Failures | Exposure of sensitive data due to weak cryptography or missing encryption at rest/transit. | TLS enforced by Vercel (edge); `AUTH_SECRET` minimum 32-byte HMAC key; Neon Postgres encrypts data at rest; API keys stored in environment variables, never in VCS; no PII stored in audit `meta_json` (enforced by QA gate). | MITIGATED |
| A03 | Injection | Attacker-supplied data interpreted as commands (SQL, LDAP, OS, LLM prompt). | Drizzle ORM parameterised queries prevent SQL injection; Zod input validation on all API routes; LLM prompt injection mitigated by system prompt sandboxing and citation-enforcement gate; user content never interpolated directly into SQL. | MITIGATED |
| A04 | Insecure Design | Missing or ineffective control design leading to exploitable business logic flaws. | LLM hallucination risk mitigated by mandatory citation enforcement (`requireCitation` flag) and expert-review gating for low-confidence answers; append-only `audit_logs` table prevents silent data tampering; threat model maintained (see `threat-model.md`). | PARTIAL |
| A05 | Security Misconfiguration | Missing hardening, unnecessary features enabled, default credentials, verbose error messages. | `next.config.ts` security headers (CSP, HSTS, X-Frame-Options, X-Content-Type-Options); Vercel preview deployments protected; Biome linter CI gate prevents insecure patterns; `.env.example` documents all required secrets; no default credentials. | MITIGATED |
| A06 | Vulnerable and Outdated Components | Use of components with known vulnerabilities (CVEs). | `pnpm audit` integrated in CI pipeline as blocking gate; automated Dependabot alerts on GitHub; locked `pnpm-lock.yaml` ensures reproducible builds; Node >= 20 LTS pinned. | MITIGATED |
| A07 | Identification and Authentication Failures | Weak authentication, session management flaws, credential exposure. | Auth.js v5 handles session lifecycle with server-side sessions; OAuth-only login (no password storage); `AUTH_SECRET` HMAC-signed tokens; session expiry enforced; CSRF protection built into Auth.js. | MITIGATED |
| A08 | Software and Data Integrity Failures | Code and infrastructure without integrity verification; insecure CI/CD pipelines. | GitHub Actions CI enforces lint + test + type-check before merge; `pnpm-lock.yaml` lockfile integrity; Vercel deployment tied to signed GitHub commits; no unauthenticated deployment paths. | MITIGATED |
| A09 | Security Logging and Monitoring Failures | Insufficient logging/monitoring allowing attacks to go undetected. | Append-only `audit_logs` table records all mutating actions with `actor_id`, `action`, `resource_type`, `resource_id`, `created_at`; Sentry error monitoring; PostHog analytics (anonymised); Langfuse LLM observability; QA gate asserts audit coverage on all API routes. | MITIGATED |
| A10 | Server-Side Request Forgery | Web application fetches a remote resource based on user-supplied URLs without proper validation. | No user-supplied URLs are used in server-side fetch calls; LLM retrieval targets pre-configured knowledge bases (MFDS, EU-MDR, PMDA, NMPA internal SOPs); URL allow-list enforced; no proxied external requests triggered by user input. | MITIGATED |

---

## Status Definitions

| Status | Meaning |
|--------|---------|
| **MITIGATED** | Control is implemented and verified in code/tests. |
| **PARTIAL** | Mitigation exists but one or more risk sub-items remain open (see notes). |
| **DOCUMENTED** | Risk acknowledged; mitigation is a manual process or organisational control. |
| **N/A** | Risk category does not apply to Regula's threat surface. |

---

## A04 Partial — Open Items

The following A04 sub-items are tracked for Post-launch:

1. **LLM prompt injection via corpus documents** — RAG retrieval fetches regulatory documents from trusted sources; however, adversarial content embedded in user-uploaded SOPs is not yet filtered. Planned: content sanitisation pipeline for internal SOPs.
2. **Expert review bypass** — Expert review gating applies to `confidence < threshold` responses. A sophisticated user manipulating confidence scores could potentially bypass review. Planned: server-side confidence re-evaluation independent of client input.

---

## Review Cadence

This document is reviewed:
- Before each major release
- After any dependency upgrade affecting authentication or data access layers
- Following any security incident or near-miss
