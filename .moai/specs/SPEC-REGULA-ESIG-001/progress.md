## SPEC-REGULA-ESIG-001 Progress

- Started: 2026-06-20
- Completed: 2026-06-20
- Branch: feat/issue-88
- Methodology: TDD (thorough)

### Acceptance criteria tracking
| AC | Description | Status |
|----|-------------|--------|
| AC-1 | Signature captures identity + timestamp + meaning | DONE (T-01~T-03) |
| AC-2 | SHA-256 hash of answer content stored | DONE (T-03: sha256OfContent) |
| AC-3 | Post-signature modification returns 403 | DONE (T-10: isAnswerLocked guard) |
| AC-4 | Manifestation in UI + PDF export | DONE (T-11: SignatureManifestation, T-12: pdf-inject) |
| AC-5 | Revocation requires re-sign + audit + relock | DONE (T-09: /signature/revoke route) |
| AC-6 | Only ra-lead (+qa-lead, admin) can sign | DONE (T-04: signature.sign + qa-lead role) |
| AC-7 | Append-only audit for signature events | DONE (T-01: signature.applied + signature.revoked) |

### Task log
| Task | Description | Status |
|------|-------------|--------|
| T-01 | AuditAction enum: signature.applied + signature.revoked | DONE |
| T-02 | DB schema: answerSignatures table + partial unique index | DONE |
| T-03 | Hash utility: sha256OfContent (Edge-compatible) | DONE |
| T-04 | RBAC: signature.sign permission + qa-lead role | DONE |
| T-05 | Lock check: isAnswerLocked(messageId, db) | DONE |
| T-06 | Queries: getActiveSignature, insertSignature, revokeSignature | DONE |
| T-07 | POST /signature route: sign answer (201/409/403/400/401) | DONE |
| T-08 | GET /signature route: §11.50 manifestation (200/404/401) | DONE |
| T-09 | POST /signature/revoke route: revoke signature | DONE |
| T-10 | Lock guard: blocks PATCH + refine POST return 403 if locked | DONE |
| T-11 | SignatureManifestation UI component | DONE |
| T-12 | PDF injection: §11.50 signature block in exported PDF | DONE |

### Iteration log
- Iteration 1 (2026-06-20): T-01~T-12 완료, AC 7/7 완료. 테스트: 2745 passed, 0 failed.
