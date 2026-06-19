# Regula — API Reference

> Version: 1.0.0 | Updated: 2026-06-19
> Base URL: `https://regula.app/api`

Application endpoints require a valid Auth.js session cookie. Public inbound
webhook endpoints use dedicated shared-secret headers instead of session cookies.
Unauthenticated requests return **401 Unauthorized**.

---

## Authentication

Regula uses Auth.js v5 session-based authentication. Sessions are established via the SSO login flow at `/api/auth/signin`.

```http
Cookie: next-auth.session-token=<signed-jwt>
```

---

## POST /api/ra/consult

Stream a regulatory consultation answer using SSE.

### Request

```http
POST /api/ra/consult
Content-Type: application/json
Authorization: session cookie

{
  "query": "510(k) 제출 요건이 어떻게 되나요?",
  "project_id": "uuid",
  "source_filters": ["fda", "eu-mdr"],
  "locale": "ko"
}
```

**Zod Schema** (`types/consult.ts`):

```typescript
export const ConsultRequestSchema = z.object({
  query: z.string().min(1).max(2000),
  project_id: z.string().uuid(),
  source_filters: z.array(
    z.enum(['fda', 'eu-mdr', 'mfds', 'nmpa', 'pmda', 'internal-sop'])
  ).optional(),
  locale: z.enum(['ko', 'en', 'zh', 'ja']).default('ko'),
})
```

### Response

Server-Sent Events stream. Each event has the form:

```
data: {"type":"<event_type>","payload":{...}}
```

### SSE Event Types

#### `meta`
```json
{
  "type": "meta",
  "payload": {
    "conversation_id": "uuid",
    "message_id": "uuid",
    "model": "claude-sonnet-4-6",
    "intent": "regulation-lookup"
  }
}
```

#### `trace`
```json
{
  "type": "trace",
  "payload": {
    "step": "retrieving",
    "detail": "Searching FDA corpus..."
  }
}
```

#### `prose_delta`
```json
{
  "type": "prose_delta",
  "payload": {
    "delta": "510(k) 제출은 의료기기 시판 전 "
  }
}
```

#### `checklist`
```json
{
  "type": "checklist",
  "payload": {
    "title": "510(k) 제출 요건 체크리스트",
    "items": [
      { "id": "1", "label": "Substantial equivalence 분석", "required": true },
      { "id": "2", "label": "Performance testing data", "required": true }
    ]
  }
}
```

#### `comparison`
```json
{
  "type": "comparison",
  "payload": {
    "title": "FDA vs EU MDR 비교",
    "columns": ["항목", "FDA 510(k)", "EU MDR"],
    "rows": [
      ["제출 방법", "eSTAR 포털", "NB (공인기관)"],
      ["검토 기간", "90일 (SE)", "60-180일"]
    ]
  }
}
```

#### `confidence`
```json
{
  "type": "confidence",
  "payload": {
    "score": 0.87,
    "level": "high",
    "factors": ["citation_coverage", "source_recency"]
  }
}
```

#### `sources`
```json
{
  "type": "sources",
  "payload": {
    "sources": [
      {
        "cite_index": 1,
        "source_id": "uuid",
        "org_label": "FDA",
        "title": "21 CFR Part 807",
        "year": 2024,
        "section": "§807.87"
      }
    ]
  }
}
```

#### `expert_review_required`
```json
{
  "type": "expert_review_required",
  "payload": {
    "reason": "confidence_below_threshold",
    "threshold": 0.6,
    "actual": 0.52
  }
}
```

#### `done`
```json
{
  "type": "done",
  "payload": {
    "message_id": "uuid",
    "tokens_in": 1240,
    "tokens_out": 380
  }
}
```

#### `error`
```json
{
  "type": "error",
  "payload": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Too many requests. Please wait 60 seconds."
  }
}
```

### Error Responses

| Status | Code | Description |
|--------|------|-------------|
| 400 | `INVALID_REQUEST` | Zod validation failed |
| 401 | `UNAUTHORIZED` | No valid session |
| 403 | `FORBIDDEN` | User lacks access to project |
| 429 | `RATE_LIMIT_EXCEEDED` | 30 req/60s limit exceeded |
| 500 | `INTERNAL_ERROR` | Server error (check Sentry) |

### Runtime

```typescript
export const runtime = 'nodejs' // Required for pgvector native bindings
export const maxDuration = 60    // Vercel function timeout (seconds)
```

---

## GET /api/ra/sources/[id]

Retrieve a source document section by ID.

### Request

