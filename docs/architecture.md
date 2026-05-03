# Regula — System Architecture

> Version: 1.0.0 | Updated: 2026-05-03

---

## 1. High-Level Overview

Regula is a **regulatory affairs (RA) expert chatbot** for medical device professionals. It combines a **Next.js 15 App Router** frontend with a **RAG (Retrieval-Augmented Generation) pipeline** backed by **Neon PostgreSQL + pgvector**, deployed on **Vercel**.

```mermaid
graph TD
    User["User (Browser)"]
    NextJS["Next.js 15 App Router\n(Vercel iad1)"]
    Auth["Auth.js v5\n(SSO / SAML / OIDC)"]
    ConsultAPI["POST /api/ra/consult\n(nodejs runtime, 60s timeout)"]
    RAG["RAG Pipeline\nlib/ai/consult.ts"]
    Intent["Intent Classifier\n(Haiku — 3 classes)"]
    QueryRewrite["Query Rewriter\n(rule-based + LLM)"]
    Retriever["Hybrid Retriever\npgvector (60%) + FTS (40%)"]
    LLM["Claude Sonnet 4.x\n(Anthropic ZDR)"]
    CitationEnforce["Citation Enforcer\nhtmlparser2"]
    DB["Neon PostgreSQL 16\n+ pgvector extension"]
    Sentry["Sentry\n(error + performance)"]
    PostHog["PostHog\n(product analytics)"]
    Langfuse["Langfuse\n(LLM trace)"]

    User -->|HTTPS| NextJS
    NextJS --> Auth
    NextJS --> ConsultAPI
    ConsultAPI --> RAG
    RAG --> Intent
    Intent --> QueryRewrite
    QueryRewrite --> Retriever
    Retriever -->|cosine similarity| DB
    Retriever -->|FTS GIN index| DB
    RAG --> LLM
    LLM --> CitationEnforce
    ConsultAPI -->|SSE stream| User
    ConsultAPI --> DB
    NextJS --> Sentry
    NextJS --> PostHog
    RAG --> Langfuse
```

---

## 2. Request Flow

### 2.1 Consultation Request (Happy Path)

```mermaid
sequenceDiagram
    participant U as User
    participant API as POST /api/ra/consult
    participant I as Intent Classifier
    participant Q as Query Rewriter
    participant R as Hybrid Retriever
    participant L as LLM (Claude)
    participant DB as Neon DB

    U->>API: POST {query, project_id, source_filters}
    API->>API: Auth check (Auth.js session)
    API->>I: classify intent
    I-->>API: {type: "regulation-lookup", confidence: 0.92}
    API->>Q: rewrite query
    Q-->>API: expanded query (FDA abbreviations etc.)
    API->>R: hybrid_search(query, corpus_filter)
    R->>DB: pgvector cosine + FTS GIN
    DB-->>R: top-K chunks (K=8)
    R-->>API: [{section_id, text, score}]
    API->>L: stream(system_prompt + chunks + query)
    L-->>API: SSE: meta → trace → prose_delta → confidence → sources → done
    API-->>U: SSE stream (real-time)
    API->>DB: INSERT messages + message_sources + audit_logs
```

### 2.2 SSE Event Order (Invariant)

Phase A events must precede Phase B, which must precede Phase C:

| Phase | Events |
|-------|--------|
| A — Setup | `meta`, `trace` |
| B — Content | `prose_delta`, `checklist`, `comparison`, `timeline`, `related` |
| C — Epilogue | `confidence`, `sources`, `expert_review_required`, `done`, `error` |

---

## 3. Database Schema

