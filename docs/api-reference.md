# Regula — API Reference

> Version: 1.2.0 | Updated: 2026-06-21
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

## hybrid-ra-saas Outbound Typed Adapter

Regula calls hybrid-ra-saas through the server-only adapter in
`lib/api/hybrid-ra-client.ts`. Do not import this module from client
components because it reads server-side secrets from `lib/env.ts`.

### Configuration

| Variable | Purpose |
|----------|---------|
| `HYBRID_RA_API_BASE_URL` | Base URL for the hybrid-ra-saas API, for example `https://hybrid.example.com` |
| `HYBRID_RA_API_TOKEN` | Bearer token sent as `Authorization: Bearer <token>` |
| `HYBRID_RA_TENANT_ID` | Tenant scope sent as `X-Tenant-Id` |

### Client Methods

Use `createHybridRaClient(timeoutMs?)` for typed calls. The default timeout is
30 seconds.

| Method | Upstream endpoint | Request type | Response type |
|--------|-------------------|--------------|---------------|
| `health()` | `GET /health` | none | `HealthResponse` |
| `syncManifest()` | `GET /sync/manifest` | none | `SyncManifestResponse` |
| `ragQuery(req)` | `POST /rag/query` | `RagQueryRequest` | `RagQueryResponse` |
| `uploadDocument(req)` | `POST /documents/upload` | `DocumentUploadRequest` | `DocumentUploadResponse` |
| `createParseJob(req)` | `POST /parse/jobs` | `ParseJobRequest` | `ParseJobResponse` |
| `runGuardrail(req)` | `POST /guardrail/run` | `GuardrailRunRequest` | `GuardrailRunResponse` |
| `exportAudit(req)` | `POST /audit/export` | `AuditExportRequest` | `AuditExportResponse` |

### Error Classification

`HybridRaClientError` includes `statusCode`, `endpoint`, and `kind`.

| Kind | Trigger |
|------|---------|
| `unconfigured` | missing `HYBRID_RA_API_BASE_URL` or `HYBRID_RA_API_TOKEN` |
| `auth` | upstream `401` or `403` |
| `schema_mismatch` | upstream `422` |
| `server_error` | other non-2xx upstream response |
| `timeout` | request aborted after timeout |
| `network` | fetch throws an unexpected network error |

### Example

