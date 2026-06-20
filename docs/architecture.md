# Regula — System Architecture

> Version: 1.1.0 | Updated: 2026-06-20

---

## 1. High-Level Overview

Regula is a **regulatory affairs (RA) expert chatbot** for medical device professionals. It combines a **Next.js 15 App Router** frontend with a **RAG (Retrieval-Augmented Generation) pipeline** backed by **Neon PostgreSQL + pgvector**, deployed on **Vercel**.

```mermaid
graph TD
    User["User (Browser)"]
    NextJS["Next.js 15 App Router\n(Vercel iad1)"]
    Auth["Auth.js v5\n(SSO / SAML / OIDC)"]
    ConsultAPI["POST /api/ra/consult\n(nodejs runtime, 60s timeout)"]
    RiskAPI["/api/ra/risk/*\nISO 14971 workflow"]
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
    NextJS --> RiskAPI
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
    RiskAPI --> DB
    RiskAPI --> RAG
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
    workflow_runs {
        uuid id PK
        string workflow_type
        string status
        uuid organization_id FK
        timestamp created_at
    }
    risk_items {
        uuid id PK
        uuid workflow_run_id FK
        text hazard
        text sequence_of_events
        text hazardous_situation
        text harm
        integer severity
        integer probability
        string risk_level
        jsonb citation
    }
    risk_controls {
        uuid id PK
        uuid risk_item_id FK
        string tier
        text description
        boolean is_adopted
        integer residual_severity
        integer residual_probability
        text alarp_justification
    }
    risk_gspr_mappings {
        uuid id PK
        uuid workflow_run_id FK
        string gspr_clause
        text requirement
        text compliance
        text evidence
    }

    users ||--o{ conversations : "has"
    conversations ||--o{ messages : "contains"
    messages ||--o{ message_sources : "cites"
    sources ||--o{ source_sections : "has"
    message_sources }o--|| sources : "references"
    users ||--o{ audit_logs : "generates"
    workflow_runs ||--o{ risk_items : "has"
    risk_items ||--o{ risk_controls : "mitigated_by"
    workflow_runs ||--o{ risk_gspr_mappings : "maps"
```

### Key Constraints

- `audit_logs`: append-only — UPDATE/DELETE/TRUNCATE are blocked at database level
- `source_sections.embedding`: 1536-dimensional vector (OpenAI `text-embedding-3-small`)
- `messages.expert_review_required`: set when confidence < 0.6 or query contains high-risk terms
- `risk_items`: stores ISO 14971 hazard / event sequence / hazardous situation / harm terms with citation metadata
- `risk_controls`: stores ISO 14971 §7.1 control hierarchy and residual risk evaluation
- `risk_gspr_mappings`: maps risk file evidence to EU MDR Annex I GSPR clauses

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

## 6. Risk Management Architecture

The ISO 14971 Risk Management workflow is a regulated workflow surface layered on top of the same Auth.js, Drizzle, audit, and hybrid-ra-saas integration primitives used by the rest of Regula.

```mermaid
sequenceDiagram
    participant U as RA User
    participant UI as /workflows/risk
    participant API as /api/ra/risk/*
    participant RAG as hybrid-ra-saas RAG
    participant Risk as lib/risk/*
    participant DB as PostgreSQL
    participant Lead as RA Lead

    U->>UI: create risk run
    UI->>API: POST /risk/runs
    API->>DB: workflow_runs(workflow_type=risk)
    U->>API: POST /risk/identify
    API->>RAG: hazard identification query
    RAG-->>API: hazards + citations + confidence
    API->>DB: risk_items + audit_logs
    U->>API: POST /risk/items/[id]/evaluate
    API->>Risk: evaluateRiskLevel(severity, probability)
    Risk-->>API: acc / alarp / unacc
    API->>DB: risk item update + risk.matrix_evaluated
    U->>API: POST /risk/controls/recommend
    API->>Risk: control hierarchy validation
    API->>DB: risk_controls
    U->>API: POST /risk/runs/[id]/export
    API->>Risk: buildRiskReport()
    API-->>U: DOCX draft
    Lead->>API: POST /risk/runs/[id]/approve
    API->>DB: risk.report_approved
```

### Risk bounded context

