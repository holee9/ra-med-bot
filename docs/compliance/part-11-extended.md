# 21 CFR Part 11 Extended Compliance — Phase 7 Cloudflare Integration

SPEC: SPEC-REGULA-CLOUDFLARE-001
Last Updated: 2026-06-21
Status: Active

This document extends the Phase 1 21 CFR Part 11 compliance baseline with Phase 7 Cloudflare storage and audit controls.

---

## 1. Phase 1 FOUNDATION — Neon Append-Only Trigger

The `audit_logs` table in Neon is protected by an append-only DDL trigger defined in `migrations/0001_audit_append_only.sql`.

The trigger blocks the following operations:

- `UPDATE` on any row in `audit_logs`
- `DELETE` on any row in `audit_logs`
- `TRUNCATE` of the `audit_logs` table

Any attempt to execute these operations raises a PostgreSQL exception with message `"audit_logs is append-only (21 CFR Part 11)"`. This exception propagates to the caller and is logged by the application error handler.

The trigger function is defined at the database level and cannot be disabled by application-layer code. Disabling or dropping the trigger requires direct superuser-level database access, which is restricted to authorized DBAs via Neon's IAM controls.

**Audit action enum**: All valid audit actions are declared as a PostgreSQL `ENUM` type (`audit_action_enum`). The enum prevents insertion of arbitrary action strings.

---

## 2. Phase 7 R2 Compliance Mode — Object Lock

The `regula-audit-cold` R2 bucket enforces 21 CFR Part 11 immutability at the storage layer via Cloudflare R2 Object Lock (Compliance Mode).

Configuration (`wrangler.toml`):

```toml
[[r2_buckets]]
binding = "AUDIT_COLD"
bucket_name = "regula-audit-cold"
```

Bucket settings (applied via Cloudflare dashboard or API):

- Object Lock: **enabled**
- Lock mode: **COMPLIANCE** (cannot be overridden by any user, including bucket owner)
- Default retention: **7 years** from `created_at` timestamp
- Versioning: **enabled** (all buckets)

Under Compliance Mode, objects cannot be deleted or overwritten for the duration of the retention period. This applies even to Cloudflare account owners.

The `regula-corpus-internal` bucket (ISO 13485/14971 internal SOPs) also has Compliance Mode object lock enabled.

---

## 3. Iceberg Checksums — Tamper-Evident Storage

Audit log batches are archived to R2 in JSON format with Iceberg-compatible schema (same columns as the Neon `audit_logs` table, plus `archived_at`).

Each batch is written alongside a SHA-256 checksum file:

- Batch key: `audit-cold/<yearMonth>/<batchId>.json`
- Checksum key: `audit-cold/<yearMonth>/<batchId>.json.sha256`

Tamper detection procedure:

1. Download the batch `.json` file.
2. Compute SHA-256 of the file content.
3. Compare against the stored `.sha256` file.
4. If checksums differ, the batch has been tampered with — escalate immediately.

The checksum is written **after** the batch file and **before** any Neon row deletion. This ordering is enforced in `lib/audit/cold-storage.ts` (`archiveAuditLogs` function). The function never deletes Neon rows until the `.sha256` file is confirmed present in R2 (REQ-CF-048).

---

## 4. 7-Year Retention Enforcement

21 CFR Part 11 requires audit records to be retained for a minimum of 7 years (or the lifetime of the device, whichever is longer).

Enforcement layers:

| Layer | Mechanism | Notes |
|---|---|---|
| Neon (hot storage) | Append-only trigger | No delete possible |
| R2 (cold storage) | Compliance Mode object lock | 7-year retention period |
| Archive script | Checksum verification before deletion | Neon rows kept until R2 confirmed |
| Application | `writeAudit` is the only write path | Enforced by static analysis sweep |

The 7-year retention period is calculated as `created_at + 2557 days` (7 × 365 + 2 leap days). The R2 `retainUntilDate` is set to this value at object creation time via `r2Client.put()` custom metadata.

---

## 5. Audit-of-Audit Meta-Logging (REQ-CF-051)

Every access to cold audit storage (via `lib/audit/cold-query.ts`) generates a meta-audit entry in the primary `audit_logs` table.

The meta-audit entry uses action `audit.cold_query` and includes:

- `dateRange`: the time range queried
- `filterAction`: the action filter applied (if any)
- `filterActorId`: the actor filter applied (if any)
- `actorId`: the identity of the administrator performing the query

This creates a complete audit trail of who accessed historical audit records and when. The meta-audit write is performed **before** any data is returned from R2, ensuring that access is logged even if the query fails or returns empty results.

The `audit.cold_query` action value is added to the `audit_action_enum` in migration `0011_organizations_data_region.sql` (or a subsequent migration).

---

## 6. Electronic Signature Controls — SPEC-REGULA-ESIG-001

Issue #88 / PR #204 adds the Part 11 electronic signature layer on top of the existing append-only audit and retention controls.

### 6.1 Signature Manifestation (§11.50)

Signed answers expose the required manifestation fields through both the API and user-visible output:

- signer name
- signer title
- signing meaning
- signed timestamp
- SHA-256 record hash
- revocation status

Implementation:

- API: `GET /api/ra/messages/[messageId]/signature`
- UI: `components/chat/SignatureManifestation.tsx`
- PDF output: `lib/signature/pdf-inject.ts`

### 6.2 Signature/Record Linking (§11.70)

`lib/signature/hash.ts` canonicalizes answer content as:

- `messages.contentProse`
- ordered `message_blocks` content and block type

The resulting SHA-256 hex digest is persisted as `answer_signatures.record_hash`. This links the signature to the exact answer state that was approved.

### 6.3 Answer Locking

`lib/signature/lock.ts` returns true when an active signature exists. Mutation paths that can change signed answer content must reject edits while locked. The current guards cover:

- answer refine route
- structured block PATCH route

If the active signature is revoked, the answer is unlocked for changes and must be signed again before use as a signed record.

### 6.4 Authorization and RBAC Boundary

Signature endpoints must not load signatures solely by UUID. They first authorize the requested message through `messages -> conversations -> projects` and return `404` for both "not found" and "not allowed" to avoid UUID probing.

Signing and revocation use `signature.sign`:

- `admin`: allowed through hierarchy
- `ra-lead`: allowed through `minRole`
- `qa-lead`: allowed only through `additionalRoles`

`qa-lead` is intentionally below `ra-lead` in the general role hierarchy so it does not inherit unrelated gates such as project management, authoring approval, conversation deletion, or risk approval.

---

## References

- 21 CFR Part 11: https://www.ecfr.gov/current/title-21/chapter-I/subchapter-A/part-11
- Cloudflare R2 Object Lock: https://developers.cloudflare.com/r2/buckets/object-lock/
- Migration files: `migrations/0001_audit_append_only.sql`, `migrations/0011_organizations_data_region.sql`
- Electronic signature migration: `migrations/0061_answer_signatures.sql`
- Implementation: `lib/audit/cold-storage.ts`, `lib/audit/cold-query.ts`, `lib/storage/r2.ts`, `lib/signature/*`