```http
GET /api/ra/sources/[source_id]?offset=0&limit=50
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `source_id` | UUID | Source document ID |
| `offset` | integer | Section offset (default: 0) |
| `limit` | integer | Sections to return (default: 50, max: 200) |

### Response

```json
{
  "source": {
    "id": "uuid",
    "org_label": "FDA",
    "type": "regulation",
    "title": "21 CFR Part 807",
    "year": 2024,
    "url": "https://www.ecfr.gov/..."
  },
  "sections": [
    {
      "id": "uuid",
      "section_num": 1,
      "anchor": "807.87",
      "text": "Applications for premarket notification..."
    }
  ],
  "total": 42
}
```

---

## GET /api/ra/projects

List accessible projects for the authenticated user.

### Request

```http
GET /api/ra/projects
```

### Response

```json
{
  "projects": [
    {
      "id": "uuid",
      "name": "ABC Device 510(k)",
      "role": "editor",
      "created_at": "2026-01-15T09:00:00Z"
    }
  ]
}
```

---

## POST /api/ra/projects

Create a new project.

### Request

```http
POST /api/ra/projects
Content-Type: application/json

{
  "name": "New Device Project",
  "description": "510(k) submission for XYZ device"
}
```

**Zod Schema:**

```typescript
const CreateProjectSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
})
```

### Response

```json
{
  "project": {
    "id": "uuid",
    "name": "New Device Project",
    "role": "owner",
    "created_at": "2026-05-03T10:00:00Z"
  }
}
```

---

## GET /api/health

System health check endpoint. Does not require authentication.

### Response

```json
{
  "status": "ok",
  "timestamp": "2026-05-03T10:00:00Z",
  "version": "1.0.0"
}
```

---

## Inbound Webhooks

hybrid-ra-saas pushes customer-runtime and cloud-control-plane events into
Regula through public webhook endpoints. These endpoints do not use Auth.js
cookies. They require shared-secret headers configured through environment
variables and compare received secrets with SHA-256 digest normalization plus
`crypto.timingSafeEqual`.

| Endpoint | Auth header | Secret env | Success |
|----------|-------------|------------|---------|
| `POST /api/webhooks/audit` | `X-Regula-API-Key` | `REGULA_API_KEY` | `202 Accepted` |
| `POST /api/webhooks/ifu` | `X-Regula-API-Key` | `REGULA_API_KEY` | `202 Accepted` |
| `POST /api/webhooks/knowledge-sync` | `X-Crawl-Push-Secret` | `CRAWL_PUSH_SECRET` | `200 OK` |

### POST /api/webhooks/audit

```http
POST /api/webhooks/audit
Content-Type: application/json
X-Regula-API-Key: <REGULA_API_KEY>
```

```json
{
  "tenant_id": "tenant-001",
  "event_type": "audit.event.created",
  "product_id": "product-001",
  "data": {
    "actor": "user@example.com",
    "action": "consult.created"
  }
}
```

### POST /api/webhooks/ifu

```http
POST /api/webhooks/ifu
Content-Type: application/json
X-Regula-API-Key: <REGULA_API_KEY>
```

```json
{
  "tenant_id": "tenant-001",
  "job_id": "ifu-job-001",
  "doc_id": "doc-001",
  "doc_type": "ifu",
  "confidence": 0.91,
  "field_candidates": {
    "intended_use": ["Example intended use"]
  },
  "required_missing": []
}
```

### POST /api/webhooks/knowledge-sync

```http
POST /api/webhooks/knowledge-sync
Content-Type: application/json
X-Crawl-Push-Secret: <CRAWL_PUSH_SECRET>
```

```json
{
  "job_id": "crawl-job-001",
  "documents": [
    {
      "id": "doc-001",
      "url": "https://example.com/regulation",
      "hash": "sha256:abc123",
      "source": "fda",
      "content": "Document text..."
    }
  ]
}
```

### Webhook Error Responses

| Status | Body | Description |
|--------|------|-------------|
| 400 | `{ "error": "Invalid JSON" }` | Request body is not valid JSON |
| 400 | `{ "error": "Invalid payload", "issues": [...] }` | JSON parsed, but Zod schema validation failed |
| 401 | `Unauthorized` | Missing, wrong, or unconfigured shared secret |

---

## Rate Limiting

| Endpoint | Limit | Window |
|----------|-------|--------|
| `POST /api/ra/consult` | 30 req | 60 seconds |
| `GET /api/ra/sources/*` | 100 req | 60 seconds |
| `GET/POST /api/ra/projects` | 60 req | 60 seconds |
| `POST /api/webhooks/*` | sender-controlled | deploy behind ingress/WAF limits as needed |
| `GET /api/health` | unlimited | — |

Rate limit responses include:
```http
HTTP/1.1 429 Too Many Requests
Retry-After: 45
X-RateLimit-Limit: 30
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 1746269260
```

---

## Common Error Codes

| Code | HTTP | Description |
|------|------|-------------|
| `UNAUTHORIZED` | 401 | Session missing or expired |
| `FORBIDDEN` | 403 | Insufficient RBAC role |
| `INVALID_REQUEST` | 400 | Zod validation failure (see `details` field) |
| `INVALID_JSON` | 400 | Webhook request body is not valid JSON |
| `NOT_FOUND` | 404 | Resource does not exist |
| `RATE_LIMIT_EXCEEDED` | 429 | Request rate limit exceeded |
| `INTERNAL_ERROR` | 500 | Unexpected server error |
| `LLM_UNAVAILABLE` | 503 | Anthropic API unreachable |