```mermaid
erDiagram
    users {
        uuid id PK
        string email
        string name
        timestamp created_at
    }
    conversations {
        uuid id PK
        uuid user_id FK
        uuid project_id FK
        timestamp created_at
    }
    messages {
        uuid id PK
        uuid conversation_id FK
        string role
        text content_prose
        jsonb meta_json
        boolean expert_review_required
        timestamp created_at
    }
    message_sources {
        uuid id PK
        uuid message_id FK
        uuid source_id FK
        integer cite_index
    }
    sources {
        uuid id PK
        string org_label
        string type
        string title
        integer year
    }
    source_sections {
        uuid id PK
        uuid source_id FK
        integer section_num
        text text
        vector embedding
    }
    audit_logs {
        uuid id PK
        uuid actor_id FK
        string action
        string resource_type
        uuid resource_id
        uuid conversation_id
        jsonb meta_json
        timestamp created_at
    }

    users ||--o{ conversations : "has"
    conversations ||--o{ messages : "contains"
    messages ||--o{ message_sources : "cites"
    sources ||--o{ source_sections : "has"
    message_sources }o--|| sources : "references"
    users ||--o{ audit_logs : "generates"
```

### Key Constraints

- `audit_logs`: append-only — UPDATE/DELETE/TRUNCATE are blocked at database level
- `source_sections.embedding`: 1536-dimensional vector (OpenAI `text-embedding-3-small`)
- `messages.expert_review_required`: set when confidence < 0.6 or query contains high-risk terms

---

## 4. Corpus Architecture

Six regulatory corpora are indexed in `source_sections`:

| Corpus | Coverage | Chunks (~) |
|--------|----------|-----------|
| FDA | 21 CFR Part 807/820/814, 510(k), PMA, De Novo | 650 |
| EU MDR | Regulation (EU) 2017/745, MDR Annexes | 400 |
| MFDS | Korean medical device regulations | 300 |
| NMPA | China NMPA device registration | 200 |
| PMDA | Japan PMDA approval process | 200 |
| Internal SOP | Company SOPs, policies | 150 |

Retrieval: `hybrid_search` combines pgvector cosine similarity (weight 0.6) and PostgreSQL FTS GIN index (weight 0.4).

---

## 5. Authentication Architecture

```mermaid
graph LR
    User -->|login| AuthJS["Auth.js v5"]
    AuthJS -->|SAML/OIDC| IdP["Identity Provider (SSO)"]
    IdP -->|assertions| AuthJS
    AuthJS -->|session cookie| User
    API["API Routes"] -->|validate session| AuthJS
    AuthJS -->|session data| API
```

All `/api/ra/*` routes require a valid Auth.js session. Unauthenticated requests receive HTTP 401.

---

## 6. Deployment Architecture

```mermaid
graph TD
    GitHub["GitHub (main branch)"]
    Vercel["Vercel (iad1)"]
    Neon["Neon PostgreSQL\n(us-east-1)"]
    CDN["Vercel Edge Network\n(CDN)"]
    Browser["User Browser"]

    GitHub -->|push to main| Vercel
    Vercel -->|serverless functions| Neon
    Vercel -->|static assets| CDN
    CDN --> Browser
    Vercel -->|nodejs runtime\nconsult route| Browser
```

- **Consult route**: `nodejs` runtime (not Edge) — required for pgvector native bindings
- **All other API routes**: default Next.js runtime (30s timeout)
- **Static assets**: served via Vercel Edge CDN globally

---

## 7. Security Architecture

| Layer | Control |
|-------|---------|
| Transport | HTTPS + HSTS (`max-age=31536000; includeSubDomains; preload`) |
| Framing | `X-Frame-Options: DENY` |
| MIME sniffing | `X-Content-Type-Options: nosniff` |
| Auth | Auth.js v5 session (signed JWT, HttpOnly cookies) |
| LLM data | Anthropic ZDR (`anthropic-beta: zero-data-retention`) |
| Error tracking | Sentry `beforeSend` PII redaction (query, user_id, content, email) |
| Secrets | gitleaks CI scan on every push |
| Dependencies | `pnpm audit --audit-level=high` in CI |

For full security documentation, see [`docs/security/`](security/).

---

## 8. Observability

| Tool | Purpose | Data |
|------|---------|------|
| Sentry | Error tracking + performance | Exceptions, slow requests |
| PostHog | Product analytics | User flows, feature usage |
| Langfuse | LLM trace | Token usage, latency, eval scores |
| Vercel Analytics | Core Web Vitals | LCP, INP, CLS |

Observability is strictly separated from `audit_logs` — observability tools never write to the audit table.
