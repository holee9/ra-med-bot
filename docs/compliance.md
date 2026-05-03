# Regula — Compliance Documentation

> Version: 1.0.0 | Updated: 2026-05-03  
> Scope: 21 CFR Part 11, GDPR data minimization, OWASP Top 10 2021

---

## 1. Overview

Regula is designed for use in regulated medical device environments. The system implements controls aligned with:

- **21 CFR Part 11** — Electronic Records and Electronic Signatures
- **EU MDR Article 10** — Quality Management System requirements (for RA tool systems)
- **OWASP Top 10 2021** — Web application security baseline

This document covers the key compliance controls and how they are implemented.

---

## 2. 21 CFR Part 11 — Electronic Records

### 2.1 Audit Trail (§11.10(e))

All user actions and LLM interactions are recorded in the `audit_logs` table.

**Implementation:**
- Table: `audit_logs` (PostgreSQL, append-only)
- Recorded actions: `llm.call`, `source.access`, `expert_review.flag`, `user.login`, `user.logout`, `project.create`, `project.update`
- Each entry contains: `actor_id`, `action`, `resource_type`, `resource_id`, `conversation_id`, `meta_json`, `created_at`

**Immutability enforcement:**
The audit table is protected at the database level — UPDATE, DELETE, and TRUNCATE operations are blocked. Integration tests validate this constraint:

```
tests/integration/audit-immutability.test.ts
```

### 2.2 Record Retention (§11.10(c))

Audit logs are retained for a minimum of **7 years** (2,555 days).

**Implementation:**
- Partitioned `audit_logs` table by year for efficient long-term storage
- Retention policy enforced via database configuration
- Integration tests validate partition configuration:

```
tests/integration/audit-retention.test.ts
```

### 2.3 Access Controls (§11.10(d))

All API endpoints are protected by Auth.js v5 session authentication.

- Sessions use signed HttpOnly cookies (NEXTAUTH_SECRET)
- RBAC enforces Owner/Editor/Viewer roles on project resources
- Unauthenticated requests return HTTP 401

### 2.4 System Validation (§11.10(a))

The system undergoes validation through:
- **LLM eval harness** (promptfoo): 55 scenarios across 6 regulatory corpora
- **E2E tests** (Playwright): 3-browser matrix covering all critical user journeys
- **Unit + integration tests** (Vitest): 85%+ coverage on `lib/` and `app/api/`
- **Pre-flight pipeline** (`scripts/preflight.sh`): 17-step validation before each deployment

### 2.5 Audit Log Schema

```sql
CREATE TABLE audit_logs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id    UUID REFERENCES users(id),
  action      TEXT NOT NULL,           -- e.g. 'llm.call', 'source.access'
  resource_type TEXT,                  -- e.g. 'message', 'conversation'
  resource_id UUID,
  conversation_id UUID,
  meta_json   JSONB DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- No UPDATE / DELETE / TRUNCATE allowed (enforced via DB policy)
```

---

## 3. LLM-Specific Compliance Controls

### 3.1 Citation Enforcement

Every LLM response must cite source documents using inline bracket notation (`[1]`, `[FDA-001]`). The `citation-enforce.ts` post-processor validates:
- All factual claims have inline citations
- Citation indices match `message_sources.cite_index` in the database
- Uncited sentences are flagged for expert review

### 3.2 Expert Review Gating

Low-confidence or high-risk answers trigger a mandatory expert review flag:

| Condition | Action |
|-----------|--------|
| `confidence_score < 0.6` | `expert_review_required: true` |
| Query contains high-risk terms (e.g., "PMA", "Class III") | `expert_review_required: true` |
| Citation coverage < 80% | `expert_review_required: true` |

Flagged answers appear in the RA lead's expert review queue. The answer is still surfaced to the user with a visible warning badge.

### 3.3 Anthropic Zero Data Retention

All LLM calls use Anthropic's Zero Data Retention (ZDR) mode:

```typescript
// lib/ai/anthropic-client.ts
headers: {
  'anthropic-beta': 'zero-data-retention'
}
```