| Layer | Module | Responsibility |
|---|---|---|
| UI | `components/risk/*` | Matrix, hazard table, control wizard, approval gate |
| API | `app/api/ra/risk/*` | Session/RBAC, BFF routing, audit writes |
| Domain | `lib/risk/*` | Matrix classification, residual risk, control hierarchy, report generation |
| Data | `risk_items`, `risk_controls`, `risk_gspr_mappings` | Workflow-scoped risk file records |
| Compliance | `audit_logs`, `risk.approve` | 21 CFR Part 11 traceability and RA-lead approval |

### Risk invariants

- `severity` and `probability` are integer scales from 1 to 5.
- Risk level is one of `acc`, `alarp`, `unacc`.
- `information` tier controls require rationale.
- Residual ALARP decisions require justification.
- Final approval uses server-side `risk.approve` and cannot be granted by RA member roles.

---

## 7. Deployment Architecture

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

## 8. Security Architecture

| Layer | Control |
|-------|---------|
| Transport | HTTPS + HSTS (`max-age=31536000; includeSubDomains; preload`) |
| Framing | `X-Frame-Options: DENY` |
| MIME sniffing | `X-Content-Type-Options: nosniff` |
| Auth | Auth.js v5 session (signed JWT, HttpOnly cookies) |
| RBAC | `withPermission` matrix, including risk.generate/view/update/approve |
| Risk approval | `risk.approve` RA-lead-only final report gate |
| LLM data | Anthropic ZDR (`anthropic-beta: zero-data-retention`) |
| Error tracking | Sentry `beforeSend` PII redaction (query, user_id, content, email) |
| Secrets | gitleaks CI scan on every push |
| Dependencies | `pnpm audit --audit-level=high` in CI |

For full security documentation, see [`docs/security/`](security/).

---

## 9. Observability

| Tool | Purpose | Data |
|------|---------|------|
| Sentry | Error tracking + performance | Exceptions, slow requests |
| PostHog | Product analytics | User flows, feature usage |
| Langfuse | LLM trace | Token usage, latency, eval scores |
| Vercel Analytics | Core Web Vitals | LCP, INP, CLS |

Observability is strictly separated from `audit_logs` — observability tools never write to the audit table.

---

## 10. Codebase Analysis (2026-06-20)

### 9.1 Project Scale

- **TypeScript files**: 400+
- **API routes**: 77+
- **Database tables**: 21+
- **lib modules**: 27
- **components categories**: 11

### 9.2 Module Structure

**12 Core Modules**:
1. `app/(auth)` - Authentication and login pages
2. `app/(app)` - Main application layout and routing
3. `components/shell` - Application shell (Sidebar, Topbar)
4. `components/chat` - Chat components (Composer, AnswerBlock, etc.)
5. `components/views` - Page-specific components
6. `components/primitives` - Basic UI elements
7. `lib/ai` - RAG pipeline and AI logic
8. `lib/db` - Database schema and queries
9. `lib/auth` - Authentication logic
10. `hooks` - Custom React hooks
11. `stores` - Client state management
12. `lib/i18n` - Internationalization

### 9.3 Dependency Breakdown

**Frontend (30+)**:
- Next.js 15, React 18, TypeScript 5.4+
- Radix UI, Tailwind v4, Zustand, TanStack Query v5

**Backend (25+)**:
- Node.js 20+, Drizzle ORM, PostgreSQL 16+pgvector
- Auth.js v5, Zod validation

**AI/ML (20+)**:
- abyz-lab Sonnet 4.5, Haiku 4.5
- LangChain, Cohere Rerank
- OpenAI embedding

**Database (15+)**:
- PostgreSQL 16, pgvector extension
- Full-text search, RLS policies

**Dev Tools (20+)**:
- Biome (lint/format), Vitest (testing)
- Playwright (E2E), Storybook (components)

### 9.4 Key Architecture Decisions

1. **Backend-first implementation** - API → RAG → UI order
2. **Multi-LLM strategy** - Sonnet (inference) + Haiku (classification)
3. **PostgreSQL + pgvector** - ACID transactions + vector search
4. **21 CFR Part 11 audit logging** - Immutable append-only logs, 7-year retention
5. **SSE streaming** - Real-time UI updates with structured data

For detailed codemaps, see:
- `.moai/project/codemaps/overview.md`
- `.moai/project/codemaps/modules.md`
- `.moai/project/codemaps/dependencies.md`
- `.moai/project/codemaps/entry-points.md`
- `.moai/project/codemaps/data-flow.md`
