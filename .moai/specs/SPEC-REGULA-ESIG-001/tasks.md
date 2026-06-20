## Task Decomposition
SPEC: SPEC-REGULA-ESIG-001

Methodology: TDD (RED-GREEN-REFACTOR). Each task starts with a failing test.
Signable resource: `messages` (the assistant answer; `content_prose` + ordered `message_blocks`).
RBAC: new `signature.sign` permission, minRole `ra-lead` (admin inherits) with signature-specific `qa-lead` allowlist.

| Task ID | Description | Requirement | Dependencies | Planned Files | Status |
|---------|-------------|-------------|--------------|---------------|--------|
| T-01 | SHA-256 canonical answer hash util (`computeAnswerHash`) over `content_prose` + ordered blocks, using Web Crypto (`globalThis.crypto.subtle`) for Edge compatibility | AC-2, §11.70 | none | `lib/signature/hash.ts`, `lib/signature/__tests__/hash.test.ts` | Complete |
| T-02 | Migration 0061: `ALTER TYPE user_role ADD VALUE 'qa-lead'`; `ALTER TYPE audit_action ADD VALUE 'signature.applied'`, `'signature.revoked'`; `CREATE TABLE answer_signatures` | AC-1,2,6,7 | none | `migrations/0061_answer_signatures.sql` | Complete |
| T-03 | Drizzle schema: `answer_signatures` table + extend `auditActionEnum` + extend `userRoleEnum` with 'qa-lead'; extend `AuditAction` union in `lib/audit.ts`; update UserRole type in auth types | AC-1,2,6,7 | T-02 | `lib/db/schema.ts`, `lib/audit.ts`, `lib/auth/types.ts` | Complete |
| T-04 | RBAC: add `signature.sign` to `PermissionAction` + `PERMISSIONS` (minRole `ra-lead`, additionalRole `qa-lead`, scope `org`, resourceType `signature`); `qa-lead` sits below `ra-lead` in the general hierarchy to avoid inheriting unrelated RA-lead gates | AC-6 | T-03 | `lib/auth/permissions.ts`, `lib/auth/rbac.ts` | Complete |
| T-05 | Lock helper `isAnswerLocked(messageId)` — true when an active (non-revoked) signature exists | AC-3,5 | T-03 | `lib/signature/lock.ts`, `lib/signature/__tests__/lock.test.ts` | Complete |
| T-06 | Signature query helpers: `getActiveSignature`, `insertSignature`, `revokeSignature` (no UPDATE/DELETE on audit; signature table uses soft-revoke columns) | AC-1,2,5 | T-03 | `lib/signature/queries.ts`, `lib/signature/__tests__/queries.test.ts` | Complete |
| T-07 | POST sign route: compute hash, insert signature, `writeAudit('signature.applied')`; reject if already signed (409) | AC-1,2,7 | T-01,04,06 | `app/api/ra/messages/[messageId]/signature/route.ts`, `app/api/ra/messages/[messageId]/signature/__tests__/route.test.ts` | Complete |
| T-08 | GET manifestation route: return signer name/title, timestamp (UTC ISO-8601), meaning, record_hash, revocation_status (§11.50/§11.70 fields) | AC-4,6 | T-06 | (same route file: add GET handler) | Complete |
| T-09 | POST revoke route: requires explicit re-confirmation, `writeAudit('signature.revoked')`, relocks-by-requiring-re-sign | AC-5,7 | T-06 | `app/api/ra/messages/[messageId]/signature/revoke/route.ts`, `.../revoke/__tests__/route.test.ts` | Complete |
| T-10 | Enforce lock (403 `answer_locked`) on existing mutation paths: answer refine route + block PATCH route | AC-3 | T-05 | `app/api/ra/refine/route.ts`, `app/api/ra/messages/[messageId]/blocks/[blockId]/route.ts` | Complete |
| T-11 | UI `SignatureManifestation` component (§11.50 display) + sign/revoke controls; integrate into `AnswerBlock`; print-visible | AC-4 | T-07,08 | `components/chat/SignatureManifestation.tsx`, `components/chat/__tests__/SignatureManifestation.test.tsx`, `components/chat/AnswerBlock.tsx` | Complete |
| T-12 | Inject signature manifestation into PDF export metadata so §11.50(a) appears on printed form | AC-4, §11.50(a) | T-08 | `lib/export/exporters/pdf-exporter.tsx`, `components/chat/AnswerBlock.tsx` (artifact metadata) | Complete |

Notes:
- Max 12 tasks (within budget). T-10 is the single highest-risk task: AC-3 fails if any mutation path is missed.
- All audit writes use existing `writeAudit()` (fail-closed). No new audit entry point.
- `answer_signatures` is NOT append-only at DB level (it needs soft-revoke UPDATE); immutability of the *record link* is guaranteed by the hash, and all sign/revoke events are mirrored into the append-only `audit_logs`.