This ensures that no user query or LLM response is stored by Anthropic after the API call completes.

### 3.4 Hallucination Detection

The LLM eval harness includes a `hallucination` scorer that detects:
- Invented regulation numbers not present in source documents
- Future years that don't exist in the corpus
- Fabricated agency guidance that contradicts known documentation

---

## 4. Data Privacy and GDPR Alignment

### 4.1 Data Minimization

- User queries are not stored by the LLM provider (Anthropic ZDR)
- Sentry `beforeSend` hook redacts PII fields before error reporting:
  ```typescript
  // Redacted fields: query, user_id, content, email
  ```
- Session tokens are HttpOnly cookies (not accessible to JavaScript)

### 4.2 Data Residency

- Application: Vercel iad1 (US East) — primary production region
- Database: Neon (us-east-1) — can be migrated to EU (fra1) post-launch if required
- LLM: Anthropic API (ZDR mode — no data retention)

### 4.3 User Data Rights

| Right | Implementation |
|-------|----------------|
| Right to access | Users can view their conversation history via the UI |
| Right to deletion | Account deletion removes conversations (audit_logs retained per 21 CFR §11.10(c)) |
| Right to portability | Conversation export available (Phase 2+ feature) |

---

## 5. OWASP Top 10 2021 Compliance

| # | Risk | Regula Control | Status |
|---|------|----------------|--------|
| A01 | Broken Access Control | Auth.js v5 + RBAC on all routes | ✅ |
| A02 | Cryptographic Failures | HTTPS + HSTS + HttpOnly cookies | ✅ |
| A03 | Injection | Drizzle ORM parameterized queries, Zod input validation | ✅ |
| A04 | Insecure Design | Threat model documented, expert review gating | ✅ |
| A05 | Security Misconfiguration | `vercel.json` security headers, `.gitleaks.toml` | ✅ |
| A06 | Vulnerable Components | `pnpm audit` in CI + Dependabot | ✅ |
| A07 | Auth Failures | Auth.js v5, session rotation, CSRF protection | ✅ |
| A08 | Software/Data Integrity | `pnpm install --frozen-lockfile` in CI | ✅ |
| A09 | Logging/Monitoring Failures | Sentry + audit_logs + Langfuse | ✅ |
| A10 | SSRF | URL validation on source document fetches | ✅ |

For full OWASP analysis, see [`docs/security/owasp-top10-2025.md`](security/owasp-top10-2025.md).

---

## 6. Quality Management

### 6.1 Change Control

All code changes must:
1. Be linked to a GitHub Issue (`Fixes #N` in commit message)
2. Pass the 17-step pre-flight pipeline (`pnpm preflight`)
3. Pass LLM eval harness (promptfoo, 55 scenarios)
4. Receive PR approval

### 6.2 Validation Testing

| Test Type | Count | Runner |
|-----------|-------|--------|
| Unit tests | 200+ | Vitest |
| Integration tests | 30+ | Vitest |
| E2E tests | 8 spec files, 3 browsers | Playwright |
| LLM eval scenarios | 55 | promptfoo |
| Load test scenarios | 2 (steady + spike) | k6 |

### 6.3 Deployment Validation

Every production deployment includes:
1. Pre-flight pipeline (17 steps)
2. GitHub Actions CI (lint + typecheck + test + security audit)
3. Post-deploy smoke test (`scripts/post-deploy-smoke.sh`)

---

## 7. Incident Management

| Severity | Response Time | Escalation |
|----------|--------------|------------|
| P1 — Critical (data breach, system down) | < 15 min | Immediate page |
| P2 — High (RAG down, >50% errors) | < 1 hour | Team alert |
| P3 — Medium (slow responses, partial outage) | < 4 hours | Ticket created |
| P4 — Low (UI issues) | Next business day | Backlog |

Security incident response is documented in [`docs/security/pentest-plan.md`](security/pentest-plan.md).

For operational procedures, see [`docs/runbook.md`](runbook.md).

---

*Maintained by the Regula engineering team. For questions, open a GitHub Issue.*
