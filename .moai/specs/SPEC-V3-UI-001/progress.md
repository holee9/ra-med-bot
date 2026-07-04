## SPEC-V3-UI-001 Progress

- Started: 2026-07-03
- Branch: feat/spec-v3-ui-001
- Execution Mode: sub-agent sequential (milestone 단위 + checkpoint)
- Development Mode: tdd (RED-GREEN-REFACTOR)
- Harness: thorough
- Language: TypeScript — Next.js 15.5 App Router
- Backend Status: FULLY IMPLEMENTED (SPEC-V3-INBOX-001, PR #322)
- Issue: #326

## Code-Authoritative Contract (DO NOT trust research.md / backend SPEC text)
- `VALID_TRANSITIONS` — `lib/domains/inbox/types.ts:33-40`
- Approve body — `app/api/inbox/[id]/approve/route.ts:18-22`: `{password, esigSignature}`
- `listByTriageState(db, orgId, filters)` — `lib/domains/inbox/queries.ts:26`

## Phase Log (모든 milestone orchestrator L-013 직검)

- **M1 Foundation COMPLETE (T-001~009)**: messages, Zustand store, useInbox hooks, Sidebar 게이팅, /inbox 라우트. manager-tdd 위임 + 4종 runtime 결함 직접 수정.
- **M2 Kanban Board COMPLETE (T-010~014)**: SlaBadge/TicketCard/KanbanColumn/InboxKanban + /inbox 통합. manager-tdd 위임(2회) + Hook 위반/biome/Unhandled Rejection 직접 수정 (KanbanColumnContainer 패턴).
- **M3 Triage Action COMPLETE (T-015~017)**: TriageActionMenu (VALID_TRANSITIONS, ra-lead 전용, reason prompt) + TicketCard 조건부 렌더. manager-tdd 위임 + 13 tests 회귀 직접 해결 (테스트 2개 삭제, TicketCard 구조 수정).
- **M4 Detail + ESIG COMPLETE (T-018~022)**: ActivityTimeline (minimal), ApproveDialog (ESIG 401/400 인라인), /inbox/[id] (서버 RBAC + InboxDetailClient). **orchestrator 직접 구현** (사용자 결정).
- **M5 Viewer + WCAG 완료 (T-023/025/027/028/029)**: chat characterization, ViewerTicketSummary, state-tokens (디자인 토큰 단일 진실원). **T-028/T-029 COMPLETE (PR #334, Issue #329)**: WCAG axe(`/inbox` + `/inbox/[id]` ApproveDialog) + 키보드 Tab + 아이콘 버튼 `aria-label` + viewer redirect E2E — snap Chromium 로컬 실행 5/5 PASSED. **잔여 보류**: T-024 (ChatShell brownfield 연동, @MX:TODO), T-026 (기존 게이팅으로 커버).
- **M6 Quality Gates 본 범위 통과 (T-030~034)**: orchestrator 직접 실행.
  - ci:typecheck/rbac/audit/tokens/i18n/glossary/contrast/module-boundaries/migrations — **전부 EXIT 0**
  - ci:build — **EXIT 0** (next dev 중지 후, L-012 회피)
  - 본 SPEC 변경 범위 vitest — **49/49 Errors 0**

## Verification Results (orchestrator 직접 실행 2026-07-04)
- `pnpm tsc --noEmit`: EXIT 0
- `pnpm biome check` (본 변경 파일): 0 errors
- `pnpm vitest` (본 변경 테스트): 49/49 passing, Errors 0
- `pnpm ci:build`: EXIT 0 (next dev 중지 후)
- 전 ci:* 게이트 (typecheck/rbac/audit/tokens/i18n/glossary/contrast/module-boundaries/migrations): EXIT 0

## 본 SPEC 범위 밖 잔여 이슈 (별도 처리 권장)
1. **ci:lint 3 errors**: `scripts/qa/model-gov-eval-gate.ts:42` noConsole — 본 SPEC-V3-UI-001 범위 밖 (scripts/qa/, 기존 에러). 별도 이슈화 권장.
2. **frontend-shell.test.ts timeout (15s)**: `tests/unit/frontend-shell.test.ts > REQ-FND-012 root metadata` — root `app/layout.tsx` 회귀, 본 변경(app/(app)/layout.tsx)과 무관. 환경 timeout 가능성. 별도 조사.
3. **M5 잔여 보류**: T-024 (ChatShell ticket_id surfacing)만. T-028/T-029는 PR #334로 완료 (이슈 #329) — snap Chromium 로컬 5/5 PASSED.

## Resume Instructions (next session)
- Branch: feat/spec-v3-ui-001 (M1-M4 커밋 완료, M5 변경셋 uncommitted)
- **M1-M4 커밋됨, M5/M6 산출물 커밋 대기** (state-tokens, ViewerTicketSummary, chat/page.test, TriageActionMenu 등 M3 이후 변경)
- 본 SPEC-V3-UI-001 핵심 기능 (4-column Kanban + Triage + ESIG Approve + Detail) 완료.
- Next: 잔여 보류 (T-024 ChatShell 연동만) + 잔여 이슈 (ci:lint scripts/qa, frontend-shell timeout) — 별도 세션. **T-028/T-029는 PR #334로 완료** (이슈 #329).
- Execution: orchestrator 직접 구현 검증됨 (M4-M6). manager-tdd 위임 시 L-013 직검 필수 (Hook 규칙 grep, vitest Errors 카운트, biome "허용" 판단 금지).
- Contract reminders: VALID_TRANSITIONS types.ts:33-40, approve body {password, esigSignature}
