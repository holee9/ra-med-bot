# Regula Threat Model

**Document scope**: Identifies assets, threat actors, and mitigations for the Regula medical device
RA RAG chatbot. Emphasises A04 Insecure Design risks arising from LLM integration.

**Last reviewed**: 2026-05-03
**Methodology**: STRIDE
**SPEC**: SPEC-REGULA-LAUNCH-001 (REQ-LAUNCH-029)

---

## 1. Assets

| Asset | Classification | Description |
|-------|---------------|-------------|
| RAG corpus | Confidential | Regulatory documents (MFDS, EU-MDR, PMDA, NMPA, internal SOPs). Unauthorised modification could cause false regulatory guidance. |
| `audit_logs` table | Confidential | Append-only record of all mutating actions. Tampering would destroy compliance audit trail. |
| User PII in chat sessions | Sensitive | Conversation history may contain question context. Stored in `messages` table, scoped to user. |
| API keys | Secret | OpenAI / LLM provider keys, Neon connection string, Auth secrets. Compromise enables data exfiltration. |
| Session tokens | Secret | Auth.js HMAC-signed tokens. Compromise allows session hijacking. |
| Expert review queue | Confidential | Low-confidence answers pending expert validation. Bypass leads to unreviewed medical guidance. |

---

## 2. Threat Actors

| Actor | Capability | Motivation |
|-------|-----------|-----------|
| External attacker | Medium — public internet access | Data exfiltration, service disruption, reputation damage |
| Malicious insider | High — authenticated access, knowledge of system | Unauthorised data access, audit log tampering |
| Regulatory auditor (adversarial) | Medium — authenticated auditor role | Discover compliance gaps before formal audit |
| LLM prompt injection attacker | Low–Medium — indirect via corpus or user input | Manipulate LLM output to produce false regulatory citations |

---

## 3. Data Flow Diagram

```
User Browser
     │  HTTPS (TLS)
     ▼
Vercel Edge (Next.js 15)
     │  Auth.js session validation
     ▼
API Routes (/api/ra/*, /api/review/*)
     │  withPermission middleware (RBAC)
     ▼
┌────────────────────────────────────────────┐
│  Consult Pipeline                          │
│  ┌─────────────┐   ┌──────────────────┐   │
│  │ Query        │──▶│ Retriever        │   │
│  │ Rewrite      │   │ (MFDS/MDR/PMDA) │   │
│  └─────────────┘   └──────────────────┘   │
│         │                   │              │
│         ▼                   ▼              │
│  ┌─────────────┐   ┌──────────────────┐   │
│  │ LLM         │◀──│ Retrieved Chunks │   │
│  │ (OpenAI)    │   │ + Citations      │   │
│  └─────────────┘   └──────────────────┘   │
│         │                                  │
│         ▼                                  │
│  Citation Enforcement Gate                 │
│  Expert Review Gating (confidence check)   │
└────────────────────────────────────────────┘
     │  writeAudit() on every mutation
     ▼
Neon Postgres
  audit_logs (append-only)
  messages, projects, users
```

---

## 4. STRIDE Threat Analysis

### 4.1 Spoofing

| Threat | Mitigation | Status |
|--------|-----------|--------|
| Session token forgery | Auth.js v5 HMAC-signed tokens with `AUTH_SECRET`; tokens verified server-side on every request | Mitigated |
| OAuth callback spoofing | `NEXTAUTH_URL` pinned; redirect URI allow-list in Microsoft Entra ID and Google Cloud Console | Mitigated |

### 4.2 Tampering

| Threat | Mitigation | Status |
|--------|-----------|--------|
| `audit_logs` row modification | Append-only table — no `UPDATE`/`DELETE` grants on audit table in Postgres | Mitigated |
| RAG corpus poisoning via malicious SOP upload | Content uploaded through authenticated endpoint; file type validation; planned: content sanitisation | Partial |

### 4.3 Repudiation

| Threat | Mitigation | Status |
|--------|-----------|--------|
| User denies performing action | `writeAudit()` on every mutating API handler; `actor_id` recorded; timestamp immutable | Mitigated |
| Expert denies approving review | Expert review actions written to `audit_logs` with `action: 'review.approve'` | Mitigated |

### 4.4 Information Disclosure

