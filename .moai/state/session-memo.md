# Session Memo

## 최근 완료 작업 (2026-06-20/21)

### SPEC-REGULA-ESIG-001 (21 CFR Part 11 Electronic Signature) — COMPLETE

- Branch: feat/issue-88 (Issue #88 연결)
- TDD RED-GREEN-REFACTOR 12 tasks 완료
- 전체 테스트: 2745 passed, 0 failed

**생성된 주요 파일:**

- `lib/signature/hash.ts` — sha256OfContent (Edge API)
- `lib/signature/lock.ts` — isAnswerLocked (@MX:ANCHOR)
- `lib/signature/queries.ts` — getActiveSignature, insertSignature, revokeSignature
- `lib/signature/pdf-inject.ts` — §11.50 PDF 서명 블록 주입
- `app/api/ra/messages/[messageId]/signature/route.ts` — POST(sign) / GET(manifestation)
- `app/api/ra/messages/[messageId]/signature/revoke/route.ts` — POST(revoke)
- `components/chat/SignatureManifestation.tsx` — §11.50 UI 컴포넌트
- `lib/db/schema.ts` — answerSignatures 테이블 추가
- `lib/auth/rbac.ts` — qa-lead role 추가
- `lib/auth/permissions.ts` — signature.sign permission 추가
- `lib/audit.ts` — signature.applied / signature.revoked AuditAction 추가

## Active Work — 2026-06-21

- Branch: `feat/issue-88`
- PR: #204 `feat(esig): 21 CFR Part 11 전자 서명 구현 (Issue #88)`
- Issue: #88; duplicate-work prevention checked via Issue #18.
- Main checked: `origin/main` fetched before review-fix work.
- Review fix scope: enforce message ownership/tenant authorization for signature sign/manifest/revoke endpoints; restrict `qa-lead` to `signature.sign` instead of all `ra-lead` gates.

## Documentation Sync — 2026-06-21

- Branch: `codex/docs-esig-20260621`
- Base: `main` at `e51ebc5` after PR #204 merge.
- Work gate: Issue #18 checked; no open PR for duplicate ESIG documentation work.
- Scope: README + implementation status + API/compliance/Part 11 docs + ESIG SPEC status updated to reflect Issue #88 completion and PR #204 review fixes.
