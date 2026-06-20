# Regula Electronic Signatures

> Version: 1.0.0 | Updated: 2026-06-21
> Scope: SPEC-REGULA-ESIG-001, Issue #88, PR #204

Regula supports 21 CFR Part 11 electronic signatures for approved answer records. The implementation covers signature capture, signature/record linkage, displayed and printed signature manifestation, revocation, answer locking, RBAC, and audit logging.

## Functional Surface

| Area | Implementation |
|---|---|
| Sign answer | `POST /api/ra/messages/[messageId]/signature` |
| Manifestation lookup | `GET /api/ra/messages/[messageId]/signature` |
| Revoke signature | `POST /api/ra/messages/[messageId]/signature/revoke` |
| Signature table | `answer_signatures` |
| Hashing | `lib/signature/hash.ts` |
| Active lock check | `lib/signature/lock.ts` |
| Query helpers | `lib/signature/queries.ts` |
| Tenant authorization | `lib/signature/authorization.ts` |
| UI manifestation | `components/chat/SignatureManifestation.tsx` |
| PDF manifestation | `lib/signature/pdf-inject.ts` |

## Signature Data Model

`answer_signatures` stores the active and revoked signature records:

- `message_id`
- `signer_id`
- `signer_name`
- `signer_title`
- `meaning`
- `record_hash`
- `signed_at`
- `revoked_at`
- `revoked_by`

Only one active signature may exist for a message. Revocation is a soft-revoke; it preserves the signature row and adds revocation metadata.

## 21 CFR Part 11 Mapping

| Requirement | Control |
|---|---|
| §11.50 signature manifestation | API/UI/PDF expose signer, title, timestamp, meaning, record hash, revocation status |
| §11.70 signature/record linking | SHA-256 hash links the signature to answer prose and ordered blocks |
| §11.10(e) audit trail | `signature.applied` and `signature.revoked` events are written through append-only `writeAudit()` |
| Post-signature integrity | Active signature locks answer refine and block PATCH mutation paths |
| Non-repudiation boundary | Signed record stores signer identity, meaning, timestamp, and record hash |

## Authorization Model

The signature routes are UUID-addressable, so authorization must happen before any signature lookup or mutation. `getAuthorizedSignatureMessage()` joins:

```text
messages -> conversations -> projects
```

The helper returns the message only when the caller is either the conversation owner or belongs to the message project's organization. It returns `null` for both "not found" and "not allowed" to avoid UUID probing.

## RBAC Model

Signing and revocation use `signature.sign`:

| Role | Can sign | Notes |
|---|---:|---|
| `admin` | Yes | Inherits through hierarchy |
| `ra-lead` | Yes | Meets `minRole: 'ra-lead'` |
| `qa-lead` | Yes | Explicitly allowed through `additionalRoles` |
| `ra-member` | No | Can view accessible manifestation through `conversation.view` |
| `viewer` | No | No signing permission |

`qa-lead` is intentionally below `ra-lead` in the general role hierarchy. It does not inherit unrelated gates such as `conversation.delete`, `project.manage`, `authoring.approve`, or `risk.approve`.

## Signing Flow

1. Caller invokes `POST /signature` with `meaning` and optional `signerTitle`.
2. `withPermission('signature.sign')` checks role and organization membership.
3. `getAuthorizedSignatureMessage()` verifies message ownership/tenant scope.
4. Existing active signature check returns `409 answer_already_signed` if present.
5. The route loads ordered `message_blocks`.
6. `computeAnswerHash()` hashes `contentProse` and ordered blocks.
7. `insertSignature()` writes the signature row.
8. `writeAudit()` records `signature.applied`.

## Revocation Flow

1. Caller invokes `POST /signature/revoke`.
2. The same `signature.sign` and message authorization checks run.
3. The active signature is soft-revoked with `revokedAt` and `revokedBy`.
4. `writeAudit()` records `signature.revoked`.
5. The answer becomes editable again and must be re-signed for a new active signed state.

## Mutation Locking

When `isAnswerLocked(messageId)` returns true, answer mutation routes reject changes with:

```json
{ "error": "answer_locked" }
```

The current lock guards cover:

- answer refine route
- structured answer block PATCH route

## Validation Evidence

- Signature/auth targeted tests: 320 tests passed.
- Full local test suite: 2,766 passed / 7 skipped.
- `corepack pnpm typecheck`: pass.
- `corepack pnpm lint`: pass.
- `corepack pnpm ci:rbac`: pass.
- `SKIP_ENV_VALIDATION=1 REGULA_ALLOW_ENV_VALIDATION_SKIP=build corepack pnpm build`: pass.
- PR #204 checks: CI Gates, E2E Smoke, Playwright chromium/firefox/webkit, LLM Eval Harness, Vercel Preview, Security Scan all passed.
- Post-merge main runs: CI, Security Scan, E2E Tests, Deploy all passed.