| Threat | Mitigation | Status |
|--------|-----------|--------|
| PII leakage via audit meta_json | QA gate (`checkFileForPiiLeaks`) blocks `question`, `answer`, `email` keys in meta | Mitigated |
| API key leakage in logs | Structured logging excludes sensitive headers; `.env` excluded from VCS | Mitigated |
| Cross-tenant data access | Row-level access scoped by `project_id` + `user_id`; `withPermission` enforces ownership | Mitigated |

### 4.5 Denial of Service

| Threat | Mitigation | Status |
|--------|-----------|--------|
| LLM API exhaustion via bulk requests | Rate limiting at Vercel edge; planned: per-user token quota | Partial |
| Database connection exhaustion | Neon serverless connection pooling; `postgres` client pool size configured | Mitigated |

### 4.6 Elevation of Privilege

| Threat | Mitigation | Status |
|--------|-----------|--------|
| Role escalation (consultant → admin) | Role assigned at login from DB; not derivable from JWT claims alone; `withPermission` checks DB-sourced role | Mitigated |
| IDOR on project resources | All resource endpoints validate `project_id` ownership against `actor_id` | Mitigated |

---

## 5. A04 Insecure Design — LLM-Specific Threats

This section expands the A04 analysis required by SPEC-REGULA-LAUNCH-001.

### 5.1 LLM Hallucination → False Regulatory Guidance

**Threat**: LLM produces plausible but incorrect regulatory citation, leading to erroneous RA decision.

**Impact**: Critical — incorrect device classification or submission route.

**Mitigation**:
- `requireCitation` flag enforced: every LLM response must include at least one source citation from the retrieved corpus.
- Citation enforcement gate validates that cited document IDs exist in retrieval results.
- Expert review gating: responses below confidence threshold are held in review queue and not delivered to user until approved by a qualified reviewer.

**Residual risk**: LLM may confidently produce a hallucinated citation that superficially matches a real document ID. Mitigated partially by fuzzy citation validation; full elimination requires human expert review for all responses (Post-launch option).

### 5.2 Prompt Injection via User Input

**Threat**: User embeds instructions in their query that override system prompt, causing the LLM to ignore citation requirements or reveal system prompts.

**Impact**: High — citation requirement bypassed; system prompt disclosed.

**Mitigation**:
- System prompt instructs the model to ignore user instructions that contradict citation requirements.
- Query rewrite step sanitises the user query before LLM invocation.
- LLM response is post-processed by citation enforcement gate regardless of LLM behaviour.

**Residual risk**: Advanced prompt injection using indirect vectors (e.g., adversarial content in regulatory corpus) is not fully mitigated. Tracked as open item in A04.

### 5.3 Prompt Injection via Corpus Documents

**Threat**: Adversarial content embedded in internal SOP documents causes LLM to behave unexpectedly when that content is retrieved and included in the context window.

**Impact**: Medium — may cause inconsistent LLM responses for specific queries.

**Mitigation**:
- Only trusted regulatory sources (MFDS, EU-MDR, PMDA, NMPA) and internally uploaded SOPs are ingested.
- SOP upload requires `admin` role.
- Planned (Post-launch): content sanitisation pipeline to strip embedded instructions from uploaded documents.

### 5.4 Expert Review Queue Bypass

**Threat**: Attacker manipulates confidence score sent to server, causing low-confidence responses to skip expert review.

**Impact**: High — unreviewed medical regulatory guidance delivered to user.

**Mitigation**:
- Confidence score is computed server-side by the consult pipeline; client cannot override it.
- Expert review gating checks the server-computed confidence at the point of response delivery.

**Residual risk**: If the confidence computation algorithm is manipulable via crafted input (e.g., very short queries always score high), bypass may be possible. Planned: server-side confidence re-evaluation independent of query characteristics.

---

## 6. Mitigation Summary

| Risk Area | Current State | Post-launch Action |
|-----------|--------------|-------------------|
| LLM hallucination | Citation enforcement + expert review gating | Full expert review for all clinical queries |
| Prompt injection (user) | System prompt hardening + query rewrite | Red-team exercise |
| Prompt injection (corpus) | Trusted sources only + admin-gated upload | Content sanitisation pipeline |
| Rate limiting | Vercel edge limits | Per-user token quota |
| SOP corpus poisoning | Authenticated upload + admin role | Content sanitisation pipeline |

---

## 7. Review Cadence

This threat model is reviewed:
- Before each major release
- After any significant architecture change (new data sources, new API endpoints)
- Following any security incident
- At minimum annually