```ts
import { createHybridRaClient } from '@/lib/api/hybrid-ra-client';

const hybrid = createHybridRaClient();
const result = await hybrid.ragQuery({
  query: 'FDA 510(k) predicate evidence requirements',
  top_k: 5,
});
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

## ISO 14971 Risk Management API

Risk Management endpoints support SPEC-REGULA-RISK-001. All endpoints require an Auth.js session and RBAC permission through `withPermission`.

### Permissions

| Permission | Minimum role | Scope | Used by |
|---|---|---|---|
| `risk.generate` | `ra-member` | `org` | create runs, identify hazards, recommend controls, export report |
| `risk.view` | `ra-member` | `org` | read run aggregate |
| `risk.update` | `ra-member` | `org` | update/delete risk items, evaluate matrix, adopt controls, map GSPR |
| `risk.approve` | `ra-lead` | `org` | approve final risk report |

### POST /api/ra/risk/runs

Create a risk workflow run.

```http
POST /api/ra/risk/runs
Content-Type: application/json
```

```json
{
  "deviceDescription": "Ambulatory insulin pump with BLE mobile app",
  "deviceClass": "Class II",
  "targetMarkets": ["US", "EU"]
}
```

Success:

```json
{
  "id": "risk-run-001",
  "workflowType": "risk",
  "status": "running"
}
```

Audit: `workflow.start` with `resource_type=risk_run`.

### GET /api/ra/risk/runs/[id]

Load a risk run aggregate including hazard items, controls, and GSPR mappings.

```http
GET /api/ra/risk/runs/risk-run-001
```

Success:

```json
{
  "id": "risk-run-001",
  "items": [],
  "controls": [],
  "gsprMappings": []
}
```

### POST /api/ra/risk/identify

Generate hazard candidates from a device description.

```json
{
  "deviceDescription": "Ventilator with pressure control mode",
  "deviceClass": "Class IIb",
  "workflowRunId": "risk-run-001"
}
```

Each generated item must include ISO 14971 terms:

```json
{
  "items": [
    {
      "hazard": "Excessive airway pressure",
      "sequenceOfEvents": "Pressure sensor drift leads to incorrect pressure control",
      "hazardousSituation": "Patient receives excessive ventilation pressure",
      "harm": "Barotrauma",
      "severity": 4,
      "probability": 2,
      "riskLevel": "alarp",
      "lowConfidence": false,
      "citation": [{ "source": "ISO 14971", "id": "7.1" }]
    }
  ]
}
```

Audit: `risk.hazard_identified`.

### POST /api/ra/risk/items/[id]/evaluate

Evaluate severity/probability against the configured 5×5 risk matrix.

```json
{
  "severity": 5,
  "probability": 4
}
```

Success:

```json
{
  "id": "risk-item-001",
  "severity": 5,
  "probability": 4,
  "riskLevel": "unacc"
}
```

Validation:

- `severity` and `probability` must be integers from 1 to 5.
- Invalid scale values return HTTP 400.

Audit: `risk.matrix_evaluated`.

### PATCH /api/ra/risk/items/[id]

Update a hazard item. Supports user override of generated content.

```json
{
  "hazard": "Incorrect dose delivery",
  "severity": 4,
  "probability": 3,
  "riskLevel": "unacc"
}
```

### DELETE /api/ra/risk/items/[id]

Delete a hazard item.

Audit: `risk.item_deleted`.

### POST /api/ra/risk/controls/recommend

Recommend ISO 14971 §7.1 control measures.

```json
{
  "riskItemId": "risk-item-001"
}
```

Success:

```json
{
  "candidates": [
    {
      "id": "control-001",
      "tier": "inherent",
      "description": "Add dose limit logic in firmware",
      "rationale": null
    },
    {
      "id": "control-002",
      "tier": "protective",
      "description": "Alarm on pressure threshold breach",
      "rationale": null
    },
    {
      "id": "control-003",
      "tier": "information",
      "description": "IFU warning for maximum pressure setting",
      "rationale": "Use only after inherent/protective measures are insufficient"
    }
  ]
}
```

### PATCH /api/ra/risk/controls/[id]

Adopt or update a control measure and optionally evaluate residual risk.

```json
{
  "tier": "information",
  "rationale": "Inherent design and protective alarm are already implemented; IFU warning addresses residual use error.",
  "isAdopted": true,
  "residualSeverity": 3,
  "residualProbability": 2,
  "alarpJustification": "Residual risk is ALARP after alarm and labeling controls."
}
```

Validation:

- `tier=information` requires `rationale`.
- Residual severity/probability must be integers from 1 to 5 when provided.
- ALARP residual risk requires `alarpJustification`.

Audit: `risk.control_adopted`; residual acceptance is recorded when residual risk is accepted.

### POST /api/ra/risk/runs/[id]/gspr

Create EU MDR GSPR mappings for the risk run.

```json
{
  "mappings": [
    {
      "gsprClause": "Annex I, Chapter I, 3",
      "requirement": "Risk management system shall be established and maintained",
      "compliance": "Implemented through ISO 14971 RMF",
      "evidence": "Risk run risk-run-001"
    }
  ]
}
```

Audit: `risk.gspr_mapped`.

### POST /api/ra/risk/runs/[id]/export

Generate an ISO 14971 risk management report.

Response is a DOCX-compatible binary payload when report generation succeeds. Draft reports include pending approval state and draft watermark.

Audit: report generation path records export/generation metadata through the risk workflow audit path.

### POST /api/ra/risk/runs/[id]/approve

Approve a risk management report. Requires `risk.approve` and therefore RA lead or higher.

```json
{
  "comment": "Reviewed and approved for design history file inclusion."
}
```

Success:

```json
{
  "id": "risk-run-001",
  "approved": true,
  "approvedBy": "user-001"
}
```

Audit: `risk.report_approved`.

### Risk API Error Responses

| Status | Body | Description |
|---|---|---|
| 400 | `{ "error": "Invalid severity/probability" }` | Matrix scale outside 1~5 |
| 401 | `{ "error": "Unauthorized" }` | Missing Auth.js session |
| 403 | `{ "error": "Forbidden" }` | User lacks required risk permission |
| 404 | `{ "error": "Not found" }` | Risk run/item/control not found |
| 422 | `{ "error": "Rationale required" }` | Information-for-safety control lacks rationale |
| 500 | `{ "error": "Internal error" }` | Unexpected server failure |

---

## Rate Limiting

| Endpoint | Limit | Window |
|----------|-------|--------|
| `POST /api/ra/consult` | 30 req | 60 seconds |
| `GET /api/ra/sources/*` | 100 req | 60 seconds |
| `GET/POST /api/ra/projects` | 60 req | 60 seconds |
| `/api/ra/risk/*` | inherited app/API limits | deploy behind org-level API/WAF limits |
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

## Electronic Signature API

Electronic signature endpoints implement SPEC-REGULA-ESIG-001 for 21 CFR Part 11 §11.50 and §11.70 controls.

All endpoints require an Auth.js session and message-level authorization. A caller must be able to access the answer through the owning conversation or project; unauthorized message IDs return `404` to avoid UUID probing.

### POST /api/ra/messages/[messageId]/signature

Applies an electronic signature to an answer.

Permission: `signature.sign` (`admin`, `ra-lead`, and signature-specific `qa-lead`).

```http
POST /api/ra/messages/8a8d0f2d-1d6a-4d74-9c4a-3f2b1a64f111/signature
Content-Type: application/json
Authorization: session cookie

{
  "meaning": "Approved for regulatory submission",
  "signerTitle": "QA Lead"
}
```

Response `201 Created`:

```json
{
  "id": "sig-001",
  "messageId": "8a8d0f2d-1d6a-4d74-9c4a-3f2b1a64f111",
  "signerId": "user-001",
  "signerName": "Alice Lead",
  "signerTitle": "QA Lead",
  "meaning": "Approved for regulatory submission",
  "recordHash": "64-char-sha256-hex",
  "signedAt": "2026-06-21T00:00:00.000Z",
  "revokedAt": null,
  "revokedBy": null
}
```

Error behavior:

- `400` invalid JSON or validation failure.
- `401` missing session.
- `403` missing `signature.sign`.
- `404` message not found or not authorized.
- `409 answer_already_signed` when an active signature already exists.

Side effects:

- Computes SHA-256 hash over answer prose and ordered structured blocks.
- Inserts an `answer_signatures` row.
- Writes append-only audit event `signature.applied`.

### GET /api/ra/messages/[messageId]/signature

Returns the active §11.50 signature manifestation for a signed answer.

Permission: `conversation.view` plus message-level authorization.

Response `200 OK`:

```json
{
  "id": "sig-001",
  "signerName": "Alice Lead",
  "signerTitle": "QA Lead",
  "meaning": "Approved for regulatory submission",
  "signedAt": "2026-06-21T00:00:00.000Z",
  "recordHash": "64-char-sha256-hex",
  "isRevoked": false,
  "revokedAt": null
}
```

Error behavior:

- `401` missing session.
- `403` missing `conversation.view`.
- `404` message not found, not authorized, or no active signature exists.

### POST /api/ra/messages/[messageId]/signature/revoke

Revokes the active electronic signature. Revocation unlocks the answer for edits, and the answer must be signed again before it is treated as an active signed record.

Permission: `signature.sign`.

```http
POST /api/ra/messages/8a8d0f2d-1d6a-4d74-9c4a-3f2b1a64f111/signature/revoke
Authorization: session cookie
```

Response `200 OK`: revoked signature row with `revokedAt` and `revokedBy` populated.

Side effects:

- Soft-revokes the active signature.
- Writes append-only audit event `signature.revoked`.

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
