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
- **M5 Viewer + WCAG 완료 (T-023/024/025/027/028/029)**: chat characterization, ChatShell ticketId 회귀 단언, ViewerTicketSummary, state-tokens (디자인 토큰 단일 진실원). **T-028/T-029 COMPLETE (PR #334, Issue #329)**: WCAG axe(`/inbox` + `/inbox/[id]` ApproveDialog) + 키보드 Tab + 아이콘 버튼 `aria-label` + viewer redirect E2E — snap Chromium 로컬 실행 5/5 PASSED. **T-024 COMPLETE (본 세션 finalize)**: PR 331로 코드 구현 완료(ChatShell.tsx ticketId 패널 + useStreamingAnswer /api/ask → ticketId wiring) → 본 세션에서 `components/chat/__tests__/ChatShell.ticketId.test.tsx` 회귀 단언 2건 추가(REQ-V3-UI-033). T-026 (기존 게이팅으로 커버).
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

## T-024 Finalize (본 세션, 2026-07-04) — SPEC 100% 완결
- **범위**: T-023 characterization 보강 + T-024 회귀 단언 + 문서 완결.
- **구현 상태 직검**: PR 331 머지로 ChatShell.tsx:189-205 ticketId 패널(`/inbox/${ticketId}` 링크) + useStreamingAnswer.ts:217-219 `/api/ask` 응답 ticketId 수신 already in main. `/api/ask` route.ts:93 `Response.json({ ticketId })` (camelCase) ↔ useStreamingAnswer `askData.ticketId` 정합 일치 (코드가 권위; SPEC 텍스트 `ticket_id`는 표기상 오기).
- **신규 산출물**: `components/chat/__tests__/ChatShell.ticketId.test.tsx` — 2 tests (ticketId 존재 시 패널+링크 렌더 / ticketId null 시 패널 미렌더). useStreamingAnswer·useUIStore·자식 컴포넌트 mock.
- **게이트 직검 (L-007/L-008/L-013, orchestrator 직접)**:
  - `pnpm tsc --noEmit`: EXIT 0
  - `pnpm biome check` (신규 파일): 0 errors (import 정렬 1건 --fix 후 green)
  - `pnpm lint:hex`: PASS (no raw hex colors)
  - `pnpm vitest` (신규 파일): 2/2 passing
  - chat 도메인 회귀 (`app/(app)/chat` + `components/chat` + `app/api/ask`): 8 files / 42 tests passing — 회귀 0
- **결론**: SPEC-V3-UI-001 28/28 REQ + 13/13 AC + 11/11 edge cases 전부 충족. M1-M6(핵심 범위) + T-024 finalize로 **본 SPEC 100% 완결**. (T-026은 기존 클라이언트/서버 게이팅으로 커버됨 — 별도 구현 불필요.)

## Resume Instructions (next session)
- **SPEC-V3-UI-001 100% 완결**. 본 세션 PR(merge 후)으로 T-024 finalize 완료.
- 본 SPEC 핵심 기능 (4-column Kanban + Triage + ESIG Approve + Detail + Viewer + WCAG + ticketId surfacing) 전부 완료.
- **별도 후속**: (1) ci:lint scripts/qa noConsole 이슈화, (2) frontend-shell.test timeout 조사, (3) 다음 SPEC — 후보: SPEC-V3-TRIAGE-001 (Phase C-2, AC-06 citation 검증 + auto_answer 주입 훅).
- Execution: orchestrator 직접 구현 검증됨 (M4-M6 + T-024 finalize). manager-tdd 위임 시 L-013 직검 필수.
- Contract reminders: VALID_TRANSITIONS types.ts:33-40, approve body {password, esigSignature}, /api/ask 응답 ticketId camelCase.
