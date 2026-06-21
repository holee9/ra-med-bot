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

## Active Work — 2026-06-21 PR #206 Review Fix

- Branch: `feat/issue-92`
- PR: #206 `feat(audit): 외부 감사관 읽기 전용 페르소나 및 1-클릭 감사 패키지 (Issue #92)`
- Issue: #92; duplicate-work prevention checked via Issue #18.
- Main checked: `origin/main` fetched before review-fix work; only open PR is #206.
- Review fix scope: allow auditor `POST /api/ra/audit-package` through `withPermission`, add persisted `auditor` `user_role`, and ship `audit.access` / `audit.denied` / `audit.package.generated` enum migration.
- Local verification: targeted auditor tests PASS, `pnpm typecheck` PASS, `pnpm lint` PASS, `pnpm ci:migrations` PASS, `pnpm audit:check` PASS, full `pnpm test` PASS (2854 passed / 7 skipped).

## Active Work — 2026-06-21 QA 메타 루프 마무리 + 프로덕션 감사

### 병합된 작업 (main)
- **PR #212** — Gate 1~5 SPEC(#75-79) Draft→Active 승격 + 문서 동기화. Closes #75~#79.

### 진행 중 (오픈 PR)
- **PR #217** `fix/issue-213-gate5-ssot` — Gate 5 SSoT 범위 정합 13→9건 (#213). MERGEABLE.
- **PR #218** `fix/issue-74-gate0-spec` — Gate 0 SPEC Draft→Active (#74). MERGEABLE. **Gate 0~5 패밀리 전체 Active 통일 완료.**

### 프로덕션 준비도 감사로 신규 등록된 gap 이슈
- **#214** 이메일 디스패처 stub (Resend/SendGrid 미연동) — 착수 전 결정: provider 통합(Resend vs SendGrid), API key 프로비저닝 필요
- **#215** 문서 렌더링 placeholder (PCCP/CER/Export-Hub PDF·DOCX) — 착수 전 결정: 렌더링 엔진(react-pdf vs Puppeteer vs docx lib)
- **#216** Inngest 백그라운드 잡 인프라 unwired — 착수 전 결정: Inngest vs Cloudflare Cron(#9 정합) vs QStash
- 기존 추적: #35 (gap-replay stub), #39 (워크플로우 LLM synthetic) — OPEN

### 다음 세션 시작 지점
1. PR #217, #218 병합 → QA Gate 프레임워크 100% 완결
2. #214 이메일: provider 결정 + API key 확보 후 착수 (digest email-sender가 SendGrid 사용 중 → 통합 권장)
3. Tier 2(#215/#216)는 기술 결정 후 착수. Tier 3(#39)는 /moai plan 선후.

## ✅ 완료 — 2026-06-21 QA 메타 루프 완결 (Tier 1)

**main HEAD: `4f17b51`** (모든 CI PASS, 열린 PR 0건, main only)

- ✅ **PR #217** Gate 5 SSoT 정합 #213 — squash merge (`6e117f2`). #213 CLOSED.
  - 리뷰(manager-quality) HIGH fix: qa-matrix §Gate Assignment Summary per-row 정합 (Gate 2: 38→34, Gate 5: 11→9), drift 방지 노트 추가
- ✅ **PR #218** Gate 0 SPEC 승격 #74 — squash merge (`4f17b51`). #74 CLOSED.
  - 리뷰(manager-quality) PASS (LOW fix: AC #6 impact axis SSoT 9축 정합)
  - sync: implementation-status.md "Gate 0-5 SPEC promotion" 행 확장

### 결과: Gate 0~5 SPEC 패밀리 6개 전부 Active 통일 완료
- SPEC-REGULA-QA-{SPEC-READINESS, IMPLEMENTATION-CHECKPOINT, PR-ACCEPTANCE, WAVE-INTEGRATION, DOMAIN-UAT, OPERATIONS}-001 → 모두 Active

### 다음 세션 시작 지점 (Tier 1 잔여 → Tier 2)
1. **#214 이메일 연동** — provider 결정(Resend vs SendGrid, SendGrid 권장) + API key 프로비저닝 후 착수
2. **#215 문서 렌더링** — 엔진 결정(react-pdf vs Puppeteer vs docx lib) 후 착수
3. **#216 Inngest infra** — 잡 인프라 결정(Inngest vs Cloudflare Cron vs QStash) 후 착수
4. **#39 워크플로우 LLM** — /moai plan 으로 SPEC-REGULA-WORKFLOWS-LLM-002 구현 계획 수립 후 착수 (CRITICAL, 대규모)
